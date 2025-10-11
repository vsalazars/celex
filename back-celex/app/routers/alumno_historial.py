# app/routers/alumno_historial.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import List, Dict, Optional

from ..database import get_db
from ..auth import get_current_user
from ..models import User, UserRole, Inscripcion, Ciclo, Evaluacion
from ..models_asistencia import AsistenciaRegistro  # estado es TEXT en la BD

from ..schemas import AlumnoHistorialItem, AlumnoHistorialResponse


router = APIRouter(prefix="/alumno", tags=["alumno"])


def _enum_to_str(v) -> str:
    """
    Convierte de forma robusta enums de SQLAlchemy/Python a string legible.
    """
    if v is None:
        return ""
    for attr in ("value", "name"):
        if hasattr(v, attr):
            try:
                return str(getattr(v, attr))
            except Exception:
                pass
    return str(v)


@router.get("/historial", response_model=AlumnoHistorialResponse)
def get_historial_alumno(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Solo alumnos
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Solo alumnos")

    # Inscripciones del alumno autenticado
    # En la BD el FK es 'alumno_id' (no 'user_id')
    # Traemos también el Ciclo para evitar N+1
    inscripciones: List[Inscripcion] = (
        db.query(Inscripcion)
        .options(joinedload(Inscripcion.ciclo))
        .filter(
            Inscripcion.alumno_id == current_user.id,
            Inscripcion.status == "confirmada",          # 👈 sólo confirmadas
            Inscripcion.validated_at.isnot(None),        # 👈 aseguramos que fue validada
        )
        .all()
    )

    if not inscripciones:
        return {"items": []}

    insc_ids = [i.id for i in inscripciones]

    # Evaluaciones por inscripción (1:1 con unique en DB)
    evaluaciones: List[Evaluacion] = (
        db.query(Evaluacion)
        .filter(Evaluacion.inscripcion_id.in_(insc_ids))
        .all()
    )
    eval_by_insc: Dict[int, Evaluacion] = {e.inscripcion_id: e for e in evaluaciones}

    # Asistencia agregada por inscripción
    # En la BD 'estado' es TEXT (presente/ausente/retardo/justificado)
    asis_rows = (
        db.query(
            AsistenciaRegistro.inscripcion_id.label("insc_id"),
            func.count().label("total"),
            func.sum(case((AsistenciaRegistro.estado == "presente", 1), else_=0)).label("presentes"),
            func.sum(case((AsistenciaRegistro.estado == "ausente", 1), else_=0)).label("ausentes"),
            func.sum(case((AsistenciaRegistro.estado == "retardo", 1), else_=0)).label("retardos"),
            func.sum(case((AsistenciaRegistro.estado == "justificado", 1), else_=0)).label("justificados"),
        )
        .filter(AsistenciaRegistro.inscripcion_id.in_(insc_ids))
        .group_by(AsistenciaRegistro.inscripcion_id)
        .all()
    )
    asis_by_insc = {r.insc_id: r for r in asis_rows}

    items: List[AlumnoHistorialItem] = []

    for insc in inscripciones:
        ciclo: Ciclo = insc.ciclo  # fechas: curso_inicio / curso_fin
        e: Optional[Evaluacion] = eval_by_insc.get(insc.id)

        # --- Asistencia ---
        ag = asis_by_insc.get(insc.id)
        total = int(ag.total) if ag else 0
        presentes = int(ag.presentes or 0) if ag else 0
        ausentes = int(ag.ausentes or 0) if ag else 0
        retardos = int(ag.retardos or 0) if ag else 0
        justificados = int(ag.justificados or 0) if ag else 0
        asistencia_pct = round((presentes / total) * 100, 1) if total > 0 else 0.0
        # Si deseas contar 'justificados' como presentes:
        # asistencia_pct = round(((presentes + justificados) / total) * 100, 1) if total > 0 else 0.0

        # --- Medio (0–100) ---
        medio_ex = float(e.medio_examen) if e and e.medio_examen is not None else None  # 0–80
        medio_cont = float(e.medio_continua) if e and e.medio_continua is not None else None  # 0–20
        medio_sub = (medio_ex or 0) + (medio_cont or 0) if (medio_ex is not None or medio_cont is not None) else None

        # --- Final (0–100) ---
        final_ex = float(e.final_examen) if e and e.final_examen is not None else None  # 0–60
        final_cont = float(e.final_continua) if e and e.final_continua is not None else None  # 0–20
        final_tar = float(e.final_tarea) if e and e.final_tarea is not None else None  # 0–20
        final_sub = (
            (final_ex or 0) + (final_cont or 0) + (final_tar or 0)
            if (final_ex is not None or final_cont is not None or final_tar is not None)
            else None
        )

        # --- Promedio (simple 50/50) ---
        if medio_sub is not None and final_sub is not None:
            promedio = round((medio_sub + final_sub) / 2.0, 1)
        else:
            promedio = None

        # Docente: el modelo Ciclo suele tener relación 'docente' (puede ser None)
        docente_nombre = None
        try:
            docente_nombre = (
                f"{ciclo.docente.first_name} {ciclo.docente.last_name}".strip()
                if getattr(ciclo, "docente", None)
                else None
            )
        except Exception:
            docente_nombre = None

        items.append(AlumnoHistorialItem(
            inscripcion_id=insc.id,
            ciclo_id=ciclo.id,
            ciclo_codigo=ciclo.codigo,
            idioma=_enum_to_str(ciclo.idioma),
            nivel=_enum_to_str(ciclo.nivel),
            modalidad=_enum_to_str(ciclo.modalidad),
            turno=_enum_to_str(ciclo.turno),
            docente_nombre=docente_nombre,
            # Ojo: en la BD son curso_inicio / curso_fin
            fecha_inicio=getattr(ciclo, "curso_inicio", None),
            fecha_fin=getattr(ciclo, "curso_fin", None),
            sesiones_total=total,
            presentes=presentes,
            ausentes=ausentes,
            retardos=retardos,
            justificados=justificados,
            asistencia_pct=asistencia_pct,
            medio_examen=medio_ex,
            medio_cont=medio_cont,
            medio_subtotal=round(medio_sub, 1) if medio_sub is not None else None,
            final_examen=final_ex,
            final_cont=final_cont,
            final_tarea=final_tar,
            final_subtotal=round(final_sub, 1) if final_sub is not None else None,
            promedio=promedio,
        ))

    return {"items": items}
