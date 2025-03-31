from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.config import settings
from .core.database import init_db
from .routers import interview
from .middleware import SecurityMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup and cleanup on shutdown."""
    # Initialize database
    init_db()
    yield
    # Cleanup resources if needed

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

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
