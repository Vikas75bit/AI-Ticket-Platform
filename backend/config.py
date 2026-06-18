import os
from pydantic import Field  # Clean V2 core import
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class ProductionSettings(BaseSettings):
    # ─── NATIVE V2 ALIAS ALIGNMENT ───────────────────────────────────────────
    # We define the variable as a Field and pass an explicit validation_alias.
    # It will pull 'SUPABASE_DB_URL' from Railway like an absolute charm.
    DATABASE_URL: str = Field(validation_alias="SUPABASE_DB_URL")
    
    GROQ_API_KEY: str
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis_broker:6379/0")
    ENV: str = "development"
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env" if os.path.exists(".env") else None,
        extra="ignore"
    )

settings = ProductionSettings()
