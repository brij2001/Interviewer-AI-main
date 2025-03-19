from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Coding Interviewer"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str ="http://localhost:3000"

    # OpenAI settings
    OPENAI_API_KEY: str
    MODEL_ENDPOINT: str = "https://api.openai.com/v1"  # Default OpenAI endpoint
    MODEL_NAME: str = "gpt-4"  # Default model
    
    # Azure OpenAI settings (optional)
    AZURE_API_VERSION: str | None = None
    AZURE_DEPLOYMENT_NAME: str | None = None
    AZURE_RESOURCE_NAME: str | None = None
    
    # Database settings
    DATABASE_URL: str = "sqlite:///./interview.db"
    
    # Vector store settings
    VECTORSTORE_PATH: str = "./chroma_db"
    
    # Interview settings
    MAX_INTERVIEW_DURATION: int = 3600  # 1 hour in seconds
    DEFAULT_INTERVIEW_DIFFICULTY: str = "medium"
    
    class Config:
        case_sensitive = True
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
