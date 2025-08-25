# app/auth.py
from datetime import datetime, timedelta, timezone
import os
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

# FastAPI / deps
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# DB y modelos
from .database import SessionLocal
from .models import User, UserRole

# === Config ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Puedes mantener env vars o, si prefieres, importar de config.py:
# from .config import settings
# SECRET_KEY = settings.SECRET_KEY
# ALGORITHM = settings.ALGORITHM
# ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

SECRET_KEY = os.getenv("SECRET_KEY", "dev")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# === Password hashing ===
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# === JWT helpers ===
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# === DB dependency ===
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# === Auth dependencies ===
def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise cred_exc
    return user

def require_superuser(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.superuser:
        raise HTTPException(status_code=403, detail="Requiere superuser")
    return current_user

# ✅ NUEVO: coordinador o superuser
def require_coordinator_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.coordinator, UserRole.superuser):
        raise HTTPException(status_code=403, detail="Permisos insuficientes (coordinador o superuser)")
    return current_user
