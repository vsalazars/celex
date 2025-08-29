# app/routers/alumno_inscripciones.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import date

from ..auth import get_db, require_student   # 👈 asegúrate de tener require_student
from ..models import (
    Ciclo,
    Modalidad as ModelModalidad,
    Turno as ModelTurno,
    Idioma as ModelIdioma,
    Nivel as ModelNivel,
)
from ..schemas import (
    CicloListResponse,
    CicloOut,
    Idioma as SchemaIdioma,
    Modalidad as SchemaModalidad,
    Turno as SchemaTurno,
    Nivel as SchemaNivel,
)

router = APIRouter(prefix="/alumno", tags=["alumno"])

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

@router.get("/ciclos", response_model=CicloListResponse, dependencies=[Depends(require_student)])
def list_ciclos_para_alumno(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None),
    idioma: Optional[SchemaIdioma] = Query(None),
    modalidad: Optional[SchemaModalidad] = Query(None),
    turno: Optional[SchemaTurno] = Query(None),
    nivel: Optional[SchemaNivel] = Query(None),
    solo_abiertos: bool = Query(True, description="Sólo mostrar ciclos dentro de inscripción/reinscripción"),
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
        hoy = date.today()
        base = base.filter(
            ((Ciclo.insc_inicio <= hoy) & (Ciclo.insc_fin >= hoy)) |
            ((Ciclo.reinsc_inicio <= hoy) & (Ciclo.reinsc_fin >= hoy))
        )

    total = base.count()
    pages = (total + page_size - 1) // page_size if total else 1
    if page > pages and total > 0:
        page = pages

    items = (
        base.order_by(Ciclo.curso_inicio.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return CicloListResponse(
        items=[_to_out(x) for x in items],
        total=total, page=page, page_size=page_size, pages=pages
    )

# 👇 si ya tienes inscripciones, deja esto; si no, puedes implementarlo después.
from ..models import Inscripcion  # asumiendo que existe
from ..schemas import InscripcionOut  # si lo tienes

@router.post("/inscripciones", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_student)])
def crear_inscripcion(ciclo_id: int, db: Session = Depends(get_db), user=Depends(require_student)):
    ciclo = db.query(Ciclo).filter(Ciclo.id == ciclo_id).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    # Evitar duplicados del mismo alumno
    existing = db.query(Inscripcion).filter(
        Inscripcion.ciclo_id == ciclo_id,
        Inscripcion.alumno_id == user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en este ciclo")

    ins = Inscripcion(ciclo_id=ciclo_id, alumno_id=user.id, status="registrada")
    db.add(ins)
    db.commit()
    db.refresh(ins)
    return {"ok": True, "id": ins.id}
