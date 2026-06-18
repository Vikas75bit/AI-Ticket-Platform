import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class ProductionSettings(BaseSettings):
    # Enforce schema validation on critical variables
    DATABASE_URL: str
    GROQ_API_KEY: str
    REDIS_URL: str = "redis://localhost:6373/0"
    
    # ENVIRONMENT STATE: Default to development, switch to production in cloud
    ENV: str = "development"
    
    # HARDENED CORS ORIGINS: Allowed clients list
    # In development, it allows localhost. In production, we pass the real URL.
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",  # Standard Vite React local address
        "http://localhost:3000"
    ]

    # Automatically parse .env files if present during local testing
    model_config = SettingsConfigDict(
        env_file=".env" if os.path.exists(".env") else None,
        extra="ignore"
    )

# Instantiate a global singleton configuration object
settings = ProductionSettings()
