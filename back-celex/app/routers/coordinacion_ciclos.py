from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session, joinedload

from ..auth import get_db, require_coordinator_or_admin
from ..models import (
    Ciclo,
    User,  # 👈 necesario para validar/traer docente
    Modalidad as ModelModalidad,
    Turno as ModelTurno,
    Idioma as ModelIdioma,
    Nivel as ModelNivel,
    ModalidadAsistencia as ModelModalidadAsistencia,
)
from ..schemas import (
    CicloCreate,
    CicloUpdate,
    CicloOut,
    CicloListResponse,
    Modalidad as SchemaModalidad,
    Turno as SchemaTurno,
    Idioma as SchemaIdioma,
    Nivel as SchemaNivel,
    ModalidadAsistencia as SchemaModalidadAsistencia,
)

router = APIRouter(prefix="/coordinacion/ciclos", tags=["coordinación-ciclos"])


# ------------------- Helpers -------------------
def _periodo_or_none(start, end):
    if start is None or end is None:
        return None
    return {"from": start, "to": end}

def _is_teacher(user: User) -> bool:
    """
    Retorna True si el usuario tiene rol 'teacher', compatible con str o Enum.
    """
    role = getattr(user, "role", None)
    if role is None:
        return False
    # role puede ser string o Enum
    if isinstance(role, str):
        return role == "teacher"
    # Enum: intenta .value / .name
    val = getattr(role, "value", None)
    if isinstance(val, str) and val == "teacher":
        return True
    name = getattr(role, "name", None)
    return isinstance(name, str) and name == "teacher"

def _validate_and_set_docente(m: Ciclo, docente_id: Optional[int], db: Session):
    """
    Valida y asigna docente_id si viene. Si docente_id es None, no cambia.
    """
    if docente_id is None:
        return

    if docente_id == 0:
        # Permite despegar explícitamente enviando 0
        m.docente_id = None
        return

    docente = db.query(User).filter(User.id == docente_id).first()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    # Debe ser teacher y activo
    is_active = getattr(docente, "is_active", True)
    if not _is_teacher(docente) or not is_active:
        raise HTTPException(
            status_code=400,
            detail="El usuario seleccionado no es un docente activo",
        )
    m.docente_id = docente_id


def _to_out(m: Ciclo) -> CicloOut:
    return CicloOut(
        id=m.id,
        codigo=m.codigo,
        idioma=m.idioma,
        modalidad=m.modalidad,
        turno=m.turno,
        nivel=m.nivel,
        cupo_total=m.cupo_total,
        dias=m.dias,
        hora_inicio=m.hora_inicio.strftime("%H:%M") if m.hora_inicio else None,
        hora_fin=m.hora_fin.strftime("%H:%M") if m.hora_fin else None,
        modalidad_asistencia=(getattr(m, "modalidad_asistencia", None) or ModelModalidadAsistencia.presencial),
        aula=getattr(m, "aula", None),
        inscripcion={"from": m.insc_inicio, "to": m.insc_fin},
        curso={"from": m.curso_inicio, "to": m.curso_fin},
        examenMT=getattr(m, "examen_mt", None),
        examenFinal=getattr(m, "examen_final", None),
        notas=m.notas,
        docente=(
            None if not getattr(m, "docente", None) else {
                "id": m.docente.id,
                "first_name": m.docente.first_name,
                "last_name": m.docente.last_name,
                "email": m.docente.email,
            }
        ),
    )

# ------------------- Endpoints -------------------
@router.get(
    "",
    response_model=CicloListResponse,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def list_ciclos(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Buscar por código"),
    idioma: Optional[SchemaIdioma] = Query(None),
    modalidad: Optional[SchemaModalidad] = Query(None),
    turno: Optional[SchemaTurno] = Query(None),
    nivel: Optional[SchemaNivel] = Query(None),
    docente_id: Optional[int] = Query(None, description="Filtrar por docente asignado"),  # 👈 nuevo
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    base = db.query(Ciclo).options(joinedload(Ciclo.docente))

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

    if docente_id is not None:   # 👈 aquí filtras
        base = base.filter(Ciclo.docente_id == docente_id)

    total = base.count()
    pages = (total + page_size - 1) // page_size if total else 1
    if page > pages and total > 0:
        page = pages

    items = (
        base.order_by(Ciclo.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return CicloListResponse(
        items=[_to_out(x) for x in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )



@router.get(
    "/{ciclo_id}",
    response_model=CicloOut,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def get_ciclo(ciclo_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    m = (
        db.query(Ciclo)
        .options(joinedload(Ciclo.docente))
        .filter(Ciclo.id == ciclo_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    return _to_out(m)


@router.post(
    "",
    response_model=CicloOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def create_ciclo(payload: CicloCreate, db: Session = Depends(get_db)):
    if db.query(Ciclo).filter(Ciclo.codigo == payload.codigo.strip()).first():
        raise HTTPException(status_code=400, detail="Ya existe un ciclo con ese código")

    if payload.cupo_total < 0:
        raise HTTPException(status_code=400, detail="cupo_total no puede ser negativo")

    m = Ciclo(
        codigo=payload.codigo.strip(),
        idioma=ModelIdioma(payload.idioma.value),
        modalidad=ModelModalidad(payload.modalidad.value),
        turno=ModelTurno(payload.turno.value),
        nivel=ModelNivel(payload.nivel.value),
        cupo_total=payload.cupo_total,

        # horario
        dias=[d.value for d in payload.dias],
        hora_inicio=payload.hora_inicio,
        hora_fin=payload.hora_fin,

        # asistencia (default a 'presencial' si no viene)
        modalidad_asistencia=(
            ModelModalidadAsistencia(payload.modalidad_asistencia.value)
            if getattr(payload, "modalidad_asistencia", None) is not None
            else ModelModalidadAsistencia.presencial
        ),
        aula=(getattr(payload, "aula", None) or "").strip() or None,

        # periodos / fechas
        insc_inicio=payload.inscripcion.from_,
        insc_fin=payload.inscripcion.to,
        curso_inicio=payload.curso.from_,
        curso_fin=payload.curso.to,
       
        # exámenes (opcionales)
        examen_mt=getattr(payload, "examenMT", None),
        examen_final=getattr(payload, "examenFinal", None),

        notas=(payload.notas or "").strip() or None,
    )

    # docente opcional (valida antes de persistir)
    _validate_and_set_docente(m, getattr(payload, "docente_id", None), db)

    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_out(m)


@router.put(
    "/{ciclo_id}",
    response_model=CicloOut,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def update_ciclo(ciclo_id: int, payload: CicloUpdate, db: Session = Depends(get_db)):
    m = db.query(Ciclo).filter(Ciclo.id == ciclo_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    if payload.codigo is not None:
        codigo = payload.codigo.strip()
        exists = (
            db.query(Ciclo)
            .filter(Ciclo.codigo == codigo, Ciclo.id != ciclo_id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=400, detail="Código en uso por otro ciclo")
        m.codigo = codigo

    if payload.idioma is not None:
        m.idioma = ModelIdioma(payload.idioma.value)
    if payload.modalidad is not None:
        m.modalidad = ModelModalidad(payload.modalidad.value)
    if payload.turno is not None:
        m.turno = ModelTurno(payload.turno.value)
    if payload.nivel is not None:
        m.nivel = ModelNivel(payload.nivel.value)

    if payload.cupo_total is not None:
        if payload.cupo_total < 0:
            raise HTTPException(status_code=400, detail="cupo_total no puede ser negativo")
        m.cupo_total = payload.cupo_total

    # horario
    if payload.dias is not None:
        m.dias = [d.value for d in payload.dias]
    if payload.hora_inicio is not None:
        m.hora_inicio = payload.hora_inicio
    if payload.hora_fin is not None:
        m.hora_fin = payload.hora_fin

    # asistencia
    if payload.modalidad_asistencia is not None:
        m.modalidad_asistencia = ModelModalidadAsistencia(payload.modalidad_asistencia.value)
    if payload.aula is not None:
        m.aula = payload.aula.strip() or None

    # periodos / fechas
    if payload.inscripcion is not None:
        m.insc_inicio = payload.inscripcion.from_
        m.insc_fin = payload.inscripcion.to
    if payload.curso is not None:
        m.curso_inicio = payload.curso.from_
        m.curso_fin = payload.curso.to
  
    # exámenes opcionales
    if payload.examenMT is not None:
        m.examen_mt = payload.examenMT
    if payload.examenFinal is not None:
        m.examen_final = payload.examenFinal

    # docente opcional (permite setear, cambiar o despegar con 0)
    if hasattr(payload, "docente_id"):
        _validate_and_set_docente(m, payload.docente_id, db)

    if payload.notas is not None:
        m.notas = payload.notas.strip() or None

    db.commit()
    # eager load docente para salida consistente
    db.refresh(m)
    m = db.query(Ciclo).options(joinedload(Ciclo.docente)).filter(Ciclo.id == ciclo_id).first()
    return _to_out(m)


@router.delete(
    "/{ciclo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def delete_ciclo(ciclo_id: int, db: Session = Depends(get_db)):
    m = db.query(Ciclo).filter(Ciclo.id == ciclo_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    db.delete(m)
    db.commit()
    return
