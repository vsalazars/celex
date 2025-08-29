# app/routers/alumno_ciclos.py
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..auth import get_db, get_current_user  # ajusta si tu módulo de auth expone otro import
from ..models import (
    Ciclo,
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

# Reutilizamos el mapeo a esquema de salida
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
        hora_inicio=m.hora_inicio,
        hora_fin=m.hora_fin,

        inscripcion={"from": m.insc_inicio, "to": m.insc_fin},
        reinscripcion={"from": m.reinsc_inicio, "to": m.reinsc_fin},
        curso={"from": m.curso_inicio, "to": m.curso_fin},
        colocacion={"from": m.coloc_inicio, "to": m.coloc_fin},

        examenMT=m.examen_mt,
        examenFinal=m.examen_final,

        modalidad_asistencia=m.modalidad_asistencia,
        aula=m.aula,

        notas=m.notas,
    )

# Permitir acceso a cualquier usuario autenticado (alumno/docente/coordinador/superuser)
def require_authenticated_user(user=Depends(get_current_user)):
    # Si tu get_current_user ya lanza 401 si no hay token, no hace falta más
    return user

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
    dependencies=[Depends(require_authenticated_user)],
)
def get_ciclo_alumno(
    ciclo_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    m = db.query(Ciclo).filter(Ciclo.id == ciclo_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    return _to_out(m)
