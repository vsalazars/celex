from __future__ import annotations

from datetime import date
import os
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile
from sqlalchemy.orm import Session, lazyload, joinedload
from sqlalchemy import func

from ..database import get_db
from ..auth import get_current_user
from ..models import Ciclo, UserRole as ModelUserRole
from .. import models as models_mod  # resolver Inscripcion en runtime
from ..schemas import (
    InscripcionOut,
    CicloLite,
    ComprobanteMeta,
)

router = APIRouter(prefix="/alumno/inscripciones", tags=["alumno-inscripciones"])


# ==========================
# Helpers
# ==========================
def _get_inscripcion_model():
    """
    Devuelve el modelo de Inscripción desde app.models.
    Busca atributo 'Inscripcion' y si no, heurística por __tablename__.
    """
    Inscripcion = getattr(models_mod, "Inscripcion", None)
    if Inscripcion is not None:
        return Inscripcion
    for name in dir(models_mod):
        obj = getattr(models_mod, name)
        if getattr(obj, "__tablename__", None):
            try:
                if "inscrip" in obj.__tablename__:
                    return obj
            except Exception:
                pass
    return None


def require_student(user=Depends(get_current_user)):
    if user.role != ModelUserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo alumnos")
    return user


def _fetch_ciclo_locked(db: Session, ciclo_id: int) -> Ciclo:
    ciclo = (
        db.query(Ciclo)
        .options(lazyload("*"))
        .filter(Ciclo.id == ciclo_id)
        .with_for_update(of=Ciclo, nowait=False)
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    return ciclo


def _check_ventana_inscripcion(ciclo: Ciclo):
    hoy = date.today()
    # Nota: asume que el modelo Ciclo tiene columnas insc_inicio/insc_fin
    if not (getattr(ciclo, "insc_inicio", None) and getattr(ciclo, "insc_fin", None)):
        raise HTTPException(status_code=409, detail="Periodo de inscripción no configurado")
    if not (ciclo.insc_inicio <= hoy <= ciclo.insc_fin):
        raise HTTPException(status_code=409, detail="Periodo de inscripción no vigente")


def _check_no_duplicado(db: Session, Inscripcion, ciclo_id: int, alumno_id: int):
    ya = (
        db.query(Inscripcion.id)
        .filter(Inscripcion.ciclo_id == ciclo_id, Inscripcion.alumno_id == alumno_id)
        .first()
    )
    if ya:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en este ciclo")


def _check_cupo(db: Session, Inscripcion, ciclo: Ciclo):
    inscritos = (
        db.query(func.count(Inscripcion.id))
        .filter(Inscripcion.ciclo_id == ciclo.id)
        .scalar()
        or 0
    )
    lugares_disponibles = max(0, (ciclo.cupo_total or 0) - inscritos)
    if lugares_disponibles <= 0:
        raise HTTPException(status_code=409, detail="No hay lugares disponibles")


def _ensure_upload_dir(path: str):
    os.makedirs(path, exist_ok=True)


def _map_comprobante_meta(ins) -> Optional[ComprobanteMeta]:
    """
    Mapea columnas del modelo a ComprobanteMeta si existen.
    Espera atributos: comprobante_path, comprobante_mime, comprobante_size.
    """
    path = getattr(ins, "comprobante_path", None)
    mime = getattr(ins, "comprobante_mime", None)
    size = getattr(ins, "comprobante_size", None)
    if not (path or mime or size):
        return None
    try:
        filename = os.path.basename(path) if path else None
    except Exception:
        filename = None
    return ComprobanteMeta(
        filename=filename,
        mimetype=mime,
        size_bytes=size,
        storage_path=path,
    )


def _fmt_period(from_, to_):
    """Devuelve dict {'from': ISO, 'to': ISO} o None si falta alguno."""
    if not (from_ and to_):
        return None
    return {"from": from_.isoformat(), "to": to_.isoformat()}


def _norm_days(dias_val) -> list[str]:
    """
    Asegura list[str] para 'dias':
    - Si viene como lista/tupla/set, lo convierte a list[str]
    - Si viene string 'lunes,martes' o con separadores variados, lo parte
    - Si viene None, regresa []
    """
    if dias_val is None:
        return []
    if isinstance(dias_val, (list, tuple, set)):
        return [str(x) for x in dias_val]
    s = str(dias_val).strip()
    if not s:
        return []
    import re
    return [p.strip() for p in re.split(r"[,\|\s]+", s) if p.strip()]


# ==========================
# POST: crear inscripción
# ==========================
@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_student)])
async def crear_inscripcion(
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(require_student),
):
    """
    Acepta:
    - JSON: {"ciclo_id": int} -> status="registrada"
    - multipart/form-data:
        ciclo_id: int
        referencia: str
        importe_centavos: int
        comprobante: UploadFile (pdf/jpg/png/webp, <= 5MB) -> status="preinscrita"
    """
    Inscripcion = _get_inscripcion_model()
    if Inscripcion is None:
        raise HTTPException(
            status_code=501,
            detail="Modelo de Inscripción no definido en app.models. Agrega el modelo (p. ej. 'Inscripcion').",
        )

    content_type = (request.headers.get("content-type") or "").lower()

    # ---------- JSON simple ----------
    if "application/json" in content_type:
        body = await request.json()
        try:
            ciclo_id = int(body.get("ciclo_id"))
        except Exception:
            raise HTTPException(status_code=422, detail="ciclo_id inválido")

        ciclo = _fetch_ciclo_locked(db, ciclo_id)
        _check_ventana_inscripcion(ciclo)
        _check_no_duplicado(db, Inscripcion, ciclo_id, user.id)
        _check_cupo(db, Inscripcion, ciclo)

        ins = Inscripcion(
            ciclo_id=ciclo_id,
            alumno_id=user.id,
            status="registrada",
        )
        db.add(ins)
        db.commit()
        db.refresh(ins)
        return {"ok": True, "id": ins.id}

    # ---------- multipart/form-data ----------
    if "multipart/form-data" in content_type:
        form = await request.form()

        # ciclo_id
        try:
            ciclo_id = int(form.get("ciclo_id"))
        except Exception:
            raise HTTPException(status_code=422, detail="ciclo_id inválido")

        referencia = (form.get("referencia") or "").strip()
        if not referencia:
            raise HTTPException(status_code=422, detail="Referencia requerida")

        try:
            importe_centavos = int(form.get("importe_centavos") or 0)
        except Exception:
            raise HTTPException(status_code=422, detail="importe_centavos inválido")
        if importe_centavos <= 0:
            raise HTTPException(status_code=422, detail="importe_centavos debe ser > 0")

        file: UploadFile | None = form.get("comprobante")  # type: ignore
        if not file:
            raise HTTPException(status_code=422, detail="Comprobante requerido")

        allowed = {
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
        }
        if (file.content_type or "").lower() not in allowed:
            raise HTTPException(status_code=415, detail="Tipo de archivo no permitido (usa PDF/JPG/PNG/WEBP)")

        # Guardar archivo (límite 5MB)
        UPLOAD_DIR = os.getenv("PAYMENT_UPLOAD_DIR", "uploads/comprobantes")
        _ensure_upload_dir(UPLOAD_DIR)

        _, ext = os.path.splitext(file.filename or "")
        ext = (ext or "").lower()
        if not ext:
            ext = ".pdf" if file.content_type == "application/pdf" else ".jpg"
        filename = f"{uuid4().hex}{ext}"
        full_path = os.path.join(UPLOAD_DIR, filename)

        size = 0
        max_size = 5 * 1024 * 1024  # 5 MB
        try:
            with open(full_path, "wb") as out:
                while True:
                    chunk = await file.read(1024 * 1024)  # 1MB
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > max_size:
                        try:
                            out.close()
                            os.remove(full_path)
                        except Exception:
                            pass
                        raise HTTPException(status_code=413, detail="El archivo excede 5MB")
                    out.write(chunk)
        finally:
            await file.close()

        ciclo = _fetch_ciclo_locked(db, ciclo_id)
        _check_ventana_inscripcion(ciclo)
        _check_no_duplicado(db, Inscripcion, ciclo_id, user.id)
        _check_cupo(db, Inscripcion, ciclo)

        ins = Inscripcion(
            ciclo_id=ciclo_id,
            alumno_id=user.id,
            status="preinscrita",
            referencia=referencia,
            importe_centavos=importe_centavos,
            comprobante_path=full_path,
            comprobante_mime=file.content_type,
            comprobante_size=size,
        )
        db.add(ins)
        db.commit()
        db.refresh(ins)
        return {"ok": True, "id": ins.id}

    raise HTTPException(status_code=415, detail="Content-Type no soportado")


# ==========================
# GET: listar mis inscripciones
# ==========================
@router.get("", response_model=list[InscripcionOut], dependencies=[Depends(require_student)])
def listar_mis_inscripciones(db: Session = Depends(get_db), user=Depends(require_student)):
    Inscripcion = _get_inscripcion_model()
    if Inscripcion is None:
        raise HTTPException(
            status_code=501,
            detail="Modelo de Inscripción no definido en app.models.",
        )

    rows = (
        db.query(Inscripcion)
        .options(joinedload(Inscripcion.ciclo))  # asegurar x.ciclo disponible
        .filter(Inscripcion.alumno_id == user.id)
        .all()
    )

    out: list[InscripcionOut] = []
    for x in rows:
        c = x.ciclo  # modelo Ciclo

        # Periodos desde el modelo (ajusta nombres si los tuyos difieren)
        insc_inicio = getattr(c, "insc_inicio", None)
        insc_fin    = getattr(c, "insc_fin", None)
        curso_inicio = getattr(c, "curso_inicio", None)
        curso_fin    = getattr(c, "curso_fin", None)

        # Horario (datetime.time; schemas ya lo aceptan y/o serializan a "HH:MM")
        hora_inicio = getattr(c, "hora_inicio", None)
        hora_fin    = getattr(c, "hora_fin", None)

        # Días (normalizar a list[str])
        dias = _norm_days(getattr(c, "dias", None))

        # Campos base (si son enums en el modelo, convertir a str)
        idioma = getattr(c, "idioma", None)
        modalidad = getattr(c, "modalidad", None)
        turno = getattr(c, "turno", None)
        nivel = getattr(c, "nivel", None)

        ciclo_lite = CicloLite(
            id=getattr(c, "id"),
            codigo=getattr(c, "codigo"),
            idioma=str(idioma) if idioma is not None else "",
            modalidad=str(modalidad) if modalidad is not None else "",
            turno=str(turno) if turno is not None else "",
            nivel=str(nivel) if nivel is not None else "",
            dias=dias,
            hora_inicio=hora_inicio,
            hora_fin=hora_fin,
            inscripcion=_fmt_period(insc_inicio, insc_fin),
            curso=_fmt_period(curso_inicio, curso_fin),
        )

        out.append(
            InscripcionOut(
                id=x.id,
                ciclo_id=x.ciclo_id,
                status=x.status,
                created_at=x.created_at,
                referencia=getattr(x, "referencia", None),
                importe_centavos=getattr(x, "importe_centavos", None),
                comprobante=_map_comprobante_meta(x),
                # alumno: si tienes relación y schema, puedes añadir joinedload e incluirlo
                ciclo=ciclo_lite,  # ✅ ahora incluye curso e inscripcion con fechas
            )
        )

    return out


# ==========================
# DELETE: cancelar inscripción
# ==========================
@router.delete("/{inscripcion_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_student)])
def cancelar_inscripcion(inscripcion_id: int, db: Session = Depends(get_db), user=Depends(require_student)):
    Inscripcion = _get_inscripcion_model()
    if Inscripcion is None:
        raise HTTPException(
            status_code=501,
            detail="Modelo de Inscripción no definido en app.models. Agrega el modelo para cancelar inscripciones.",
        )

    ins = (
        db.query(Inscripcion)
        .filter(Inscripcion.id == inscripcion_id, Inscripcion.alumno_id == user.id)
        .first()
    )
    if not ins:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    db.delete(ins)
    db.commit()
    return
