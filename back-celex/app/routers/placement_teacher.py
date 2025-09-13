# routers/placement_teacher.py
from __future__ import annotations

from typing import List, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    PlacementExam,
    PlacementRegistro,
    PlacementRegistroStatus,
    User,
    UserRole,
)
from app.schemas import (
    PlacementExamAsignadoOut,
    PlacementRegistroAlumnoOut,
    NivelIdiomaUpdate,
)
from app.auth import get_current_user  # ajusta si tu dependencia se llama distinto

router = APIRouter(prefix="/placement-exams", tags=["placement-teacher"])


# ───────────────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────────────
def require_teacher_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in (UserRole.teacher, UserRole.superuser, UserRole.coordinator):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")


def _iso(dt):
    try:
        return dt.isoformat() if dt else None
    except Exception:
        return None


ACTIVE_REG_STATUSES: Tuple[PlacementRegistroStatus, ...] = (
    PlacementRegistroStatus.PREINSCRITA,
    PlacementRegistroStatus.VALIDADA,
)


# ───────────────────────────────────────────────────────────────────────────────
# Endpoints
# ───────────────────────────────────────────────────────────────────────────────
@router.get("/teachers/mis-examenes", response_model=List[PlacementExamAsignadoOut])
def mis_examenes(
    db: Session = Depends(get_db),
    me: User = Depends(require_teacher_or_admin),
):
    """
    Lista exámenes de colocación asignados al docente autenticado.
    Cuenta inscritos solo en estatus que ocupan lugar (preinscrita/validada).
    """
    exams = (
        db.query(PlacementExam)
        .filter(PlacementExam.docente_id == me.id)
        .order_by(
            PlacementExam.fecha.asc().nullslast(),
            PlacementExam.hora.asc().nullslast(),
            PlacementExam.id.asc(),
        )
        .all()
    )

    out: List[PlacementExamAsignadoOut] = []
    for ex in exams:
        inscritos = (
            db.query(func.count(PlacementRegistro.id))
            .filter(
                PlacementRegistro.exam_id == ex.id,
                PlacementRegistro.status.in_(ACTIVE_REG_STATUSES),
            )
            .scalar()
            or 0
        )
        out.append(
            PlacementExamAsignadoOut(
                id=ex.id,
                titulo=getattr(ex, "nombre", None) or getattr(ex, "codigo", None),
                fecha=_iso(getattr(ex, "fecha", None)),
                modalidad=getattr(ex, "modalidad", None),
                idioma=getattr(ex, "idioma", None),
                nivel=getattr(ex, "nivel_objetivo", None),
                sede=getattr(ex, "salon", None),
                turno=None,  # placement normalmente no lleva turno
                inscritos=inscritos,
            )
        )
    return out


@router.get("/{exam_id}/registros", response_model=List[PlacementRegistroAlumnoOut])
def registros_por_examen(
    exam_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(require_teacher_or_admin),
    scope: str = Query(default="teacher"),
):
    """
    Lista alumnos inscritos a un examen de colocación.
    - Si scope=teacher: valida que el examen pertenezca al docente (o admin/coordinador).
    - Devuelve nombre, email, boleta y nivel_asignado (nivel_idioma en la BD).
    """
    exam = db.query(PlacementExam).filter(PlacementExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    if scope == "teacher" and (exam.docente_id != me.id) and (
        me.role not in (UserRole.superuser, UserRole.coordinator)
    ):
        raise HTTPException(status_code=403, detail="No autorizado para ver este examen")

    regs = (
        db.query(PlacementRegistro)
        .options(joinedload(PlacementRegistro.alumno))
        .filter(PlacementRegistro.exam_id == exam_id)
        .order_by(PlacementRegistro.created_at.asc(), PlacementRegistro.id.asc())
        .all()
    )

    out: List[PlacementRegistroAlumnoOut] = []
    for r in regs:
        alumno = r.alumno
        nombre = None
        if alumno:
            fn = getattr(alumno, "first_name", None)
            ln = getattr(alumno, "last_name", None)
            if fn or ln:
                nombre = f"{fn or ''} {ln or ''}".strip()
        out.append(
            PlacementRegistroAlumnoOut(
                id=r.id,
                alumno_nombre=nombre,
                alumno_email=getattr(alumno, "email", None) if alumno else None,
                alumno_boleta=getattr(alumno, "boleta", None) if alumno else None,
                nivel_asignado=getattr(r, "nivel_idioma", None),
            )
        )
    return out


@router.patch("/registros/{registro_id}/nivel-idioma", response_model=PlacementRegistroAlumnoOut)
def actualizar_nivel_por_registro(
    registro_id: int,
    payload: NivelIdiomaUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_teacher_or_admin),
):
    """
    Actualiza el nivel a cursar para un alumno (registro de examen).
    Valida que el examen pertenezca al docente (o que sea admin/coordinador).
    """
    reg = db.query(PlacementRegistro).filter(PlacementRegistro.id == registro_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    exam = reg.exam
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado para este registro")

    if (exam.docente_id != me.id) and (me.role not in (UserRole.superuser, UserRole.coordinator)):
        raise HTTPException(status_code=403, detail="No autorizado para modificar este registro")

    reg.nivel_idioma = payload.nivel.strip().upper()
    db.add(reg)
    db.commit()
    db.refresh(reg)

    alumno = reg.alumno
    nombre = None
    if alumno:
        fn = getattr(alumno, "first_name", None)
        ln = getattr(alumno, "last_name", None)
        if fn or ln:
            nombre = f"{fn or ''} {ln or ''}".strip()

    return PlacementRegistroAlumnoOut(
        id=reg.id,
        alumno_nombre=nombre,
        alumno_email=getattr(alumno, "email", None) if alumno else None,
        alumno_boleta=getattr(alumno, "boleta", None) if alumno else None,
        nivel_asignado=reg.nivel_idioma,
    )


# Compatibilidad con el front (PATCH genérico)
@router.patch("/registros/{registro_id}", response_model=PlacementRegistroAlumnoOut)
def patch_registro_nivel_generico(
    registro_id: int,
    payload: NivelIdiomaUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_teacher_or_admin),
):
    return actualizar_nivel_por_registro(registro_id, payload, db, me)
