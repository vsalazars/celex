# app/routers/coordinacion_docentes.py
from typing import Optional, List, Literal, Union
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, EmailStr, Field, field_validator

from ..auth import get_db, require_coordinator_or_admin, get_password_hash
from ..models import User, UserRole
from ..email_utils import send_email
import secrets, string
import re

router = APIRouter(prefix="/coordinacion/docentes", tags=["coordinación-docentes"])

# ======= Helpers/const =======
CURP_REGEX = r"^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$"

def _gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

def compute_status(user: User) -> Literal["activo", "suspendido"]:
    """
    Estado para el front:
    - 'activo'     si is_active=True
    - 'suspendido' si is_active=False
    (Ignoramos email_verified para que siempre aparezca ACTIVO al crearse)
    """
    return "activo" if user.is_active else "suspendido"

# ======= Schemas locales (salida mínima para el front) =======
class TeacherOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    curp: str
    status: Literal["activo","suspendido"]

class Paginated(BaseModel):
    items: List[TeacherOut]
    total: int
    page: int
    page_size: int

class TeacherInviteIn(BaseModel):
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)
    email: EmailStr
    curp: str

    @field_validator("curp")
    @classmethod
    def valid_curp(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if not re.fullmatch(CURP_REGEX, v, flags=re.IGNORECASE):
            raise ValueError("CURP inválida (formato de 18 caracteres)")
        return v

# ======= Rutas =======

@router.get("", response_model=Union[List[TeacherOut], Paginated])
def list_docentes(
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinator_or_admin),
    q: Optional[str] = Query(None, description="Buscar por nombre, correo o CURP"),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=200),
):
    base = db.query(User).filter(User.role == UserRole.teacher)

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

    base = base.order_by(User.created_at.desc())

    if not page or not page_size:
        users = base.all()
        return [
            TeacherOut(
                id=u.id,
                first_name=u.first_name,
                last_name=u.last_name,
                email=u.email,
                curp=u.curp,
                status=compute_status(u),
            )
            for u in users
        ]

    total = base.count()
    users = base.offset((page - 1) * page_size).limit(page_size).all()
    return Paginated(
        items=[
            TeacherOut(
                id=u.id,
                first_name=u.first_name,
                last_name=u.last_name,
                email=u.email,
                curp=u.curp,
                status=compute_status(u),
            )
            for u in users
        ],
        total=total,
        page=page,
        page_size=page_size,
    )

@router.post("/invite", response_model=TeacherOut, status_code=status.HTTP_201_CREATED)
def invite_docente(
    payload: TeacherInviteIn,
    background: BackgroundTasks,            # ← envío en background
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinator_or_admin),
):
    email_norm = payload.email.lower().strip()
    curp_upper = payload.curp.upper().strip()

    # Unicidad
    if db.query(User).filter(User.email == email_norm).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    if db.query(User).filter(User.curp == curp_upper).first():
        raise HTTPException(status_code=400, detail="La CURP ya está registrada")

    # Contraseña temporal + usuario teacher
    temp_password = _gen_password(12)
    user = User(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email_norm,
        email_verified=True,                # ✅ creado como verificado
        hashed_password=get_password_hash(temp_password),
        is_ipn=False,
        boleta=None,
        curp=curp_upper,
        role=UserRole.teacher,
        is_active=True,                     # ✅ creado como activo
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # ===== Email HTML (IPN guinda) =====
    html = f"""
    <!-- Preheader (oculto) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Alta de Docente CELEX — credenciales temporales e instrucciones.
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
            Alta de Docente CELEX
          </h1>

          <p style="margin:0 0 16px 0; font-size:15px; color:#444;">
            Se creó una cuenta de docente asociada a este correo.
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
            Si necesitas ayuda, contacta a la coordinación.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f3f3f3; padding:14px 18px; text-align:center; font-size:11px; color:#666;">
          © 2025 CELEX CECyT 15 — IPN
        </div>
      </div>
    </div>
    """

    # 👇 Enviar en segundo plano (usa Resend si hay API key; si no, SMTP)
    background.add_task(send_email, email_norm, "Tu cuenta de Docente CELEX", html, None)

    return TeacherOut(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        curp=user.curp,
        status=compute_status(user),
    )

@router.post("/{teacher_id}/suspend", status_code=status.HTTP_204_NO_CONTENT)
def suspend_docente(
    teacher_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinator_or_admin),
):
    user: User | None = db.query(User).filter(
        User.id == teacher_id, User.role == UserRole.teacher
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    user.is_active = False
    db.commit()
    return

@router.post("/{teacher_id}/activate", status_code=status.HTTP_204_NO_CONTENT)
def activate_docente(
    teacher_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinator_or_admin),
):
    user: User | None = db.query(User).filter(
        User.id == teacher_id, User.role == UserRole.teacher
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    user.is_active = True
    db.commit()
    return
