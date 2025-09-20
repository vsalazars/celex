# app/routers/docente_encuestas.py
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, literal

from ..database import get_db
from ..auth import get_current_user
from ..models import User, UserRole, Ciclo

router = APIRouter(prefix="/docente/encuestas", tags=["Docente - Encuestas"])

# =========================
# Auth helpers (roles)
# =========================
def require_teacher_or_coord_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.teacher, UserRole.coordinator, UserRole.superuser):
        # Docente, coordinador o superuser
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return current_user


# =========================
# DTOs (Pydantic)
# =========================
from pydantic import BaseModel, ConfigDict

class SeriePunto(BaseModel):
    x: str   # ciclo.codigo
    y: float # 0..100

class SerieLinea(BaseModel):
    id: str           # question_id
    label: str        # question.text
    data: List[SeriePunto]

class DocenteMini(BaseModel):
    id: int | str
    nombre: str

class SeriePorPreguntaResp(BaseModel):
    docente: DocenteMini
    series: List[SerieLinea]


class EncuestaComentarioOut(BaseModel):
    id: int | str
    pregunta_id: int | str | None = None
    pregunta_texto: Optional[str] = None
    texto: str
    created_at: Optional[str] = None
    alumno: Optional[Dict[str, Any]] = None  # {nombre, email}


# =========================
# GET /serie-por-pregunta
# =========================
@router.get("/serie-por-pregunta", response_model=SeriePorPreguntaResp, dependencies=[Depends(require_teacher_or_coord_or_admin)])
def serie_por_pregunta(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    docenteId: Optional[int] = Query(None, description="Si no se envía, usa el docente en sesión"),
    anio: Optional[int] = Query(None, description="Filtro opcional por año (prefijo del código del ciclo)"),
    idioma: Optional[str] = Query(None, description="Filtro opcional por idioma: ingles|frances|..."),
    soloProfesor: bool = Query(False, description="Si True, solo ciclos donde el docente está asignado (por defecto ya se filtra así)"),
):
    """
    Devuelve series por PREGUNTA (id/label) y puntos por CICLO (x=codigo, y=% 0..100).
    Para docente en sesión o, si el rol lo permite, para cualquier docenteId.
    """
    # ---- Resolver docente objetivo
    target_docente_id: int
    if docenteId is not None:
        # Solo coordinador/superuser pueden consultar a otros
        if current_user.role not in (UserRole.coordinator, UserRole.superuser) and current_user.id != docenteId:
            raise HTTPException(status_code=403, detail="No autorizado para consultar otros docentes")
        target_docente_id = int(docenteId)
    else:
        if current_user.role != UserRole.teacher:
            raise HTTPException(status_code=400, detail="Falta docenteId para roles no-docente")
        target_docente_id = int(current_user.id)

    # ---- Nombre del docente
    first = func.coalesce(func.trim(User.first_name), "")
    last  = func.coalesce(func.trim(User.last_name), "")
    docente_nombre = (
        db.query(func.trim(func.concat(first, literal(" "), last)))
        .filter(User.id == target_docente_id)
        .scalar()
    ) or ""
    if not docente_nombre:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    # ---- Importes locales para evitar import circular
    from ..models import SurveyQuestion, SurveyResponse, SurveyAnswer

    # ---- Ciclos donde el docente está asignado
    q_ciclos = db.query(Ciclo).filter(Ciclo.docente_id == target_docente_id)
    if idioma:
        q_ciclos = q_ciclos.filter(func.lower(func.cast(Ciclo.idioma, str)).ilike(func.lower(idioma)))
    if anio:
        q_ciclos = q_ciclos.filter(Ciclo.codigo.ilike(f"{anio}-%"))

    ciclos = q_ciclos.order_by(Ciclo.codigo.asc()).all()
    if not ciclos:
        return SeriePorPreguntaResp(
            docente=DocenteMini(id=target_docente_id, nombre=docente_nombre),
            series=[]
        )

    ciclo_ids = [c.id for c in ciclos]
    codigo_by_id = {c.id: c.codigo for c in ciclos}

    # ---- Preguntas activas (orden por order asc)
    # Tomamos todas las preguntas activas; el % se calcula con respuestas del ciclo del docente
    preguntas = (
        db.query(SurveyQuestion)
        .filter(SurveyQuestion.active.is_(True))
        .order_by(SurveyQuestion.order.asc(), SurveyQuestion.id.asc())
        .all()
    )
    if not preguntas:
        return SeriePorPreguntaResp(
            docente=DocenteMini(id=target_docente_id, nombre=docente_nombre),
            series=[]
        )

    # ---- Para cada pregunta, construir serie (ciclo → porcentaje)
    series: List[SerieLinea] = []
    for q in preguntas:
        q_type = (q.type or "").strip()
        label = (q.text or f"Pregunta {q.id}").strip()

        puntos: List[SeriePunto] = []

        if q_type == "likert_1_5":
            # Para cada ciclo, promedio (1..5) → % (0..100)
            for ciclo_id in ciclo_ids:
                rows = (
                    db.query(SurveyAnswer.value_int.label("v"), func.count().label("n"))
                    .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                    .filter(
                        SurveyResponse.ciclo_id == ciclo_id,
                        SurveyAnswer.question_id == q.id,
                        SurveyAnswer.value_int.isnot(None),
                    )
                    .group_by(SurveyAnswer.value_int)
                    .all()
                )
                total = 0
                suma = 0
                for r in rows:
                    val = int(r.v or 0)
                    n = int(r.n or 0)
                    if 1 <= val <= 5 and n > 0:
                        total += n
                        suma += val * n
                if total > 0:
                    prom = suma / total  # 1..5
                    pct = round((prom / 5.0) * 100.0, 1)
                    puntos.append(SeriePunto(x=codigo_by_id[ciclo_id], y=pct))

        elif q_type == "scale_0_10":
            for ciclo_id in ciclo_ids:
                rows = (
                    db.query(SurveyAnswer.value_int.label("v"), func.count().label("n"))
                    .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                    .filter(
                        SurveyResponse.ciclo_id == ciclo_id,
                        SurveyAnswer.question_id == q.id,
                        SurveyAnswer.value_int.isnot(None),
                    )
                    .group_by(SurveyAnswer.value_int)
                    .all()
                )
                total = 0
                suma = 0
                for r in rows:
                    val = int(r.v or 0)
                    n = int(r.n or 0)
                    if 0 <= val <= 10 and n > 0:
                        total += n
                        suma += val * n
                if total > 0:
                    prom = suma / total  # 0..10
                    pct = round((prom / 10.0) * 100.0, 1)
                    puntos.append(SeriePunto(x=codigo_by_id[ciclo_id], y=pct))

        elif q_type == "yes_no":
            # % de "Sí" (value_bool=True)
            for ciclo_id in ciclo_ids:
                rows = (
                    db.query(SurveyAnswer.value_bool.label("v"), func.count().label("n"))
                    .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                    .filter(
                        SurveyResponse.ciclo_id == ciclo_id,
                        SurveyAnswer.question_id == q.id,
                        SurveyAnswer.value_bool.isnot(None),
                    )
                    .group_by(SurveyAnswer.value_bool)
                    .all()
                )
                total = 0
                si = 0
                for r in rows:
                    n = int(r.n or 0)
                    total += n
                    if r.v is True:
                        si += n
                if total > 0:
                    pct = round((si / total) * 100.0, 1)
                    puntos.append(SeriePunto(x=codigo_by_id[ciclo_id], y=pct))

        else:
            # open_text u otros: no son numéricos → se omiten en la serie
            pass

        if puntos:
            serie = SerieLinea(
                id=str(q.id),
                label=label,
                data=sorted(puntos, key=lambda p: p.x)  # por código de ciclo asc
            )
            series.append(serie)

    # Respuesta
    return SeriePorPreguntaResp(
        docente=DocenteMini(id=target_docente_id, nombre=docente_nombre),
        series=series
    )


# =========================
# GET /comentarios
# =========================
@router.get("/comentarios", response_model=List[EncuestaComentarioOut], dependencies=[Depends(require_teacher_or_coord_or_admin)])
def comentarios_ciclo_docente(
    cicloId: int = Query(..., description="ID del ciclo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve comentarios (open_text) del ciclo, restringiendo acceso:
    - Docente: solo si es el docente asignado del ciclo.
    - Coordinador/superuser: acceso total.
    """
    # Validar ciclo y permiso del docente
    ciclo = db.query(Ciclo).filter(Ciclo.id == cicloId).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    if current_user.role == UserRole.teacher and ciclo.docente_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado para ver comentarios de este ciclo")

    from ..models import SurveyQuestion, SurveyResponse, SurveyAnswer

    # Respuestas open_text por ciclo
    rows = (
        db.query(
            SurveyAnswer.id.label("id"),
            SurveyAnswer.value_text.label("texto"),
            SurveyAnswer.created_at.label("created_at"),
            SurveyAnswer.question_id.label("pregunta_id"),
            SurveyQuestion.text.label("pregunta_texto"),
            SurveyResponse.alumno_id.label("alumno_id"),
        )
        .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
        .outerjoin(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .filter(
            SurveyResponse.ciclo_id == cicloId,
            SurveyAnswer.value_text.isnot(None),
            func.length(func.trim(SurveyAnswer.value_text)) > 0,
        )
        .order_by(SurveyAnswer.created_at.desc())
        .all()
    )

    # Cargar alumnos (nombre/email) de forma perezosa cuando sea necesario
    alumno_names: Dict[int, Dict[str, Optional[str]]] = {}
    def _alumno_payload(alumno_id: Optional[int]):
        if not alumno_id:
            return None
        if alumno_id in alumno_names:
            return alumno_names[alumno_id]
        # Formato "Apellidos, Nombres"
        a_first = func.coalesce(func.trim(User.first_name), "")
        a_last  = func.coalesce(func.trim(User.last_name), "")
        nombre = (
            db.query(func.trim(func.concat(a_last, literal(", "), a_first)))
            .filter(User.id == alumno_id)
            .scalar()
        ) or None
        email = db.query(User.email).filter(User.id == alumno_id).scalar()
        alumno_names[alumno_id] = {"nombre": nombre, "email": email}
        return alumno_names[alumno_id]

    out: List[EncuestaComentarioOut] = []
    for r in rows:
        out.append(
            EncuestaComentarioOut(
                id=r.id,
                pregunta_id=r.pregunta_id,
                pregunta_texto=(r.pregunta_texto or None),
                texto=str(r.texto or "").strip(),
                created_at=r.created_at.isoformat() if getattr(r, "created_at", None) else None,
                alumno=_alumno_payload(getattr(r, "alumno_id", None)),
            )
        )

    return out
