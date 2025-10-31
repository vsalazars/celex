# app/routers/placement.py
from __future__ import annotations

from typing import Optional, List, Tuple
import os
from datetime import datetime, date, time

from fastapi import (
    APIRouter,
    Depends,
    Query,
    HTTPException,
    status,
    Request,
    UploadFile,
    Response,
)
from fastapi.responses import FileResponse
from sqlalchemy import or_, func, and_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..auth import get_current_user
from ..models import (
    PlacementExam,
    User,
    UserRole,
    PlacementRegistro,
    PlacementRegistroStatus,
)
from ..schemas import (
    PlacementCreate,
    PlacementUpdate,
    PlacementOut,
    PlacementList,           # si no lo usas en responses, no pasa nada
    PlacementRegistroOut,
    PlacementExamMini,       # usado en /mis-registros
)

router = APIRouter(prefix="/placement-exams", tags=["placement"])

# ==========================
# Helpers (auth)
# ==========================
def require_student(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo alumnos")
    return user


# ==========================
# Helpers (upload)
# ==========================
ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}

ACTIVE_REG_STATUSES: Tuple[PlacementRegistroStatus, ...] = (
    PlacementRegistroStatus.PREINSCRITA,
    PlacementRegistroStatus.VALIDADA,
)


async def _save_upload(file: UploadFile | None, env_dir_key: str, default_dir: str, max_mb: int = 5):
    """
    Guarda un UploadFile validando MIME y tamaño.
    Regresa (full_path, mime, size_bytes).
    """
    if not file:
        raise HTTPException(status_code=422, detail="Archivo requerido")
    if (file.content_type or "").lower() not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail="Tipo de archivo no permitido (usa PDF/JPG/PNG/WEBP)")

    raw = await file.read()
    size = len(raw)
    if size > max_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Archivo demasiado grande (máx {max_mb} MB)")

    base_dir = os.getenv(env_dir_key, default_dir)
    os.makedirs(base_dir, exist_ok=True)
    fname = getattr(file, "filename", "comprobante")
    safe_name = fname.replace("/", "_").replace("\\", "_")
    full_path = os.path.join(base_dir, safe_name)
    with open(full_path, "wb") as f:
        f.write(raw)

    try:
        await file.close()
    except Exception:
        pass

    return full_path, (file.content_type or "application/octet-stream"), size


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


# ==========================
# Helpers (fechas/horas y cupo)
# ==========================
def _parse_date_str(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=422, detail=f"Fecha inválida: {s!r} (YYYY-MM-DD)")

def _parse_time_str(s: str | None) -> time | None:
    if not s:
        return None
    try:
        fmt = "%H:%M:%S" if len(s.split(":")) == 3 else "%H:%M"
        return datetime.strptime(s, fmt).time()
    except Exception:
        raise HTTPException(status_code=422, detail=f"Hora inválida: {s!r} (HH:MM o HH:MM:SS)")

def _normalize_insc_window(data: dict) -> tuple[date | None, date | None]:
    """
    Acepta insc_inicio/insc_fin o insc_from/insc_to o inscripcion.{from,to} (strings).
    Devuelve (date|None, date|None).
    """
    insc_inicio_str = (
        data.get("insc_inicio")
        or data.get("insc_from")
        or (data.get("inscripcion") or {}).get("from")
    )
    insc_fin_str = (
        data.get("insc_fin")
        or data.get("insc_to")
        or (data.get("inscripcion") or {}).get("to")
    )
    # limpia llaves no mapeadas al modelo
    for k in ("insc_from", "insc_to", "inscripcion"):
        data.pop(k, None)
    d_inicio = _parse_date_str(insc_inicio_str) if insc_inicio_str else None
    d_fin    = _parse_date_str(insc_fin_str)    if insc_fin_str    else None
    if d_inicio and d_fin and d_inicio > d_fin:
        raise HTTPException(status_code=422, detail="insc_inicio debe ser ≤ insc_fin")
    return d_inicio, d_fin


def _ocupados_subquery(db: Session):
    """
    Subquery: cuenta registros por examen con estatus que ocupan lugar.
    """
    return (
        db.query(
            PlacementRegistro.exam_id.label("exam_id"),
            func.count(PlacementRegistro.id).label("ocupados"),
        )
        .filter(PlacementRegistro.status.in_(ACTIVE_REG_STATUSES))
        .group_by(PlacementRegistro.exam_id)
        .subquery()
    )


def _ocupados_for_exam(db: Session, exam_id: int) -> int:
    return (
        db.query(func.count(PlacementRegistro.id))
        .filter(
            PlacementRegistro.exam_id == exam_id,
            PlacementRegistro.status.in_(ACTIVE_REG_STATUSES),
        )
        .scalar()
        or 0
    )


def _serialize_exam_with_disponibles(exam: PlacementExam, ocupados: int):
    disponibles = max(0, (exam.cupo_total or 0) - (ocupados or 0))
    # incluye insc_inicio/insc_fin y objeto inscripcion {from,to} para compat
    return {
        "id": exam.id,
        "codigo": exam.codigo,
        "nombre": getattr(exam, "nombre", None),
        "idioma": exam.idioma,
        "fecha": getattr(exam, "fecha", None),
        "hora": getattr(exam, "hora", None),
        "salon": getattr(exam, "salon", None),
        "duracion_min": getattr(exam, "duracion_min", 60),
        "cupo_total": getattr(exam, "cupo_total", 0),
        "costo": getattr(exam, "costo", None),
        "docente_id": getattr(exam, "docente_id", None),
        "instrucciones": getattr(exam, "instrucciones", None),
        "modalidad": getattr(exam, "modalidad", None),
        "nivel_objetivo": getattr(exam, "nivel_objetivo", None),
        "estado": getattr(exam, "estado", None),
        "link_registro": getattr(exam, "link_registro", None),
        "activo": getattr(exam, "activo", True),

        # NUEVO: ventana de inscripción en ambos formatos
        "insc_inicio": getattr(exam, "insc_inicio", None),
        "insc_fin": getattr(exam, "insc_fin", None),
        "inscripcion": {
            "from": getattr(exam, "insc_inicio", None),
            "to": getattr(exam, "insc_fin", None),
        },

        # capacidad
        "cupo_disponible": disponibles,
        "registros_ocupados": int(ocupados or 0),
    }

# ==========================
# Helpers (formularios de registro)
# ==========================
def _parse_importe(form) -> int:
    """
    Devuelve importe en centavos.
    Acepta 'importe_pesos' (preferido) o 'importe_centavos'.
    """
    if "importe_pesos" in form and form.get("importe_pesos"):
        raw = str(form.get("importe_pesos")).replace(",", ".")
        try:
            pesos = float(raw)
        except Exception:
            raise HTTPException(status_code=422, detail="Importe inválido (pesos)")
        if pesos < 0:
            raise HTTPException(status_code=422, detail="Importe inválido (pesos)")
        if round(pesos, 2) != pesos:
            raise HTTPException(status_code=422, detail="El importe solo admite 2 decimales")
        return int(round(pesos * 100))
    elif "importe_centavos" in form and form.get("importe_centavos"):
        try:
            c = int(form.get("importe_centavos"))
        except Exception:
            raise HTTPException(status_code=422, detail="Importe inválido (centavos)")
        if c < 0:
            raise HTTPException(status_code=422, detail="Importe inválido (centavos)")
        return c
    else:
        raise HTTPException(status_code=422, detail="Importe requerido (importe_pesos)")

def _parse_fecha_pago(fecha_pago_str: str) -> date:
    try:
        y, m, d = map(int, fecha_pago_str.split("-"))
        from datetime import date as _date
        return _date(y, m, d)
    except Exception:
        raise HTTPException(status_code=422, detail="Fecha de pago inválida (YYYY-MM-DD)")

async def _parse_registro_form_and_upload(request: Request):
    """
    Lee form-data estándar del registro y guarda el comprobante.
    Retorna dict con campos listos para asignarse en el modelo.
    """
    form = await request.form()
    referencia = (form.get("referencia") or "").strip()
    fecha_pago_str = (form.get("fecha_pago") or "").strip()
    if not referencia:
        raise HTTPException(status_code=422, detail="Referencia requerida")
    importe_centavos = _parse_importe(form)
    fecha_pago = _parse_fecha_pago(fecha_pago_str)
    file: UploadFile | None = form.get("comprobante")  # type: ignore
    full_path, mime, size = await _save_upload(
        file,
        env_dir_key="PLACEMENT_PAGOS_UPLOAD_DIR",
        default_dir="uploads/placement_pagos",
        max_mb=5,
    )
    return {
        "referencia": referencia,
        "importe_centavos": importe_centavos,
        "fecha_pago": fecha_pago,
        "comprobante_path": full_path,
        "comprobante_mime": mime,
        "comprobante_size": size,
        "_action": (form.get("_action") or "").strip().lower(),
    }

# ==========================
# RUTAS PÚBLICAS / ALUMNO
# ==========================
@router.get("/public")
def list_public(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    idioma: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(PlacementExam).filter(PlacementExam.activo == True)  # noqa: E712
    if idioma:
        q = q.filter(PlacementExam.idioma == idioma)

    total = q.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(max(1, page), pages)

    sub = _ocupados_subquery(db)

    rows = (
        q.outerjoin(sub, PlacementExam.id == sub.c.exam_id)
        .with_entities(PlacementExam, func.coalesce(sub.c.ocupados, 0))
        .order_by(
            PlacementExam.fecha.asc().nullslast(),
            PlacementExam.hora.asc().nullslast(),
            PlacementExam.id.asc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_serialize_exam_with_disponibles(exam, ocupados) for exam, ocupados in rows]
    return {"items": items, "page": page, "pages": pages, "total": total}


@router.get("/mis-registros", response_model=List[PlacementRegistroOut])
def my_registros(
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    regs = (
        db.query(PlacementRegistro)
        .options(joinedload(PlacementRegistro.exam))
        .filter(PlacementRegistro.alumno_id == user.id)
        .order_by(PlacementRegistro.created_at.desc())
        .all()
    )

    out: List[PlacementRegistroOut] = []
    for r in regs:
        comp_meta = _comprobante_to_meta(r.comprobante_path, r.comprobante_mime, r.comprobante_size)

        exam_mini = None
        if r.exam:
            exam_mini = PlacementExamMini(
                id=r.exam.id,
                codigo=r.exam.codigo,
                nombre=getattr(r.exam, "nombre", None),
                idioma=r.exam.idioma,
                fecha=getattr(r.exam, "fecha", None),
                hora=getattr(r.exam, "hora", None),
                salon=getattr(r.exam, "salon", None),
                cupo_total=getattr(r.exam, "cupo_total", None),
                costo=getattr(r.exam, "costo", None),
                activo=getattr(r.exam, "activo", None),
            )

        out.append(
            PlacementRegistroOut(
                id=r.id,
                exam_id=r.exam_id,
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                referencia=r.referencia,
                importe_centavos=r.importe_centavos,
                fecha_pago=r.fecha_pago,
                comprobante=comp_meta,  # type: ignore[arg-type]
                created_at=r.created_at,
                rechazo_motivo=getattr(r, "rechazo_motivo", None),
                validation_notes=getattr(r, "validation_notes", None),
                nivel_idioma=getattr(r, "nivel_idioma", None),
                exam=exam_mini,
            )
        )
    return out


@router.get("/registros/{registro_id}/comprobante")
def download_comprobante(
    registro_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    reg = db.get(PlacementRegistro, registro_id)  # type: ignore[attr-defined]
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if reg.alumno_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if not reg.comprobante_path or not os.path.exists(reg.comprobante_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    filename = os.path.basename(reg.comprobante_path)
    media_type = reg.comprobante_mime or "application/octet-stream"
    return FileResponse(
        reg.comprobante_path,
        media_type=media_type,
        filename=filename,
    )


@router.delete("/registros/{registro_id}", status_code=204)
def cancel_registro(
    registro_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    reg = db.get(PlacementRegistro, registro_id)  # type: ignore[attr-defined]
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if reg.alumno_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if reg.status == PlacementRegistroStatus.CANCELADA:
        return Response(status_code=204)

    reg.status = PlacementRegistroStatus.CANCELADA
    db.add(reg)
    db.commit()
    return Response(status_code=204)


@router.post("/{exam_id}/registros", response_model=PlacementRegistroOut, status_code=201)
async def create_registro(
    exam_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    # 1) Validar examen
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam or not bool(exam.activo):
        raise HTTPException(status_code=404, detail="Examen no disponible")

    # 1.1) Bloquear sobrecupo
    ocupados = _ocupados_for_exam(db, exam_id)
    cupo_total = int(getattr(exam, "cupo_total", 0) or 0)
    if ocupados >= cupo_total:
        raise HTTPException(status_code=409, detail="No hay lugares disponibles")

    # 2) Parseo estándar (incluye guardar comprobante)
    parsed = await _parse_registro_form_and_upload(request)
    referencia = parsed["referencia"]
    importe_centavos = parsed["importe_centavos"]
    fecha_pago = parsed["fecha_pago"]
    full_path = parsed["comprobante_path"]
    mime = parsed["comprobante_mime"]
    size = parsed["comprobante_size"]
    action = parsed.get("_action", "")

    # 3) Unicidad alumno+examen con rehidratación para RECHAZADA y CANCELADA
    exists = (
        db.query(PlacementRegistro)
        .filter(PlacementRegistro.alumno_id == user.id, PlacementRegistro.exam_id == exam_id)
        .first()
    )
    if exists:
        if getattr(exists, "status") in (PlacementRegistroStatus.RECHAZADA, PlacementRegistroStatus.CANCELADA):
            # Si está cancelada o rechazada, permitimos "revivir" siempre; si quieres,
            # puedes requerir action in {"reintentar","reinscribir"}.
            # Reemplazar archivo previo
            old_path = getattr(exists, "comprobante_path", None)
            if old_path and os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception:
                    pass

            exists.referencia = referencia
            exists.importe_centavos = importe_centavos
            exists.fecha_pago = fecha_pago
            exists.comprobante_path = full_path
            exists.comprobante_mime = mime
            exists.comprobante_size = size
            exists.status = PlacementRegistroStatus.PREINSCRITA

            db.add(exists)
            db.commit()
            db.refresh(exists)

            return {
                "id": exists.id,
                "exam_id": exists.exam_id,
                "status": exists.status.value if hasattr(exists.status, "value") else str(exists.status),
                "referencia": exists.referencia,
                "importe_centavos": exists.importe_centavos,
                "fecha_pago": exists.fecha_pago,
                "comprobante": _comprobante_to_meta(exists.comprobante_path, exists.comprobante_mime, exists.comprobante_size),
                "created_at": exists.created_at,
            }

        # Legacy: mantener 409 para no romper integraciones previas en otros estados
        raise HTTPException(status_code=409, detail="Ya existe un registro para este examen")

    # 4) Crear registro nuevo
    reg = PlacementRegistro(
        exam_id=exam_id,
        alumno_id=user.id,
        referencia=referencia,
        importe_centavos=importe_centavos,
        fecha_pago=fecha_pago,
        comprobante_path=full_path,
        comprobante_mime=mime,
        comprobante_size=size,
        status=PlacementRegistroStatus.PREINSCRITA,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    # 5) Respuesta
    return {
        "id": reg.id,
        "exam_id": reg.exam_id,
        "status": reg.status.value if hasattr(reg.status, "value") else str(reg.status),
        "referencia": reg.referencia,
        "importe_centavos": reg.importe_centavos,
        "fecha_pago": reg.fecha_pago,
        "comprobante": _comprobante_to_meta(reg.comprobante_path, reg.comprobante_mime, reg.comprobante_size),
        "created_at": reg.created_at,
    }

# ==========================
# Reintento/Reinscripción explícitos (endpoints nuevos)
# ==========================
@router.post("/registros/{registro_id}/reintentar", response_model=PlacementRegistroOut)
async def retry_registro(
    registro_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    reg = db.get(PlacementRegistro, registro_id)  # type: ignore[attr-defined]
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if reg.alumno_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if getattr(reg, "status") != PlacementRegistroStatus.RECHAZADA:
        raise HTTPException(status_code=409, detail="Solo puedes reintentar registros rechazados")

    exam = db.get(PlacementExam, reg.exam_id)  # type: ignore[attr-defined]
    if not exam or not bool(exam.activo):
        raise HTTPException(status_code=404, detail="Examen no disponible")

    ocupados = _ocupados_for_exam(db, reg.exam_id)
    cupo_total = int(getattr(exam, "cupo_total", 0) or 0)
    if ocupados >= cupo_total:
        raise HTTPException(status_code=409, detail="No hay lugares disponibles")

    parsed = await _parse_registro_form_and_upload(request)

    old_path = getattr(reg, "comprobante_path", None)
    if old_path and os.path.exists(old_path):
        try:
            os.remove(old_path)
        except Exception:
            pass

    reg.referencia = parsed["referencia"]
    reg.importe_centavos = parsed["importe_centavos"]
    reg.fecha_pago = parsed["fecha_pago"]
    reg.comprobante_path = parsed["comprobante_path"]
    reg.comprobante_mime = parsed["comprobante_mime"]
    reg.comprobante_size = parsed["comprobante_size"]
    reg.status = PlacementRegistroStatus.PREINSCRITA

    db.add(reg)
    db.commit()
    db.refresh(reg)

    return PlacementRegistroOut(
        id=reg.id,
        exam_id=reg.exam_id,
        status=reg.status.value if hasattr(reg.status, "value") else str(reg.status),
        referencia=reg.referencia,
        importe_centavos=reg.importe_centavos,
        fecha_pago=reg.fecha_pago,
        comprobante=_comprobante_to_meta(reg.comprobante_path, reg.comprobante_mime, reg.comprobante_size),  # type: ignore[arg-type]
        created_at=reg.created_at,
    )


@router.post("/registros/{registro_id}/reinscribir", response_model=PlacementRegistroOut)
async def reinscribir_registro(
    registro_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """
    Permite reinscribir un registro CANCELADO.
    """
    reg = db.get(PlacementRegistro, registro_id)  # type: ignore[attr-defined]
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if reg.alumno_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if getattr(reg, "status") != PlacementRegistroStatus.CANCELADA:
        raise HTTPException(status_code=409, detail="Solo puedes reinscribir registros cancelados")

    exam = db.get(PlacementExam, reg.exam_id)  # type: ignore[attr-defined]
    if not exam or not bool(exam.activo):
        raise HTTPException(status_code=404, detail="Examen no disponible")

    ocupados = _ocupados_for_exam(db, reg.exam_id)
    cupo_total = int(getattr(exam, "cupo_total", 0) or 0)
    if ocupados >= cupo_total:
        raise HTTPException(status_code=409, detail="No hay lugares disponibles")

    parsed = await _parse_registro_form_and_upload(request)

    old_path = getattr(reg, "comprobante_path", None)
    if old_path and os.path.exists(old_path):
        try:
            os.remove(old_path)
        except Exception:
            pass

    reg.referencia = parsed["referencia"]
    reg.importe_centavos = parsed["importe_centavos"]
    reg.fecha_pago = parsed["fecha_pago"]
    reg.comprobante_path = parsed["comprobante_path"]
    reg.comprobante_mime = parsed["comprobante_mime"]
    reg.comprobante_size = parsed["comprobante_size"]
    reg.status = PlacementRegistroStatus.PREINSCRITA

    db.add(reg)
    db.commit()
    db.refresh(reg)

    return PlacementRegistroOut(
        id=reg.id,
        exam_id=reg.exam_id,
        status=reg.status.value if hasattr(reg.status, "value") else str(reg.status),
        referencia=reg.referencia,
        importe_centavos=reg.importe_centavos,
        fecha_pago=reg.fecha_pago,
        comprobante=_comprobante_to_meta(reg.comprobante_path, reg.comprobante_mime, reg.comprobante_size),  # type: ignore[arg-type]
        created_at=reg.created_at,
    )


@router.put("/registros/{registro_id}", response_model=PlacementRegistroOut)
async def update_registro_action(
    registro_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """
    Fallback: permite _action=reintentar o _action=reinscribir vía PUT con form-data.
    """
    reg = db.get(PlacementRegistro, registro_id)  # type: ignore[attr-defined]
    if not reg:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if reg.alumno_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    parsed = await _parse_registro_form_and_upload(request)
    action = parsed.get("_action", "")

    if action not in ("reintentar", "reinscribir"):
        raise HTTPException(status_code=400, detail="Acción no soportada")

    # Validaciones por estado esperado
    if action == "reintentar" and getattr(reg, "status") != PlacementRegistroStatus.RECHAZADA:
        raise HTTPException(status_code=409, detail="Solo puedes reintentar registros rechazados")
    if action == "reinscribir" and getattr(reg, "status") != PlacementRegistroStatus.CANCELADA:
        raise HTTPException(status_code=409, detail="Solo puedes reinscribir registros cancelados")

    exam = db.get(PlacementExam, reg.exam_id)  # type: ignore[attr-defined]
    if not exam or not bool(exam.activo):
        raise HTTPException(status_code=404, detail="Examen no disponible")

    ocupados = _ocupados_for_exam(db, reg.exam_id)
    cupo_total = int(getattr(exam, "cupo_total", 0) or 0)
    if ocupados >= cupo_total:
        raise HTTPException(status_code=409, detail="No hay lugares disponibles")

    # Reemplaza archivo previo
    old_path = getattr(reg, "comprobante_path", None)
    if old_path and os.path.exists(old_path):
        try:
            os.remove(old_path)
        except Exception:
            pass

    reg.referencia = parsed["referencia"]
    reg.importe_centavos = parsed["importe_centavos"]
    reg.fecha_pago = parsed["fecha_pago"]
    reg.comprobante_path = parsed["comprobante_path"]
    reg.comprobante_mime = parsed["comprobante_mime"]
    reg.comprobante_size = parsed["comprobante_size"]
    reg.status = PlacementRegistroStatus.PREINSCRITA

    db.add(reg)
    db.commit()
    db.refresh(reg)

    return PlacementRegistroOut(
        id=reg.id,
        exam_id=reg.exam_id,
        status=reg.status.value if hasattr(reg.status, "value") else str(reg.status),
        referencia=reg.referencia,
        importe_centavos=reg.importe_centavos,
        fecha_pago=reg.fecha_pago,
        comprobante=_comprobante_to_meta(reg.comprobante_path, reg.comprobante_mime, reg.comprobante_size),  # type: ignore[arg-type]
        created_at=reg.created_at,
    )

# ==========================
# Endpoints de administración/coordinación ligeros
# ==========================
@router.get("/teachers")
def list_teachers(db: Session = Depends(get_db)):
    rows = (
        db.query(User)
        .filter(User.role == UserRole.teacher)
        .order_by(User.last_name.asc(), User.first_name.asc())
        .all()
    )
    return [
        {"id": u.id, "name": f"{u.first_name} {u.last_name}".strip()}
        for u in rows
    ]


@router.get("")
def list_placement_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    idioma: Optional[str] = None,
    estado: Optional[str] = None,
    fecha_from: Optional[str] = None,
    fecha_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PlacementExam)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                PlacementExam.codigo.ilike(like),
                PlacementExam.nombre.ilike(like),
                PlacementExam.idioma.ilike(like),
                PlacementExam.salon.ilike(like),
            )
        )

    if idioma:
        query = query.filter(PlacementExam.idioma == idioma)

    if estado:
        query = query.filter(PlacementExam.estado == estado)

    # Filtro opcional por rango de fecha
    try:
        d_from = _parse_date_str(fecha_from) if fecha_from else None
        d_to   = _parse_date_str(fecha_to)   if fecha_to   else None
    except HTTPException as e:
        raise e

    if d_from and d_to:
        if d_from > d_to:
            raise HTTPException(status_code=422, detail="fecha_from debe ser ≤ fecha_to")
        query = query.filter(and_(PlacementExam.fecha >= d_from, PlacementExam.fecha <= d_to))
    elif d_from:
        query = query.filter(PlacementExam.fecha >= d_from)
    elif d_to:
        query = query.filter(PlacementExam.fecha <= d_to)

    total = query.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(max(1, page), pages)

    sub = _ocupados_subquery(db)

    rows = (
        query.outerjoin(sub, PlacementExam.id == sub.c.exam_id)
        .with_entities(PlacementExam, func.coalesce(sub.c.ocupados, 0))
        .order_by(
            PlacementExam.fecha.desc().nullslast(),
            PlacementExam.hora.desc().nullslast(),
            PlacementExam.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_serialize_exam_with_disponibles(exam, ocupados) for exam, ocupados in rows]
    return {"items": items, "page": page, "pages": pages, "total": total}


@router.get("/{exam_id}")
def get_placement_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    ocupados = _ocupados_for_exam(db, exam_id)
    return _serialize_exam_with_disponibles(exam, ocupados)


@router.post("", response_model=PlacementOut, status_code=201)
def create_placement_exam(
    payload: PlacementCreate,
    db: Session = Depends(get_db),
):
    try:
        data = payload.model_dump(exclude_none=True)  # type: ignore[attr-defined]
    except Exception:
        data = payload.dict(exclude_none=True)

    d_inicio, d_fin = _normalize_insc_window(data)
    data["insc_inicio"] = d_inicio
    data["insc_fin"] = d_fin

    fecha_str: str = data.pop("fecha")
    hora_str:  str = data.pop("hora")
    data["fecha"] = _parse_date_str(fecha_str)
    data["hora"]  = _parse_time_str(hora_str)

    if not data.get("nombre"):
        data["nombre"] = data["codigo"].strip()

    for key in ("codigo", "idioma", "salon", "instrucciones", "modalidad",
                "nivel_objetivo", "estado", "link_registro", "nombre"):
        if key in data and isinstance(data[key], str):
            data[key] = data[key].strip()

    if "activo" not in data or data["activo"] is None:
        data["activo"] = True

    try:
        exam = PlacementExam(**data)
    except TypeError as e:
        raise HTTPException(status_code=400, detail=f"Campos inválidos en payload: {e}")

    db.add(exam)
    db.commit()
    db.refresh(exam)
    return PlacementOut.model_validate(exam)


@router.put("/{exam_id}", response_model=PlacementOut)
def update_placement_exam(
    exam_id: int,
    payload: PlacementUpdate,
    db: Session = Depends(get_db),
):
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    try:
        patch = payload.model_dump(exclude_unset=True)  # type: ignore[attr-defined]
    except Exception:
        patch = payload.dict(exclude_unset=True)

    if any(k in patch for k in ("insc_inicio", "insc_fin", "insc_from", "insc_to", "inscripcion")):
        d_inicio, d_fin = _normalize_insc_window(dict(patch))
        patch["insc_inicio"] = d_inicio
        patch["insc_fin"] = d_fin

    if "fecha" in patch and patch["fecha"] is not None:
        patch["fecha"] = _parse_date_str(patch["fecha"])
    if "hora" in patch and patch["hora"] is not None:
        patch["hora"] = _parse_time_str(patch["hora"])

    valid_keys = set(c.name for c in PlacementExam.__table__.columns)
    for k, v in list(patch.items()):
        if k in valid_keys:
            setattr(exam, k, v)

    db.commit()
    db.refresh(exam)
    return PlacementOut.model_validate(exam)


@router.delete("/{exam_id}", status_code=204)
def delete_placement_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.get(PlacementExam, exam_id)  # type: ignore[attr-defined]
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    db.delete(exam)
    db.commit()
    return None
