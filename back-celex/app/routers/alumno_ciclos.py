# app/routers/alumno_ciclos.py
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func, literal

from ..auth import get_db, get_current_user  # deja igual si ya te funciona así
from ..models import (
    Ciclo,
    Inscripcion,  # 👈 para contar inscripciones activas
    Modalidad as ModelModalidad,
    Turno as ModelTurno,
    Idioma as ModelIdioma,
    Nivel as ModelNivel,
)
from ..schemas import (
    CicloOut,
    CicloListResponse,
    Modalidad as SchemaModalidad,
    Turno as SchemaTurno,
    Idioma as SchemaIdioma,
    Nivel as SchemaNivel,
)

router = APIRouter(prefix="/alumno/ciclos", tags=["alumno-ciclos"])


# =========================
# Helpers
# =========================
def _to_out(m: Ciclo, ocupadas: int | None = None) -> CicloOut:
    """
    Mapea el modelo Ciclo a CicloOut, calculando lugares_disponibles
    cuando se proporciona 'ocupadas'.
    """
    g = getattr
    cupo_total = m.cupo_total or 0
    ocup = ocupadas or 0
    disponibles = max(cupo_total - ocup, 0)

    return CicloOut(
        id=m.id,
        codigo=m.codigo,
        idioma=m.idioma,
        modalidad=m.modalidad,
        turno=m.turno,
        nivel=m.nivel,
        cupo_total=m.cupo_total,

        # 👇 nuevo campo calculado
        lugares_disponibles=disponibles,

        dias=(m.dias or []),
        hora_inicio=m.hora_inicio,
        hora_fin=m.hora_fin,

        # Ventanas de inscripción
        inscripcion={"from": g(m, "insc_inicio", None), "to": g(m, "insc_fin", None)},
        reinscripcion={"from": g(m, "reinsc_inicio", None), "to": g(m, "reinsc_fin", None)},

        # Fechas de curso / colocación
        curso={"from": g(m, "curso_inicio", None), "to": g(m, "curso_fin", None)},
        colocacion={
            "from": g(m, "colocacion_inicio", g(m, "coloc_inicio", None)),
            "to": g(m, "colocacion_fin", g(m, "coloc_fin", None)),
        },

        examenMT=g(m, "examen_mt", None),
        examenFinal=g(m, "examen_final", None),

        modalidad_asistencia=g(m, "modalidad_asistencia", None),
        aula=g(m, "aula", None),

        notas=g(m, "notas", None),
    )


def require_authenticated_user(user=Depends(get_current_user)):
    return user


# =========================
# Rutas
# =========================
@router.get(
    "",
    response_model=CicloListResponse,
    dependencies=[Depends(require_authenticated_user)],
)
def list_ciclos_alumno(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Buscar por código"),
    idioma: Optional[SchemaIdioma] = Query(None),
    modalidad: Optional[SchemaModalidad] = Query(None),
    turno: Optional[SchemaTurno] = Query(None),
    nivel: Optional[SchemaNivel] = Query(None),
    solo_abiertos: bool = Query(False, description="Solo ciclos con inscripción vigente"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    base = db.query(Ciclo)

    if q:
        like = f"%{q.strip()}%"
        base = base.filter(Ciclo.codigo.ilike(like))

    if idioma:
        base = base.filter(Ciclo.idioma == ModelIdioma(idioma.value))
    if modalidad:
        base = base.filter(Ciclo.modalidad == ModelModalidad(modalidad.value))
    if turno:
        base = base.filter(Ciclo.turno == ModelTurno(turno.value))
    if nivel:
        base = base.filter(Ciclo.nivel == ModelNivel(nivel.value))

    if solo_abiertos:
        today = date.today()
        base = base.filter(and_(Ciclo.insc_inicio <= today, today <= Ciclo.insc_fin))

    # ---- Subquery: inscripciones activas por ciclo
    estados_activos = ("registrada", "pendiente", "confirmada")
    subq = (
        db.query(
            Inscripcion.ciclo_id.label("ciclo_id"),
            func.count(Inscripcion.id).label("ocupadas"),
        )
        .filter(Inscripcion.status.in_(estados_activos))
        .group_by(Inscripcion.ciclo_id)
        .subquery()
    )

    # Join para obtener (Ciclo, ocupadas)
    q = (
        base.outerjoin(subq, subq.c.ciclo_id == Ciclo.id)
            .with_entities(Ciclo, func.coalesce(subq.c.ocupadas, literal(0)).label("ocupadas"))
    )

    total = base.count()
    pages = (total + page_size - 1) // page_size if total else 1
    if page > pages and total > 0:
        page = pages

    rows = (
        q.order_by(desc(Ciclo.id))
         .offset((page - 1) * page_size)
         .limit(page_size)
         .all()
    )

    return CicloListResponse(
        items=[_to_out(m, int(ocupadas or 0)) for (m, ocupadas) in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get(
    "/{ciclo_id}",
    response_model=CicloOut,
    dependencies=[Depends(require_authenticated_user)],
)
def get_ciclo_alumno(
    ciclo_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    m = db.query(Ciclo).filter(Ciclo.id == ciclo_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    # Contar inscripciones activas para este ciclo
    estados_activos = ("registrada", "pendiente", "confirmada")
    ocupadas = (
        db.query(func.count(Inscripcion.id))
          .filter(Inscripcion.ciclo_id == ciclo_id, Inscripcion.status.in_(estados_activos))
          .scalar()
    ) or 0

    return _to_out(m, int(ocupadas))
