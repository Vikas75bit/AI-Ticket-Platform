import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class ProductionSettings(BaseSettings):
    # Keep these as clean, pure Python type annotations
    DATABASE_URL: str
    GROQ_API_KEY: str
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis_broker:6379/0")
    ENV: str = "development"
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000"
    ]

    # ─── HARDENED ALIAS INJECTION METRIC ─────────────────────────────────────
    # Instead of inline Fields, we tell Pydantic V2 globally to treat 
    # 'SUPABASE_DB_URL' as an absolute direct alias for 'DATABASE_URL'.
    model_config = SettingsConfigDict(
        env_file=".env" if os.path.exists(".env") else None,
        extra="ignore",
        fields={
            'DATABASE_URL': {
                'validation_alias': 'SUPABASE_DB_URL'
            }
        }
    )

settings = ProductionSettings()
