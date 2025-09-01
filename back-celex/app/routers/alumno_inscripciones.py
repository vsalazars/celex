# app/routers/alumno_inscripciones.py
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, lazyload
from sqlalchemy import func

from ..database import get_db
from ..auth import get_current_user
from ..models import Ciclo, UserRole as ModelUserRole
from .. import models as models_mod  # resolver Inscripcion en runtime

router = APIRouter(prefix="/alumno/inscripciones", tags=["alumno-inscripciones"])


class CreateInscripcionRequest(BaseModel):
    ciclo_id: int = Field(..., ge=1)


# ---------- helpers ----------
def _get_inscripcion_model():
    Inscripcion = getattr(models_mod, "Inscripcion", None)
    if Inscripcion is not None:
        return Inscripcion
    for name in dir(models_mod):
        obj = getattr(models_mod, name)
        if getattr(obj, "__tablename__", None):
            try:
                if "inscrip" in obj.__tablename__:
                    return obj
            except Exception:
                pass
    return None


def require_student(user=Depends(get_current_user)):
    if user.role != ModelUserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo alumnos")
    return user


# ---------- endpoints ----------
@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_student)])
def crear_inscripcion(
    payload: CreateInscripcionRequest,
    db: Session = Depends(get_db),
    user=Depends(require_student),
):
    Inscripcion = _get_inscripcion_model()
    if Inscripcion is None:
        raise HTTPException(
            status_code=501,
            detail="Modelo de Inscripción no definido en app.models. Agrega el modelo (p. ej. 'Inscripcion').",
        )

    # 1) Trae el ciclo SIN joins y bloquea SOLO la tabla ciclos (evita FOR SHARE en outer join)
    ciclo = (
        db.query(Ciclo)
        .options(lazyload("*"))                 # 👈 desactiva eager joins (joinedload)
        .filter(Ciclo.id == payload.ciclo_id)
        .with_for_update(of=Ciclo, nowait=False)  # 👈 FOR UPDATE OF ciclos (seguro con outer joins)
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    # 2) Ventana de inscripción (usa solo insc_* si no manejas reinsc_*)
    hoy = date.today()
    if not (ciclo.insc_inicio and ciclo.insc_fin and ciclo.insc_inicio <= hoy <= ciclo.insc_fin):
        raise HTTPException(status_code=409, detail="Periodo de inscripción no vigente")

    # 3) Evitar duplicado del mismo alumno
    ya = (
        db.query(Inscripcion.id)
        .filter(Inscripcion.ciclo_id == payload.ciclo_id, Inscripcion.alumno_id == user.id)
        .first()
    )
    if ya:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en este ciclo")

    # 4) Validar cupo actual
    inscritos = (
        db.query(func.count(Inscripcion.id))
        .filter(Inscripcion.ciclo_id == payload.ciclo_id)
        .scalar()
        or 0
    )
    lugares_disponibles = max(0, (ciclo.cupo_total or 0) - inscritos)
    if lugares_disponibles <= 0:
        raise HTTPException(status_code=409, detail="No hay lugares disponibles")

    # 5) Crear inscripción
    ins = Inscripcion(ciclo_id=payload.ciclo_id, alumno_id=user.id, status="registrada")
    db.add(ins)
    db.commit()
    db.refresh(ins)
    return {"ok": True, "id": ins.id}


@router.get("", dependencies=[Depends(require_student)])
def listar_mis_inscripciones(db: Session = Depends(get_db), user=Depends(require_student)):
    Inscripcion = _get_inscripcion_model()
    if Inscripcion is None:
        raise HTTPException(
            status_code=501,
            detail="Modelo de Inscripción no definido en app.models. Agrega el modelo para listar inscripciones.",
        )
    rows = db.query(Inscripcion).filter(Inscripcion.alumno_id == user.id).all()
    return [
        {
            "id": x.id,
            "ciclo_id": getattr(x, "ciclo_id", None),
            "status": getattr(x, "status", None),
            "created_at": getattr(x, "created_at", None),
        }
        for x in rows
    ]


@router.delete("/{inscripcion_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_student)])
def cancelar_inscripcion(inscripcion_id: int, db: Session = Depends(get_db), user=Depends(require_student)):
    Inscripcion = _get_inscripcion_model()
    if Inscripcion is None:
        raise HTTPException(
            status_code=501,
            detail="Modelo de Inscripción no definido en app.models. Agrega el modelo para cancelar inscripciones.",
        )

    ins = (
        db.query(Inscripcion)
        .filter(Inscripcion.id == inscripcion_id, Inscripcion.alumno_id == user.id)
        .first()
    )
    if not ins:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    db.delete(ins)
    db.commit()
    return
