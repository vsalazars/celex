# app/routers/alumno_perfil.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.schemas import AlumnoPerfilOut, AlumnoPerfilUpdate

router = APIRouter(prefix="/alumno", tags=["alumno"])


def _parse_age_from_curp(curp: str | None) -> int | None:
    """
    Devuelve la edad (años) deducida de la CURP o None si no es válida.
    Formato esperado: ABCDYYMMDDHXXXXXNN
    """
    if not curp:
        return None
    import re
    m = re.match(r"^[A-Z]{4}(\d{2})(\d{2})(\d{2})[HM][A-Z]{5}[A-Z0-9]{2}$", curp, re.IGNORECASE)
    if not m:
        return None
    yy, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
    from datetime import date
    today = date.today()
    current_yy = today.year % 100
    full_year = 2000 + yy if yy <= current_yy else 1900 + yy
    try:
        dob = date(full_year, mm, dd)
    except ValueError:
        return None
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age


def _to_out(user: User) -> AlumnoPerfilOut:
    # Dirección
    direccion = None
    if any([user.addr_calle, user.addr_numero, user.addr_colonia, user.addr_municipio, user.addr_estado, user.addr_cp]):
        direccion = {
            "calle": user.addr_calle or None,
            "numero": user.addr_numero or None,
            "colonia": user.addr_colonia or None,
            "municipio": user.addr_municipio or None,
            "estado": user.addr_estado or None,
            "cp": user.addr_cp or None,
        }

    # IPN
    ipn = None
    if user.is_ipn:
        ipn = {
            "nivel": user.ipn_nivel or "Superior",  # valor por defecto razonable
            "unidad": user.ipn_unidad or "",
        }

    # Tutor (normaliza vacíos a None y valida parentesco)
    tutor = None
    if any([user.tutor_nombre, user.tutor_parentesco, user.tutor_telefono]):
        parentesco = (user.tutor_parentesco or None)
        valid_parentescos = {"Padre", "Madre", "Tutor legal", "Hermano/a", "Abuelo/a", "Otro"}
        if parentesco not in valid_parentescos:
            parentesco = None
        tutor = {
            "nombre": (user.tutor_nombre or None),
            "parentesco": parentesco,
            "telefono": (user.tutor_telefono or None),
        }

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
        v = (payload.nombre or "").strip()
        if v:
            user.first_name = v
    if payload.apellidos is not None:
        v = (payload.apellidos or "").strip()
        if v:
            user.last_name = v
    if payload.email is not None:
        # si NO quieres permitir cambiar email, comenta la línea siguiente
        user.email = (payload.email or "").lower().strip() or user.email
    if payload.curp is not None:
        user.curp = (payload.curp or "").strip().upper() or user.curp

    if payload.telefono is not None:
        v = (payload.telefono or "").strip()
        user.telefono = v or None

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

    # === Reglas para TUTOR cuando es menor de edad ===
    # Determinamos edad con la CURP "resultante" (la recién enviada o la actual)
    curp_ref = user.curp  # ya normalizada arriba si vino en el payload
    age = _parse_age_from_curp(curp_ref)

    if age is not None and age < 18:
        # Debe enviarse tutor con los 3 campos obligatorios
        if payload.tutor is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Si eres menor de edad, debes proporcionar los datos de tu padre/tutor.",
            )
        t = payload.tutor
        missing = []
        if not (t.nombre or "").strip():
            missing.append("nombre del padre/tutor")
        if not (t.parentesco or "").strip():
            missing.append("parentesco")
        if not (t.telefono or "").strip():
            missing.append("teléfono del tutor")
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Faltan campos de tutor: {', '.join(missing)}.",
            )
        # Guardar tutor completo
        user.tutor_nombre = t.nombre.strip()
        user.tutor_parentesco = t.parentesco.strip()
        user.tutor_telefono = t.telefono.strip()
    else:
        # Si NO es menor: si viene tutor explícitamente, se respeta (actualiza o limpia)
        if payload.tutor is not None:
            t = payload.tutor
            user.tutor_nombre = (t.nombre or "").strip() or None
            user.tutor_parentesco = (t.parentesco or "").strip() or None
            user.tutor_telefono = (t.telefono or "").strip() or None
        # Si no vino, no tocamos lo existente.

    # ¡OJO!: no llames a db.add(user); ya está ligado a la sesión
    db.commit()
    db.refresh(user)
    return _to_out(user)
