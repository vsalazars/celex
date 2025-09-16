# app/routers/coordinacion_reportes.py
# app/routers/coordinacion_reportes.py
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import or_, func, literal, extract

from ..database import get_db
from ..auth import require_coordinator_or_admin
# 👇 Asegura estos imports (incluye PlacementExam y PlacementRegistro)
from ..models import Ciclo, Inscripcion, User, PlacementExam, PlacementRegistro
router = APIRouter(prefix="/coordinacion", tags=["Coordinación - Reportes"])

# ------------------------------
# Schemas (Pydantic v2-friendly)
# ------------------------------
from pydantic import BaseModel, ConfigDict

class CicloLite(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int | str
    codigo: str
    idioma: Optional[str] = None
    anio: Optional[int] = None

class GrupoLite(BaseModel):
    id: int | str
    nombre: str

class AlumnoInscrito(BaseModel):
    inscripcion_id: int | str
    boleta: Optional[str] = None
    nombre: str
    email: Optional[str] = None
    fecha_inscripcion: Optional[str] = None
    estado: Optional[str] = None

class ReporteInscritos(BaseModel):
    ciclo: Dict[str, Any]
    grupo: Optional[Dict[str, Any]] = None
    total: int
    alumnos: List[AlumnoInscrito]

class PagoRow(BaseModel):
    inscripcion_id: int | str
    alumno: str
    email: Optional[str] = None
    referencia: Optional[str] = None     # <- referencia del pago (si aplica)
    tipo: str                            # "pago" | "exencion"
    status: str                          # "pendiente" | "validado" | "rechazado"
    importe_centavos: int
    fecha_pago: Optional[str] = None

class ReportePagos(BaseModel):
    ciclo: Dict[str, Any]
    grupo: Optional[Dict[str, Any]] = None
    total_registros: int
    total_validado_centavos: int          # suma solo de pagos validados
    rows: List[PagoRow]

# ======================
# Filtros: Ciclos/Grupos
# ======================

@router.get("/ciclos", response_model=List[CicloLite], dependencies=[Depends(require_coordinator_or_admin)])
def listar_ciclos(
    anio: Optional[int] = Query(None, description="Ej. 2025"),
    idioma: Optional[str] = Query(None, description="ingles|frances|aleman|..."),
    db: Session = Depends(get_db),
):
    q = db.query(Ciclo)
    if idioma:
        # Ciclo.idioma puede ser Enum o string; comparamos por su representación
        q = q.filter(or_(Ciclo.idioma == idioma, Ciclo.idioma.ilike(idioma)))
    if anio:
        # Tus códigos suelen empezar con 'YYYY-...'
        like = f"{anio}-%"
        q = q.filter(Ciclo.codigo.ilike(like))

    q = q.order_by(Ciclo.codigo.desc()).limit(200)
    ciclos = q.all()

    out: List[CicloLite] = []
    for c in ciclos:
        # Intenta extraer año del prefijo del código
        year = None
        try:
            pref = str(getattr(c, "codigo", "")).split("-", 1)[0]
            year = int(pref)
        except Exception:
            pass
        out.append(CicloLite(id=c.id, codigo=c.codigo, idioma=str(getattr(c, "idioma", None) or ""), anio=year))
    return out


@router.get("/grupos", response_model=List[GrupoLite], dependencies=[Depends(require_coordinator_or_admin)])
def listar_grupos(
    cicloId: int = Query(..., description="ID de ciclo"),
    db: Session = Depends(get_db),
):
    """
    En tu modelo actual no existe tabla 'grupos'. Regresamos lista vacía
    (el front lo maneja como opcional). Si más adelante modelas 'grupos',
    ajusta este endpoint para consultarlos por ciclo.
    """
    return []

# ==============================
# Reporte: Alumnos Inscritos
# ==============================

@router.get("/reportes/inscritos", response_model=ReporteInscritos, dependencies=[Depends(require_coordinator_or_admin)])
def reporte_inscritos(
    cicloId: int = Query(...),
    grupoId: Optional[str] = Query(None),  # reservado para futuro
    db: Session = Depends(get_db),
):
    ciclo = db.query(Ciclo).filter(Ciclo.id == cicloId).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    # Columnas calculadas para mostrar y ordenar: "Apellidos, Nombres"
    apellidos = func.coalesce(func.trim(User.last_name), "")
    nombres = func.coalesce(func.trim(User.first_name), "")
    alumno_fmt = func.concat(apellidos, literal(", "), nombres).label("nombre")

    # Si tienes extensión unaccent en PostgreSQL, puedes usar:
    # apellidos_ord = func.lower(func.unaccent(apellidos))
    # nombres_ord  = func.lower(func.unaccent(nombres))
    # Si no, usa estas:
    apellidos_ord = func.lower(apellidos)
    nombres_ord  = func.lower(nombres)

    # Join Inscripcion + User
    inscs = (
        db.query(
            Inscripcion.id.label("inscripcion_id"),
            User.boleta.label("boleta"),
            alumno_fmt,  # <- "Apellidos, Nombres"
            User.email.label("email"),
            Inscripcion.created_at.label("fecha_inscripcion"),
            Inscripcion.status.label("estado"),
        )
        .join(User, User.id == Inscripcion.alumno_id)
        .filter(Inscripcion.ciclo_id == cicloId)
        .order_by(apellidos_ord.asc(), nombres_ord.asc(), Inscripcion.id.asc())
        .all()
    )

    alumnos: List[AlumnoInscrito] = []
    for r in inscs:
        fecha = None
        if getattr(r, "fecha_inscripcion", None):
            fecha = getattr(r, "fecha_inscripcion").strftime("%Y-%m-%d")
        alumnos.append(
            AlumnoInscrito(
                inscripcion_id=r.inscripcion_id,
                boleta=r.boleta,
                nombre=r.nombre or "",  # ya viene "Apellidos, Nombres"
                email=r.email,
                fecha_inscripcion=fecha,
                estado=r.estado,
            )
        )

    return ReporteInscritos(
        ciclo={"id": ciclo.id, "codigo": ciclo.codigo},
        grupo=None,  # no hay grupos en el modelo actual
        total=len(alumnos),
        alumnos=alumnos,
    )

# ==============================
# Reporte: Pagos (por ciclo)
# ==============================

@router.get("/reportes/pagos", response_model=ReportePagos, dependencies=[Depends(require_coordinator_or_admin)])
def reporte_pagos(
    cicloId: int = Query(...),
    grupoId: Optional[str] = Query(None),  # reservado para futuro
    db: Session = Depends(get_db),
):
    ciclo = db.query(Ciclo).filter(Ciclo.id == cicloId).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    # Columnas calculadas para mostrar y ordenar: "Apellidos, Nombres"
    apellidos = func.coalesce(func.trim(User.last_name), "")
    nombres = func.coalesce(func.trim(User.first_name), "")
    alumno_fmt = func.concat(apellidos, literal(", "), nombres).label("alumno")

    # Con unaccent (si disponible):
    # apellidos_ord = func.lower(func.unaccent(apellidos))
    # nombres_ord  = func.lower(func.unaccent(nombres))
    # Sin unaccent:
    apellidos_ord = func.lower(apellidos)
    nombres_ord  = func.lower(nombres)

    rows = (
        db.query(
            Inscripcion.id.label("inscripcion_id"),
            alumno_fmt,  # <- "Apellidos, Nombres"
            User.email.label("email"),
            Inscripcion.referencia.label("referencia"),
            Inscripcion.tipo.label("tipo"),
            Inscripcion.importe_centavos.label("importe_centavos"),
            Inscripcion.fecha_pago.label("fecha_pago"),
            Inscripcion.validated_by_id.label("validated_by_id"),
            Inscripcion.rechazo_motivo.label("rechazo_motivo"),
        )
        .join(User, User.id == Inscripcion.alumno_id)
        .filter(Inscripcion.ciclo_id == cicloId)
        .order_by(apellidos_ord.asc(), nombres_ord.asc(), Inscripcion.id.asc())
        .all()
    )

    def coerce_tipo(v) -> str:
        # Enum → usa .value; string → úsala; None → "pago" por defecto
        val = getattr(v, "value", v)
        if val is None:
            val = "pago"
        return str(val).lower().strip()

    out_rows: List[PagoRow] = []
    total_validado = 0

    for r in rows:
        # Estatus
        if r.validated_by_id:
            status = "validado"
        elif r.rechazo_motivo:
            status = "rechazado"
        else:
            status = "pendiente"

        tipo = coerce_tipo(r.tipo)
        importe = int(r.importe_centavos or 0)

        # Suma solo pagos validados (exenciones NO suman)
        if status == "validado" and tipo == "pago":
            total_validado += importe

        fecha = None
        if getattr(r, "fecha_pago", None):
            fecha = getattr(r, "fecha_pago").strftime("%Y-%m-%d")

        out_rows.append(
            PagoRow(
                inscripcion_id=r.inscripcion_id,
                alumno=r.alumno or "",  # ya viene "Apellidos, Nombres"
                email=r.email,
                referencia=r.referencia,
                tipo=tipo,  # "pago" | "exencion"
                status=status,
                importe_centavos=importe,
                fecha_pago=fecha,
            )
        )

    return ReportePagos(
        ciclo={"id": ciclo.id, "codigo": ciclo.codigo},
        grupo=None,
        total_registros=len(out_rows),
        total_validado_centavos=total_validado,
        rows=out_rows,
    )




# ==============================
# Reporte: Encuesta (con promedios y distribución completa)
# ==============================

class SurveyOptionDTO(BaseModel):
    opcion: str
    conteo: int

# ---- NUEVO: DTO para categoría ----
class SurveyCategoryDTO(BaseModel):
    id: int | str
    name: str
    order: int

class SurveyQuestionDTO(BaseModel):
    id: int | str
    texto: str
    opciones: List[SurveyOptionDTO]
    total_respuestas: int | None = None
    # Métricas para Likert 1-5
    promedio: float | None = None        # escala 1..5
    promedio_pct: float | None = None    # 0..100 (promedio/5 * 100)
    favorables_pct: float | None = None  # % de respuestas >=4
    # ---- NUEVO: categoría asociada ----
    categoria: Optional[SurveyCategoryDTO] = None

# ⬇️ NUEVO
class DocenteMini(BaseModel):
    id: int | str
    nombre: str



class ReporteEncuesta(BaseModel):
    ciclo: Dict[str, Any]
    preguntas: List[SurveyQuestionDTO]
    total_participantes: int | None = None
    # ⬇️ NUEVO: para que el front pueda mostrar "Docente: ..."
    docente: DocenteMini | None = None


@router.get(
    "/reportes/encuesta",
    response_model=ReporteEncuesta,
    dependencies=[Depends(require_coordinator_or_admin)]
)
def reporte_encuesta(
    cicloId: int = Query(..., description="ID de ciclo"),
    db: Session = Depends(get_db),
):
    """
    Consolida resultados de encuesta por ciclo.

    Tipos soportados (con columnas en SurveyAnswer):
      - likert_1_5  → value_int (1..5)  [incluye promedio y % favorables]
      - scale_0_10  → value_int (0..10)
      - yes_no      → value_bool        [mapea a Sí/No]
      - open_text   → value_text        [solo cuenta]
    """
    # Import local para evitar dependencias circulares
    from ..models import SurveyQuestion, SurveyResponse, SurveyAnswer, SurveyCategory

    # Ciclo
    ciclo = db.query(Ciclo).filter(Ciclo.id == cicloId).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

     
     
      # ⬇⬇⬇ NUEVO: armar el payload del docente (si existe)
    docente_payload = None
    if getattr(ciclo, "docente_id", None):
        first = func.coalesce(func.trim(User.first_name), "")
        last  = func.coalesce(func.trim(User.last_name), "")
        nombre = (
            db.query(func.trim(func.concat(first, literal(" "), last)))
            .filter(User.id == ciclo.docente_id)
            .scalar()
        ) or ""
        docente_payload = DocenteMini(id=ciclo.docente_id, nombre=nombre)

    
    
    # Participantes (cantidad de responses del ciclo)
    total_participantes = (
        db.query(func.count(SurveyResponse.id))
        .filter(SurveyResponse.ciclo_id == cicloId)
        .scalar()
    ) or 0

    # Preguntas activas + categoría (ordenadas por categoría y orden de pregunta)
    preguntas_join = (
        db.query(SurveyQuestion, SurveyCategory)
        .outerjoin(SurveyCategory, SurveyCategory.id == SurveyQuestion.category_id)
        .filter(SurveyQuestion.active.is_(True))
        .order_by(SurveyCategory.order.asc(), SurveyQuestion.order.asc())
        .all()
    )

    out_pregs: List[SurveyQuestionDTO] = []

    for q, cat in preguntas_join:
        q_type = (q.type or "").strip()

        opciones: List[SurveyOptionDTO] = []
        total_respuestas: int | None = None
        promedio: float | None = None
        promedio_pct: float | None = None
        favorables_pct: float | None = None

        if q_type == "likert_1_5":
            # Distribución 1..5 (incluir ceros)
            rows = (
                db.query(SurveyAnswer.value_int.label("val"), func.count().label("n"))
                .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                .filter(
                    SurveyResponse.ciclo_id == cicloId,
                    SurveyAnswer.question_id == q.id,
                    SurveyAnswer.value_int.isnot(None),
                )
                .group_by(SurveyAnswer.value_int)
                .all()
            )

            # Mapa val→conteo con ceros 1..5
            dist = {v: 0 for v in range(1, 6)}
            for r in rows:
                v = int(r.val or 0)
                n = int(r.n or 0)
                if 1 <= v <= 5 and n > 0:
                    dist[v] += n

            total = 0
            suma = 0
            favorables = 0  # >=4

            # Construye opciones en orden 1..5 y calcula métricas
            for v in range(1, 6):
                n = dist[v]
                opciones.append(SurveyOptionDTO(opcion=str(v), conteo=n))
                total += n
                suma += v * n
                if v >= 4:
                    favorables += n

            total_respuestas = total
            if total > 0:
                promedio = round(suma / total, 2)
                promedio_pct = round((promedio / 5.0) * 100.0, 1)
                favorables_pct = round((favorables / total) * 100.0, 1)

        elif q_type == "scale_0_10":
            # Distribución 0..10 (solo opciones con votos; puedes rellenar 0..10 si lo deseas)
            rows = (
                db.query(SurveyAnswer.value_int.label("val"), func.count().label("n"))
                .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                .filter(
                    SurveyResponse.ciclo_id == cicloId,
                    SurveyAnswer.question_id == q.id,
                    SurveyAnswer.value_int.isnot(None),
                )
                .group_by(SurveyAnswer.value_int)
                .order_by(SurveyAnswer.value_int.asc())
                .all()
            )
            total = 0
            suma = 0
            for r in rows:
                v = int(r.val or 0)
                n = int(r.n or 0)
                if 0 <= v <= 10 and n > 0:
                    opciones.append(SurveyOptionDTO(opcion=str(v), conteo=n))
                    total += n
                    suma += v * n
            total_respuestas = total
            if total > 0:
                promedio = round(suma / total, 2)

        elif q_type == "yes_no":
            # Siempre devuelve "Sí" y "No" (con ceros si no hay votos)
            rows = (
                db.query(SurveyAnswer.value_bool.label("val"), func.count().label("n"))
                .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                .filter(
                    SurveyResponse.ciclo_id == cicloId,
                    SurveyAnswer.question_id == q.id,
                    SurveyAnswer.value_bool.isnot(None),
                )
                .group_by(SurveyAnswer.value_bool)
                .all()
            )
            dist = {"Sí": 0, "No": 0}
            total = 0
            si = 0
            for r in rows:
                n = int(r.n or 0)
                if r.val is True:
                    dist["Sí"] += n
                    si += n
                elif r.val is False:
                    dist["No"] += n
                total += n

            opciones = [
                SurveyOptionDTO(opcion="Sí", conteo=dist["Sí"]),
                SurveyOptionDTO(opcion="No", conteo=dist["No"]),
            ]
            total_respuestas = total
            if total > 0:
                favorables_pct = round((si / total) * 100.0, 1)

        else:
            # open_text u otros → solo cuenta respuestas con texto
            total_texto = (
                db.query(func.count(SurveyAnswer.id))
                .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                .filter(
                    SurveyResponse.ciclo_id == cicloId,
                    SurveyAnswer.question_id == q.id,
                    SurveyAnswer.value_text.isnot(None),
                )
                .scalar()
            ) or 0
            total_respuestas = int(total_texto)
            opciones = []  # no graficamos texto libre

        out_pregs.append(
            SurveyQuestionDTO(
                id=q.id,
                texto=q.text,
                opciones=opciones,
                total_respuestas=total_respuestas,
                promedio=promedio,
                promedio_pct=promedio_pct,
                favorables_pct=favorables_pct,
                categoria=(
                    SurveyCategoryDTO(id=cat.id, name=cat.name, order=cat.order)
                    if cat is not None else None
                ),
            )
        )

    return ReporteEncuesta(
        ciclo={"id": ciclo.id, "codigo": ciclo.codigo},
        preguntas=out_pregs,
        total_participantes=total_participantes,
        docente=docente_payload,  # ⬅️ NUEVO
    )



# ==============================
# Desempeño Docente (serie por ciclos)
# ==============================

class DocenteLite(BaseModel):
    id: int | str
    nombre: str

class SeriePunto(BaseModel):
    ciclo_id: int | str
    ciclo_codigo: str
    promedio_pct: float          # 0..100
    fecha: Optional[str] = None  # ISO (curso_inicio) si existe

class SerieDocenteResponse(BaseModel):
    docente: Dict[str, Any]
    puntos: List[SeriePunto]


@router.get(
    "/docentes",
    response_model=List[DocenteLite],
    dependencies=[Depends(require_coordinator_or_admin)],
)
def listar_docentes(
    q: Optional[str] = Query(None, description="Búsqueda por nombre (opcional)"),
    incluir_inactivos: bool = Query(False, description="Incluir cuentas inactivas"),
    db: Session = Depends(get_db),
):
    """
    Lista docentes:
    - role == 'teacher' (activos por defecto)
    - + cualquiera asignado como docente en algún ciclo (ciclos.docente_id)
    - evita duplicados y ordena por 'Apellidos, Nombres'
    """
    from ..models import User, UserRole, Ciclo  # evita dependencias circulares

    apellidos = func.coalesce(func.trim(User.last_name), "")
    nombres   = func.coalesce(func.trim(User.first_name), "")
    nombre_fmt = func.concat(apellidos, literal(", "), nombres).label("nombre")

    # Helper: condición de "activo" (trata NULL como activo por defecto)
    def activo_clause():
        # incluir_inactivos=False  => (is_active IS TRUE OR is_active IS NULL)
        # incluir_inactivos=True   => no filtra
        return (User.is_active.is_(True) | User.is_active.is_(None))

    # Base: usuarios con role teacher
    base = db.query(User.id.label("id"), nombre_fmt).filter(User.role == UserRole.teacher)
    if not incluir_inactivos:
        base = base.filter(activo_clause())

    # Asignados a algún ciclo como docente, sin importar el role
    asignados = (
        db.query(User.id.label("id"), nombre_fmt)
        .join(Ciclo, Ciclo.docente_id == User.id)
    )
    if not incluir_inactivos:
        asignados = asignados.filter(activo_clause())

    # Filtro por texto (si se pide)
    if q:
        like = f"%{q}%"
        name_or_last = or_(
            User.first_name.ilike(like),
            User.last_name.ilike(like),
            func.concat(apellidos, literal(", "), nombres).ilike(like),
        )
        base      = base.filter(name_or_last)
        asignados = asignados.filter(name_or_last)

    # UNION (evita duplicados) y orden por "Apellidos, Nombres"
    sub = base.union_all(asignados).subquery()
    rows = (
        db.query(sub.c.id, sub.c.nombre)
        .distinct()
        .order_by(func.lower(sub.c.nombre).asc(), sub.c.id.asc())
        .all()
    )

    return [DocenteLite(id=r.id, nombre=r.nombre or "") for r in rows]


@router.get(
    "/reportes/desempeno-docente",
    response_model=SerieDocenteResponse,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def reporte_desempeno_docente(
    docenteId: int = Query(..., description="ID del docente"),
    db: Session = Depends(get_db),
):
    """
    Serie temporal por ciclo para un docente:
    - Considera respuestas de encuesta del ciclo
    - Solo preguntas tipo 'likert_1_5'
    - Si existen categorías activas cuyo nombre contiene 'profesor', restringe a ellas;
      si no, usa todas las 'likert_1_5'
    - promedio_pct = (avg(value_int)/5)*100
    """
    from ..models import (
        User, Ciclo,
        SurveyCategory, SurveyQuestion, SurveyResponse, SurveyAnswer,
    )

    # Docente
    docente = db.query(User).filter(User.id == docenteId).first()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    apellidos = func.coalesce(func.trim(User.last_name), "")
    nombres = func.coalesce(func.trim(User.first_name), "")
    docente_nombre = (
        db.query(func.concat(apellidos, literal(", "), nombres))
        .filter(User.id == docenteId)
        .scalar()
    ) or ""

    # ¿Hay categorías "del profesor" activas?
    cat_prof_ids = [
        x[0]
        for x in db.query(SurveyCategory.id)
        .filter(
            SurveyCategory.active.is_(True),
            SurveyCategory.name.ilike("%profesor%"),
        ).all()
    ]
    usar_filtro_profesor = len(cat_prof_ids) > 0

    # Agregación por ciclo (una sola consulta)
    q = (
        db.query(
            SurveyResponse.ciclo_id.label("ciclo_id"),
            Ciclo.codigo.label("ciclo_codigo"),
            Ciclo.curso_inicio.label("curso_inicio"),
            func.sum(SurveyAnswer.value_int).label("suma"),
            func.count(SurveyAnswer.value_int).label("n"),
        )
        .join(SurveyAnswer, SurveyAnswer.response_id == SurveyResponse.id)
        .join(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .join(Ciclo, Ciclo.id == SurveyResponse.ciclo_id)
        .filter(
            Ciclo.docente_id == docenteId,
            SurveyAnswer.value_int.isnot(None),
            SurveyQuestion.type == "likert_1_5",
        )
        .group_by(SurveyResponse.ciclo_id, Ciclo.codigo, Ciclo.curso_inicio)
    )

    if usar_filtro_profesor:
        q = q.filter(SurveyQuestion.category_id.in_(cat_prof_ids))

    rows = q.all()

    puntos: List[SeriePunto] = []
    for r in rows:
        n = int(r.n or 0)
        if n <= 0:
            continue
        prom = float(r.suma or 0) / n               # escala 1..5
        pct = round((prom / 5.0) * 100.0, 1)        # 0..100

        fecha_iso = None
        if getattr(r, "curso_inicio", None):
            try:
                fecha_iso = r.curso_inicio.isoformat()
            except Exception:
                fecha_iso = None

        puntos.append(
            SeriePunto(
                ciclo_id=r.ciclo_id,
                ciclo_codigo=r.ciclo_codigo,
                promedio_pct=pct,
                fecha=fecha_iso,
            )
        )

    # Ordena por fecha si viene, si no por código (estable)
    puntos.sort(key=lambda p: (p.fecha or "", str(p.ciclo_codigo)))

    return SerieDocenteResponse(
        docente={"id": docente.id, "nombre": docente_nombre},
        puntos=puntos,
    )



@router.get(
    "/reportes/desempeno-docente-por-pregunta",
    dependencies=[Depends(require_coordinator_or_admin)],
)
def reporte_desempeno_docente_por_pregunta(
    docenteId: int = Query(..., description="ID del docente"),
    soloProfesor: Optional[bool] = Query(
        None,
        description=(
            "Si True, filtra solo preguntas de categorías activas que contengan 'profesor'. "
            "Si False, NO filtra. Si None (por defecto), filtra solo si existen dichas categorías."
        ),
    ),
    db: Session = Depends(get_db),
):
    """
    Devuelve series por PREGUNTA (tipo 'likert_1_5') con el promedio en % por ciclo
    para el docente indicado. El filtro por categorías que contienen 'profesor'
    es controlable con 'soloProfesor'.
    """
    # 👇 IMPORT LOCAL (evita dependencias circulares y corrige el NameError)
    from ..models import (
        User, Ciclo,
        SurveyCategory, SurveyQuestion, SurveyResponse, SurveyAnswer,
    )

    # Docente
    docente = db.query(User).filter(User.id == docenteId).first()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    # Nombre "Nombre Apellidos"
    first = func.coalesce(func.trim(User.first_name), "")
    last  = func.coalesce(func.trim(User.last_name), "")
    docente_nombre = (
        db.query(func.concat(first, literal(" "), last))
        .filter(User.id == docenteId)
        .scalar()
        or ""
    ).strip()

    # Categorías 'profesor' activas
    cat_prof_ids = [
        x[0]
        for x in db.query(SurveyCategory.id)
        .filter(
            SurveyCategory.active.is_(True),
            SurveyCategory.name.ilike("%profesor%"),
        )
        .all()
    ]

    # Decidir si usar filtro
    if soloProfesor is True:
        usar_filtro_profesor = True
    elif soloProfesor is False:
        usar_filtro_profesor = False
    else:
        usar_filtro_profesor = len(cat_prof_ids) > 0  # auto: filtra si existen

    # Agregación por ciclo y por pregunta
    q = (
        db.query(
            SurveyResponse.ciclo_id.label("ciclo_id"),
            Ciclo.codigo.label("ciclo_codigo"),
            SurveyQuestion.id.label("pregunta_id"),
            SurveyQuestion.text.label("pregunta_texto"),
            func.sum(SurveyAnswer.value_int).label("suma"),
            func.count(SurveyAnswer.value_int).label("n"),
        )
        .join(SurveyAnswer, SurveyAnswer.response_id == SurveyResponse.id)
        .join(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .join(Ciclo, Ciclo.id == SurveyResponse.ciclo_id)
        .filter(
            Ciclo.docente_id == docenteId,
            SurveyAnswer.value_int.isnot(None),
            SurveyQuestion.type == "likert_1_5",
        )
        .group_by(
            SurveyResponse.ciclo_id,
            Ciclo.codigo,
            SurveyQuestion.id,
            SurveyQuestion.text,
        )
        .order_by(Ciclo.codigo.asc(), SurveyQuestion.id.asc())
    )

    if usar_filtro_profesor:
        q = q.filter(SurveyQuestion.category_id.in_(cat_prof_ids))

    rows = q.all()

    # Construir series { id, label, data: [{x,y}] } por pregunta
    series_map: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        n = int(r.n or 0)
        if n <= 0:
            continue
        prom = float(r.suma or 0) / n               # escala 1..5
        pct  = round((prom / 5.0) * 100.0, 1)       # 0..100
        pid  = str(r.pregunta_id)
        if pid not in series_map:
            series_map[pid] = {
                "id": pid,
                "label": (r.pregunta_texto or f"Pregunta {pid}"),
                "data": [],
            }
        series_map[pid]["data"].append({"x": r.ciclo_codigo, "y": pct})

    # Orden de puntos por código de ciclo
    for s in series_map.values():
        s["data"].sort(key=lambda p: str(p["x"]).lower())

    series = list(series_map.values())
    series.sort(key=lambda s: s["id"])

    return {
        "docente": {"id": docenteId, "nombre": docente_nombre},
        "series": series,
        "meta": {
            "soloProfesor": usar_filtro_profesor,
            "catProfesorCount": len(cat_prof_ids),
        },
    }

# ==============================
# Reporte: Comentarios de Encuesta (por ciclo)
# ==============================


# --- Shape EXACTO que consume el front ---
class ComentarioAlumno(BaseModel):
    id: int | str | None = None
    nombre: str | None = None
    email: str | None = None

class EncuestaComentarioItem(BaseModel):
    id: int | str
    pregunta_id: int | str | None = None
    pregunta_texto: str | None = None
    texto: str
    created_at: str | None = None
    alumno: Optional[ComentarioAlumno] = None

class ComentariosEncuestaResponse(BaseModel):
    ciclo: Dict[str, Any]
    total: int
    items: List[EncuestaComentarioItem]


@router.get(
    "/reportes/encuesta/comentarios",
    response_model=ComentariosEncuestaResponse,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def reporte_encuesta_comentarios(
    cicloId: int = Query(..., description="ID de ciclo"),
    q: Optional[str] = Query(None, description="Búsqueda en comentario/pregunta/alumno/email"),
    includeGeneral: bool = Query(False, description="Intentar incluir comentarios 'legacy' si la columna existe"),
    onlyCommentLike: bool = Query(True, description="Limitar a preguntas open_text típicas de comentarios/sugerencias"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Devuelve comentarios de encuesta *dinámicamente*:
      - Toma TODAS las preguntas `open_text` del ciclo.
      - Si `onlyCommentLike=True`, filtra a las que en el texto/help contengan
        'coment', 'sugerenc' u 'observaci' (stems).
      - Opcionalmente intenta incluir comentarios 'legacy' (SurveyResponse.comments)
        SOLO si la columna existe en el modelo/tabla.
      - Formato 100% compatible con el front: { id, pregunta_id, pregunta_texto, texto, created_at, alumno{...} }
    """
    from ..models import SurveyResponse, SurveyAnswer, SurveyQuestion, User

    # Verifica ciclo
    ciclo = db.query(Ciclo).filter(Ciclo.id == cicloId).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")

    # ----------- Query base: comentarios de preguntas OPEN_TEXT -----------
    open_filters = [
        SurveyResponse.ciclo_id == cicloId,
        SurveyQuestion.type == "open_text",
        SurveyAnswer.value_text.isnot(None),
        func.length(func.btrim(SurveyAnswer.value_text)) > 0,
    ]

    if onlyCommentLike:
        rx1, rx2, rx3 = "%coment%", "%sugerenc%", "%observaci%"
        open_filters.append(
            or_(
                SurveyQuestion.text.ilike(rx1),
                SurveyQuestion.text.ilike(rx2),
                SurveyQuestion.text.ilike(rx3),
                func.coalesce(SurveyQuestion.help_text, literal("")).ilike(rx1),
                func.coalesce(SurveyQuestion.help_text, literal("")).ilike(rx2),
                func.coalesce(SurveyQuestion.help_text, literal("")).ilike(rx3),
            )
        )

    open_q = (
        db.query(
            SurveyAnswer.id.label("id"),
            SurveyQuestion.id.label("pregunta_id"),
            SurveyQuestion.text.label("pregunta_texto"),
            SurveyAnswer.value_text.label("texto"),
            # Si tu modelo tiene created_at en SurveyAnswer úsalo; si no, cae a SurveyResponse
            func.coalesce(SurveyAnswer.created_at, SurveyResponse.created_at).label("created_at"),
            User.id.label("alumno_id"),
            User.first_name.label("first_name"),
            User.last_name.label("last_name"),
            User.email.label("email"),
        )
        .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
        .join(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .join(User, User.id == SurveyResponse.alumno_id)
        .filter(*open_filters)
    )

    # ----------- Opcional: comentarios "legacy" SOLO si la columna existe -----------
    has_general_col = (
        includeGeneral
        and hasattr(SurveyResponse, "__table__")
        and "comments" in SurveyResponse.__table__.c
    )

    if has_general_col:
        general_q = (
            db.query(
                SurveyResponse.id.label("id"),
                literal(None).label("pregunta_id"),
                literal(None).label("pregunta_texto"),
                SurveyResponse.comments.label("texto"),
                SurveyResponse.created_at.label("created_at"),
                User.id.label("alumno_id"),
                User.first_name.label("first_name"),
                User.last_name.label("last_name"),
                User.email.label("email"),
            )
            .join(User, User.id == SurveyResponse.alumno_id)
            .filter(
                SurveyResponse.ciclo_id == cicloId,
                SurveyResponse.comments.isnot(None),
                func.length(func.btrim(SurveyResponse.comments)) > 0,
            )
        )
        combined = open_q.union_all(general_q)
    else:
        combined = open_q

    sub = combined.subquery()

    # ----------- Búsqueda libre (q) -----------
    qry = db.query(sub)
    if q:
        like = f"%{q.strip()}%"
        nombre_fmt = func.concat(
            func.coalesce(func.trim(sub.c.last_name), ""),
            literal(", "),
            func.coalesce(func.trim(sub.c.first_name), ""),
        )
        qry = qry.filter(
            or_(
                sub.c.texto.ilike(like),
                func.coalesce(sub.c.pregunta_texto, literal("")).ilike(like),
                nombre_fmt.ilike(like),
                func.coalesce(sub.c.email, literal("")).ilike(like),
            )
        )

    # ----------- Total, orden y paginación -----------
    total = db.query(func.count()).select_from(qry.subquery()).scalar() or 0

    rows = (
        qry.order_by(sub.c.created_at.desc().nullslast(), sub.c.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # ----------- Construcción de ítems (shape del front) -----------
    items: List[EncuestaComentarioItem] = []
    for r in rows:
        ap = (getattr(r, "last_name", "") or "").strip()
        no = (getattr(r, "first_name", "") or "").strip()
        alumno_nombre = f"{ap}, {no}".strip(", ").strip() or None

        created_iso = None
        try:
            created_iso = r.created_at.isoformat() if r.created_at else None
        except Exception:
            created_iso = None

        items.append(
            EncuestaComentarioItem(
                id=r.id,
                pregunta_id=r.pregunta_id,
                pregunta_texto=r.pregunta_texto,
                texto=r.texto,
                created_at=created_iso,
                alumno=ComentarioAlumno(
                    id=r.alumno_id,
                    nombre=alumno_nombre,
                    email=r.email,
                ),
            )
        )

    return ComentariosEncuestaResponse(
        ciclo={"id": ciclo.id, "codigo": getattr(ciclo, "codigo", "")},
        total=int(total),
        items=items,
    )




# ==============================
# Placement Exams (lite) + Registros (admin)
# ==============================

class PlacementExamLiteDTO(BaseModel):
    id: int | str
    codigo: str
    idioma: str
    fecha: Optional[str] = None  # ISO "YYYY-MM-DD"

@router.get(
    "/placement-exams/lite",
    response_model=List[PlacementExamLiteDTO],
    dependencies=[Depends(require_coordinator_or_admin)],
)
def placement_exams_lite(
    anio: Optional[int] = Query(None, description="Ej. 2025"),
    idioma: Optional[str] = Query(None, description="ingles|frances|aleman|..."),
    q: Optional[str] = Query(None, description="Búsqueda por código/nombre (opcional)"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    Lista 'lite' para el selector de exámenes de colocación.
    Filtra por año (fecha) e idioma. Orden: fecha desc, codigo desc.
    """
    qry = db.query(PlacementExam).filter(PlacementExam.activo.is_(True))

    if idioma:
        qry = qry.filter(
            or_(
                PlacementExam.idioma == idioma,
                PlacementExam.idioma.ilike(idioma)
            )
        )
    if anio:
        # YEAR(fecha) = anio
        qry = qry.filter(extract("year", PlacementExam.fecha) == anio)
    if q:
        like = f"%{q}%"
        qry = qry.filter(
            or_(
                PlacementExam.codigo.ilike(like),
                PlacementExam.nombre.ilike(like),
            )
        )

    rows = (
        qry.order_by(PlacementExam.fecha.desc(), PlacementExam.codigo.desc())
        .limit(limit)
        .all()
    )

    out: List[PlacementExamLiteDTO] = []
    for r in rows:
        fecha_iso = None
        try:
            fecha_iso = r.fecha.isoformat() if getattr(r, "fecha", None) else None
        except Exception:
            fecha_iso = None
        out.append(
            PlacementExamLiteDTO(
                id=r.id,
                codigo=r.codigo,
                idioma=r.idioma,
                fecha=fecha_iso,
            )
        )
    return out


class PlacementRegistroItemDTO(BaseModel):
    id: int | str
    # Alumno (lo mando desglosado y también listo para usar en front)
    alumno_id: int | str
    alumno_nombre: Optional[str] = None
    alumno_apellidos: Optional[str] = None
    alumno_email: Optional[str] = None

    referencia: Optional[str] = None
    tipo: str = "pago"  # default: pago
    estado: str         # pendiente | validado | rechazado (mapeado desde status)
    importe_centavos: Optional[int] = 0
    created_at: Optional[str] = None   # ISO
    validated_at: Optional[str] = None # ISO
    validated_by_id: Optional[int | str] = None
    validated_by_name: Optional[str] = None
    rechazo_motivo: Optional[str] = None
    validation_notes: Optional[str] = None

class PlacementRegistrosAdminResponse(BaseModel):
    exam: Dict[str, Any]
    total: int
    items: List[PlacementRegistroItemDTO]


@router.get(
    "/placement-exams/{exam_id}/registros-admin",
    response_model=PlacementRegistrosAdminResponse,
    dependencies=[Depends(require_coordinator_or_admin)],
)
def placement_registros_admin(
    exam_id: int,
    db: Session = Depends(get_db),
):
    """
    Regresa TODOS los registros/pagos del examen de colocación (placement_registros)
    con datos del alumno y del validador (si existe).
    """
    exam = db.query(PlacementExam).filter(PlacementExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examen no encontrado")

    # Alias para el validador
    Validador = aliased(User)

    # Columnas del alumno
    apellidos = func.coalesce(func.trim(User.last_name), "")
    nombres   = func.coalesce(func.trim(User.first_name), "")

    # Columnas del validador
    v_ap = func.coalesce(func.trim(Validador.last_name), "")
    v_no = func.coalesce(func.trim(Validador.first_name), "")
    validador_nombre = func.trim(func.concat(v_no, literal(" "), v_ap)).label("validador_nombre")

    rows = (
        db.query(
            PlacementRegistro.id.label("id"),
            PlacementRegistro.alumno_id.label("alumno_id"),
            User.first_name.label("alumno_nombre"),
            User.last_name.label("alumno_apellidos"),
            User.email.label("alumno_email"),
            PlacementRegistro.referencia.label("referencia"),
            PlacementRegistro.status.label("status"),
            PlacementRegistro.importe_centavos.label("importe_centavos"),
            PlacementRegistro.created_at.label("created_at"),
            PlacementRegistro.validated_at.label("validated_at"),
            PlacementRegistro.validated_by_id.label("validated_by_id"),
            PlacementRegistro.rechazo_motivo.label("rechazo_motivo"),
            PlacementRegistro.validation_notes.label("validation_notes"),
            validador_nombre,
        )
        .join(User, User.id == PlacementRegistro.alumno_id)
        .outerjoin(Validador, Validador.id == PlacementRegistro.validated_by_id)
        .filter(PlacementRegistro.exam_id == exam_id)
        .order_by(func.lower(apellidos).asc(), func.lower(nombres).asc(), PlacementRegistro.id.asc())
        .all()
    )

    items: List[PlacementRegistroItemDTO] = []
    for r in rows:
        estado = (r.status or "").strip().lower() or "pendiente"
        created_iso = None
        validated_iso = None
        try:
            created_iso = r.created_at.isoformat() if r.created_at else None
        except Exception:
            created_iso = None
        try:
            validated_iso = r.validated_at.isoformat() if r.validated_at else None
        except Exception:
            validated_iso = None

        items.append(
            PlacementRegistroItemDTO(
                id=r.id,
                alumno_id=r.alumno_id,
                alumno_nombre=r.alumno_nombre,
                alumno_apellidos=r.alumno_apellidos,
                alumno_email=r.alumno_email,
                referencia=r.referencia,
                tipo="pago",                # si modelas exenciones, aquí puedes mapear
                estado=estado,              # pendiente|validado|rechazado
                importe_centavos=int(r.importe_centavos or 0),
                created_at=created_iso,
                validated_at=validated_iso,
                validated_by_id=r.validated_by_id,
                validated_by_name=r.validador_nombre,
                rechazo_motivo=r.rechazo_motivo,
                validation_notes=r.validation_notes,
            )
        )

    exam_fecha = None
    try:
        exam_fecha = exam.fecha.isoformat() if getattr(exam, "fecha", None) else None
    except Exception:
        exam_fecha = None

    return PlacementRegistrosAdminResponse(
        exam={
            "id": exam.id,
            "codigo": exam.codigo,
            "idioma": exam.idioma,
            "fecha": exam_fecha,
            "nombre": getattr(exam, "nombre", None),
        },
        total=len(items),
        items=items,
    )