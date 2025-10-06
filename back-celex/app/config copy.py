# app/config.py
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "dev"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # CORS
    CORS_ORIGINS: List[str] | str = []

    # SMTP / Titan
    SMTP_HOST: str = "smtp.titan.email"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    FROM_EMAIL: str = ""
    SMTP_USE_SSL: bool = True      # True => SMTP_SSL:465; False => STARTTLS:587
    SMTP_DEBUG: bool = False       # True para ver diálogo SMTP

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list) and self.CORS_ORIGINS:
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str) and self.CORS_ORIGINS.strip():
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

settings = Settings()
