# app/routers/coordinacion_perfil.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import update, select

from app.database import get_db
from app.auth import get_current_user, require_coordinator_or_admin, verify_password, get_password_hash
from app.models import User
from app.schemas import ChangePasswordIn

router = APIRouter(prefix="/coordinacion", tags=["coordinacion"])

@router.post("/perfil/password", status_code=200)
def change_password_coordinador(
    payload: ChangePasswordIn,
    current_user: User = Depends(require_coordinator_or_admin),
    db: Session = Depends(get_db),
):
    """
    Cambia la contraseña del coordinador (o superuser).
    - Verifica la contraseña actual.
    - Evita reutilizar la misma.
    - Fuerza UPDATE y confirma persistencia.
    """
    user = db.merge(current_user)

    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="El usuario no tiene una contraseña registrada.")

    # 1) Verificar actual
    try:
        ok = verify_password(payload.current_password, user.hashed_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al verificar la contraseña: {type(e).__name__}")
    if not ok:
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")

    # 2) Evitar reutilizar
    try:
        if verify_password(payload.new_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="La nueva contraseña no puede ser igual a la actual.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al validar la nueva contraseña: {type(e).__name__}")

    # 3) Hash nuevo
    try:
        new_hash = get_password_hash(payload.new_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar el hash de la contraseña: {type(e).__name__}")

    # 4) UPDATE forzado
    res = db.execute(
        update(User).where(User.id == user.id).values(hashed_password=new_hash)
    )
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=500, detail="No se pudo actualizar la contraseña (ninguna fila modificada).")

    # 5) Confirmar persistencia
    refreshed = db.execute(select(User).where(User.id == user.id)).scalar_one()
    try:
        ok = verify_password(payload.new_password, refreshed.hashed_password or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al verificar la persistencia del hash: {type(e).__name__}")
    if not ok:
        raise HTTPException(status_code=500, detail="La contraseña no se persistió correctamente en la base de datos.")

    return {"detail": "Contraseña actualizada correctamente."}
