from __future__ import annotations

from datetime import date
import os
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, lazyload, joinedload
from sqlalchemy import func

from ..database import get_db
from ..auth import get_current_user
from ..models import Ciclo, UserRole as ModelUserRole, InscripcionTipo
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

def _map_comprobante_meta_from(ins, base: str) -> Optional[ComprobanteMeta]:
    """
    Construye ComprobanteMeta leyendo campos <base>_path|_mime|_size.
    """
    path = getattr(ins, f"{base}_path", None)
    mime = getattr(ins, f"{base}_mime", None)
    size = getattr(ins, f"{base}_size", None)
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

# === NUEVO === Rutas de almacenamiento y helper para resolver a absoluto
BASE_STORAGE = os.getenv("APP_STORAGE_ROOT", os.path.abspath(os.getcwd()))

def _resolve_storage_path(p: str | None) -> str | None:
    """
    Devuelve una ruta absoluta válida a partir de lo que venga en BD.
    - Si p ya es absoluta, la respeta.
    - Si p es relativa, la concatena a BASE_STORAGE.
    """
    if not p:
        return None
    if os.path.isabs(p):
        return p
    return os.path.abspath(os.path.join(BASE_STORAGE, p))

# === NUEVO === Constantes/helper para guardar archivos de manera segura
ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}

async def _save_upload(file: UploadFile, env_dir_key: str, default_dir: str, max_mb: int = 5):
    """
    Guarda un UploadFile validando MIME y tamaño.
    Regresa (full_path, mime, size_bytes).
    """
    if not file:
        raise HTTPException(status_code=422, detail="Archivo requerido")
    if (file.content_type or "").lower() not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail="Tipo de archivo no permitido (usa PDF/JPG/PNG/WEBP)")

    upload_dir = os.getenv(env_dir_key, default_dir)
    upload_dir = os.path.abspath(upload_dir)  # ← guardar como absoluto
    _ensure_upload_dir(upload_dir)

    _, ext = os.path.splitext(file.filename or "")
    ext = (ext or "").lower()
    if not ext:
        ext = ".pdf" if file.content_type == "application/pdf" else ".jpg"
    filename = f"{uuid4().hex}{ext}"
    full_path = os.path.abspath(os.path.join(upload_dir, filename))  # ← absoluto

    size = 0
    max_size = max_mb * 1024 * 1024
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
                    raise HTTPException(status_code=413, detail=f"El archivo excede {max_mb}MB")
                out.write(chunk)
    finally:
        await file.close()

    return full_path, file.content_type, size


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
      (Si el alumno es IPN, se requiere multipart con comprobantes)
    - multipart/form-data (modo **pago**):
        tipo: 'pago' (default)
        ciclo_id: int
        referencia: str
        importe_centavos: int
        comprobante: UploadFile (pdf/jpg/png/webp, <= 5MB) -> status="preinscrita"
        comprobante_estudios: UploadFile (<= 5MB) [OBLIGATORIO si user.is_ipn]
    - multipart/form-data (modo **exencion**):
        tipo: 'exencion'
        ciclo_id: int
        comprobante_exencion: UploadFile (pdf/jpg/png/webp, <= 5MB)
        (NO requiere referencia/importe ni comprobante_estudios)
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
        # Si es IPN, bloquear flujo JSON (exigir multipart con comprobantes)
        if bool(getattr(user, "is_ipn", False)):
            raise HTTPException(
                status_code=422,
                detail="Alumnos IPN: adjunta comprobante de estudios usando multipart/form-data."
            )

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
            alumno_is_ipn=bool(getattr(user, "is_ipn", False)),
            tipo=InscripcionTipo.pago,  # default histórico
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

        # NEW: tipo de trámite (default: pago)
        raw_tipo = (form.get("tipo") or "pago").strip().lower()
        if raw_tipo not in ("pago", "exencion"):
            raise HTTPException(status_code=422, detail="tipo inválido (usa 'pago' o 'exencion')")

        es_ipn = bool(getattr(user, "is_ipn", False))

        ciclo = _fetch_ciclo_locked(db, ciclo_id)
        _check_ventana_inscripcion(ciclo)
        _check_no_duplicado(db, Inscripcion, ciclo_id, user.id)
        _check_cupo(db, Inscripcion, ciclo)

        # ===== Rama EXENCIÓN =====
        if raw_tipo == "exencion":
            file_ex: UploadFile | None = form.get("comprobante_exencion")  # type: ignore
            if not file_ex:
                raise HTTPException(status_code=422, detail="Comprobante de exención requerido")

            ex_path, ex_mime, ex_size = await _save_upload(
                file_ex,
                env_dir_key="EXENCION_UPLOAD_DIR",
                default_dir="uploads/exenciones",
                max_mb=5,
            )

            ins = Inscripcion(
                ciclo_id=ciclo_id,
                alumno_id=user.id,
                status="registrada",  # mantén tu semántica
                alumno_is_ipn=es_ipn,
                tipo=InscripcionTipo.exencion,
                comprobante_exencion_path=ex_path,
                comprobante_exencion_mime=ex_mime,
                comprobante_exencion_size=ex_size,
            )
            db.add(ins)
            try:
                db.commit()
            except Exception:
                db.rollback()
                # limpieza si falló la transacción
                try:
                    if ex_path:
                        os.remove(ex_path)
                except Exception:
                    pass
                raise
            db.refresh(ins)
            return {"ok": True, "id": ins.id}

        # ===== Rama PAGO (comportamiento previo, intacto) =====
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

        # Guardar archivo (límite 5MB) → **guardar ABSOLUTO**
        UPLOAD_DIR = os.getenv("PAYMENT_UPLOAD_DIR", "uploads/comprobantes")
        UPLOAD_DIR = os.path.abspath(UPLOAD_DIR)
        _ensure_upload_dir(UPLOAD_DIR)

        _, ext = os.path.splitext(file.filename or "")
        ext = (ext or "").lower()
        if not ext:
            ext = ".pdf" if file.content_type == "application/pdf" else ".jpg"
        filename = f"{uuid4().hex}{ext}"
        full_path = os.path.abspath(os.path.join(UPLOAD_DIR, filename))

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

        # Exigir y guardar comprobante de estudios si es IPN
        file_est: UploadFile | None = form.get("comprobante_estudios")  # type: ignore
        if es_ipn and not file_est:
            # limpiar comprobante de pago si fallamos aquí
            try:
                os.remove(full_path)
            except Exception:
                pass
            raise HTTPException(status_code=422, detail="Comprobante de estudios requerido para alumnos IPN")

        est_path = est_mime = est_size = None
        if file_est:
            est_path, est_mime, est_size = await _save_upload(
                file_est, env_dir_key="STUDIES_UPLOAD_DIR", default_dir="uploads/estudios", max_mb=5
            )

        ins = Inscripcion(
            ciclo_id=ciclo_id,
            alumno_id=user.id,
            status="preinscrita",
            tipo=InscripcionTipo.pago,
            referencia=referencia,
            importe_centavos=importe_centavos,
            comprobante_path=full_path,
            comprobante_mime=file.content_type,
            comprobante_size=size,
            alumno_is_ipn=es_ipn,
            comprobante_estudios_path=est_path,
            comprobante_estudios_mime=est_mime,
            comprobante_estudios_size=est_size,
        )
        db.add(ins)
        try:
            db.commit()  # respeta los CHECKs de BD
        except Exception:
            db.rollback()
            # limpieza de archivos en caso de fallo
            for p in (full_path, est_path):
                if p:
                    try:
                        os.remove(p)
                    except Exception:
                        pass
            raise
        db.refresh(ins)
        return {"ok": True, "id": ins.id}

    raise HTTPException(status_code=415, detail="Content-Type no soportado")


# ==========================
# GET: Descargar archivo (comprobante/estudios/exención)
# ==========================
@router.get("/{inscripcion_id}/archivo")
def descargar_archivo_inscripcion(
    inscripcion_id: int,
    tipo: str = Query(..., pattern="^(comprobante|estudios|exencion)$"),
    db: Session = Depends(get_db),
    user=Depends(require_student),
):
    Inscripcion = _get_inscripcion_model()
    if Inscripcion is None:
        raise HTTPException(status_code=501, detail="Modelo de Inscripción no definido.")

    ins = (
        db.query(Inscripcion)
        .filter(Inscripcion.id == inscripcion_id, Inscripcion.alumno_id == user.id)
        .first()
    )
    if not ins:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    if tipo == "comprobante":
        raw_path = getattr(ins, "comprobante_path", None)
        mime = getattr(ins, "comprobante_mime", None) or "application/octet-stream"
    elif tipo == "estudios":
        raw_path = getattr(ins, "comprobante_estudios_path", None)
        mime = getattr(ins, "comprobante_estudios_mime", None) or "application/octet-stream"
    else:  # exencion
        raw_path = getattr(ins, "comprobante_exencion_path", None)
        mime = getattr(ins, "comprobante_exencion_mime", None) or "application/octet-stream"

    path = _resolve_storage_path(raw_path)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Archivo no disponible")

    filename = os.path.basename(path)
    return FileResponse(path, media_type=mime, filename=filename)


# ==========================
# GET: listar mis inscripciones
# ==========================
@router.get("", response_model=list[InscripcionOut], dependencies=[Depends(require_student)])
def listar_mis_inscripciones(
    db: Session = Depends(get_db),
    user=Depends(require_student),
):
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

        # Periodos (ajusta nombres si difieren en tu modelo)
        insc_inicio = getattr(c, "insc_inicio", None)
        insc_fin    = getattr(c, "insc_fin", None)
        curso_inicio = getattr(c, "curso_inicio", None)
        curso_fin    = getattr(c, "curso_fin", None)

        # Horario
        hora_inicio = getattr(c, "hora_inicio", None)
        hora_fin    = getattr(c, "hora_fin", None)

        # Días normalizados a list[str]
        dias = _norm_days(getattr(c, "dias", None))

        # Campos base (si son enums, convertir a str)
        idioma = getattr(c, "idioma", None)
        modalidad = getattr(c, "modalidad", None)
        turno = getattr(c, "turno", None)
        nivel = getattr(c, "nivel", None)
        aula = getattr(c, "aula", None)

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
            aula=aula,
            inscripcion=_fmt_period(insc_inicio, insc_fin),
            curso=_fmt_period(curso_inicio, curso_fin),
            docente_nombre=(
                f"{c.docente.first_name} {c.docente.last_name}"
                if getattr(c, "docente", None) else None
            ),
        )

        out.append(
            InscripcionOut(
                id=x.id,
                ciclo_id=x.ciclo_id,
                status=x.status,
                created_at=x.created_at,
                # NUEVO: tipo (fallback a 'pago' por si faltara en filas antiguas)
                tipo=getattr(x, "tipo", "pago"),
                # Pago
                referencia=getattr(x, "referencia", None),
                importe_centavos=getattr(x, "importe_centavos", None),
                comprobante=_map_comprobante_meta(x),
                # Estudios (IPN)
                comprobante_estudios=_map_comprobante_meta_from(x, "comprobante_estudios"),
                # Exención
                comprobante_exencion=_map_comprobante_meta_from(x, "comprobante_exencion"),
                ciclo=ciclo_lite,
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
