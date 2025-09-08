from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..auth import get_current_user  # ya la usas en otros routers
from ..models import User, UserRole, Ciclo, Inscripcion, Evaluacion
from ..schemas import EvaluacionUpsertIn, EvaluacionOut, EvaluacionListOut

router = APIRouter(prefix="/docente/evaluaciones", tags=["Docente - Evaluaciones"])

# Helpers de validación de rango (por si llegan por fuera del schema)
def clamp(v: Optional[int], lo: int, hi: int) -> Optional[int]:
    if v is None:
        return None
    v = int(v)
    return max(lo, min(hi, v))

def calcular_subtotales_y_promedio(p: EvaluacionUpsertIn) -> tuple[int, int, float]:
    medio = (clamp(p.medio_examen, 0, 80) or 0) + (clamp(p.medio_continua, 0, 20) or 0)        # 0..100
    final = (clamp(p.final_examen, 0, 60) or 0) + (clamp(p.final_continua, 0, 20) or 0) + (clamp(p.final_tarea, 0, 20) or 0)  # 0..100
    promedio = round((medio + final) / 2, 2)
    return medio, final, float(promedio)

def require_docente_del_ciclo_o_superuser(
    db: Session, user: User, ciclo: Ciclo
):
    if str(user.role) == "superuser" or getattr(user.role, "value", str(user.role)) == "superuser":
        return
    # solo el docente asignado al ciclo puede calificar
    if ciclo.docente_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para evaluar este curso",
        )

@router.post("/ciclos/{ciclo_id}/alumnos/{inscripcion_id}", response_model=EvaluacionOut)
def upsert_evaluacion(
    ciclo_id: int,
    inscripcion_id: int,
    payload: EvaluacionUpsertIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1) Validar pertenencia y permisos
    ciclo = db.query(Ciclo).filter(Ciclo.id == ciclo_id).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    insc = (
        db.query(Inscripcion)
        .filter(Inscripcion.id == inscripcion_id, Inscripcion.ciclo_id == ciclo_id)
        .first()
    )
    if not insc:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada en este ciclo")

    require_docente_del_ciclo_o_superuser(db, current_user, ciclo)

    # 2) Cálculos
    subtotal_medio, subtotal_final, promedio_final = calcular_subtotales_y_promedio(payload)

    # 3) Upsert por inscripcion_id
    ev = db.query(Evaluacion).filter(Evaluacion.inscripcion_id == inscripcion_id).first()
    if not ev:
        ev = Evaluacion(
            inscripcion_id=inscripcion_id,
            ciclo_id=ciclo_id,
        )
        db.add(ev)

    ev.medio_examen   = clamp(payload.medio_examen, 0, 80)
    ev.medio_continua = clamp(payload.medio_continua, 0, 20)
    ev.final_examen   = clamp(payload.final_examen, 0, 60)
    ev.final_continua = clamp(payload.final_continua, 0, 20)
    ev.final_tarea    = clamp(payload.final_tarea, 0, 20)

    ev.subtotal_medio = subtotal_medio
    ev.subtotal_final = subtotal_final
    ev.promedio_final = promedio_final
    ev.updated_by_id  = current_user.id

    db.commit()
    db.refresh(ev)

    return EvaluacionOut(
        inscripcion_id=ev.inscripcion_id,
        ciclo_id=ev.ciclo_id,
        medio_examen=ev.medio_examen,
        medio_continua=ev.medio_continua,
        final_examen=ev.final_examen,
        final_continua=ev.final_continua,
        final_tarea=ev.final_tarea,
        subtotal_medio=ev.subtotal_medio,
        subtotal_final=ev.subtotal_final,
        promedio_final=float(ev.promedio_final),
    )

@router.get("/ciclos/{ciclo_id}", response_model=EvaluacionListOut)
def list_evaluaciones_por_ciclo(
    ciclo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ciclo = db.query(Ciclo).filter(Ciclo.id == ciclo_id).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    require_docente_del_ciclo_o_superuser(db, current_user, ciclo)

    rows = (
        db.query(Evaluacion)
        .filter(Evaluacion.ciclo_id == ciclo_id)
        .all()
    )
    items = [
        EvaluacionOut(
            inscripcion_id=r.inscripcion_id,
            ciclo_id=r.ciclo_id,
            medio_examen=r.medio_examen,
            medio_continua=r.medio_continua,
            final_examen=r.final_examen,
            final_continua=r.final_continua,
            final_tarea=r.final_tarea,
            subtotal_medio=r.subtotal_medio,
            subtotal_final=r.subtotal_final,
            promedio_final=float(r.promedio_final),
        )
        for r in rows
    ]
    return EvaluacionListOut(items=items)
