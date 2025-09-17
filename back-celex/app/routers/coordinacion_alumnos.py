# app/routers/coordinacion_alumnos.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from ..database import get_db
from ..auth import require_coordinator_or_admin
from ..models import User, Inscripcion, Ciclo

# ------------------------------
# Router
# ------------------------------
router = APIRouter(prefix="/coordinacion", tags=["Coordinación - Alumnos"])  # expone GET /coordinacion/alumnos

# ------------------------------
# Schemas (locales a este router)
# ------------------------------
from pydantic import BaseModel, ConfigDict, EmailStr

class AlumnoFullOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Identificadores
    id: Optional[int] = None                 # id del usuario/alumno
    inscripcion_id: Optional[int] = None     # id de la inscripción

    # Datos personales
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    nombre: Optional[str] = None             # nombre completo (si prefieres consumirlo así en el front)
    email: Optional[EmailStr] = None
    curp: Optional[str] = None
    boleta: Optional[str] = None
    is_ipn: Optional[bool] = None
    telefono: Optional[str] = None

    # Dirección
    addr_calle: Optional[str] = None
    addr_numero: Optional[str] = None
    addr_colonia: Optional[str] = None
    addr_municipio: Optional[str] = None
    addr_estado: Optional[str] = None
    addr_cp: Optional[str] = None

    # Metadatos / estados
    fecha_inscripcion: Optional[str] = None  # ISO datetime (Inscripcion.created_at)
    estado: Optional[str] = None             # Inscripcion.status
    created_at: Optional[str] = None         # ISO datetime (User.created_at)

class AlumnosListResponse(BaseModel):
    items: List[AlumnoFullOut]
    total: int
    page: int
    page_size: int
    pages: int

# ------------------------------
# Helper para armar salida
# ------------------------------
def _to_full_out(u: User, ins: Optional[Inscripcion]) -> AlumnoFullOut:
    nombre = (f"{u.first_name or ''} {u.last_name or ''}").strip()
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
        addr_calle=u.addr_calle,
        addr_numero=u.addr_numero,
        addr_colonia=u.addr_colonia,
        addr_municipio=u.addr_municipio,
        addr_estado=u.addr_estado,
        addr_cp=u.addr_cp,
        fecha_inscripcion=(ins.created_at.isoformat() if ins and getattr(ins, "created_at", None) else None),
        estado=(ins.status if ins else None),
        created_at=(u.created_at.isoformat() if getattr(u, "created_at", None) else None),
    )

# ------------------------------
# GET /coordinacion/alumnos
# ------------------------------
@router.get("/alumnos", response_model=AlumnosListResponse, dependencies=[Depends(require_coordinator_or_admin)])
def listar_alumnos(
    q: Optional[str] = Query(None, description="Búsqueda por nombre, email, CURP, boleta"),
    anio: Optional[int] = Query(None, description="Filtra por año del ciclo (prefijo de codigo: 'YYYY-…')"),
    idioma: Optional[str] = Query(None, description="ingles|frances|aleman|italiano|chino|japones|..."),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Lista **inscripciones** con datos completos del alumno.
    - Si quieres un alumno por fila *sin* repetir por inscripción, aplicaremos un DISTINCT por usuario, pero por ahora
      devolvemos una fila por inscripción (esto permite mostrar `estado`/`fecha_inscripcion`).
    Filtros:
      • `anio`: coincide contra el prefijo del `Ciclo.codigo` (p.ej. 2025-...)
      • `idioma`: compara por igualdad con `Ciclo.idioma` (enum o string)
      • `q`: busca en nombre, apellidos, email, curp y boleta
    """

    # Base: Inscripcion -> User -> Ciclo
    qry = (
        db.query(Inscripcion, User, Ciclo)
        .join(User, User.id == Inscripcion.alumno_id)
        .join(Ciclo, Ciclo.id == Inscripcion.ciclo_id)
    )

    # Filtro idioma
    if idioma:
        # Ciclo.idioma puede ser Enum o String; usamos una comparación doble para robustez
        try:
            qry = qry.filter(or_(Ciclo.idioma == idioma, func.lower(Ciclo.idioma) == idioma.lower()))
        except Exception:
            # Si el tipo del Enum no permite lower(), probamos una comparación directa
            qry = qry.filter(Ciclo.idioma == idioma)

    # Filtro año por prefijo del código de ciclo "YYYY-..."
    if anio:
        like = f"{anio}-%"
        qry = qry.filter(Ciclo.codigo.like(like))

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

    # Ordenamiento (apellido, nombre, luego fecha de inscripción DESC)
    qry = qry.order_by(User.last_name.asc(), User.first_name.asc(), Inscripcion.created_at.desc())

    # Total para paginación
    total = qry.count()
    pages = max(1, (total + page_size - 1) // page_size)
    if page > pages:
        page = pages

    # Page slice
    offset = (page - 1) * page_size
    rows = qry.offset(offset).limit(page_size).all()

    items = [_to_full_out(u=user, ins=ins) for (ins, user, ciclo) in rows]

    return AlumnosListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
