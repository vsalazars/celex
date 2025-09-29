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
        # Enviar correo (mejor formato guinda IPN para coordinadores)
    html = f"""
    <!-- Preheader (oculto) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Alta de Coordinador CELEX — credenciales temporales e instrucciones.
    </div>

    <div style="font-family: Arial, Helvetica, sans-serif; background-color:#f6f6f6; padding:24px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e6e6e6; border-radius:10px; overflow:hidden;">

        <!-- Header guinda -->
        <div style="background:#7A003C; padding:18px 24px; text-align:center;">
          <div style="font-size:20px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">
            CELEX CECyT 15 “Diódoro Antúnez Echegaray”
          </div>
          <div style="font-size:12px; color:#f3e6ee; margin-top:2px;">
            Instituto Politécnico Nacional
          </div>
        </div>

        <!-- Contenido -->
        <div style="padding:24px;">
          <h1 style="margin:0 0 12px 0; font-size:20px; line-height:1.3; color:#222;">
            Alta de Coordinador CELEX
          </h1>

          <p style="margin:0 0 16px 0; font-size:15px; color:#444;">
            Se creó una cuenta de <b>Coordinación</b> asociada a este correo.
          </p>

          <!-- Credenciales -->
          <div style="border:1px solid #ececec; border-radius:8px; overflow:hidden; margin:18px 0;">
            <div style="background:#faf7f9; padding:10px 14px; font-weight:600; color:#7A003C;">
              Credenciales de acceso al sistema
            </div>
            <div style="padding:14px;">
              <table role="presentation" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0; width:34%; color:#555; font-weight:600;">Usuario</td>
                  <td style="padding:8px 0; color:#222;">{email_norm}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0; color:#555; font-weight:600;">Contraseña temporal</td>
                  <td style="padding:8px 0; color:#111;">
                    <span style="display:inline-block; padding:6px 10px; border:1px dashed #c9a2b4; border-radius:6px; font-family:Consolas, Menlo, monospace; font-size:16px;">
                      {temp_password}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
          </div>

         
          <!-- Avisos -->
          <div style="background:#fff8f0; border:1px solid #f1d2b6; border-radius:8px; padding:12px 14px; color:#7a4b00; font-size:13px;">
            <strong>Importante:</strong> Inicia sesión lo antes posible y cambia tu contraseña de inmediato.
          </div>

          <!-- Soporte / firma -->
          <p style="margin:18px 0 0 0; font-size:12px; color:#666; line-height:1.5;">
            Este correo fue generado automáticamente; por favor no respondas a esta dirección.
            Si necesitas ayuda, contacta a la administración de CELEX.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f3f3f3; padding:14px 18px; text-align:center; font-size:11px; color:#666;">
          © 2025 CELEX CECyT 15 — IPN
        </div>

      </div>
    </div>
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
