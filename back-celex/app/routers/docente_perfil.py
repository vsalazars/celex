# app/routers/docente_perfil.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import update, select

from app.database import get_db
from app.auth import get_current_user, verify_password, get_password_hash
from app.models import User, UserRole
from app.schemas import ChangePasswordIn

router = APIRouter(prefix="/docente", tags=["Docente"])

def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.teacher:
        raise HTTPException(status_code=403, detail="Requiere rol docente")
    return current_user

@router.post("/perfil/password", status_code=200)
def change_password_docente(
    payload: ChangePasswordIn,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Permite al docente cambiar su contraseña."""
    user = db.merge(current_user)

    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="El usuario no tiene una contraseña registrada.")

    # Verificar actual
    try:
        ok = verify_password(payload.current_password, user.hashed_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al verificar la contraseña: {type(e).__name__}")
    if not ok:
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")

    # Evitar reutilizar
    if verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="La nueva contraseña no puede ser igual a la actual.")

    # Nuevo hash
    new_hash = get_password_hash(payload.new_password)

    # Actualizar y confirmar
    res = db.execute(update(User).where(User.id == user.id).values(hashed_password=new_hash))
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=500, detail="No se pudo actualizar la contraseña.")

    refreshed = db.execute(select(User).where(User.id == user.id)).scalar_one()
    if not verify_password(payload.new_password, refreshed.hashed_password or ""):
        raise HTTPException(status_code=500, detail="La contraseña no se persistió correctamente.")

    return {"detail": "Contraseña actualizada correctamente."}
