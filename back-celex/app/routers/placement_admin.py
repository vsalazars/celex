# app/routers/placement_admin.py
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import require_coordinator_or_admin
from ..models import (
    User,
    PlacementExam,
    PlacementRegistro,
    PlacementRegistroStatus,
)

router = APIRouter(prefix="/placement-exams", tags=["placement-admin"])


# ==========================
# Helpers
# ==========================
def _comprobante_to_meta(path: str | None, mime: str | None, size: int | None):
    if not path:
        return None
    fname = os.path.basename(path)
    return {
        "filename": fname,
        "mimetype": mime,
        "size_bytes": size,
        "storage_path": path,
    }


def _set_registro_status(reg: PlacementRegistro, status_name: str):
    """
    Asigna estado usando el Enum PlacementRegistroStatus si existe,
    o como string en minúsculas si no.
    """
    try:
        enum_val = getattr(PlacementRegistroStatus, status_name.upper())
        reg.status = enum_val
    except Exception:
        reg.status = status_name.lower()


ACTIVE_REG_STATUSES = (
    PlacementRegistroStatus.PREINSCRITA,
    PlacementRegistroStatus.VALIDADA,
)


# ==========================
# Schemas
# ==========================
class ValidateRegistroPayload(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    motivo: str | None = None


# ==========================
# Endpoints (Coordinación)
# ==========================
@router.get("/{exam_id}/registros-admin")
def list_registros_admin(
    exam_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinator_or_admin),
):
    """
    Lista los registros/pagos de un examen para coordinación.
    Incluye metadatos del comprobante y nivel_idioma (nivel asignado por docente).
    """
    rows = (
        db.query(PlacementRegistro, User)
        .join(User, User.id == PlacementRegistro.alumno_id)
        .filter(PlacementRegistro.exam_id == exam_id)
        .order_by(PlacementRegistro.created_at.desc())
        .all()
    )

    items = []
    for reg, u in rows:
        items.append(
            {
                "id": reg.id,
                "alumno": {
                    "first_name": getattr(u, "first_name", None),
                    "last_name": getattr(u, "last_name", None),
                    "email": getattr(u, "email", None),
                    "boleta": getattr(u, "boleta", None),
                },
                "referencia": reg.referencia,
                "importe_centavos": reg.importe_centavos,
                "fecha_pago": reg.fecha_pago,  # FastAPI serializa date a "YYYY-MM-DD"
                "status": reg.status.value if hasattr(reg.status, "value") else str(reg.status),
                "created_at": reg.created_at,
                "comprobante": _comprobante_to_meta(
                    reg.comprobante_path, reg.comprobante_mime, reg.comprobante_size
                ),
                # 👇 nuevos/alineados
                "rechazo_motivo": getattr(reg, "rechazo_motivo", None),
                "validation_notes": getattr(reg, "validation_notes", None),
                "nivel_idioma": getattr(reg, "nivel_idioma", None),
            }
        )

    return {"items": items}


@router.post("/registros/{registro_id}/validate")
def validate_registro_admin(
    registro_id: int,
    payload: ValidateRegistroPayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_coordinator_or_admin),
):
    """
    Aprueba o rechaza un registro/pago.
    - action: "APPROVE" | "REJECT"
    - motivo: requerido si REJECT (min 6 chars)
    """
    reg = db.get(PlacementRegistro, registro_id)  # type: ignore[attr-defined]
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    action = (payload.action or "").upper()
    if action == "APPROVE":
        _set_registro_status(reg, "VALIDADA")
        if hasattr(reg, "validated_by_id"):
            setattr(reg, "validated_by_id", user.id)
        if hasattr(reg, "validated_at"):
            setattr(reg, "validated_at", datetime.now(timezone.utc))
        if hasattr(reg, "rechazo_motivo"):
            setattr(reg, "rechazo_motivo", None)
        if hasattr(reg, "validation_notes"):
            setattr(reg, "validation_notes", None)

    elif action == "REJECT":
        if not payload.motivo or len(payload.motivo.strip()) < 6:
            raise HTTPException(status_code=422, detail="Motivo requerido (≥ 6 caracteres)")
        _set_registro_status(reg, "RECHAZADA")
        if hasattr(reg, "validated_by_id"):
            setattr(reg, "validated_by_id", user.id)
        if hasattr(reg, "validated_at"):
            setattr(reg, "validated_at", datetime.now(timezone.utc))
        if hasattr(reg, "rechazo_motivo"):
            setattr(reg, "rechazo_motivo", payload.motivo.strip())
        if hasattr(reg, "validation_notes"):
            setattr(reg, "validation_notes", payload.motivo.strip())

    else:
        raise HTTPException(status_code=400, detail="Acción inválida")

    db.add(reg)
    db.commit()
    db.refresh(reg)

    return {
        "id": reg.id,
        "exam_id": reg.exam_id,
        "status": reg.status.value if hasattr(reg.status, "value") else str(reg.status),
        "referencia": reg.referencia,
        "importe_centavos": reg.importe_centavos,
        "fecha_pago": reg.fecha_pago,
        "comprobante": _comprobante_to_meta(reg.comprobante_path, reg.comprobante_mime, reg.comprobante_size),
        "created_at": reg.created_at,
        "rechazo_motivo": getattr(reg, "rechazo_motivo", None),
        "validation_notes": getattr(reg, "validation_notes", None),
        "nivel_idioma": getattr(reg, "nivel_idioma", None),
    }


@router.get("/registros/{registro_id}/comprobante-admin")
def download_comprobante_admin(
    registro_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinator_or_admin),
):
    """
    Descarga el comprobante del registro/pago (coordinación).
    """
    reg = db.get(PlacementRegistro, registro_id)  # type: ignore[attr-defined]
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    if not reg.comprobante_path or not os.path.exists(reg.comprobante_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    filename = os.path.basename(reg.comprobante_path)
    media_type = reg.comprobante_mime or "application/octet-stream"
    return FileResponse(
        reg.comprobante_path,
        media_type=media_type,
        filename=filename,
    )


# ───────────────────────────────────────────────────────────────────────────────
# NUEVO: Stats de cupo/ocupación para coordinación
# ───────────────────────────────────────────────────────────────────────────────
@router.get("/{exam_id}/stats-admin")
def stats_admin(
    exam_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinator_or_admin),
) -> Dict[str, int | None]:
    """
    Regresa { cupo_total, ocupados, disponibles } del examen.
    - ocupados: cantidad de registros en PREINSCRITA o VALIDADA
    """
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    ocupados = (
        db.query(func.count(PlacementRegistro.id))
        .filter(
            PlacementRegistro.exam_id == exam_id,
            PlacementRegistro.status.in_(ACTIVE_REG_STATUSES),
        )
        .scalar()
        or 0
    )

    cupo_total = getattr(exam, "cupo_total", None)
    disponibles = None
    if isinstance(cupo_total, int):
        disponibles = max(0, cupo_total - int(ocupados))

    return {
        "cupo_total": cupo_total,
        "ocupados": int(ocupados),
        "disponibles": disponibles,
    }
