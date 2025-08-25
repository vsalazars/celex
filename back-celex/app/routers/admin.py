# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import or_
import secrets, string
from pydantic import BaseModel, EmailStr, field_validator

from ..auth import get_db, require_superuser, get_password_hash
from ..models import User, UserRole
from ..schemas import UserOut, CoordinatorListResponse, ToggleActiveRequest
from ..email_utils import send_email

router = APIRouter(prefix="/admin", tags=["admin"])

CURP_REGEX = r"^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$"


class AdminCreateCoordinator(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    curp: str

    @field_validator("first_name", "last_name")
    @classmethod
    def must_have_text(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 2:
            raise ValueError("Debe tener al menos 2 caracteres")
        return v

    @field_validator("curp")
    @classmethod
    def valid_curp(cls, v: str) -> str:
        v = (v or "").strip().upper()
        import re
        if not re.match(CURP_REGEX, v, flags=re.IGNORECASE):
            raise ValueError("CURP inválido (formato de 18 caracteres)")
        return v


def _gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/coordinators", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_coordinator(
    payload: AdminCreateCoordinator,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    email_norm = payload.email.lower().strip()
    curp_upper = payload.curp.upper().strip()

    # Unicidad
    if db.query(User).filter(User.email == email_norm).first():
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo electrónico")
    if db.query(User).filter(User.curp == curp_upper).first():
        raise HTTPException(status_code=400, detail="Ya existe un usuario con esa CURP")

    # Contraseña temporal
    temp_password = _gen_password(12)

    # Crear coordinador (is_ipn False, boleta None)
    user = User(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email_norm,
        email_verified=True,
        hashed_password=get_password_hash(temp_password),
        is_ipn=False,
        boleta=None,
        curp=curp_upper,
        role=UserRole.coordinator,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Enviar correo (si SMTP está configurado)
    html = f"""
    <h3>Bienvenido(a) al CELEX</h3>
    <p>Se creó una cuenta de Coordinación con este correo.</p>
    <p><b>Usuario:</b> {email_norm}<br/>
       <b>Contraseña temporal:</b> {temp_password}</p>
    <p>Inicia sesión y cambia tu contraseña de inmediato.</p>
    """
    send_email(email_norm, "Tu cuenta de Coordinación CELEX", html)  # no bloquea si falla

    return user


@router.get("/coordinators", response_model=CoordinatorListResponse)
def list_coordinators(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, description="Búsqueda por nombre, email o CURP"),
):
    """
    Lista coordinadores con paginación.
    - page: número de página (1-based)
    - page_size: tamaño de página (1..100)
    - q: texto de búsqueda (nombre, apellido, email, curp)
    Orden: más recientes primero (created_at DESC)
    """
    base = db.query(User).filter(User.role == UserRole.coordinator)

    if q:
        like = f"%{q.strip()}%"
        base = base.filter(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.email.ilike(like),
                User.curp.ilike(like),
            )
        )

    total = base.count()
    pages = (total + page_size - 1) // page_size if total else 1
    if page > pages and total > 0:
        page = pages  # ajusta si te piden una página más allá del final

    items = (
        base.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return CoordinatorListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.patch("/coordinators/{user_id}/status", response_model=UserOut)
def toggle_coordinator_status(
    user_id: int = Path(..., ge=1),
    payload: ToggleActiveRequest = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """
    Habilitar/Deshabilitar coordinador (is_active True/False)
    """
    user: User | None = db.query(User).filter(
        User.id == user_id, User.role == UserRole.coordinator
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Coordinador no encontrado")

    user.is_active = bool(payload.is_active)
    db.commit()
    db.refresh(user)
    return user
