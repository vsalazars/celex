# app/config.py
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # --- Core ---
    DATABASE_URL: str
    SECRET_KEY: str = "dev"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # --- Public base URL (para enlaces en correos, e.g. reset-password) ---
    # Ejemplo: https://celex.upiita.mx
    PUBLIC_BASE_URL: Optional[str] = None

    # --- CORS ---
    CORS_ORIGINS: List[str] | str = []

    # --- Mailjet (API HTTPS 443, no SMTP) ---
    MAILJET_API_KEY: Optional[str] = None
    MAILJET_API_SECRET: Optional[str] = None
    FROM_EMAIL: Optional[str] = "celex@upiita.mx"
    FROM_NAME: str = "CELEX CECyT 15 Diódoro Antúnez Echegaray"
    REPLY_TO_EMAIL: Optional[str] = None  # si quieres reply-to distinto

    # --- Config general ---
    DEBUG: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        """Devuelve lista usable por FastAPI para CORS."""
        if isinstance(self.CORS_ORIGINS, list) and self.CORS_ORIGINS:
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str) and self.CORS_ORIGINS.strip():
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

settings = Settings()
