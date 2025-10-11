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
from app.schemas import AlumnoPerfilOut, AlumnoDetalleOut, InscripcionLiteOut, CicloLiteOut


# ✅ Routers (importa cada router con alias .router)
from .routers.admin import router as admin_router
from .routers.coordinacion_docentes import router as coordinacion_docentes_router
from .routers.coordinacion_ciclos import router as coordinacion_ciclos_router
from .routers.alumno_ciclos import router as alumno_ciclos_router
from .routers.alumno_inscripciones import router as alumno_inscripciones_router
from .routers.coordinacion_inscripciones import router as coordinacion_inscripciones_router  # 👈 NUEVO
from .routers.docente_grupos import router as docente_grupos_router
from .routers.docente_asistencia import router as docente_asistencia_router
from .routers.docente_evaluaciones import router as docente_evaluaciones_router  # 👈 nuevo
from .routers.alumno_historial import router as alumno_historial_router
from .routers.public_ciclos import router as public_ciclos_router
from .routers import placement
from .routers.placement_admin import router as placement_admin_router  # 👈 NUEVO
from app.routers import placement_teacher  # ⬅️ importa
from .routers.coordinacion_encuestas import router as coordinacion_encuestas_router
from .routers.alumno_encuestas import router as alumno_encuestas_router  # 👈 NUEVO
from app.routers import coordinacion_reportes
from app.routers import public_examenes
from .routers.alumno_perfil import router as alumno_perfil_router
from app.routers import coordinacion_alumnos
from .routers import docente_reportes  # 👈 importa el router nuevo
from .routers import coordinacion_dashboard
from app.routers import coordinacion_perfil
from app.routers import docente_perfil
from app.routers import auth_password_reset







Base.metadata.create_all(bind=engine)

app = FastAPI(title="CELEX API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Monta routers
app.include_router(admin_router)
app.include_router(coordinacion_docentes_router)
app.include_router(coordinacion_ciclos_router)
app.include_router(alumno_ciclos_router)
app.include_router(alumno_inscripciones_router)
app.include_router(coordinacion_inscripciones_router)  # 👈 NUEVO
app.include_router(docente_grupos_router)
app.include_router(docente_asistencia_router)
app.include_router(docente_evaluaciones_router)  # 👈 monta endpoints
app.include_router(alumno_historial_router)  # ✅
app.include_router(public_ciclos_router)
app.include_router(placement.router)
app.include_router(placement_admin_router)  # 👈 NUEVO
app.include_router(placement_teacher.router)
app.include_router(coordinacion_encuestas_router)
app.include_router(alumno_encuestas_router)   # 👈 NUEVO
app.include_router(coordinacion_reportes.router)
app.include_router(public_examenes.router)
app.include_router(alumno_perfil_router)
app.include_router(coordinacion_alumnos.router)
app.include_router(docente_reportes.router)  # 👈 monta endpoints del docente
app.include_router(coordinacion_dashboard.router)
app.include_router(coordinacion_perfil.router)
app.include_router(docente_perfil.router)
app.include_router(auth_password_reset.router)





# 👇 añade este hook de startup
@app.on_event("startup")
def _create_db_if_needed():
    # Sólo para desarrollo: crea todas las tablas si no existen
    Base.metadata.create_all(bind=engine)

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

    # 👇 JWT payload completo con is_ipn y boleta como strings planas
    claims = {
        "sub": user.email,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "is_ipn": bool(user.is_ipn),
        "boleta": user.boleta or None,
    }

    token = create_access_token(claims)

    return TokenResponse(
        access_token=token,
        role=claims["role"],
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        curp=user.curp,
        is_ipn=claims["is_ipn"],
        boleta=user.boleta,
    )


@app.get("/health")
def health():
    return {"ok": True}


