from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.config import settings
from .core.database import init_db
from .routers import interview
from .middleware import SecurityMiddleware
from typing import Optional
import httpx
import logging
import asyncio

# Session cleanup background task
async def cleanup_inactive_sessions():
    """Background task to periodically clean up inactive sessions"""
    from .routers.interview import session_manager
    
    while True:
        try:
            # Clean up sessions inactive for more than 30 minutes
            cleaned_count = session_manager.cleanup_inactive_sessions(max_idle_minutes=30)
            if cleaned_count > 0:
                logging.info(f"Cleaned up {cleaned_count} inactive sessions")
        except Exception as e:
            logging.error(f"Error in session cleanup task: {str(e)}")
        
        # Sleep for 10 minutes
        await asyncio.sleep(600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup and cleanup on shutdown."""
    # Initialize database
    init_db()
    
    # Start background task for session cleanup
    cleanup_task = asyncio.create_task(cleanup_inactive_sessions())
    
    yield
    
    # Cleanup resources if needed
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Configure CORS
allowed_origins = ["https://interviewer.im-brij.com"]
# Add localhost for development environments
if settings.ENVIRONMENT.lower() in ["development", "dev", "local"]:
    allowed_origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Add security middleware
app.add_middleware(SecurityMiddleware)

# Include routers
app.include_router(
    interview.router,
    prefix=f"{settings.API_V1_STR}/interviews",
    tags=["interviews"]
)

# Health check endpoint
@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "healthy"}

# Health check endpoint with custom OpenAI API endpoint
@app.get(f"{settings.API_V1_STR}/health/check-custom-endpoint")
async def check_custom_endpoint(
    custom_endpoint: Optional[str] = None, 
    custom_api_key: Optional[str] = None,
    custom_model_name: Optional[str] = None
):
    """Verify if a custom OpenAI API endpoint and model are valid"""
    try:
        # Filter out empty strings
        custom_endpoint = custom_endpoint if custom_endpoint and custom_endpoint.strip() else None
        custom_api_key = custom_api_key if custom_api_key and custom_api_key.strip() else None
        custom_model_name = custom_model_name if custom_model_name and custom_model_name.strip() else None
        
        # Determine what settings are being used
        using_default_endpoint = not custom_endpoint
        using_default_api_key = not custom_api_key
        using_default_model = not custom_model_name
        
        # Check if we're using all defaults
        all_defaults = using_default_endpoint and using_default_api_key and using_default_model
        
        if all_defaults:
            return {
                "valid": True, 
                "message": "Using default API settings from environment variables",
                "settings": {
                    "endpoint": f"{settings.MODEL_ENDPOINT} (default)",
                    "api_key": "Using environment variable (default)",
                    "model": f"{settings.MODEL_NAME} (default)"
                }
            }
        
        # Use provided endpoint or default
        endpoint = custom_endpoint or settings.MODEL_ENDPOINT
        api_key = custom_api_key or settings.OPENAI_API_KEY
        model_name = custom_model_name or settings.MODEL_NAME
        
        # Create URL for the models endpoint to verify connectivity
        url = f"{endpoint.rstrip('/')}/models"
        
        # Set up headers with API key
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        # Make a request to the models endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=10.0)
            
        if response.status_code == 200:
            # If a custom model is specified, check if it exists in the list of models
            if custom_model_name:
                models_data = response.json()
                model_list = [model.get("id") for model in models_data.get("data", [])]
                
                if not any(custom_model_name in model_id for model_id in model_list):
                    return {
                        "valid": False,
                        "message": f"Model '{custom_model_name}' not found in the available models",
                        "settings": {
                            "endpoint": f"{endpoint}{' (default)' if using_default_endpoint else ' (custom)'}",
                            "api_key": f"{'Using environment variable (default)' if using_default_api_key else 'Using custom API key'}",
                            "model": f"{model_name}{' (default)' if using_default_model else ' (custom)'} - NOT FOUND"
                        }
                    }
            
            return {
                "valid": True, 
                "message": "API settings validated successfully", 
                "settings": {
                    "endpoint": f"{endpoint}{' (default)' if using_default_endpoint else ' (custom)'}",
                    "api_key": f"{'Using environment variable (default)' if using_default_api_key else 'Using custom API key'}",
                    "model": f"{model_name}{' (default)' if using_default_model else ' (custom)'}"
                }
            }
        else:
            return {
                "valid": False, 
                "message": f"API endpoint returned status code {response.status_code}", 
                "details": response.text,
                "settings": {
                    "endpoint": f"{endpoint}{' (default)' if using_default_endpoint else ' (custom)'}",
                    "api_key": f"{'Using environment variable (default)' if using_default_api_key else 'Using custom API key'}",
                    "model": f"{model_name}{' (default)' if using_default_model else ' (custom)'}"
                }
            }
    except Exception as e:
        logging.error(f"Error checking custom endpoint: {str(e)}")
        return {"valid": False, "message": f"Error checking endpoint: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
