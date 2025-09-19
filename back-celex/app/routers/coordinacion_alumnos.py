# app/routers/coordinacion_alumnos.py
from typing import List, Optional, Tuple, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case, desc

from ..database import get_db
from ..auth import require_coordinator_or_admin
from ..models import User, Inscripcion, Ciclo, Evaluacion
from .. import models_asistencia as ma  # AsistenciaSesion (ciclo_id), AsistenciaRegistro (sesion_id, inscripcion_id, estado)
from datetime import date  # 👈👈👈 AÑADIR


# ------------------------------
# Router
# ------------------------------
router = APIRouter(
    prefix="/coordinacion",
    tags=["Coordinación - Alumnos"],
)

# ------------------------------
# Schemas (locales a este router)
# ------------------------------
from pydantic import BaseModel, ConfigDict, EmailStr

class AlumnoFullOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Identificadores
    id: Optional[int] = None
    inscripcion_id: Optional[int] = None

    # Datos personales
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    curp: Optional[str] = None
    boleta: Optional[str] = None
    is_ipn: Optional[bool] = None
    telefono: Optional[str] = None
    tutor_telefono: Optional[str] = None   # 👈👈👈 NUEVO

    # Dirección
    addr_calle: Optional[str] = None
    addr_numero: Optional[str] = None
    addr_colonia: Optional[str] = None
    addr_municipio: Optional[str] = None
    addr_estado: Optional[str] = None
    addr_cp: Optional[str] = None

    # Metadatos / estados
    fecha_inscripcion: Optional[str] = None
    estado: Optional[str] = None
    created_at: Optional[str] = None

    # ⬇️ NUEVO: Perfil IPN
    ipn_nivel: Optional[str] = None
    ipn_unidad_academica: Optional[str] = None


class AlumnosListResponse(BaseModel):
    items: List[AlumnoFullOut]
    total: int
    page: int
    page_size: int
    pages: int


class HistorialAsistenciaSummary(BaseModel):
    presentes: int = 0
    ausentes: int = 0
    retardos: int = 0
    justificados: int = 0
    total_sesiones: int = 0
    porcentaje_asistencia: float = 0.0  # 0..100


class HistorialCicloItem(BaseModel):
    inscripcion_id: int
    ciclo_id: int
    ciclo_codigo: str
    idioma: Optional[str] = None
    nivel: Optional[str] = None
    modalidad: Optional[str] = None
    turno: Optional[str] = None

    fecha_inicio: Optional[str] = None  # ISO date
    fecha_fin: Optional[str] = None     # ISO date
    horario: Optional[str] = None       # "HH:MM - HH:MM" si aplica

    inscripcion_estado: Optional[str] = None
    inscripcion_tipo: Optional[str] = None
    fecha_inscripcion: Optional[str] = None  # ISO datetime

    calificacion: Optional[float] = None

    # Docente asignado
    docente_id: Optional[int] = None
    docente_nombre: Optional[str] = None
    docente_email: Optional[EmailStr] = None

    asistencia: HistorialAsistenciaSummary = HistorialAsistenciaSummary()


class HistorialAlumnoResponse(BaseModel):
    alumno_id: int
    total: int
    items: List[HistorialCicloItem]


# ------------------------------
# Helpers
# ------------------------------
def _to_full_out(u: User, ins: Optional[Inscripcion]) -> AlumnoFullOut:
    nombre = (f"{u.first_name or ''} {u.last_name or ''}").strip()

    # tolerante a nombres: usa ipn_unidad (modelo) y si algún día
    # existe ipn_unidad_academica, también lo toma
    ua = (
        getattr(u, "ipn_unidad", None)
        or getattr(u, "ipn_unidad_academica", None)
    )

    # 👇 calcular si es menor
    es_menor = _es_menor_de_edad(getattr(u, "curp", None))

    return AlumnoFullOut(
        id=u.id,
        inscripcion_id=getattr(ins, "id", None),

        first_name=u.first_name,
        last_name=u.last_name,
        nombre=nombre or None,
        email=u.email,
        curp=u.curp,
        boleta=u.boleta,
        is_ipn=u.is_ipn,
        telefono=u.telefono,
        tutor_telefono=(u.tutor_telefono if es_menor else None),  # 👈 sólo si es menor

        addr_calle=u.addr_calle,
        addr_numero=u.addr_numero,
        addr_colonia=u.addr_colonia,
        addr_municipio=u.addr_municipio,
        addr_estado=u.addr_estado,
        addr_cp=u.addr_cp,

        fecha_inscripcion=(ins.created_at.isoformat() if ins and getattr(ins, "created_at", None) else None),
        estado=(ins.status if ins else None),
        created_at=(u.created_at.isoformat() if getattr(u, "created_at", None) else None),

        # ⬇️ mapeo correcto para el front
        ipn_nivel=getattr(u, "ipn_nivel", None),
        ipn_unidad_academica=ua,
    )



def _safe_horario(c: Ciclo) -> Optional[str]:
    """Convierte hora_inicio/hora_fin a 'HH:MM - HH:MM' si existen; en su defecto None."""
    try:
        hi = getattr(c, "hora_inicio", None)
        hf = getattr(c, "hora_fin", None)
        if hi and hf:
            return f"{str(hi)[:5]} - {str(hf)[:5]}"
    except Exception:
        pass
    return None


def _to_iso(dt) -> Optional[str]:
    return dt.isoformat() if hasattr(dt, "isoformat") else (str(dt) if dt else None)


# ------------------------------
# Helpers extra para fechas de Ciclo (tolerantes a nombres distintos)
# ------------------------------
def _ciclo_start_col():
    """
    Devuelve la columna SQLAlchemy que represente el inicio del curso, si existe.
    Orden de preferencia: fecha_inicio, curso_inicio, curso_from, inicio, fecha_inicio_curso
    """
    for name in ("fecha_inicio", "curso_inicio", "curso_from", "inicio", "fecha_inicio_curso"):
        col = getattr(Ciclo, name, None)
        if col is not None:
            return col
    return None


def _ciclo_end_col():
    """
    Devuelve la columna SQLAlchemy que represente el fin del curso, si existe.
    Orden de preferencia: fecha_fin, curso_fin, curso_to, fin, fecha_fin_curso
    """
    for name in ("fecha_fin", "curso_fin", "curso_to", "fin", "fecha_fin_curso"):
        col = getattr(Ciclo, name, None)
        if col is not None:
            return col
    return None


def _ciclo_start_value(c: Ciclo):
    for name in ("fecha_inicio", "curso_inicio", "curso_from", "inicio", "fecha_inicio_curso"):
        if hasattr(c, name):
            v = getattr(c, name)
            if v:
                return v
    return None


def _ciclo_end_value(c: Ciclo):
    for name in ("fecha_fin", "curso_fin", "curso_to", "fin", "fecha_fin_curso"):
        if hasattr(c, name):
            v = getattr(c, name)
            if v:
                return v
    return None


def _dob_from_curp(curp: Optional[str]) -> Optional[date]:
    """Extrae fecha de nacimiento (YYMMDD) de la CURP y resuelve el siglo."""
    if not curp or len(curp) < 10:
        return None
    try:
        yy = int(curp[4:6])
        mm = int(curp[6:8])
        dd = int(curp[8:10])
        today = date.today()
        century = 2000 if yy <= (today.year % 100) else 1900
        return date(century + yy, mm, dd)
    except Exception:
        return None


def _es_menor_de_edad(curp: Optional[str]) -> bool:
    """True si la edad calculada por CURP es < 18; False si no se puede calcular."""
    dob = _dob_from_curp(curp)
    if not dob:
        return False
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age < 18



# ------------------------------
# GET /coordinacion/alumnos
# ------------------------------
@router.get(
    "/alumnos",
    response_model=AlumnosListResponse,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def listar_alumnos(
    q: Optional[str] = Query(None, description="Búsqueda por nombre, email, CURP, boleta"),
    anio: Optional[int] = Query(None, description="Año del ciclo (por fecha_inicio si existe o prefijo de codigo 'YYYY-…')"),
    idioma: Optional[str] = Query(None, description="ingles|frances|aleman|italiano|chino|japones|..."),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Lista **inscripciones** con datos completos del alumno (una fila por inscripción).
    Filtros:
      • `anio`: por año de fecha_inicio del ciclo (si existe) o por prefijo `YYYY-` de `Ciclo.codigo`
      • `idioma`: igualdad con `Ciclo.idioma` (enum o string, case-insensitive)
      • `q`: nombre, apellidos, email, curp, boleta
    """
    qry = (
        db.query(Inscripcion, User, Ciclo)
        .join(User, User.id == Inscripcion.alumno_id)
        .join(Ciclo, Ciclo.id == Inscripcion.ciclo_id)
    )

    # Filtro idioma (case-insensitive si es string)
    if idioma:
        try:
            qry = qry.filter(or_(Ciclo.idioma == idioma, func.lower(Ciclo.idioma) == idioma.lower()))
        except Exception:
            qry = qry.filter(Ciclo.idioma == idioma)

    # Filtro por año (fecha de inicio si existe, o prefijo del código)
    start_col = _ciclo_start_col()
    if anio:
        conds = [func.substr(Ciclo.codigo, 1, 4) == str(anio)]
        if start_col is not None:
            conds.append(func.extract('year', start_col) == anio)
        qry = qry.filter(or_(*conds))

    # Búsqueda libre
    if q:
        pat = f"%{q.strip()}%"
        qry = qry.filter(
            or_(
                User.first_name.ilike(pat),
                User.last_name.ilike(pat),
                User.email.ilike(pat),
                User.curp.ilike(pat),
                User.boleta.ilike(pat),
            )
        )

    # Ordenamiento (apellido, nombre, luego fecha de inicio si existe; si no, por código)
    order_cols = [User.last_name.asc(), User.first_name.asc()]
    if start_col is not None:
        order_cols.extend([desc(start_col), desc(Ciclo.codigo)])
    else:
        order_cols.append(desc(Ciclo.codigo))
    qry = qry.order_by(*order_cols)

    total = qry.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)

    offset = (page - 1) * page_size
    rows = qry.offset(offset).limit(page_size).all()

    items = [_to_full_out(u=user, ins=ins) for (ins, user, _ciclo) in rows]

    return AlumnosListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ------------------------------
# GET /coordinacion/alumnos/{alumno_id}/historial
# ------------------------------
@router.get(
    "/alumnos/{alumno_id}/historial",
    response_model=HistorialAlumnoResponse,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def historial_alumno(
    alumno_id: int,
    db: Session = Depends(get_db),
    idioma: Optional[str] = Query(None, description="Filtro por idioma (ingles/frances/aleman/...)"),
    anio: Optional[int] = Query(None, description="Año del ciclo por fecha_inicio si existe o prefijo de codigo (YYYY)"),
    estado: Optional[str] = Query(None, description="Filtro por Inscripcion.status (case-insensitive)"),
):
    """
    Historial de ciclos del alumno:
      - Ciclo: codigo/idioma/nivel/modalidad/turno/fechas/horario
      - Inscripción: status, tipo, fecha_inscripcion
      - Evaluación: calificacion (si existe)
      - Asistencia: resumen por inscripción
      - Docente: id, nombre, email (FK directa o tabla intermedia CicloDocente)
    """
    # Base: Inscripcion join Ciclo
    q = (
        db.query(Inscripcion, Ciclo)
        .join(Ciclo, Ciclo.id == Inscripcion.ciclo_id)
        .filter(Inscripcion.alumno_id == alumno_id)
    )

    # Estado (case-insensitive)
    if estado:
        q = q.filter(func.lower(Inscripcion.status) == estado.strip().lower())

    # Idioma (case-insensitive)
    if idioma:
        try:
            q = q.filter(or_(Ciclo.idioma == idioma, func.lower(Ciclo.idioma) == idioma.lower()))
        except Exception:
            q = q.filter(Ciclo.idioma == idioma)

    # Año (por columna de inicio si existe, o prefijo del código)
    start_col = _ciclo_start_col()
    if anio:
        conds = [func.substr(Ciclo.codigo, 1, 4) == str(anio)]
        if start_col is not None:
            conds.append(func.extract('year', start_col) == anio)
        q = q.filter(or_(*conds))

    # Orden
    if start_col is not None:
        q = q.order_by(desc(start_col), desc(Ciclo.codigo))
    else:
        q = q.order_by(desc(Ciclo.codigo))

    base_rows = q.all()
    if not base_rows:
        return HistorialAlumnoResponse(alumno_id=alumno_id, total=0, items=[])

    ins_ids = [ins.id for (ins, _c) in base_rows]
    ciclo_ids = [c.id for (_ins, c) in base_rows]

    # --- Evaluaciones por inscripción (tolerante) ---
    eval_map: Dict[int, Optional[float]] = {}
    try:
        if ins_ids:
            eval_rows = (
                db.query(Evaluacion.inscripcion_id, Evaluacion.calificacion)
                .filter(Evaluacion.inscripcion_id.in_(ins_ids))
                .all()
            )
            for iid, cal in eval_rows:
                eval_map[iid] = cal
    except Exception:
        eval_map = {}

    # --- Asistencia por inscripción (tolerante) ---
    asis_map: Dict[int, HistorialAsistenciaSummary] = {}
    try:
        if ins_ids:
            AR = ma.AsistenciaRegistro
            AS = ma.AsistenciaSesion

            presentes = func.sum(case((AR.estado == "presente", 1), else_=0)).label("presentes")
            ausentes = func.sum(case((AR.estado == "ausente", 1), else_=0)).label("ausentes")
            retardos = func.sum(case((AR.estado == "retardo", 1), else_=0)).label("retardos")
            justificados = func.sum(case((AR.estado == "justificado", 1), else_=0)).label("justificados")
            total = func.count(AR.id).label("total")

            asis_rows = (
                db.query(
                    AR.inscripcion_id,
                    presentes,
                    ausentes,
                    retardos,
                    justificados,
                    total,
                )
                .join(AS, AS.id == AR.sesion_id)
                .filter(AR.inscripcion_id.in_(ins_ids))
                .group_by(AR.inscripcion_id)
                .all()
            )

            for (iid, p, a, r, j, t) in asis_rows:
                p = int(p or 0); a = int(a or 0); r = int(r or 0); j = int(j or 0); t = int(t or 0)
                pct = (p * 100.0 / t) if t else 0.0
                asis_map[iid] = HistorialAsistenciaSummary(
                    presentes=p, ausentes=a, retardos=r, justificados=j,
                    total_sesiones=t, porcentaje_asistencia=round(pct, 2),
                )
    except Exception:
        asis_map = {}

    # --- Docente por ciclo (FK directa y fallback a tabla intermedia si existe) ---
    docente_info_map: Dict[int, Tuple[Optional[int], Optional[str], Optional[str]]] = {}
    try:
        if hasattr(Ciclo, "docente_id"):
            rows_doc = (
                db.query(Ciclo.id, User.id, User.first_name, User.last_name, User.email)
                .outerjoin(User, User.id == getattr(Ciclo, "docente_id"))
                .filter(Ciclo.id.in_(ciclo_ids))
                .all()
            )
            for cid, uid, fn, ln, em in rows_doc:
                nom = f"{fn or ''} {ln or ''}".strip() or None
                docente_info_map[cid] = (uid, nom, em)
    except Exception:
        pass

    if not docente_info_map:
        try:
            from ..models import CicloDocente as _CicloDocente  # opcional
            if hasattr(_CicloDocente, "docente_id"):
                rows_doc2 = (
                    db.query(_CicloDocente.ciclo_id, User.id, User.first_name, User.last_name, User.email, _CicloDocente.id)
                    .join(User, User.id == _CicloDocente.docente_id)
                    .filter(_CicloDocente.ciclo_id.in_(ciclo_ids))
                    .order_by(_CicloDocente.ciclo_id.asc(), _CicloDocente.id.desc())
                    .all()
                )
                for cid, uid, fn, ln, em, _cdid in rows_doc2:
                    if cid in docente_info_map:
                        continue
                    nom = f"{fn or ''} {ln or ''}".strip() or None
                    docente_info_map[cid] = (uid, nom, em)
        except Exception:
            pass

    # --- Construcción de respuesta ---
    items: List[HistorialCicloItem] = []
    for ins, c in base_rows:
        asistencia = asis_map.get(ins.id, HistorialAsistenciaSummary())
        calificacion = eval_map.get(ins.id)

        doc_id, doc_nom, doc_email = (None, None, None)
        if c.id in docente_info_map:
            doc_id, doc_nom, doc_email = docente_info_map[c.id]

        items.append(
            HistorialCicloItem(
                inscripcion_id=ins.id,
                ciclo_id=c.id,
                ciclo_codigo=c.codigo,
                idioma=str(getattr(c, "idioma", None)) if getattr(c, "idioma", None) is not None else None,
                nivel=str(getattr(c, "nivel", None)) if getattr(c, "nivel", None) is not None else None,
                modalidad=str(getattr(c, "modalidad", None)) if getattr(c, "modalidad", None) is not None else None,
                turno=str(getattr(c, "turno", None)) if getattr(c, "turno", None) is not None else None,

                # Fechas tolerantes
                fecha_inicio=_to_iso(_ciclo_start_value(c)),
                fecha_fin=_to_iso(_ciclo_end_value(c)),

                horario=_safe_horario(c),
                inscripcion_estado=getattr(ins, "status", None),
                inscripcion_tipo=str(getattr(ins, "tipo", None)) if getattr(ins, "tipo", None) is not None else None,
                fecha_inscripcion=_to_iso(getattr(ins, "created_at", None)) or _to_iso(getattr(ins, "fecha_inscripcion", None)),
                calificacion=calificacion,
                docente_id=doc_id,
                docente_nombre=doc_nom,
                docente_email=doc_email,
                asistencia=asistencia,
            )
        )

    # Orden final por fecha_inicio desc (si hay), luego código desc
    items.sort(key=lambda it: (it.fecha_inicio or "", it.ciclo_codigo or ""), reverse=True)

    return HistorialAlumnoResponse(
        alumno_id=alumno_id,
        total=len(items),
        items=items,
    )
