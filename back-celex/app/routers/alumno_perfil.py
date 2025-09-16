# app/routers/alumno_perfil.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.schemas import AlumnoPerfilOut, AlumnoPerfilUpdate

router = APIRouter(prefix="/alumno", tags=["alumno"])

def _to_out(user: User) -> AlumnoPerfilOut:
    direccion = None
    if any([user.addr_calle, user.addr_numero, user.addr_colonia, user.addr_municipio, user.addr_estado, user.addr_cp]):
        direccion = {
            "calle": user.addr_calle,
            "numero": user.addr_numero,
            "colonia": user.addr_colonia,
            "municipio": user.addr_municipio,
            "estado": user.addr_estado,
            "cp": user.addr_cp,
        }

    ipn = None
    if user.is_ipn:
        ipn = {
            "nivel": user.ipn_nivel or "Superior",  # valor por defecto razonable
            "unidad": user.ipn_unidad or "",
        }

    tutor = None
    if user.tutor_telefono:
        tutor = {"telefono": user.tutor_telefono}

    return AlumnoPerfilOut(
        nombre=user.first_name,
        apellidos=user.last_name,
        email=user.email,
        curp=user.curp,
        telefono=user.telefono,
        direccion=direccion,
        is_ipn=bool(user.is_ipn),
        boleta=user.boleta,
        ipn=ipn,
        tutor=tutor,
    )

@router.get("/perfil", response_model=AlumnoPerfilOut)
def get_perfil(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Solo lectura: no necesitamos merge aquí
    return _to_out(current_user)

@router.patch("/perfil", response_model=AlumnoPerfilOut)
def update_perfil(
    payload: AlumnoPerfilUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # IMPORTANTÍSIMO: re-adjuntar el user a ESTA sesión
    user = db.merge(current_user)  # devuelve una instancia ligada a 'db'

    # === Campos básicos ===
    if payload.nombre is not None:
        user.first_name = payload.nombre.strip() or user.first_name
    if payload.apellidos is not None:
        user.last_name = payload.apellidos.strip() or user.last_name
    if payload.email is not None:
        # si NO quieres permitir cambiar email, comenta la línea siguiente
        user.email = payload.email.lower().strip()
    if payload.curp is not None:
        user.curp = payload.curp.strip().upper()

    if payload.telefono is not None:
        user.telefono = (payload.telefono or "").strip() or None

    # === Dirección ===
    if payload.direccion is not None:
        d = payload.direccion
        user.addr_calle     = (d.calle or "").strip() or None
        user.addr_numero    = (d.numero or "").strip() or None
        user.addr_colonia   = (d.colonia or "").strip() or None
        user.addr_municipio = (d.municipio or "").strip() or None
        user.addr_estado    = (d.estado or "").strip() or None
        user.addr_cp        = (d.cp or "").strip() or None

    # === IPN ===
    # is_ipn del payload se ignora; la verdad está en DB (user.is_ipn)
    if user.is_ipn:
        if payload.boleta is not None:
            user.boleta = (payload.boleta or "").strip() or None
        if payload.ipn is not None:
            user.ipn_nivel  = payload.ipn.nivel
            user.ipn_unidad = (payload.ipn.unidad or "").strip() or None
    else:
        user.boleta = None
        user.ipn_nivel = None
        user.ipn_unidad = None

    # === Tutor ===
    if payload.tutor is not None:
        user.tutor_telefono = (payload.tutor.telefono or "").strip() or None

    # ¡OJO!: no llames a db.add(user); ya está ligado a la sesión
    db.commit()
    db.refresh(user)
    return _to_out(user)
