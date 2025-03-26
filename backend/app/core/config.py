from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from time import sleep
class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Coding Interviewer"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "8080"))  # Cloud Run uses PORT env variable
    ENVIRONMENT: str = "production"  # Default to production for cloud
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")  # Comma-separated list of origins

    # OpenAI settings
    OPENAI_API_KEY: str
    MODEL_ENDPOINT: str = "https://api.openai.com/v1"  # Default OpenAI endpoint
    MODEL_NAME: str = "gpt-4"  # Default model
    
    # Azure OpenAI settings (optional)
    AZURE_API_VERSION: str | None = None
    AZURE_DEPLOYMENT_NAME: str | None = None
    AZURE_RESOURCE_NAME: str | None = None
    
    # Database settings
    # For cloud, use Cloud SQL or another persistent DB
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./interview.db")
    
    # Vector store settings - in cloud, use a persistent storage
    VECTORSTORE_PATH: str = os.getenv("VECTORSTORE_PATH", "./chroma_db")
    
    # Interview settings
    MAX_INTERVIEW_DURATION: int = 3600  # 1 hour in seconds
    DEFAULT_INTERVIEW_DIFFICULTY: str = "medium"
    
    class Config:
        case_sensitive = True
        env_file = ".env.production"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
