# app/routers/public_examenes.py
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, literal_column, case
from typing import Optional, List, Dict, Any
from datetime import date, datetime, timezone

from ..database import get_db
from ..models import PlacementExam

# Modelos opcionales (capacidad / holds)
try:
    from ..models import PlacementRegistro  # registros/inscripciones al examen
except Exception:
    PlacementRegistro = None

try:
    from ..models import PlacementHold  # reservaciones temporales de asientos
except Exception:
    PlacementHold = None

router = APIRouter(prefix="/public", tags=["public"])

# ================= Helpers =================

def _first_col(model, names: list[str]):
    """Devuelve la 1a columna existente del modelo según los posibles nombres."""
    for n in names:
        col = getattr(model, n, None)
        if col is not None:
            return col
    return None

def _today() -> date:
    return date.today()

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _as_str(v):
    if v is None:
        return None
    return getattr(v, "value", None) or getattr(v, "name", None) or str(v)

def _int_or_0(v) -> int:
    try:
        return int(v)
    except Exception:
        return 0

# Estados que consideramos "consumen lugar" en PlacementRegistro
ACTIVE_REG_STATES = {"pendiente", "preinscrita", "confirmada", "validada"}

def _capacity_map(db: Session, exam_ids: List[int]) -> Dict[str, Any]:
    """
    Calcula capacidad por examen y devuelve:
      { "<id>": { cupo_total, inscritos_count, holds_activos, cupo_restante } }
    """
    out: Dict[str, Any] = {}
    if not exam_ids:
        return out

    # Columnas tolerantes a distintos esquemas
    total_col = _first_col(PlacementExam, ["cupo_total", "capacidad_total", "cupo", "capacidad"])

    # 1) cupo_total
    if total_col is not None:
        rows = (
            db.query(PlacementExam.id.label("eid"), total_col.label("total"))
              .filter(PlacementExam.id.in_(exam_ids))
              .all()
        )
        cupos = {r.eid: _int_or_0(r.total) for r in rows}
    else:
        cupos = {eid: 0 for eid in exam_ids}

    # 2) registros que ocupan asiento
    regs_map: Dict[int, int] = {eid: 0 for eid in exam_ids}
    if PlacementRegistro is not None:
        reg_exam_id_col = _first_col(PlacementRegistro, ["exam_id", "placement_exam_id", "examen_id"])
        reg_status_col  = _first_col(PlacementRegistro, ["estado", "status", "estatus"])

        if reg_exam_id_col is not None:
            q = db.query(
                reg_exam_id_col.label("eid"),
                func.count(literal_column("*")).label("cnt"),
            ).filter(reg_exam_id_col.in_(exam_ids))

            if reg_status_col is not None:
                q = q.filter(func.lower(reg_status_col).in_(ACTIVE_REG_STATES))

            q = q.group_by(reg_exam_id_col)
            for eid, cnt in q.all():
                regs_map[int(eid)] = _int_or_0(cnt)

    # 3) holds activos
    holds_map: Dict[int, int] = {eid: 0 for eid in exam_ids}
    if PlacementHold is not None:
        hold_exam_id_col   = _first_col(PlacementHold, ["exam_id", "placement_exam_id", "examen_id"])
        hold_expires_col   = _first_col(PlacementHold, ["expires_at", "expira_en"])
        hold_released_col  = _first_col(PlacementHold, ["released", "is_released", "liberado"])
        hold_released_at   = _first_col(PlacementHold, ["released_at", "liberado_en"])

        if hold_exam_id_col is not None and hold_expires_col is not None:
            conds = [hold_exam_id_col.in_(exam_ids), hold_expires_col > _now_utc()]
            if hold_released_col is not None:
                conds.append(or_(hold_released_col.is_(None), hold_released_col.is_(False)))
            if hold_released_at is not None:
                conds.append(hold_released_at.is_(None))

            qh = (
                db.query(
                    hold_exam_id_col.label("eid"),
                    func.count(literal_column("*")).label("cnt"),
                )
                .filter(and_(*conds))
                .group_by(hold_exam_id_col)
            )
            for eid, cnt in qh.all():
                holds_map[int(eid)] = _int_or_0(cnt)

    # 4) ensamblar
    for eid in exam_ids:
        total = _int_or_0(cupos.get(eid, 0))
        insc  = _int_or_0(regs_map.get(eid, 0))
        hact  = _int_or_0(holds_map.get(eid, 0))
        restante = max(total - insc - hact, 0)
        out[str(eid)] = {
            "id": eid,
            "cupo_total": total,
            "inscritos_count": insc,
            "holds_activos": hact,
            "cupo_restante": restante,
        }
    return out

# =============== Endpoints ===============

@router.get("/placement-exams")
def list_placement_exams_public(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=200),
    q: Optional[str] = None,
    idioma: Optional[str] = None,
    anio: Optional[int] = None,
    vigente: bool = True,
    include_capacity: bool = Query(False, description="Incluir bloque capacity por examen"),
    db: Session = Depends(get_db),
):
    """
    Lista PÚBLICA de exámenes de colocación.
    Devuelve: id, codigo, idioma, fecha, hora/hora_inicio/hora_fin, salón/aula/sala, sede, inscripcion {...}
    """

    # Columnas tolerantes (nombres alternos)
    codigo_col   = _first_col(PlacementExam, ["codigo", "code"])
    idioma_col   = _first_col(PlacementExam, ["idioma", "language", "lang"])
    fecha_col    = _first_col(PlacementExam, ["fecha", "fecha_examen", "exam_date"])

    # Ventana de inscripción
    insc_ini_col = _first_col(PlacementExam, ["insc_inicio", "inscripcion_inicio", "registro_inicio", "insc_from"])
    insc_fin_col = _first_col(PlacementExam, ["insc_fin", "inscripcion_fin", "registro_fin", "insc_to"])

    # ⏰ hora (soporta una sola columna 'hora' o par inicio/fin)
    hora_col     = _first_col(PlacementExam, ["hora", "hour", "hora_examen", "start_time"])  # simple
    hora_ini_col = _first_col(PlacementExam, ["hora_inicio", "start_time", "hora_inicia"])
    hora_fin_col = _first_col(PlacementExam, ["hora_fin", "end_time", "hora_termina"])

    # 🏫 salón/aula/sala + sede
    salon_col    = _first_col(PlacementExam, ["salon", "aula", "sala"])
    sede_col     = _first_col(PlacementExam, ["sede", "campus", "ubicacion", "site"])

    # Validación mínima
    if fecha_col is None and (insc_ini_col is None or insc_fin_col is None):
        raise HTTPException(
            status_code=500,
            detail="No se localizaron columnas suficientes (fecha o ventana de inscripción) en PlacementExam.",
        )

    query = db.query(PlacementExam)

    # Búsqueda libre
    if q and codigo_col is not None:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                codigo_col.ilike(like),
                (idioma_col.ilike(like) if idioma_col is not None else False),
            )
        )

    # Filtros exactos
    if idioma and idioma_col is not None:
        query = query.filter(idioma_col == idioma)

    if anio and fecha_col is not None:
        query = query.filter(func.extract("year", fecha_col) == anio)

    # Vigentes (o próximos si no hay ventana)
    if vigente:
        hoy = _today()
        window_ok = (
            and_(
                insc_ini_col.isnot(None),
                insc_fin_col.isnot(None),
                insc_ini_col <= hoy,
                insc_fin_col >= hoy,
            )
            if insc_ini_col is not None and insc_fin_col is not None
            else False
        )
        upcoming_ok = (
            and_(fecha_col.isnot(None), fecha_col >= hoy) if fecha_col is not None else False
        )
        query = query.filter(or_(window_ok, upcoming_ok))

    # ===== ORDEN: por inicio de inscripción (más antiguo primero).
    # Reglas:
    #  - Primero exámenes con ventana de inscripción (insc_inicio no NULL).
    #  - Dentro de ellos: insc_inicio ASC.
    #  - Luego (fallback): fecha ASC para los que no tienen ventana.
    #  - Desempate final: codigo ASC (case-insensitive).
    order_exprs = []

    if insc_ini_col is not None:
        # Empuja NULLs (sin ventana) al final
        order_exprs.append(
            case(
                (insc_ini_col.is_(None), 1),
                else_=0
            ).asc()
        )
        order_exprs.append(insc_ini_col.asc())

    if fecha_col is not None:
        order_exprs.append(fecha_col.asc())

    if codigo_col is not None:
        order_exprs.append(func.lower(codigo_col).asc())

    if order_exprs:
        query = query.order_by(*order_exprs)

    total = query.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)

    rows: List[PlacementExam] = (
        query.offset((page - 1) * page_size)
             .limit(page_size)
             .all()
    )

    items = []
    ids: List[int] = []

    for e in rows:
        _codigo = getattr(e, getattr(codigo_col, "key", "codigo"), None) if codigo_col is not None else getattr(e, "codigo", None)
        _idioma = getattr(e, getattr(idioma_col, "key", "idioma"), None) if idioma_col is not None else getattr(e, "idioma", None)
        _fecha  = getattr(e, getattr(fecha_col,  "key", "fecha"),  None) if fecha_col  is not None else getattr(e, "fecha", None)

        _insc_from = getattr(e, getattr(insc_ini_col, "key", "insc_inicio"), None) if insc_ini_col is not None else None
        _insc_to   = getattr(e, getattr(insc_fin_col, "key", "insc_fin"),    None) if insc_fin_col is not None else None

        # ⏰ hora (simple + rango)
        _hora      = getattr(e, getattr(hora_col, "key", "hora"), None) if hora_col is not None else getattr(e, "hora", None)
        _hora_ini  = getattr(e, getattr(hora_ini_col, "key", "hora_inicio"), None) if hora_ini_col is not None else getattr(e, "hora_inicio", None)
        _hora_fin  = getattr(e, getattr(hora_fin_col, "key", "hora_fin"), None) if hora_fin_col is not None else getattr(e, "hora_fin", None)

        # 🏫 salón/aula/sala + sede
        _salon     = getattr(e, getattr(salon_col, "key", "salon"), None) if salon_col is not None else getattr(e, "salon", None)
        _aula      = getattr(e, "aula", None)
        _sala      = getattr(e, "sala", None)
        _sede      = getattr(e, getattr(sede_col, "key", "sede"), None) if sede_col is not None else getattr(e, "sede", None)

        items.append({
            "id": e.id,
            "codigo": _codigo,
            "idioma": _as_str(_idioma),
            "fecha": _fecha,

            # Hora: el front usa 'hora' o (hora_inicio/hora_fin)
            "hora": _hora,
            "hora_inicio": _hora_ini,
            "hora_fin": _hora_fin,

            # Salón: el front cae en salon || aula || sala
            "salon": _salon,
            "aula": _aula,
            "sala": _sala,

            # Campus/sede
            "sede": _sede,

            # Duración (opcional, el front la muestra junto a la hora si existe)
            "duracion_min": getattr(e, "duracion_min", None),

            # Ventana de inscripción (normalizada)
            "inscripcion": {"from": _insc_from, "to": _insc_to} if (_insc_from or _insc_to) else None,
        })
        ids.append(int(e.id))

    # Inyecta capacity si lo piden
    if include_capacity and ids:
        caps = _capacity_map(db, ids)
        for it in items:
            c = caps.get(str(it["id"]))
            if c:
                it["capacity"] = {
                    "cupo_total": c["cupo_total"],
                    "cupo_restante": c["cupo_restante"],
                    "inscritos_count": c["inscritos_count"],
                    "holds_activos": c["holds_activos"],
                }
                # compat plano
                it["cupo_total"] = c["cupo_total"]
                it["cupo_restante"] = c["cupo_restante"]

    return {"items": items, "page": page, "pages": pages, "total": total}


@router.get("/placement-exams/capacity")
def get_placement_exams_capacity(
    ids: str = Query(..., description="CSV de IDs, p.ej. 1, 9, 8, 10"),
    db: Session = Depends(get_db),
):
    """Devuelve capacidad por lote. No requiere auth."""
    try:
        exam_ids = [int(x) for x in ids.split(",") if x.strip()]
    except Exception:
        raise HTTPException(status_code=400, detail="Parámetro ids inválido")
    return _capacity_map(db, exam_ids)


@router.post("/placement-exams/capacity")
def post_placement_exams_capacity(
    payload: dict = Body(..., example={"ids": [1, 9, 8, 10]}),
    db: Session = Depends(get_db),
):
    """Batch por POST para clientes que no quieren querystring largo."""
    ids = payload.get("ids") or []
    try:
        exam_ids = [int(x) for x in ids]
    except Exception:
        raise HTTPException(status_code=400, detail="Campo 'ids' inválido")
    return _capacity_map(db, exam_ids)
