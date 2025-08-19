from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "dev"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # Puede definirse como lista en .env: CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
    # o como string separado por comas: CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
    CORS_ORIGINS: List[str] | str = []

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> List[str]:
        # Si viene como lista (pydantic la parsea), úsala
        if isinstance(self.CORS_ORIGINS, list) and self.CORS_ORIGINS:
            return self.CORS_ORIGINS
        # Si viene como string con comas
        if isinstance(self.CORS_ORIGINS, str) and self.CORS_ORIGINS.strip():
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        # Fallback sensato para dev
        return ["http://localhost:3000", "http://127.0.0.1:3000"]


settings = Settings()
