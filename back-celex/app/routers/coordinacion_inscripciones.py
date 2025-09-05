from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
import os

from fastapi.responses import FileResponse

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..config import settings  # 👈 para resolver rutas relativas con UPLOAD_DIR / MEDIA_ROOT

router = APIRouter(
    prefix="/coordinacion/inscripciones",
    tags=["Coordinación - Inscripciones"],
)

# --------------------------
# Helpers de seguridad
# --------------------------
def require_coordinator(user=Depends(get_current_user)):
    if user.role != models.UserRole.coordinator and user.role != models.UserRole.superuser:
        raise HTTPException(status_code=403, detail="No autorizado, se requiere rol coordinator")
    return user

# --------------------------
# Helpers de serialización
# --------------------------
def _meta(path: Optional[str], mime: Optional[str], size: Optional[int]) -> Optional[schemas.ComprobanteMeta]:
    if not path:
        return None
    return schemas.ComprobanteMeta(
        filename=os.path.basename(path),
        mimetype=mime,
        size_bytes=size,
        storage_path=path,
    )

def _to_inscripcion_out(r: models.Inscripcion) -> schemas.InscripcionOut:
    # CicloLite embebido como espera tu schema
    ciclo_dict = None
    if getattr(r, "ciclo", None):
        c = r.ciclo
        ciclo_dict = {
            "id": c.id,
            "codigo": c.codigo,
            "idioma": getattr(c.idioma, "value", str(c.idioma)),
            "modalidad": getattr(c.modalidad, "value", str(c.modalidad)),
            "turno": getattr(c.turno, "value", str(c.turno)),
            "nivel": getattr(c.nivel, "value", (c.nivel or None)),
            "dias": c.dias or [],
            "hora_inicio": c.hora_inicio,
            "hora_fin": c.hora_fin,
            "aula": c.aula,
            "inscripcion": {"from": c.insc_inicio, "to": c.insc_fin},
            "curso": {"from": c.curso_inicio, "to": c.curso_fin},
            "docente_nombre": (
                f"{c.docente.first_name} {c.docente.last_name}" if getattr(c, "docente", None) else None
            ),
        }

    return schemas.InscripcionOut(
        id=r.id,
        ciclo_id=r.ciclo_id,
        status=r.status,
        tipo=r.tipo,
        referencia=r.referencia,
        importe_centavos=r.importe_centavos,
        comprobante=_meta(r.comprobante_path, r.comprobante_mime, r.comprobante_size),
        comprobante_estudios=_meta(
            r.comprobante_estudios_path, r.comprobante_estudios_mime, r.comprobante_estudios_size
        ),
        comprobante_exencion=_meta(
            r.comprobante_exencion_path, r.comprobante_exencion_mime, r.comprobante_exencion_size
        ),
        alumno=r.alumno,  # Pydantic lo mapea a AlumnoMini (from_attributes=True)
        created_at=r.created_at,
        ciclo=ciclo_dict,
    )

# --------------------------
# Listar inscripciones (coordinación)
# --------------------------
@router.get("", response_model=List[schemas.InscripcionOut])
def list_inscripciones(
    status: Optional[str] = Query(None, description="Filtrar por status"),
    ciclo_id: Optional[int] = Query(None, description="Filtrar por ciclo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_coordinator),
):
    q = (
        db.query(models.Inscripcion)
        .options(
            joinedload(models.Inscripcion.alumno),
            joinedload(models.Inscripcion.ciclo).joinedload(models.Ciclo.docente),
        )
        .order_by(models.Inscripcion.created_at.desc())
    )
    if status:
        q = q.filter(models.Inscripcion.status == status)
    if ciclo_id:
        q = q.filter(models.Inscripcion.ciclo_id == ciclo_id)

    rows = q.offset(skip).limit(limit).all()
    return [_to_inscripcion_out(r) for r in rows]

# --------------------------
# Validar inscripción
# --------------------------
@router.post("/{inscripcion_id}/validate", response_model=schemas.InscripcionOut)
def validate_inscripcion(
    inscripcion_id: int,
    payload: schemas.ValidateInscripcionIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_coordinator),
):
    insc = (
        db.query(models.Inscripcion)
        .options(
            joinedload(models.Inscripcion.alumno),
            joinedload(models.Inscripcion.ciclo).joinedload(models.Ciclo.docente),
        )
        .filter(models.Inscripcion.id == inscripcion_id)
        .first()
    )
    if not insc:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    if insc.validated_at is not None:
        raise HTTPException(status_code=409, detail="La inscripción ya fue validada")

    if payload.action == "APPROVE":
        insc.status = "confirmada"
    elif payload.action == "REJECT":
        insc.status = "rechazada"
    else:
        raise HTTPException(status_code=400, detail="Acción inválida")

    insc.validation_notes = payload.notes
    insc.validated_by_id = user.id
    insc.validated_at = datetime.utcnow()

    db.commit()
    db.refresh(insc)
    return _to_inscripcion_out(insc)

# --------------------------
# Descargar archivo de inscripción (coordinación)
# --------------------------
@router.get("/{inscripcion_id}/archivo")
def download_comprobante_coord(
    inscripcion_id: int,
    tipo: str = Query(..., pattern="^(comprobante|estudios|exencion)$"),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_coordinator),
):
    ins = db.query(models.Inscripcion).filter(models.Inscripcion.id == inscripcion_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    if tipo == "comprobante":
        raw_path, mime = ins.comprobante_path, ins.comprobante_mime
    elif tipo == "estudios":
        raw_path, mime = ins.comprobante_estudios_path, ins.comprobante_estudios_mime
    else:
        raw_path, mime = ins.comprobante_exencion_path, ins.comprobante_exencion_mime

    if not raw_path:
        raise HTTPException(status_code=404, detail="Archivo no disponible (sin ruta)")

    base_dir = getattr(settings, "UPLOAD_DIR", None) or getattr(settings, "MEDIA_ROOT", None) or "."

    # 1) Directo
    file_path = raw_path if os.path.isabs(raw_path) else os.path.join(base_dir, raw_path)
    if not os.path.exists(file_path):
        # 2) Compat: corta tras '/uploads/' si guardaste ruta absoluta del host
        marker = "/uploads/"
        candidate = None
        if marker in raw_path:
            rel = raw_path.split(marker, 1)[-1]  # p.ej. 'exenciones/archivo.pdf'
            candidate = os.path.join(base_dir, rel)
        else:
            candidate = os.path.join(base_dir, os.path.basename(raw_path))

        if candidate and os.path.exists(candidate):
            file_path = candidate
        else:
            raise HTTPException(status_code=404, detail=f"Archivo no disponible: {file_path}")

    if not mime:
        guessed, _ = mimetypes.guess_type(file_path)
        mime = guessed or "application/octet-stream"

    filename = os.path.basename(file_path)
    return FileResponse(file_path, media_type=mime, filename=filename)