# app/routers/docente_grupos.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from ..database import get_db
from ..auth import get_current_user
from ..models import Ciclo, User, UserRole
from .. import schemas

router = APIRouter(prefix="/docente", tags=["Docente"])


# ----------------------------
# Helpers
# ----------------------------
def _ensure_teacher(u: User):
    """
    Asegura que el usuario actual sea docente (o superuser).
    Ajusta aquí si tu enum usa 'docente' en lugar de 'teacher'.
    """
    roles_perm = {getattr(UserRole, "teacher", None), getattr(UserRole, "superuser", None)}
    roles_perm = {r for r in roles_perm if r is not None}  # filtra None si no existen
    if getattr(u, "role", None) not in roles_perm:
        raise HTTPException(status_code=403, detail="Permisos insuficientes (docente o superuser)")


def _user_display_name(u) -> Optional[str]:
    """
    Devuelve un nombre mostrable del usuario sin asumir qué campos existen.
    Intenta: nombre | name | full_name | (nombres + apellidos) | username | email
    """
    if not u:
        return None

    for attr in ("nombre", "name", "full_name"):
        val = getattr(u, attr, None)
        if val:
            return str(val)

    partes = []
    for attr in ("nombres", "first_name", "given_name"):
        v = getattr(u, attr, None)
        if v:
            partes.append(str(v))
    for attr in ("apellido_paterno", "last_name", "family_name", "apellido_materno"):
        v = getattr(u, attr, None)
        if v:
            partes.append(str(v))
    if partes:
        return " ".join([p for p in partes if p])

    for attr in ("username", "email"):
        v = getattr(u, attr, None)
        if v:
            return str(v)

    return str(u)


def _enum_val(value):
    """Devuelve value.value si es Enum, o el valor tal cual si no lo es."""
    if hasattr(value, "value"):
        return value.value
    return value


def _to_ciclo_lite(c: Ciclo) -> schemas.CicloLite:
    """
    Mapea un Ciclo a CicloLite según tus schemas,
    usando accesos seguros para evitar AttributeError.
    """
    # Días como lista de strings
    dias = []
    for d in (getattr(c, "dias", None) or []):
        dias.append(_enum_val(d) if d is not None else None)
    dias = [d for d in dias if d is not None]

    inscripcion = None
    if getattr(c, "insc_inicio", None) and getattr(c, "insc_fin", None):
        inscripcion = {"from": c.insc_inicio, "to": c.insc_fin}

    curso = None
    if getattr(c, "curso_inicio", None) and getattr(c, "curso_fin", None):
        curso = {"from": c.curso_inicio, "to": c.curso_fin}

    return schemas.CicloLite(
        id=getattr(c, "id", None),
        codigo=getattr(c, "codigo", None),
        idioma=_enum_val(getattr(c, "idioma", None)) if getattr(c, "idioma", None) is not None else None,
        modalidad=_enum_val(getattr(c, "modalidad", None)) if getattr(c, "modalidad", None) is not None else None,
        turno=_enum_val(getattr(c, "turno", None)) if getattr(c, "turno", None) is not None else None,
        nivel=_enum_val(getattr(c, "nivel", None)) if getattr(c, "nivel", None) is not None else None,
        dias=dias,
        hora_inicio=getattr(c, "hora_inicio", None),
        hora_fin=getattr(c, "hora_fin", None),
        aula=getattr(c, "aula", None),
        inscripcion=inscripcion,
        curso=curso,
        docente_nombre=_user_display_name(getattr(c, "docente", None)),
    )


# ----------------------------
# Schemas locales (alumnos)
# ----------------------------
class AlumnoEnGrupo(BaseModel):
    inscripcion_id: int
    alumno_id: int
    alumno_nombre: Optional[str] = None
    alumno_email: Optional[str] = None
    alumno_username: Optional[str] = None
    boleta: Optional[str] = None
    status: Optional[str] = None  # si usas Enum en Inscripcion.status, aquí irá el .value


# ----------------------------
# Endpoints
# ----------------------------
@router.get("/grupos", response_model=List[schemas.CicloLite])
def mis_grupos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Buscar por código o aula"),
):
    """
    Lista los ciclos (grupos) asignados al docente autenticado.
    - Protegido por token.
    - Solo accesible a role: teacher/superuser (ajustable en _ensure_teacher).
    - Filtro básico 'q' por código o aula.
    """
    _ensure_teacher(current_user)

    query = (
        db.query(Ciclo)
        .options(joinedload(Ciclo.docente))
        .filter(Ciclo.docente_id == getattr(current_user, "id", None))
        .order_by(getattr(Ciclo, "curso_inicio").desc(), getattr(Ciclo, "codigo").desc())
    )

    if q:
        q_like = f"%{q.strip()}%"
        query = query.filter(
            (getattr(Ciclo, "codigo").ilike(q_like)) |
            (getattr(Ciclo, "aula").ilike(q_like))
        )

    ciclos = query.all()
    return [_to_ciclo_lite(c) for c in ciclos]


@router.get(
    "/grupos/{ciclo_id}/alumnos",
    response_model=List[AlumnoEnGrupo],
    summary="Lista alumnos inscritos en un ciclo del docente",
)
def alumnos_de_mi_ciclo(
    ciclo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve las inscripciones del ciclo indicado, solo si el ciclo pertenece
    al docente autenticado (o si es superuser).
    """
    _ensure_teacher(current_user)

    # Cargar ciclo + docente, y validar pertenencia
    ciclo: Optional[Ciclo] = (
        db.query(Ciclo)
        .options(joinedload(Ciclo.docente))
        .filter(Ciclo.id == ciclo_id)
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    # Si no es superuser, debe ser el docente propietario del ciclo
    if getattr(current_user, "role", None) != getattr(UserRole, "superuser", None):
        if getattr(ciclo, "docente_id", None) != getattr(current_user, "id", None):
            raise HTTPException(status_code=403, detail="No puedes ver alumnos de un ciclo ajeno")

    # Import tardío para evitar posibles ciclos de importación
    from ..models import Inscripcion  # type: ignore
    from sqlalchemy.orm import joinedload as _joinedload

    inscripciones = (
        db.query(Inscripcion)
        .options(_joinedload(Inscripcion.alumno))
        .filter(Inscripcion.ciclo_id == ciclo_id)
        .order_by(Inscripcion.id.asc())
        .all()
    )

    out: List[AlumnoEnGrupo] = []
    for ins in inscripciones:
        alumno = getattr(ins, "alumno", None)

        # status como string seguro (si es Enum, úsalo como .value)
        status_val = getattr(ins, "status", None)
        if hasattr(status_val, "value"):
            status_val = status_val.value

        out.append(
            AlumnoEnGrupo(
                inscripcion_id=getattr(ins, "id", None),
                alumno_id=getattr(ins, "alumno_id", None),
                alumno_nombre=_user_display_name(alumno),
                alumno_email=getattr(alumno, "email", None),
                alumno_username=getattr(alumno, "username", None),
                boleta=getattr(ins, "boleta", None) or getattr(alumno, "boleta", None),
                status=status_val,
            )
        )
    return out
