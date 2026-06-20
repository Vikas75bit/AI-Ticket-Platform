import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class ProductionSettings(BaseSettings):
    # Standard lowercase Python attributes
    DATABASE_URL: str = Field(validation_alias="SUPABASE_DB_URL")
    GROQ_API_KEY: str
    REDIS_URL: str = "redis://redis_broker:6379/0"
    ENV: str = "development"
    
    ALLOWED_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ai-ticket-platform.vercel.app",
    ] 

    # ─── HARDENED V2 CONFIGURATION ───────────────────────────────────────────
    # case_sensitive=False tells Pydantic to map uppercase cloud keys (like GROQ_API_KEY or ENV)
    # straight to our clean lowercase class attributes smoothly.
    model_config = SettingsConfigDict(
        env_file=".env" if os.path.exists(".env") else None,
        extra="ignore",
        case_sensitive=False
    )



# (At the very bottom of config.py)
settings = ProductionSettings()

# ─── THE BULLETPROOF SANITIZER ──────────────────────────────────────────
# This violently strips any invisible spaces or newlines that accidentally 
# get pasted into the Railway environment variables dashboard.
settings.DATABASE_URL = settings.DATABASE_URL.strip()
