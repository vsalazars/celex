# app/routers/auth_password_reset.py
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, update, delete
from datetime import datetime, timedelta, timezone
import secrets, hashlib

from app.database import get_db
from app.models import User, PasswordResetToken
from app.email_utils import send_email
from app.config import settings
from app.auth import get_password_hash

# DEBUG: ver qué archivo se carga realmente
print("[auth_password_reset] loaded from:", __file__)

router = APIRouter(prefix="/auth", tags=["Auth"])

RESET_EXP_MINUTES = 30  # token válido 30 min


# --- Schemas (usa los tuyos si ya existen) ---
try:
    # Si ya tienes estos modelos en app.schemas, usa esos
    from app.schemas import ForgotPasswordIn, ResetPasswordIn  # type: ignore
except Exception:
    # Fallback minimalista si no se pueden importar
    from pydantic import BaseModel, Field

    class ForgotPasswordIn(BaseModel):
        email: str = Field(..., min_length=3)

    class ResetPasswordIn(BaseModel):
        token: str = Field(..., min_length=1)
        new_password: str = Field(..., min_length=8)
        confirm_new_password: str = Field(..., min_length=8)


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _build_reset_link(raw_token: str, request: Request) -> str:
    """
    Construye el link de reset usando:
    1) settings.PUBLIC_BASE_URL si existe
    2) Si no, usa Origin o Host del request como fallback
    """
    base = getattr(settings, "PUBLIC_BASE_URL", None)
    if not base or not str(base).strip():
        origin = request.headers.get("origin")
        host = request.headers.get("host")
        scheme = request.url.scheme or "http"
        if origin:
            base = origin
        elif host:
            base = f"{scheme}://{host}"
        else:
            base = "http://localhost:3000"
    base = str(base).rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


@router.post("/password/forgot", status_code=200)
def request_password_reset(payload: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    # Siempre 200 para evitar enumeración de usuarios
    user = db.execute(
        select(User).where(User.email == payload.email.lower().strip())
    ).scalar_one_or_none()

    if not user or not user.is_active:
        return {"detail": "Si el correo existe, enviaremos instrucciones de recuperación."}

    # Generar token crudo y hash
    raw = secrets.token_urlsafe(48)
    token_hash = _sha256_hex(raw)

    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=RESET_EXP_MINUTES)

    # Invalidar tokens previos
    db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.purpose == "password_reset",
        )
    )

    # Guardar nuevo
    prt = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=exp,
        request_ip=request.client.host if request.client else None,
        request_ua=request.headers.get("user-agent"),
        purpose="password_reset",
    )
    db.add(prt)
    db.commit()

    # Email — formato IPN guinda con CTA (conservado)
    link = _build_reset_link(raw, request)
    subject = f"Restablecimiento de contraseña — CELEX (expira en {RESET_EXP_MINUTES} min)"

    first_name = (user.first_name or "alumno").strip()
    current_year = datetime.now().year

    body_html = f"""
    <!-- Preheader (oculto) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Restablece tu contraseña de CELEX — enlace válido por {RESET_EXP_MINUTES} minutos.
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
            Restablecer contraseña
          </h1>

          <p style="margin:0 0 16px 0; font-size:15px; color:#444;">
            Hola {first_name},
          </p>

          <p style="margin:0 0 16px 0; font-size:15px; color:#444;">
            Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón para continuar.
          </p>

          <!-- Botón (tabla para compatibilidad) -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
            <tr>
              <td align="center" bgcolor="#7A003C" style="border-radius:8px;">
                <a href="{link}"
                   style="display:inline-block; padding:12px 22px; font-size:16px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:8px;">
                  Restablecer contraseña
                </a>
              </td>
            </tr>
          </table>

          <!-- Aviso de expiración -->
          <div style="background:#fff8f0; border:1px solid #f1d2b6; border-radius:8px; padding:12px 14px; color:#7a4b00; font-size:13px; margin:18px 0;">
            <strong>Importante:</strong> El enlace expira en {RESET_EXP_MINUTES} minutos por seguridad.
          </div>

          <!-- Fallback de enlace en texto -->
          <p style="margin:16px 0 0 0; font-size:13px; color:#666; line-height:1.6;">
            Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
            <span style="word-break:break-all; color:#444;">{link}</span>
          </p>

          <!-- Seguridad -->
          <p style="margin:16px 0 0 0; font-size:13px; color:#666; line-height:1.6;">
            Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña seguirá siendo la misma.
          </p>

          <!-- Soporte / firma -->
          <p style="margin:18px 0 0 0; font-size:12px; color:#666; line-height:1.5;">
            Este correo fue generado automáticamente; por favor no respondas a esta dirección.
            Si necesitas ayuda, contacta a la coordinación.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f3f3f3; padding:14px 18px; text-align:center; font-size:11px; color:#666;">
          © {current_year} CELEX CECyT 15 — IPN
        </div>

      </div>
    </div>
    """

    body_text = (
        f"Hola {first_name},\n\n"
        f"Solicitaste restablecer tu contraseña de CELEX.\n\n"
        f"Usa este enlace para continuar (expira en {RESET_EXP_MINUTES} minutos):\n"
        f"{link}\n\n"
        "Si no solicitaste este cambio, puedes ignorar este correo.\n"
        "Este correo fue generado automáticamente; por favor no respondas."
    )

    # Enviar sin revelar existencia del correo (Postmark via send_email)
    ok = send_email(user.email, subject, body_html, body_text)
    if not ok:
        # Log no bloqueante: mantén el flujo idéntico hacia el cliente
        print(f"⚠ No se pudo enviar correo de reset a {user.email}")

    return {"detail": "Si el correo existe, enviaremos instrucciones de recuperación."}


@router.post("/password/reset", status_code=200)
def reset_password(payload: ResetPasswordIn, request: Request, db: Session = Depends(get_db)):
    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(status_code=400, detail="La confirmación no coincide.")

    raw = payload.token.strip()
    token_hash = _sha256_hex(raw)

    prt = db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    ).scalar_one_or_none()

    # Validaciones
    if not prt or prt.purpose != "password_reset":
        raise HTTPException(status_code=400, detail="Token inválido o no encontrado.")
    now = datetime.now(timezone.utc)
    if prt.used_at is not None:
        raise HTTPException(status_code=400, detail="El token ya fue utilizado.")
    if prt.expires_at < now:
        # fix: statuscode -> status_code
        raise HTTPException(status_code=400, detail="El token expiró. Solicita uno nuevo.")

    # Cambiar contraseña
    user = db.execute(select(User).where(User.id == prt.user_id)).scalar_one()
    new_hash = get_password_hash(payload.new_password)
    db.execute(
        update(User).where(User.id == user.id).values(hashed_password=new_hash)
    )

    # Marcar token como usado e invalidar otros
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.id == prt.id)
        .values(
            used_at=now,
            consumed_ip=request.client.host if request.client else None,
            consumed_ua=request.headers.get("user-agent"),
        )
    )
    db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.purpose == "password_reset",
            PasswordResetToken.id != prt.id,
        )
    )

    db.commit()
    return {"detail": "Tu contraseña fue restablecida correctamente."}
