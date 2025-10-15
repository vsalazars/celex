# app/routers/coordinacion_dashboard.py
from __future__ import annotations

from typing import List, Optional, Dict, Any, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, literal, or_, case, cast, String
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from ..models import (
    User,
    UserRole,
    Ciclo,
    SurveyCategory,
    SurveyQuestion,
    SurveyResponse,
    SurveyAnswer,
)

router = APIRouter(prefix="/coordinacion", tags=["Coordinación - Dashboard"])


# =========================
#          Auth
# =========================
def require_coordinator_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.coordinator, UserRole.superuser):
        raise HTTPException(status_code=403, detail="Permisos insuficientes (coordinador o superuser)")
    return current_user


# =========================
#       DTO / Schemas
# =========================
class KpisOut(BaseModel):
    grupos_activos: int
    docentes_asignados: int
    alumnos_matriculados: int
    alumnos_ipn: int
    alumnos_externos: int
    pagos_verificados_pct: float
    pagos_monto_total: float
    promedio_global_pct: float


class SerieGlobalOut(BaseModel):
    series: List[Dict[str, Any]]
    ciclos: List[str]


class CategoriaAgg(BaseModel):
    id: int | str
    name: str
    order: int
    promedio_pct: float


class CategoriasAggOut(BaseModel):
    categorias: List[CategoriaAgg]


class RankingDoc(BaseModel):
    docente_id: int | str
    docente: str
    promedio_pct: float
    grupos: int


class RankingOut(BaseModel):
    top: List[RankingDoc]
    bottom: List[RankingDoc]


class ComentarioOut(BaseModel):
    id: int | str | None = None
    ciclo: str
    docente: str | None = None
    pregunta: str | None = None
    texto: str
    created_at: str | None = None


class PreguntaAgg(BaseModel):
    id: int | str
    texto: str
    category_id: int | str | None = None
    category_name: str | None = None
    order: int
    promedio_pct: float
    respuestas: int


class PreguntasAggOut(BaseModel):
    preguntas: List[PreguntaAgg]


class ReportCicloLite(BaseModel):
    id: int | str
    codigo: str
    idioma: Optional[str] = None
    anio: Optional[int] = None


# === NUEVO ===
class MontosOut(BaseModel):
    inscripciones_total_mxn: float
    inscripciones_count: int
    placement_total_mxn: float
    placement_count: int
    total_mxn: float


# =========================
#     Helpers / Common
# =========================
def _flt_ciclos_q(db: Session, anio: Optional[int], idioma: Optional[str]):
    q = db.query(Ciclo)
    if anio:
        q = q.filter(Ciclo.codigo.ilike(f"{anio}-%"))
    if idioma:
        q = q.filter(or_(Ciclo.idioma == idioma, Ciclo.idioma.ilike(str(idioma))))
    return q


def _docente_nombre_expr():
    first = func.coalesce(func.trim(User.first_name), "")
    last = func.coalesce(func.trim(User.last_name), "")
    return func.trim(func.concat(first, literal(" "), last))


def _promedio_pct_heuristica(sum_vals, count_vals):
    return case((count_vals > 0, (sum_vals / count_vals) / 5.0 * 100.0), else_=literal(0.0))


# =========================
# 0) Listado ligero de ciclos (selector del frontend)
# =========================
@router.get("/reportes/ciclos-lite", response_model=List[ReportCicloLite])
def listar_ciclos_lite(
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    q = _flt_ciclos_q(db, anio, idioma).order_by(Ciclo.codigo.asc())
    rows = q.with_entities(Ciclo.id, Ciclo.codigo, Ciclo.idioma).all()
    out: List[ReportCicloLite] = []
    for _id, codigo, _idioma in rows:
        try:
            _anio = int(str(codigo).split("-")[0])
        except Exception:
            _anio = None
        out.append(
            ReportCicloLite(
                id=_id,
                codigo=str(codigo),
                idioma=str(_idioma) if _idioma is not None else None,
                anio=_anio,
            )
        )
    return out


# =========================
#   1) KPIs principales
# =========================
@router.get("/resumen/kpis", response_model=KpisOut)
def kpis_coordinacion(
    cicloId: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    """
    Por defecto agrega TODOS los ciclos (con filtros anio/idioma).
    Si viene cicloId, se restringe a ese ciclo. Esto permite que el frontend cambie
    los KPIs según el ciclo seleccionado, mientras que el ranking se mantiene global.
    """
    # universo de ciclos
    if cicloId is not None:
        ciclos_ids_sq = db.query(Ciclo.id).filter(Ciclo.id == cicloId).subquery()
    else:
        ciclos_ids_sq = _flt_ciclos_q(db, anio, idioma).with_entities(Ciclo.id).subquery()

    # Grupos activos (mientras no exista tabla grupos: contamos ciclos en el universo)
    grupos_activos = db.query(func.count()).select_from(ciclos_ids_sq).scalar() or 0

    # Docentes asignados
    docentes_asignados = (
        db.query(func.count(func.distinct(Ciclo.docente_id)))
        .filter(Ciclo.id.in_(ciclos_ids_sq))
        .filter(Ciclo.docente_id.isnot(None))
        .scalar()
        or 0
    )

    # ---------- Alumnos ----------
    alumnos_total = 0
    alumnos_ipn = 0
    try:
        # Fuente preferida: Inscripcion (si existe en tu proyecto)
        from ..models import Inscripcion  # type: ignore

        estados_activos = ["registrada", "preinscrita", "confirmada"]
        base_insc = db.query(Inscripcion).filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
        if hasattr(Inscripcion, "status"):
            base_insc = base_insc.filter(Inscripcion.status.in_(estados_activos))

        alumnos_total = (
            db.query(func.count(func.distinct(Inscripcion.alumno_id)))
            .filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
            .filter(Inscripcion.status.in_(estados_activos))
            .scalar()
            if hasattr(Inscripcion, "status")
            else db.query(func.count(func.distinct(Inscripcion.alumno_id)))
            .filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
            .scalar()
        ) or 0

        if hasattr(Inscripcion, "alumno_is_ipn"):
            alumnos_ipn = (
                db.query(func.count(func.distinct(Inscripcion.alumno_id)))
                .filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
                .filter(Inscripcion.status.in_(estados_activos))
                .filter(Inscripcion.alumno_is_ipn.is_(True))
                .scalar()
                if hasattr(Inscripcion, "status")
                else db.query(func.count(func.distinct(Inscripcion.alumno_id)))
                .filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
                .filter(Inscripcion.alumno_is_ipn.is_(True))
                .scalar()
            ) or 0
        else:
            raise RuntimeError("Inscripcion.alumno_is_ipn no disponible")
    except Exception:
        # Fallback heurístico con usuarios + encuestas
        ipn_email_like = or_(
            func.lower(User.email).like("%@ipn.mx"),
            func.lower(User.email).like("%.ipn.mx%"),
        )
        es_ipn = or_(
            getattr(User, "is_ipn").is_(True) if hasattr(User, "is_ipn") else literal(False),
            (func.length(func.coalesce(getattr(User, "boleta", literal("")), "")) == 10)
            if hasattr(User, "boleta")
            else literal(False),
            ipn_email_like,
        )

        alumnos_total = (
            db.query(func.count(func.distinct(SurveyResponse.alumno_id)))
            .filter(SurveyResponse.ciclo_id.in_(ciclos_ids_sq))
            .scalar()
            or 0
        )

        alumnos_ipn = (
            db.query(func.count(func.distinct(SurveyResponse.alumno_id)))
            .join(User, User.id == SurveyResponse.alumno_id)
            .filter(SurveyResponse.ciclo_id.in_(ciclos_ids_sq))
            .filter(es_ipn)
            .scalar()
            or 0
        )

    alumnos_externos = max(int(alumnos_total) - int(alumnos_ipn), 0)

    # ---------- Pagos: suma de importes validados ----------
    pagos_verificados_pct = 0.0
    pagos_monto_total = 0.0
    try:
        from ..models import Inscripcion  # type: ignore

        pagos_base = db.query(Inscripcion).filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))

        if hasattr(Inscripcion, "tipo"):
            pagos_base = pagos_base.filter(Inscripcion.tipo == "pago")

        total_pagos = pagos_base.count()

        verifs_q = pagos_base
        if hasattr(Inscripcion, "status"):
            verifs_q = verifs_q.filter(Inscripcion.status == "confirmada")
        if hasattr(Inscripcion, "validated_at"):
            verifs_q = verifs_q.filter(Inscripcion.validated_at.isnot(None))

        verificados = verifs_q.count()
        pagos_verificados_pct = round((verificados / total_pagos) * 100.0, 1) if total_pagos > 0 else 0.0

        suma_centavos = (
            verifs_q.with_entities(func.coalesce(func.sum(getattr(Inscripcion, "importe_centavos", literal(0))), 0)).scalar()
            or 0
        )
        pagos_monto_total = round(float(suma_centavos) / 100.0, 2)

    except Exception:
        pagos_verificados_pct = 0.0
        pagos_monto_total = 0.0

    # Promedio global (0..100)
    sum_vals, n_vals = (
        db.query(func.coalesce(func.sum(SurveyAnswer.value_int), 0), func.count(SurveyAnswer.value_int))
        .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
        .filter(SurveyResponse.ciclo_id.in_(ciclos_ids_sq))
        .first()
        or (0, 0)
    )
    prom_global = round(((float(sum_vals) / float(n_vals)) / 5.0) * 100.0, 1) if (n_vals or 0) > 0 else 0.0

    return KpisOut(
        grupos_activos=int(grupos_activos),
        docentes_asignados=int(docentes_asignados),
        alumnos_matriculados=int(alumnos_total),
        alumnos_ipn=int(alumnos_ipn),
        alumnos_externos=int(alumnos_externos),
        pagos_verificados_pct=pagos_verificados_pct,
        pagos_monto_total=pagos_monto_total,
        promedio_global_pct=prom_global,
    )


# === NUEVO ===
@router.get("/resumen/montos", response_model=MontosOut)
def resumen_montos(
    cicloId: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    """
    Montos de:
    - Inscripciones confirmadas (por ciclo / filtros)
    - Exámenes de colocación validados (por idioma / año)
    Retorna totales en MXN y contadores.
    """
    # ---------- Universo de ciclos para inscripciones ----------
    if cicloId is not None:
        ciclos_ids_sq = db.query(Ciclo.id).filter(Ciclo.id == cicloId).subquery()
    else:
        ciclos_ids_sq = _flt_ciclos_q(db, anio, idioma).with_entities(Ciclo.id).subquery()

    # ---------- Inscripciones ----------
    insc_total_cent = 0
    insc_count = 0
    try:
        from ..models import Inscripcion  # type: ignore

        base = db.query(Inscripcion).filter(Inscripcion.ciclo_id.in_(ciclos_ids_sq))
        # solo confirmadas
        if hasattr(Inscripcion, "status"):
            base = base.filter(Inscripcion.status == "confirmada")
        if hasattr(Inscripcion, "validated_at"):
            base = base.filter(Inscripcion.validated_at.isnot(None))
        if hasattr(Inscripcion, "tipo"):
            base = base.filter(Inscripcion.tipo == "pago")

        insc_count = base.count()
        insc_total_cent = (
            base.with_entities(func.coalesce(func.sum(getattr(Inscripcion, "importe_centavos", literal(0))), 0)).scalar()
            or 0
        )
    except Exception:
        insc_total_cent = 0
        insc_count = 0

    # ---------- Placement (exámenes de colocación) ----------
    place_total_cent = 0
    place_count = 0
    try:
        from ..models import PlacementExam, PlacementRegistro, PlacementRegistroStatus  # type: ignore

        reg = (
            db.query(PlacementRegistro)
            .join(PlacementExam, PlacementExam.id == PlacementRegistro.exam_id)
        )

        # Solo registros validados
        try:
            reg = reg.filter(PlacementRegistro.status == PlacementRegistroStatus.VALIDADA)
        except Exception:
            reg = reg.filter(func.lower(func.coalesce(PlacementRegistro.status, "")) == "validada")

        # Filtro idioma si se envía
        if idioma and hasattr(PlacementExam, "idioma"):
            reg = reg.filter(or_(PlacementExam.idioma == idioma, PlacementExam.idioma.ilike(str(idioma))))

        # Filtro por año si se envía (funciona para DATE o TEXT tipo 'YYYY-MM-DD')
        if anio and hasattr(PlacementExam, "fecha"):
            reg = reg.filter(cast(PlacementExam.fecha, String).like(f"{anio}-%"))

        place_count = reg.count()
        place_total_cent = reg.with_entities(func.coalesce(func.sum(PlacementRegistro.importe_centavos), 0)).scalar() or 0

    except Exception:
        place_total_cent = 0
        place_count = 0

    inscripciones_total_mxn = round(float(insc_total_cent) / 100.0, 2)
    placement_total_mxn = round(float(place_total_cent) / 100.0, 2)
    total_mxn = round(inscripciones_total_mxn + placement_total_mxn, 2)

    return MontosOut(
        inscripciones_total_mxn=inscripciones_total_mxn,
        inscripciones_count=int(insc_count),
        placement_total_mxn=placement_total_mxn,
        placement_count=int(place_count),
        total_mxn=total_mxn,
    )


# =========================
# 2) Serie global por ciclo
# =========================
@router.get("/reportes/serie-global", response_model=SerieGlobalOut)
def serie_global(
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    ciclos = _flt_ciclos_q(db, anio, idioma).order_by(Ciclo.codigo.asc()).all()
    data = []
    for c in ciclos:
        sum_vals, n_vals = (
            db.query(func.coalesce(func.sum(SurveyAnswer.value_int), 0), func.count(SurveyAnswer.value_int))
            .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
            .filter(SurveyResponse.ciclo_id == c.id, SurveyAnswer.value_int.isnot(None))
            .first()
            or (0, 0)
        )
        pct = float(round((float(sum_vals) / float(n_vals)) / 5.0 * 100.0, 1)) if (n_vals or 0) > 0 else 0.0
        data.append({"x": c.codigo, "y": pct})

    return SerieGlobalOut(series=[{"id": "Promedio global", "data": data}], ciclos=[c.codigo for c in ciclos])


# ======================================
# 3) Agregado por categoría
# ======================================
@router.get("/reportes/categorias", response_model=CategoriasAggOut)
def categorias_agg(
    cicloId: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    allCiclos: bool = Query(False),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    if cicloId and not allCiclos:
        ciclos_ids_sq = db.query(Ciclo.id).filter(Ciclo.id == cicloId).subquery()
    else:
        q = _flt_ciclos_q(db, anio, idioma)
        if not allCiclos:
            last = q.order_by(Ciclo.codigo.desc()).first()
            if not last:
                return CategoriasAggOut(categorias=[])
            ciclos_ids_sq = db.query(Ciclo.id).filter(Ciclo.id == last.id).subquery()
        else:
            ciclos_ids_sq = q.with_entities(Ciclo.id).subquery()

    pq_rows = (
        db.query(SurveyQuestion, SurveyCategory)
        .outerjoin(SurveyCategory, SurveyCategory.id == SurveyQuestion.category_id)
        .filter(SurveyQuestion.active.is_(True))
        .order_by(SurveyCategory.order.asc(), SurveyQuestion.order.asc())
        .all()
    )

    agg_sum: Dict[str, Dict[str, float]] = {}
    meta: Dict[str, Dict[str, Any]] = {}

    for qrow, cat in pq_rows:
        dist = (
            db.query(SurveyAnswer.value_int.label("v"), func.count().label("n"))
            .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
            .filter(
                SurveyResponse.ciclo_id.in_(ciclos_ids_sq),
                SurveyAnswer.question_id == qrow.id,
                SurveyAnswer.value_int.isnot(None),
            )
            .group_by(SurveyAnswer.value_int)
            .all()
        )
        total = sum(int(r.n or 0) for r in dist)
        if total <= 0:
            continue
        suma = sum(int(r.n or 0) * int(r.v or 0) for r in dist)
        prom = float(suma) / float(total)
        pct = (prom / 5.0) * 100.0

        key = str(cat.id if cat else "sin_categoria")
        if key not in agg_sum:
            agg_sum[key] = {"suma_pct": 0.0, "suma_n": 0.0}
            meta[key] = {
                "id": cat.id if cat else "sin_categoria",
                "name": cat.name if cat else "General",
                "order": int(cat.order) if cat and cat.order is not None else 9999,
            }

        agg_sum[key]["suma_pct"] += pct * total
        agg_sum[key]["suma_n"] += total

    out: List[CategoriaAgg] = []
    for key, sums in agg_sum.items():
        n = sums["suma_n"] or 1.0
        prom_pct = round(sums["suma_pct"] / n, 1)
        m = meta[key]
        out.append(CategoriaAgg(id=m["id"], name=m["name"], order=m["order"], promedio_pct=prom_pct))

    out.sort(key=lambda r: (r.order, r.name.lower()))
    return CategoriasAggOut(categorias=out)


# ======================================
# 3b) Agregado por pregunta (incluye 'texto' para tooltips)
# ======================================
@router.get("/reportes/preguntas", response_model=PreguntasAggOut)
def preguntas_agg(
    cicloId: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    allCiclos: bool = Query(False),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    if cicloId and not allCiclos:
        ciclos_ids_sq = db.query(Ciclo.id).filter(Ciclo.id == cicloId).subquery()
    else:
        q = _flt_ciclos_q(db, anio, idioma)
        if not allCiclos:
            last = q.order_by(Ciclo.codigo.desc()).first()
            if not last:
                return PreguntasAggOut(preguntas=[])
            ciclos_ids_sq = db.query(Ciclo.id).filter(Ciclo.id == last.id).subquery()
        else:
            ciclos_ids_sq = q.with_entities(Ciclo.id).subquery()

    pq_rows = (
        db.query(SurveyQuestion, SurveyCategory)
        .outerjoin(SurveyCategory, SurveyCategory.id == SurveyQuestion.category_id)
        .filter(SurveyQuestion.active.is_(True))
        .order_by(SurveyCategory.order.asc(), SurveyQuestion.order.asc())
        .all()
    )

    out: List[PreguntaAgg] = []
    for qrow, cat in pq_rows:
        sum_vals, n_vals = (
            db.query(func.coalesce(func.sum(SurveyAnswer.value_int), 0), func.count(SurveyAnswer.value_int))
            .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
            .filter(
                SurveyResponse.ciclo_id.in_(ciclos_ids_sq),
                SurveyAnswer.question_id == qrow.id,
                SurveyAnswer.value_int.isnot(None),
            )
            .first()
            or (0, 0)
        )
        total = int(n_vals or 0)
        if total <= 0:
            continue
        prom = float(sum_vals) / float(total)
        pct = round((prom / 5.0) * 100.0, 1)

        out.append(
            PreguntaAgg(
                id=int(qrow.id),
                texto=qrow.text,
                category_id=(cat.id if cat else None),
                category_name=(cat.name if cat else None),
                order=int(qrow.order or 0),
                promedio_pct=float(pct),
                respuestas=total,
            )
        )

    out.sort(key=lambda r: (r.category_name or "", r.order, r.texto.lower()))
    return PreguntasAggOut(preguntas=out)


# ======================================
# 4) Ranking de docentes (top/bottom)
# ======================================
@router.get("/reportes/ranking-docentes", response_model=RankingOut)
def ranking_docentes(
    limitTop: int = Query(5, ge=1, le=50),
    limitBottom: int = Query(5, ge=1, le=50),
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    """
    Se mantiene GLOBAL (sin cicloId), tal como pediste.
    Filtra por anio/idioma si se envían.
    """
    ciclos_ids_q = _flt_ciclos_q(db, anio, idioma).with_entities(Ciclo.id).subquery()

    rows = (
        db.query(
            Ciclo.docente_id.label("doc_id"),
            _promedio_pct_heuristica(
                func.coalesce(func.sum(SurveyAnswer.value_int), 0),
                func.count(SurveyAnswer.value_int),
            ).label("pct"),
        )
        .join(SurveyResponse, SurveyResponse.ciclo_id == Ciclo.id)
        .join(SurveyAnswer, SurveyAnswer.response_id == SurveyResponse.id)
        .filter(Ciclo.id.in_(ciclos_ids_q))
        .filter(Ciclo.docente_id.isnot(None))
        .group_by(Ciclo.docente_id)
        .all()
    )

    grupos_rows = (
        db.query(Ciclo.docente_id.label("doc_id"), func.count(Ciclo.id).label("grupos"))
        .filter(Ciclo.id.in_(ciclos_ids_q))
        .filter(Ciclo.docente_id.isnot(None))
        .group_by(Ciclo.docente_id)
        .all()
    )
    grupos_map = {int(r.doc_id): int(r.grupos or 0) for r in grupos_rows if r.doc_id is not None}

    doc_ids = [int(r.doc_id) for r in rows if r.doc_id is not None]
    nombres = {}
    if doc_ids:
        nombres = dict(db.query(User.id, _docente_nombre_expr()).filter(User.id.in_(doc_ids)).all())

    parsed: List[Tuple[int, str, float, int]] = []
    for r in rows:
        if r.doc_id is None:
            continue
        parsed.append(
            (
                int(r.doc_id),
                str(nombres.get(int(r.doc_id), "Docente")),
                float(getattr(r, "pct", 0.0) or 0.0),
                int(grupos_map.get(int(r.doc_id), 0)),
            )
        )
    parsed.sort(key=lambda t: t[2], reverse=True)
    top = parsed[:limitTop]
    bottom = list(reversed(parsed[-limitBottom:])) if parsed else []
    return RankingOut(
        top=[RankingDoc(docente_id=i, docente=n, promedio_pct=round(p, 1), grupos=g) for (i, n, p, g) in top],
        bottom=[RankingDoc(docente_id=i, docente=n, promedio_pct=round(p, 1), grupos=g) for (i, n, p, g) in bottom],
    )


# ======================================
# 5) Comentarios recientes
# ======================================
@router.get("/encuestas/comentarios", response_model=List[ComentarioOut])
def comentarios_recientes(
    cicloId: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    idioma: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: User = Depends(require_coordinator_or_admin),
):
    """
    Ahora acepta cicloId para que el frontend pueda filtrar comentarios al seleccionar un ciclo.
    Por defecto agrega todos los ciclos (con anio/idioma).
    """
    base = (
        db.query(
            SurveyAnswer.id.label("id"),
            SurveyResponse.ciclo_id.label("ciclo_id"),
            SurveyAnswer.value_text.label("texto"),
            SurveyResponse.created_at.label("created_at"),
            SurveyQuestion.text.label("pregunta"),
            Ciclo.docente_id.label("docente_id"),
            Ciclo.codigo.label("ciclo"),
        )
        .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
        .join(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .join(Ciclo, Ciclo.id == SurveyResponse.ciclo_id)
        .filter(SurveyAnswer.value_text.isnot(None), func.trim(SurveyAnswer.value_text) != "")
    )

    if cicloId is not None:
        base = base.filter(Ciclo.id == cicloId)
    else:
        if anio:
            base = base.filter(Ciclo.codigo.ilike(f"{anio}-%"))
        if idioma:
            base = base.filter(or_(Ciclo.idioma == idioma, Ciclo.idioma.ilike(str(idioma))))

    if q:
        like = f"%{q.strip().lower()}%"
        base = base.filter(
            or_(
                func.lower(SurveyAnswer.value_text).like(like),
                func.lower(SurveyQuestion.text).like(like),
                func.lower(Ciclo.codigo).like(like),
            )
        )

    rows = base.order_by(SurveyResponse.created_at.desc()).limit(limit).all()
    doc_ids = [int(r.docente_id) for r in rows if r.docente_id is not None]
    nombres = {}
    if doc_ids:
        nombres = dict(db.query(User.id, _docente_nombre_expr()).filter(User.id.in_(doc_ids)).all())

    out: List[ComentarioOut] = []
    for r in rows:
        out.append(
            ComentarioOut(
                id=r.id,
                ciclo=r.ciclo,
                docente=str(nombres.get(r.docente_id, "Docente")) if r.docente_id is not None else None,
                pregunta=r.pregunta,
                texto=(r.texto or "").trim() if hasattr(str, "trim") else (r.texto or "").strip(),
                created_at=r.created_at.isoformat() if r.created_at else None,
            )
        )
    return out
