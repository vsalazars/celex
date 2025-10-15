# app/routers/docente_overview.py
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, literal, or_
from sqlalchemy.orm import Session, aliased

from ..database import get_db
from ..auth import get_current_user
from ..models import (
    User,
    UserRole,
    Ciclo,
    SurveyResponse,
    SurveyAnswer,
    Evaluacion,
)

router = APIRouter(prefix="/docente", tags=["Docente - Overview"])


# =========================
#          Auth
# =========================
def require_teacher_or_admin(current_user: User = Depends(get_current_user)) -> User:
    # Permite docente, coordinador y superuser
    if current_user.role not in (UserRole.teacher, UserRole.coordinator, UserRole.superuser):
        raise HTTPException(status_code=403, detail="Permisos insuficientes (docente)")
    return current_user


# =========================
#       DTO / Schemas
# =========================
class DocenteOverviewOut(BaseModel):
    grupos_activos: int
    alumnos_total: int
    satisfaccion_promedio: float  # 0..10
    ultimo_grupo: Optional[str] = None


# =========================
#          Helper
# =========================
def _docente_ciclos_ids_sq(db: Session, docente_id: int):
    """Subquery con ids de ciclos asignados al docente."""
    return db.query(Ciclo.id).filter(Ciclo.docente_id == docente_id).subquery()


# =========================
#         Endpoint
# =========================
@router.get("/overview", response_model=DocenteOverviewOut)
def docente_overview(
    db: Session = Depends(get_db),
    current: User = Depends(require_teacher_or_admin),
):
    docente_id = int(current.id)

    # Universo de ciclos del docente
    ciclos_ids_sq = _docente_ciclos_ids_sq(db, docente_id)

    # 1) Grupos activos:
    #    - Por compatibilidad, si existe Ciclo.curso_fin, filtramos >= hoy.
    #    - Si no existe, contamos ciclos asignados.
    try:
        # acceso para forzar AttributeError si la columna no existe
        _ = Ciclo.curso_fin  # type: ignore[attr-defined]
        grupos_activos = (
            db.query(func.count(Ciclo.id))
            .filter(Ciclo.docente_id == docente_id)
            .filter(Ciclo.curso_fin >= date.today())  # type: ignore[operator]
            .scalar()
            or 0
        )
    except Exception:
        grupos_activos = db.query(func.count()).select_from(ciclos_ids_sq).scalar() or 0

    # 2) Alumnos totales (distinct por alumno_id) evitando canceladas/rechazadas si aplica
    alumnos_total = 0
    try:
        from ..models import Inscripcion  # type: ignore

        q_insc = db.query(Inscripcion).filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
        estados_excluir = ["cancelada", "rechazada"]
        if hasattr(Inscripcion, "status"):
            q_insc = q_insc.filter(~Inscripcion.status.in_(estados_excluir))

        alumnos_total = (
            db.query(func.count(func.distinct(Inscripcion.alumno_id)))
            .filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
            .filter(~Inscripcion.status.in_(estados_excluir))  # si no existe status, SQLA lo ignora vía try? No: protegemos:
            .scalar()
            if hasattr(Inscripcion, "status")
            else db.query(func.count(func.distinct(Inscripcion.alumno_id)))
            .filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
            .scalar()
        ) or 0
    except Exception:
        alumnos_total = 0  # si no existe Inscripcion, dejamos 0

    # 3) Último grupo evaluado (por updated_at o created_at)
    ev = aliased(Evaluacion)
    ultimo_grupo = (
        db.query(Ciclo.codigo)
        .join(ev, ev.ciclo_id == Ciclo.id)
        .filter(Ciclo.docente_id == docente_id)
        .order_by(func.coalesce(ev.updated_at, ev.created_at).desc())
        .limit(1)
        .scalar()
    )

    # 4) Satisfacción promedio (0..10) a partir de value_int (1..5)
    #    prom_int = avg(value_int) ; 1..5 → (prom_int / 5) * 10
    sum_vals, n_vals = (
        db.query(
            func.coalesce(func.sum(SurveyAnswer.value_int), 0),
            func.count(SurveyAnswer.value_int),
        )
        .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
        .join(Ciclo, Ciclo.id == SurveyResponse.ciclo_id)
        .filter(Ciclo.docente_id == docente_id, SurveyAnswer.value_int.isnot(None))
        .first()
        or (0, 0)
    )
    if (n_vals or 0) > 0:
        prom_int = float(sum_vals) / float(n_vals)  # 1..5
        satisfaccion_promedio = round((prom_int / 5.0) * 10.0, 2)  # 0..10
    else:
        satisfaccion_promedio = 0.0

    return DocenteOverviewOut(
        grupos_activos=int(grupos_activos),
        alumnos_total=int(alumnos_total),
        satisfaccion_promedio=float(satisfaccion_promedio),
        ultimo_grupo=str(ultimo_grupo) if ultimo_grupo else None,
    )
