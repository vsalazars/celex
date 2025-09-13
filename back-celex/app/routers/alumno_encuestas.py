from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Dict, Set
from datetime import date, datetime, timezone

from ..database import get_db
from ..auth import get_current_user
from ..models import (
    User, Inscripcion, Ciclo,
    SurveyCategory, SurveyQuestion, SurveyResponse, SurveyAnswer
)
from ..schemas import (
    SurveyCuestionarioOut, SurveyEstadoOut, SurveySubmitIn,
    SurveyCategoryOut, SurveyQuestionOut, SurveyAnswerIn
)

router = APIRouter(prefix="/alumno/encuestas", tags=["Encuestas — Alumno"])

# ---------- Helpers ----------

def _ensure_owned_inscripcion(db: Session, alumno_id: int, inscripcion_id: int) -> Inscripcion:
    insc = db.query(Inscripcion).filter(Inscripcion.id == inscripcion_id).first()
    if not insc:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    if insc.alumno_id != alumno_id:
        raise HTTPException(status_code=403, detail="No puedes operar esta inscripción")
    return insc

def _already_submitted(db: Session, alumno_id: int, inscripcion_id: int) -> bool:
    return db.query(SurveyResponse).filter(
        SurveyResponse.alumno_id == alumno_id,
        SurveyResponse.inscripcion_id == inscripcion_id
    ).first() is not None

def _pick_general_comment_question(db: Session) -> SurveyQuestion | None:
    """
    Busca una pregunta open_text que parezca 'comentarios' o 'sugerencias'.
    Si no encuentra, devuelve la primera open_text activa.
    """
    q = db.query(SurveyQuestion).filter(
        SurveyQuestion.active.is_(True),
        SurveyQuestion.type == "open_text",
        or_(
            SurveyQuestion.text.ilike("%coment%"),
            SurveyQuestion.text.ilike("%sugerenc%"),
        )
    ).order_by(SurveyQuestion.order.asc()).first()
    if q:
        return q
    return db.query(SurveyQuestion).filter(
        SurveyQuestion.active.is_(True),
        SurveyQuestion.type == "open_text",
    ).order_by(SurveyQuestion.order.asc()).first()

def _question_to_out(q: SurveyQuestion) -> SurveyQuestionOut:
    return SurveyQuestionOut(
        id=q.id,
        category_id=q.category_id,
        text=q.text,
        help_text=q.help_text,
        type=q.type,
        required=q.required,
        active=q.active,
        order=q.order,
        created_at=q.created_at,  # incluye created_at
    )

def _category_to_out(c: SurveyCategory) -> SurveyCategoryOut:
    return SurveyCategoryOut(
        id=c.id,
        name=c.name,
        description=c.description,
        order=c.order,
        active=c.active,
        created_at=c.created_at,  # incluye created_at
    )

def _curso_terminado(ciclo: Ciclo) -> bool:
    """
    True si el curso ya terminó (compara contra curso_fin).
    Soporta Date o DateTime.
    Si no hay curso_fin, devuelve True (no bloquea).
    """
    fin = getattr(ciclo, "curso_fin", None)
    if fin is None:
        return True
    if isinstance(fin, datetime):
        now = datetime.now(fin.tzinfo or timezone.utc)
        return fin <= now
    # fin es date
    return fin <= date.today()

# ---------- Endpoints ----------

@router.get("/cuestionario", response_model=SurveyCuestionarioOut)
def get_cuestionario(
    ciclo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cats = db.query(SurveyCategory).filter(
        SurveyCategory.active.is_(True)
    ).order_by(SurveyCategory.order.asc()).all()

    qs = db.query(SurveyQuestion).filter(
        SurveyQuestion.active.is_(True)
    ).order_by(SurveyQuestion.category_id.asc(), SurveyQuestion.order.asc()).all()

    submitted = db.query(SurveyResponse).filter(
        SurveyResponse.alumno_id == user.id,
        SurveyResponse.ciclo_id == ciclo_id
    ).first() is not None

    return SurveyCuestionarioOut(
        submitted=submitted,
        categories=[_category_to_out(c) for c in cats],
        questions=[_question_to_out(q) for q in qs],
    )

@router.get("/estado", response_model=SurveyEstadoOut)
def get_estado(
    inscripcion_ids: str = Query(..., description="IDs separados por coma, p.e. 1,2,3"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        ids = [int(x) for x in inscripcion_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="inscripcion_ids inválido")

    rows = db.query(SurveyResponse.inscripcion_id).filter(
        SurveyResponse.alumno_id == user.id,
        SurveyResponse.inscripcion_id.in_(ids)
    ).all()
    done: Set[int] = {r[0] for r in rows}
    return SurveyEstadoOut(
        map={i: (i in done) for i in ids},
        submitted=sorted(list(done))
    )

@router.post("/responder")
def submit_survey(
    payload: SurveySubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    insc = _ensure_owned_inscripcion(db, user.id, payload.inscripcion_id)
    ciclo = db.query(Ciclo).filter(Ciclo.id == insc.ciclo_id).first()

    if _already_submitted(db, user.id, payload.inscripcion_id):
        raise HTTPException(status_code=409, detail="Ya enviaste esta encuesta")

    # Reglas de negocio mínimas (coinciden con el front):
    if insc.status != "confirmada":
        raise HTTPException(status_code=400, detail="Encuesta disponible hasta confirmar la inscripción")
    if ciclo and not _curso_terminado(ciclo):
        raise HTTPException(status_code=400, detail="Encuesta disponible al terminar el curso")

    # Adjunta 'comments' a una pregunta open_text si no vino en el payload
    answers_in: List[SurveyAnswerIn] = list(payload.answers)
    if payload.comments:
        try:
            ids_in_payload = {a.question_id for a in answers_in}
        except Exception:
            ids_in_payload = set()
        candidate = _pick_general_comment_question(db)
        if candidate and candidate.id not in ids_in_payload:
            answers_in.append(SurveyAnswerIn(question_id=candidate.id, value=payload.comments))

    # Crea la respuesta y sus answers
    resp = SurveyResponse(
        alumno_id=user.id,
        inscripcion_id=insc.id,
        ciclo_id=insc.ciclo_id,
    )
    db.add(resp)
    db.flush()  # para obtener resp.id

    # Preguntas de referencia
    qmap: Dict[int, SurveyQuestion] = {
        q.id: q for q in db.query(SurveyQuestion).filter(
            SurveyQuestion.id.in_([a.question_id for a in answers_in])
        ).all()
    }

    # Persistir answers mapeando tipo
    for a in answers_in:
        q = qmap.get(a.question_id)
        if not q:
            continue

        ans = SurveyAnswer(response_id=resp.id, question_id=q.id)

        if q.type in ("likert_1_5", "scale_0_10"):
            try:
                ans.value_int = int(a.value)  # 1..5 o 0..10
            except Exception:
                ans.value_int = None

        elif q.type == "yes_no":
            # Parse robusto de booleanos
            if isinstance(a.value, bool):
                ans.value_bool = a.value
            else:
                v = str(a.value).strip().lower()
                ans.value_bool = v in {"1", "true", "t", "yes", "y", "si", "sí", "verdadero"}

        else:
            ans.value_text = (str(a.value).strip() if a.value is not None else None)

        db.add(ans)

    db.commit()
    return {"ok": True}
