# app/routers/placement.py
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PlacementExam
from ..schemas import (
    PlacementCreate,
    PlacementUpdate,
    PlacementOut,
    PlacementList,
)

router = APIRouter(prefix="/placement-exams", tags=["placement"])


@router.get("", response_model=PlacementList)
def list_placement_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    idioma: Optional[str] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PlacementExam)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                PlacementExam.nombre.ilike(like),
                PlacementExam.idioma.ilike(like),
            )
        )

    if idioma:
        query = query.filter(PlacementExam.idioma == idioma)

    if estado:
        query = query.filter(PlacementExam.estado == estado)

    total = query.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(max(1, page), pages)

    rows = (
        query.order_by(
            PlacementExam.fecha.desc().nullslast(),
            PlacementExam.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": rows,
        "page": page,
        "pages": pages,
        "total": total,
    }


@router.get("/{exam_id}", response_model=PlacementOut)
def get_placement_exam(
    exam_id: int,
    db: Session = Depends(get_db),
):
    # SQLAlchemy 1.4+ soporta Session.get; si usas 1.3 usa query.get
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    return exam


@router.post("", response_model=PlacementOut, status_code=201)
def create_placement_exam(
    payload: PlacementCreate,
    db: Session = Depends(get_db),
):
    exam = PlacementExam(**payload.dict())
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.put("/{exam_id}", response_model=PlacementOut)
def update_placement_exam(
    exam_id: int,
    payload: PlacementUpdate,
    db: Session = Depends(get_db),
):
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(exam, k, v)

    db.commit()
    db.refresh(exam)
    return exam


@router.delete("/{exam_id}", status_code=204)
def delete_placement_exam(
    exam_id: int,
    db: Session = Depends(get_db),
):
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    db.delete(exam)
    db.commit()
    return None
