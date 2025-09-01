# app/main.py
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from .models import User, UserRole as ModelUserRole
from .schemas import UserCreate, UserOut, LoginRequest, TokenResponse, UserRole
from .auth import get_password_hash, verify_password, create_access_token

# ✅ Routers (importa cada router con alias .router)
from .routers.admin import router as admin_router
from .routers.coordinacion_docentes import router as coordinacion_docentes_router
from .routers.coordinacion_ciclos import router as coordinacion_ciclos_router
from .routers.alumno_ciclos import router as alumno_ciclos_router
from .routers.alumno_inscripciones import router as alumno_inscripciones_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CELEX API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # incluye Authorization
)

# Monta routers
app.include_router(admin_router)
app.include_router(coordinacion_docentes_router)
app.include_router(coordinacion_ciclos_router)
app.include_router(alumno_ciclos_router)
app.include_router(alumno_inscripciones_router)

@app.post("/auth/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if payload.password != payload.password_confirm:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")

    if payload.is_ipn:
        if not payload.boleta or not payload.boleta.isdigit() or len(payload.boleta) != 10:
            raise HTTPException(status_code=400, detail="Boleta inválida (10 dígitos)")

    exists_email = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if exists_email:
        raise HTTPException(status_code=409, detail="El correo ya está registrado")

    exists_curp = db.query(User).filter(User.curp == payload.curp.upper().strip()).first()
    if exists_curp:
        raise HTTPException(status_code=409, detail="La CURP ya está registrada")

    user = User(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=payload.email.lower().strip(),
        is_ipn=payload.is_ipn,
        boleta=payload.boleta.strip() if payload.boleta else None,
        curp=payload.curp.upper().strip(),
        role=ModelUserRole.student,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user: User | None = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    token = create_access_token({"sub": user.email, "email": user.email, "role": user.role})
    return TokenResponse(
        access_token=token,
        role=user.role,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        curp=user.curp,
        is_ipn=bool(user.is_ipn),
        boleta=user.boleta,
    )

@app.get("/health")
def health():
    return {"ok": True}

