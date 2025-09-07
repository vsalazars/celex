# app/routers/docente_asistencia.py
from typing import List, Optional
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..auth import get_current_user
from ..models import Ciclo, User, UserRole, Inscripcion
from ..models_asistencia import AsistenciaSesion, AsistenciaRegistro, AsistenciaEstado

router = APIRouter(prefix="/docente/asistencia", tags=["Docente - Asistencia"])

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def _ensure_teacher(u: User):
    roles_perm = {getattr(UserRole, "teacher", None), getattr(UserRole, "superuser", None)}
    roles_perm = {r for r in roles_perm if r is not None}
    if getattr(u, "role", None) not in roles_perm:
        raise HTTPException(status_code=403, detail="Permisos insuficientes (docente o superuser)")

def _ciclo_del_docente(db: Session, ciclo_id: int, docente_id: int, is_super: bool):
    ciclo: Ciclo | None = (
        db.query(Ciclo)
        .options(joinedload(Ciclo.docente))
        .filter(Ciclo.id == ciclo_id)
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    if not is_super and getattr(ciclo, "docente_id", None) != docente_id:
        raise HTTPException(status_code=403, detail="No autorizado para este ciclo")
    return ciclo

def _dias_semana_a_set(dias) -> set[int]:
    # Convierte enums/textos de días a weekday int (0=lunes ... 6=domingo)
    out = set()
    if not dias:
        return out
    map_es = {
        "LUNES": 0, "MARTES": 1, "MIERCOLES": 2, "MIÉRCOLES": 2,
        "JUEVES": 3, "VIERNES": 4, "SABADO": 5, "SÁBADO": 5, "DOMINGO": 6
    }
    for d in dias:
        v = getattr(d, "value", d)
        v = str(v).upper()
        if v in map_es:
            out.add(map_es[v])
    return out

def _alumno_display_name(u: User | None) -> Optional[str]:
    if not u:
        return None
    fn = getattr(u, "first_name", None) or ""
    ln = getattr(u, "last_name", None) or ""
    full = (fn + " " + ln).strip()
    if full:
        return full
    for attr in ("email", "boleta"):
        v = getattr(u, attr, None)
        if v:
            return str(v)
    return str(getattr(u, "id", "")) if getattr(u, "id", None) is not None else None

# -------------------------------------------------------------------
# DTOs básicos
# -------------------------------------------------------------------
from pydantic import BaseModel

class SesionDTO(BaseModel):
    id: int
    fecha: date

class RegistroDTO(BaseModel):
    id: int
    sesion_id: int
    inscripcion_id: int
    alumno_id: int | None = None
    alumno_nombre: str | None = None
    estado: str
    nota: str | None = None

class MarcarItem(BaseModel):
    inscripcion_id: int
    estado: AsistenciaEstado
    nota: str | None = None

# -------------------------------------------------------------------
# Endpoints: generar/listar sesiones y registros por sesión
# -------------------------------------------------------------------
@router.post("/ciclos/{ciclo_id}/generar", response_model=List[SesionDTO], summary="Genera sesiones entre curso_inicio y curso_fin")
def generar_sesiones(
    ciclo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_teacher(current_user)
    is_super = getattr(current_user, "role", None) == getattr(UserRole, "superuser", None)
    ciclo = _ciclo_del_docente(db, ciclo_id, getattr(current_user, "id", None), is_super)

    if not ciclo.curso_inicio or not ciclo.curso_fin:
        raise HTTPException(status_code=400, detail="El ciclo no tiene fechas de curso definidas")

    dias_ok = _dias_semana_a_set(getattr(ciclo, "dias", None))
    if not dias_ok:
        raise HTTPException(status_code=400, detail="El ciclo no tiene días de la semana configurados")

    # Construir fechas elegibles
    valores = []
    fecha = ciclo.curso_inicio
    while fecha <= ciclo.curso_fin:
        if fecha.weekday() in dias_ok:
            valores.append({"ciclo_id": ciclo.id, "fecha": fecha})
        fecha += timedelta(days=1)

    # Idempotente: ON CONFLICT DO NOTHING
    if valores:
        stmt = pg_insert(AsistenciaSesion.__table__).values(valores)
        stmt = stmt.on_conflict_do_nothing(index_elements=["ciclo_id", "fecha"])
        try:
            db.execute(stmt)
            db.commit()
        except IntegrityError:
            db.rollback()

    sesiones = (
        db.query(AsistenciaSesion)
        .filter(AsistenciaSesion.ciclo_id == ciclo.id)
        .order_by(AsistenciaSesion.fecha.asc())
        .all()
    )
    return [SesionDTO(id=s.id, fecha=s.fecha) for s in sesiones]

@router.get("/ciclos/{ciclo_id}/sesiones", response_model=List[SesionDTO], summary="Lista sesiones del ciclo")
def listar_sesiones(
    ciclo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
):
    _ensure_teacher(current_user)
    is_super = getattr(current_user, "role", None) == getattr(UserRole, "superuser", None)
    _ = _ciclo_del_docente(db, ciclo_id, getattr(current_user, "id", None), is_super)

    q = db.query(AsistenciaSesion).filter(AsistenciaSesion.ciclo_id == ciclo_id)
    if desde:
        q = q.filter(AsistenciaSesion.fecha >= desde)
    if hasta:
        q = q.filter(AsistenciaSesion.fecha <= hasta)
    sesiones = q.order_by(AsistenciaSesion.fecha.asc()).all()
    return [SesionDTO(id=s.id, fecha=s.fecha) for s in sesiones]

@router.get("/sesiones/{sesion_id}/registros", response_model=List[RegistroDTO], summary="Registros de asistencia por sesión")
def registros_por_sesion(
    sesion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_teacher(current_user)
    sesion = (
        db.query(AsistenciaSesion)
        .options(joinedload(AsistenciaSesion.ciclo))
        .filter(AsistenciaSesion.id == sesion_id)
        .first()
    )
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    is_super = getattr(current_user, "role", None) == getattr(UserRole, "superuser", None)
    if not is_super and getattr(sesion.ciclo, "docente_id", None) != getattr(current_user, "id", None):
        raise HTTPException(status_code=403, detail="No autorizado")

    # Asegurar registros para todos los inscritos del ciclo (idempotente)
    inscripciones = (
        db.query(Inscripcion)
        .options(joinedload(Inscripcion.alumno))
        .filter(Inscripcion.ciclo_id == sesion.ciclo_id)
        .all()
    )
    existentes = {
        r.inscripcion_id: r
        for r in db.query(AsistenciaRegistro).filter(AsistenciaRegistro.sesion_id == sesion.id).all()
    }
    to_create = []
    for ins in inscripciones:
        if ins.id not in existentes:
            to_create.append(
                AsistenciaRegistro(
                    sesion_id=sesion.id,
                    inscripcion_id=ins.id,
                    estado=AsistenciaEstado.presente,
                    marcado_por_id=getattr(current_user, "id", None),
                )
            )
    if to_create:
        db.add_all(to_create)
        db.commit()

    # Consultar con cargas encadenadas DESDE AsistenciaRegistro
    registros = (
        db.query(AsistenciaRegistro)
        .options(
            joinedload(AsistenciaRegistro.sesion),
            joinedload(AsistenciaRegistro.inscripcion).joinedload(Inscripcion.alumno),
        )
        .filter(AsistenciaRegistro.sesion_id == sesion.id)
        .order_by(AsistenciaRegistro.id.asc())
        .all()
    )

    out: List[RegistroDTO] = []
    for r in registros:
        ins = getattr(r, "inscripcion", None)
        alumno_u: User | None = getattr(ins, "alumno", None) if ins else None

        estado = getattr(r, "estado", None)
        estado_str = estado.value if hasattr(estado, "value") else (estado or "presente")

        out.append(
            RegistroDTO(
                id=r.id,
                sesion_id=r.sesion_id,
                inscripcion_id=r.inscripcion_id,
                alumno_id=getattr(ins, "alumno_id", None),
                alumno_nombre=_alumno_display_name(alumno_u),
                estado=str(estado_str),
                nota=getattr(r, "nota", None),
            )
        )
    return out

@router.post("/sesiones/{sesion_id}/marcar", response_model=List[RegistroDTO], summary="Marca asistencia en lote")
def marcar_asistencia_lote(
    sesion_id: int,
    items: List[MarcarItem] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_teacher(current_user)
    sesion = (
        db.query(AsistenciaSesion)
        .options(joinedload(AsistenciaSesion.ciclo))
        .filter(AsistenciaSesion.id == sesion_id)
        .first()
    )
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    is_super = getattr(current_user, "role", None) == getattr(UserRole, "superuser", None)
    if not is_super and getattr(sesion.ciclo, "docente_id", None) != getattr(current_user, "id", None):
        raise HTTPException(status_code=403, detail="No autorizado")

    reg_map = {
        r.inscripcion_id: r
        for r in db.query(AsistenciaRegistro).filter(AsistenciaRegistro.sesion_id == sesion_id).all()
    }

    to_create = []
    for it in items:
        r = reg_map.get(it.inscripcion_id)
        if not r:
            r = AsistenciaRegistro(
                sesion_id=sesion_id,
                inscripcion_id=it.inscripcion_id,
            )
            reg_map[it.inscripcion_id] = r
            to_create.append(r)
        r.estado = it.estado
        r.nota = it.nota
        r.marcado_por_id = getattr(current_user, "id", None)

    if to_create:
        db.add_all(to_create)
    db.commit()

    # devolver registros actualizados
    return registros_por_sesion(sesion_id, db=db, current_user=current_user)

# -------------------------------------------------------------------
# MATRIZ (sesiones × alumnos) para edición continua
# -------------------------------------------------------------------
class MatrizSesion(BaseModel):
    id: int
    fecha: date

class MatrizAlumno(BaseModel):
    inscripcion_id: int
    alumno_id: int | None = None
    nombre: str | None = None

class MatrizRegistro(BaseModel):
    sesion_id: int
    inscripcion_id: int
    estado: str
    nota: str | None = None

class MatrizDTO(BaseModel):
    sesiones: List[MatrizSesion]
    alumnos: List[MatrizAlumno]
    registros: List[MatrizRegistro]  # sparse

@router.get("/ciclos/{ciclo_id}/matriz", response_model=MatrizDTO, summary="Matriz completa del ciclo (sesiones × alumnos)")
def matriz_ciclo(
    ciclo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_teacher(current_user)
    is_super = getattr(current_user, "role", None) == getattr(UserRole, "superuser", None)
    ciclo = _ciclo_del_docente(db, ciclo_id, getattr(current_user, "id", None), is_super)

    if not ciclo.curso_inicio or not ciclo.curso_fin:
        raise HTTPException(status_code=400, detail="El ciclo no tiene fechas de curso definidas")
    dias_ok = _dias_semana_a_set(getattr(ciclo, "dias", None))
    if not dias_ok:
        raise HTTPException(status_code=400, detail="El ciclo no tiene días de la semana configurados")

    # Asegurar sesiones (idempotente)
    vals = []
    f = ciclo.curso_inicio
    while f <= ciclo.curso_fin:
        if f.weekday() in dias_ok:
            vals.append({"ciclo_id": ciclo.id, "fecha": f})
        f += timedelta(days=1)

    if vals:
        stmt = pg_insert(AsistenciaSesion.__table__).values(vals)
        stmt = stmt.on_conflict_do_nothing(index_elements=["ciclo_id", "fecha"])
        try:
            db.execute(stmt)
            db.commit()
        except IntegrityError:
            db.rollback()

    sesiones = (
        db.query(AsistenciaSesion)
        .filter(AsistenciaSesion.ciclo_id == ciclo.id)
        .order_by(AsistenciaSesion.fecha.asc())
        .all()
    )

    inscs = (
        db.query(Inscripcion)
        .options(joinedload(Inscripcion.alumno))
        .filter(Inscripcion.ciclo_id == ciclo.id)
        .order_by(Inscripcion.id.asc())
        .all()
    )

    # Asegurar registros (idempotente por bloque)
    if sesiones and inscs:
        existentes = set(
            (r.sesion_id, r.inscripcion_id)
            for r in db.query(AsistenciaRegistro)
                       .filter(AsistenciaRegistro.sesion_id.in_([s.id for s in sesiones]))
                       .all()
        )
        reg_vals = []
        for s in sesiones:
            for ins in inscs:
                key = (s.id, ins.id)
                if key not in existentes:
                    reg_vals.append({
                        "sesion_id": s.id,
                        "inscripcion_id": ins.id,
                        "estado": AsistenciaEstado.presente,
                        "marcado_por_id": getattr(current_user, "id", None),
                    })
        if reg_vals:
            db.bulk_insert_mappings(AsistenciaRegistro, reg_vals)
            db.commit()

    registros = (
        db.query(AsistenciaRegistro)
        .filter(AsistenciaRegistro.sesion_id.in_([s.id for s in sesiones]))
        .all()
    )

    def _name(u: User | None) -> str | None:
        return _alumno_display_name(u)

    return MatrizDTO(
        sesiones=[MatrizSesion(id=s.id, fecha=s.fecha) for s in sesiones],
        alumnos=[
            MatrizAlumno(
                inscripcion_id=i.id,
                alumno_id=getattr(i, "alumno_id", None),
                nombre=_name(getattr(i, "alumno", None)),
            )
            for i in inscs
        ],
        registros=[
            MatrizRegistro(
                sesion_id=r.sesion_id,
                inscripcion_id=r.inscripcion_id,
                estado=(r.estado.value if hasattr(r.estado, "value") else str(r.estado)),
                nota=r.nota,
            )
            for r in registros
        ],
    )

class MatrizMarcarItem(BaseModel):
    sesion_id: int
    inscripcion_id: int
    estado: AsistenciaEstado
    nota: str | None = None

class MatrizMarcarDTO(BaseModel):
    items: List[MatrizMarcarItem]

@router.post("/ciclos/{ciclo_id}/matriz/marcar", response_model=MatrizDTO, summary="Actualiza celdas de la matriz en bloque y devuelve la matriz")
def marcar_matriz(
    ciclo_id: int,
    payload: MatrizMarcarDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_teacher(current_user)
    is_super = getattr(current_user, "role", None) == getattr(UserRole, "superuser", None)
    ciclo = _ciclo_del_docente(db, ciclo_id, getattr(current_user, "id", None), is_super)

    # Validar sesiones pertenecen al ciclo
    sesion_ids = {it.sesion_id for it in payload.items}
    if sesion_ids:
        sesiones = db.query(AsistenciaSesion).filter(AsistenciaSesion.id.in_(list(sesion_ids))).all()
        mapa_sesion = {s.id: s for s in sesiones}
        for sid in sesion_ids:
            s = mapa_sesion.get(sid)
            if not s or s.ciclo_id != ciclo.id:
                raise HTTPException(status_code=400, detail=f"Sesión {sid} no pertenece al ciclo")

    # Upsert en memoria
    keys = {(it.sesion_id, it.inscripcion_id) for it in payload.items}
    if keys:
        regs = (
            db.query(AsistenciaRegistro)
            .filter(
                AsistenciaRegistro.sesion_id.in_([k[0] for k in keys]),
                AsistenciaRegistro.inscripcion_id.in_([k[1] for k in keys]),
            ).all()
        )
        reg_map = {(r.sesion_id, r.inscripcion_id): r for r in regs}

        to_create = []
        for it in payload.items:
            key = (it.sesion_id, it.inscripcion_id)
            r = reg_map.get(key)
            if not r:
                r = AsistenciaRegistro(sesion_id=it.sesion_id, inscripcion_id=it.inscripcion_id)
                reg_map[key] = r
                to_create.append(r)
            r.estado = it.estado
            r.nota = it.nota
            r.marcado_por_id = getattr(current_user, "id", None)

        if to_create:
            db.add_all(to_create)
        db.commit()

    # Devolver matriz actualizada
    return matriz_ciclo(ciclo_id, db=db, current_user=current_user)
