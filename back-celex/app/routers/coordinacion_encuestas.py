# app/routers/coordinacion_encuestas.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app.models import User, UserRole, SurveyCategory, SurveyQuestion
from app.schemas import (
    SurveyCategoryCreate, SurveyCategoryUpdate, SurveyCategoryOut,
    SurveyQuestionCreate, SurveyQuestionUpdate, SurveyQuestionOut,
    MovePayload,
)
# ⬇️ Usa tu dependencia de auth para obtener el usuario actual
from app.auth import get_current_user  # ajusta si tu helper se llama distinto

router = APIRouter(
    prefix="/coordinacion/encuestas",
    tags=["Coordinación - Encuestas"],
)

# ---------------------------
# Helpers de autorización
# ---------------------------
def require_coordinator_or_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Permite acceso a coordinador o superuser."""
    # En tu proyecto User.role es un Enum UserRole
    if current_user.role not in (UserRole.coordinator, UserRole.superuser):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    return current_user


# ---------------------------
# Utilidades de orden
# ---------------------------
def _next_category_order(db: Session) -> int:
    max_order = db.scalar(select(func.max(SurveyCategory.order)))
    return (max_order or 0) + 1

def _next_question_order(db: Session, category_id: int) -> int:
    max_order = db.scalar(
        select(func.max(SurveyQuestion.order)).where(SurveyQuestion.category_id == category_id)
    )
    return (max_order or 0) + 1


# ===========================
#        CATEGORÍAS
# ===========================
@router.get("/categories", response_model=List[SurveyCategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    rows = db.scalars(
        select(SurveyCategory).order_by(SurveyCategory.order.asc(), SurveyCategory.id.asc())
    ).all()
    return rows

@router.post("/categories", response_model=SurveyCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: SurveyCategoryCreate,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    obj = SurveyCategory(
        name=payload.name,
        description=payload.description,
        active=payload.active,
        order=_next_category_order(db),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.patch("/categories/{category_id}", response_model=SurveyCategoryOut)
def update_category(
    category_id: int,
    payload: SurveyCategoryUpdate,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    obj = db.get(SurveyCategory, category_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    if payload.name is not None:
        obj.name = payload.name
    if payload.description is not None:
        obj.description = payload.description
    if payload.active is not None:
        obj.active = payload.active

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    obj = db.get(SurveyCategory, category_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    db.delete(obj)
    db.commit()
    return {"ok": True}

@router.post("/categories/{category_id}/move", response_model=SurveyCategoryOut)
def move_category(
    category_id: int,
    payload: MovePayload,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    obj = db.get(SurveyCategory, category_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    if payload.direction == "up":
        neighbor = db.scalar(
            select(SurveyCategory)
            .where(SurveyCategory.order < obj.order)
            .order_by(SurveyCategory.order.desc())
            .limit(1)
        )
    else:  # "down"
        neighbor = db.scalar(
            select(SurveyCategory)
            .where(SurveyCategory.order > obj.order)
            .order_by(SurveyCategory.order.asc())
            .limit(1)
        )

    if not neighbor:
        # ya está en borde; no cambia
        return obj

    obj.order, neighbor.order = neighbor.order, obj.order
    db.add_all([obj, neighbor])
    db.commit()
    db.refresh(obj)
    return obj


# ===========================
#         PREGUNTAS
# ===========================
@router.get("/questions", response_model=List[SurveyQuestionOut])
def list_questions(
    category_id: Optional[int] = Query(default=None, description="Filtra por categoría"),
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    stmt = select(SurveyQuestion)
    if category_id is not None:
        stmt = stmt.where(SurveyQuestion.category_id == category_id)
    stmt = stmt.order_by(SurveyQuestion.order.asc(), SurveyQuestion.id.asc())
    rows = db.scalars(stmt).all()
    return rows

@router.post("/questions", response_model=SurveyQuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(
    payload: SurveyQuestionCreate,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    # Valida categoría existente
    cat = db.get(SurveyCategory, payload.category_id)
    if not cat:
        raise HTTPException(status_code=400, detail="Categoría no válida")

    obj = SurveyQuestion(
        category_id=payload.category_id,
        text=payload.text,
        help_text=payload.help_text,
        type=payload.type,
        required=payload.required,
        active=payload.active,
        order=_next_question_order(db, payload.category_id),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.patch("/questions/{question_id}", response_model=SurveyQuestionOut)
def update_question(
    question_id: int,
    payload: SurveyQuestionUpdate,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    obj = db.get(SurveyQuestion, question_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    # Si cambia de categoría, enviamos al final del nuevo grupo
    if payload.category_id is not None and payload.category_id != obj.category_id:
        cat = db.get(SurveyCategory, payload.category_id)
        if not cat:
            raise HTTPException(status_code=400, detail="Categoría no válida")
        obj.category_id = payload.category_id
        obj.order = _next_question_order(db, payload.category_id)

    if payload.text is not None:
        obj.text = payload.text
    if payload.help_text is not None:
        obj.help_text = payload.help_text
    if payload.type is not None:
        obj.type = payload.type
    if payload.required is not None:
        obj.required = payload.required
    if payload.active is not None:
        obj.active = payload.active

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    obj = db.get(SurveyQuestion, question_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    db.delete(obj)
    db.commit()
    return {"ok": True}

@router.post("/questions/{question_id}/move", response_model=SurveyQuestionOut)
def move_question(
    question_id: int,
    payload: MovePayload,
    db: Session = Depends(get_db),
    _u: User = Depends(require_coordinator_or_superuser),
):
    obj = db.get(SurveyQuestion, question_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    if payload.direction == "up":
        neighbor = db.scalar(
            select(SurveyQuestion)
            .where(
                SurveyQuestion.category_id == obj.category_id,
                SurveyQuestion.order < obj.order,
            )
            .order_by(SurveyQuestion.order.desc())
            .limit(1)
        )
    else:
        neighbor = db.scalar(
            select(SurveyQuestion)
            .where(
                SurveyQuestion.category_id == obj.category_id,
                SurveyQuestion.order > obj.order,
            )
            .order_by(SurveyQuestion.order.asc())
            .limit(1)
        )

    if not neighbor:
        return obj

    obj.order, neighbor.order = neighbor.order, obj.order
    db.add_all([obj, neighbor])
    db.commit()
    db.refresh(obj)
    return obj
