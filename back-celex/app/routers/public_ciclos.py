# app/routers/public_ciclos.py
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import Optional, List

from ..database import get_db
from ..models import Ciclo
try:
    # si tienes el modelo de inscripciones
    from ..models import Inscripcion
except Exception:
    Inscripcion = None  # fallback si no existe el modelo

router = APIRouter(prefix="/public", tags=["public"])

def _getattr(obj, name_list: list[str], default=None):
    for n in name_list:
        if hasattr(obj, n):
            return getattr(obj, n)
    return default

@router.get("/ciclos-abiertos")
def list_ciclos_abiertos(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    idioma: Optional[str] = None,
    modalidad: Optional[str] = None,
    turno: Optional[str] = None,
    nivel: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Lista pública de ciclos con PERIODO DE INSCRIPCIÓN vigente.
    No requiere autenticación.
    """

    # --- Campos fecha de inscripción (ajusta nombres si difieren) ---
    insc_ini_col = (
        getattr(Ciclo, "inscripcion_inicio", None)
        or getattr(Ciclo, "insc_inicio", None)
        or getattr(Ciclo, "inscripcion_from", None)
    )
    insc_fin_col = (
        getattr(Ciclo, "inscripcion_fin", None)
        or getattr(Ciclo, "insc_fin", None)
        or getattr(Ciclo, "inscripcion_to", None)
    )

    if insc_ini_col is None or insc_fin_col is None:
        raise HTTPException(status_code=500, detail="No se localizaron columnas de inscripción en el modelo Ciclo.")

    from datetime import date
    hoy = date.today()

    query = db.query(Ciclo)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (getattr(Ciclo, "codigo").ilike(like)) |
            (getattr(Ciclo, "idioma").ilike(like)) |
            (getattr(Ciclo, "nivel").ilike(like))
        )

    if idioma:
        query = query.filter(getattr(Ciclo, "idioma") == idioma)
    if modalidad:
        query = query.filter(getattr(Ciclo, "modalidad") == modalidad)
    if turno:
        query = query.filter(getattr(Ciclo, "turno") == turno)
    if nivel:
        query = query.filter(getattr(Ciclo, "nivel") == nivel)

    # Solo periodos de inscripción vigentes (hoy dentro del rango)
    query = query.filter(and_(insc_ini_col <= hoy, insc_fin_col >= hoy))

    total = query.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)

    rows: List[Ciclo] = (
        query.order_by(getattr(Ciclo, "codigo"))
             .offset((page - 1) * page_size)
             .limit(page_size)
             .all()
    )

    # Estados que consideramos "ocupando lugar"
    ACTIVE = {"registrada", "preinscrita", "confirmada"}

    def as_str(v):
        if v is None:
            return None
        return getattr(v, "value", None) or getattr(v, "name", None) or str(v)

    def derive_disponibles(c: Ciclo) -> tuple[int, int, int]:
        """Devuelve (disp, total, usados_calculados)"""
        # total
        total = (
            getattr(c, "cupo_total", None)
            or getattr(c, "cupo", None)
            or getattr(c, "capacidad", None)
            or 0
        )
        try:
            total = int(total)
        except Exception:
            total = 0

        # 1) campos 'restantes' explícitos
        for name in ["cupo_restante", "vacantes", "disponibles", "cupos_disponibles", "cupos_restantes"]:
            val = getattr(c, name, None)
            if isinstance(val, (int, float)):
                disp = int(val)
                return max(0, min(total, disp)), total, total - max(0, min(total, disp))

        # 2) usar lugares_disponibles si está en rango
        ld = getattr(c, "lugares_disponibles", None)
        if isinstance(ld, (int, float)):
            disp = int(ld)
            if 0 <= disp <= max(total, 0):
                return disp, total, total - disp

        # 3) calcular por 'usados'
        usados_candidates = [
            getattr(c, "ocupados", None),
            getattr(c, "usados", None),
            getattr(c, "inscritos", None),
            getattr(c, "inscritos_actuales", None),
            getattr(c, "inscritos_count", None),
            getattr(c, "preinscritos_count", None),
        ]
        usados = next((int(x) for x in usados_candidates if isinstance(x, (int, float))), None)

        # 4) si no hay 'usados', contar inscripciones activas en DB (si existe el modelo)
        if usados is None and Inscripcion is not None:
            try:
                # detecta el campo de estatus
                status_col = (
                    getattr(Inscripcion, "status", None)
                    or getattr(Inscripcion, "estado", None)
                    or getattr(Inscripcion, "estatus", None)
                )
                ciclo_id_col = getattr(Inscripcion, "ciclo_id", None)
                if status_col is not None and ciclo_id_col is not None:
                    usados = (
                        db.query(func.count(Inscripcion.id))
                        .filter(
                            ciclo_id_col == c.id,
                            func.lower(status_col).in_(ACTIVE),
                        )
                        .scalar()
                    )
            except Exception:
                usados = None

        if not isinstance(usados, int):
            usados = 0

        disp = total - usados
        if not isinstance(disp, int):
            disp = 0

        # clamp
        disp = max(0, min(total, disp))
        return disp, total, usados

    items = []
    for c in rows:
        disp, total_cupo, ocupados = derive_disponibles(c)

        items.append({
            "id": c.id,
            "codigo": getattr(c, "codigo", None),
            "idioma": as_str(getattr(c, "idioma", None)),
            "nivel": as_str(getattr(c, "nivel", None)),
            "modalidad": as_str(getattr(c, "modalidad", None)),
            "turno": as_str(getattr(c, "turno", None)),
            "aula": getattr(c, "aula", None),
            "dias": getattr(c, "dias", None) or [],
            "hora_inicio": getattr(c, "hora_inicio", None),
            "hora_fin": getattr(c, "hora_fin", None),
            "examenMT": getattr(c, "examenMT", None),
            "examenFinal": getattr(c, "examenFinal", None),

            # capacidad consistente
            "cupo_total": total_cupo,
            "lugares_disponibles": disp,
            "ocupados": ocupados,  # útil para depurar en front (puedes ocultarlo)

            # Ventanas de inscripción/curso
            "inscripcion": {
                "from": getattr(c, insc_ini_col.key),
                "to": getattr(c, insc_fin_col.key),
            },
            "curso": {
                "from": _getattr(c, ["curso_inicio", "curso_from"]),
                "to": _getattr(c, ["curso_fin", "curso_to"]),
            },

            "modalidad_asistencia": getattr(c, "modalidad_asistencia", None),
        })

    return {"items": items, "page": page, "pages": pages, "total": total}
