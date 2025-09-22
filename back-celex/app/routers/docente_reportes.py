# app/routers/docente_reportes.py
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, literal, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from ..models import (
    User,
    UserRole,
    Ciclo,
    SurveyCategory,
    SurveyQuestion,
    SurveyResponse,
    SurveyAnswer,
)

router = APIRouter(prefix="/docente", tags=["Docente - Reportes"])


# =========================
#        DTO / Schemas
# =========================
class CicloLite(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int | str
    codigo: str
    idioma: Optional[str] = None
    anio: Optional[int] = None


class DocenteMini(BaseModel):
    id: int | str
    nombre: str


class SurveyOptionDTO(BaseModel):
    opcion: str
    conteo: int


class SurveyCategoryDTO(BaseModel):
    id: int | str
    name: str
    order: int


class SurveyQuestionDTO(BaseModel):
    id: int | str
    texto: str
    opciones: List[SurveyOptionDTO]
    total_respuestas: int | None = None
    promedio: float | None = None          # 1..5 ó 0..10
    promedio_pct: float | None = None      # 0..100
    favorables_pct: float | None = None    # >=4 (solo likert)
    categoria: SurveyCategoryDTO | None = None


class ReporteEncuestaDocente(BaseModel):
    ciclo: Dict[str, Any]
    preguntas: List[SurveyQuestionDTO]
    total_participantes: int = 0
    docente: DocenteMini | None = None


class ComentarioAlumno(BaseModel):
    nombre: str | None = None
    email: str | None = None


class ComentarioOut(BaseModel):
    id: int | str | None = None
    pregunta_id: int | str | None = None
    pregunta_texto: str | None = None
    texto: str
    created_at: str | None = None
    alumno: ComentarioAlumno | None = None


class ComentariosResponse(BaseModel):
    ciclo: Dict[str, Any] | None = None
    total: int
    items: List[ComentarioOut]


class SeriePunto(BaseModel):
    ciclo_id: int | str
    ciclo_codigo: str
    promedio_pct: float
    fecha: str | None = None


class SerieDocenteResponse(BaseModel):
    docente: DocenteMini
    puntos: List[SeriePunto]


# =========================
#     Auth (local guard)
# =========================
def require_teacher_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Permite acceso a: docente, coordinador y superuser.
    Se define aquí para no modificar auth.py.
    """
    if current_user.role not in (UserRole.teacher, UserRole.coordinator, UserRole.superuser):
        raise HTTPException(status_code=403, detail="Permisos insuficientes (docente/coordinador/superuser)")
    return current_user


# =========================================
# A) Listar ciclos asignados al docente
# =========================================
@router.get("/ciclos", response_model=List[CicloLite])
def listar_ciclos_asignados(
    anio: Optional[int] = Query(None, description="Ej. 2025"),
    idioma: Optional[str] = Query(None, description="ingles|frances|aleman|..."),
    db: Session = Depends(get_db),
    current: User = Depends(require_teacher_or_admin),
):
    q = db.query(Ciclo).filter(Ciclo.docente_id == current.id)

    if idioma:
        # Coincidencia exacta o case-insensitive
        q = q.filter(or_(Ciclo.idioma == idioma, Ciclo.idioma.ilike(idioma)))

    if anio:
        like = f"{anio}-%"  # códigos 'YYYY-...'
        q = q.filter(Ciclo.codigo.ilike(like))

    ciclos = q.order_by(Ciclo.codigo.desc()).limit(200).all()

    out: List[CicloLite] = []
    for c in ciclos:
        try:
            pref = str(c.codigo).split("-", 1)[0]
            anio_int = int(pref) if pref.isdigit() else None
        except Exception:
            anio_int = None
        out.append(CicloLite(
            id=c.id,
            codigo=c.codigo,
            idioma=str(getattr(c, "idioma", "") or ""),
            anio=anio_int
        ))
    return out


# ===========================================================
# B) Resultados de encuesta del ciclo (para el docente)
#     Shape compatible con el front de Nivo (ReportEncuesta)
# ===========================================================
@router.get("/reportes/encuesta", response_model=ReporteEncuestaDocente)
def encuesta_por_ciclo(
    cicloId: int = Query(..., description="ID del ciclo"),
    db: Session = Depends(get_db),
    current: User = Depends(require_teacher_or_admin),
):
    # Verifica ciclo y propiedad
    ciclo = db.query(Ciclo).filter(Ciclo.id == cicloId).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    if ciclo.docente_id != current.id:
        raise HTTPException(status_code=403, detail="No puedes ver encuestas de un ciclo no asignado")

    # Docente payload (nombre)
    first = func.coalesce(func.trim(User.first_name), "")
    last = func.coalesce(func.trim(User.last_name), "")
    docente_nombre = (
        db.query(func.trim(func.concat(first, literal(" "), last)))
        .filter(User.id == current.id)
        .scalar()
        or ""
    )
    docente = DocenteMini(id=current.id, nombre=docente_nombre)

    # Total de participantes (responses del ciclo)
    total_participantes = (
        db.query(func.count(SurveyResponse.id))
        .filter(SurveyResponse.ciclo_id == cicloId)
        .scalar()
    ) or 0

    # Preguntas activas con su categoría
    rows = (
        db.query(SurveyQuestion, SurveyCategory)
        .outerjoin(SurveyCategory, SurveyCategory.id == SurveyQuestion.category_id)
        .filter(SurveyQuestion.active.is_(True))
        .order_by(SurveyCategory.order.asc(), SurveyQuestion.order.asc())
        .all()
    )

    out_pregs: List[SurveyQuestionDTO] = []

    for q, cat in rows:
        q_type = (q.type or "").strip()

        opciones: List[SurveyOptionDTO] = []
        total_respuestas: int | None = None
        promedio: float | None = None
        promedio_pct: float | None = None
        favorables_pct: float | None = None

        if q_type in ("likert_1_5", "scale_0_10"):
            # Distribución value_int por ciclo/pregunta
            dist_rows = (
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

            # Construir base por escala
            if q_type == "likert_1_5":
                base = {v: 0 for v in range(1, 6)}  # 1..5
                denom = 5.0
            else:
                base = {v: 0 for v in range(0, 11)}  # 0..10
                denom = 10.0

            for r in dist_rows:
                v = int(r.val or 0)
                n = int(r.n or 0)
                if v in base and n > 0:
                    base[v] += n

            total = sum(base.values())
            suma = sum(v * n for v, n in base.items())
            total_respuestas = total if total > 0 else None
            promedio = (suma / total) if total > 0 else None
            promedio_pct = round(((promedio or 0) / denom) * 100.0, 1) if promedio is not None else None

            if q_type == "likert_1_5":
                favorables = sum(n for v, n in base.items() if v >= 4)  # 4 y 5
                favorables_pct = round((favorables / total) * 100.0, 1) if total > 0 else None

            opciones = [SurveyOptionDTO(opcion=str(v), conteo=n) for v, n in base.items()]

        elif q_type == "yes_no":
            rows_bool = (
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
            counts = {True: 0, False: 0}
            for r in rows_bool:
                counts[bool(r.val)] += int(r.n or 0)

            total = counts[True] + counts[False]
            total_respuestas = total if total > 0 else None
            # Promedio en 0..1, % “Sí”
            promedio = (counts[True] / total) if total > 0 else None
            promedio_pct = round((promedio or 0) * 100.0, 1) if promedio is not None else None
            favorables_pct = promedio_pct
            opciones = [
                SurveyOptionDTO(opcion="Sí", conteo=counts[True]),
                SurveyOptionDTO(opcion="No", conteo=counts[False]),
            ]

        else:
            # open_text u otros → solo contar textos no vacíos
            total = (
                db.query(func.count(SurveyAnswer.id))
                .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
                .filter(
                    SurveyResponse.ciclo_id == cicloId,
                    SurveyAnswer.question_id == q.id,
                    SurveyAnswer.value_text.isnot(None),
                    func.trim(SurveyAnswer.value_text) != "",
                )
                .scalar()
            ) or 0
            total_respuestas = total or None
            promedio = None
            promedio_pct = None
            favorables_pct = None
            opciones = []

        cat_dto = SurveyCategoryDTO(id=cat.id, name=cat.name, order=cat.order) if cat else None

        out_pregs.append(SurveyQuestionDTO(
            id=q.id,
            texto=q.text,
            opciones=opciones,
            total_respuestas=total_respuestas,
            promedio=promedio,
            promedio_pct=promedio_pct,
            favorables_pct=favorables_pct,
            categoria=cat_dto,
        ))

    return ReporteEncuestaDocente(
        ciclo={"id": ciclo.id, "codigo": ciclo.codigo},
        preguntas=out_pregs,
        total_participantes=total_participantes,
        docente=docente,
    )


# ===========================================================
# C) Comentarios de encuesta del ciclo (para el docente)
# ===========================================================
@router.get("/reportes/encuesta/comentarios", response_model=ComentariosResponse)
def encuesta_comentarios_docente(
    cicloId: int = Query(...),
    includeGeneral: bool = Query(False, description="Reservado por si agregas comentarios generales"),
    onlyCommentLike: bool = Query(True, description="Filtra por preguntas tipo 'coment/observac/sugerenc'"),
    q: Optional[str] = Query(None, description="Texto a buscar"),
    limit: int = Query(300, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(require_teacher_or_admin),
):
    # Seguridad: solo ciclos del docente
    ciclo = db.query(Ciclo).filter(Ciclo.id == cicloId).first()
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    if ciclo.docente_id != current.id:
        raise HTTPException(status_code=403, detail="No puedes ver comentarios de un ciclo no asignado")

    qbase = (
        db.query(
            SurveyAnswer.id.label("id"),
            SurveyQuestion.id.label("pregunta_id"),
            SurveyQuestion.text.label("pregunta_texto"),
            SurveyAnswer.value_text.label("texto"),
            SurveyResponse.created_at.label("created_at"),
            User.first_name.label("first_name"),
            User.last_name.label("last_name"),
            User.email.label("email"),
        )
        .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
        .join(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .join(User, User.id == SurveyResponse.alumno_id)
        .filter(
            SurveyResponse.ciclo_id == cicloId,
            SurveyQuestion.type.in_(["open_text"]),
            SurveyAnswer.value_text.isnot(None),
            func.trim(SurveyAnswer.value_text) != "",
        )
    )

    if onlyCommentLike:
        # Evita regexp para mantener portabilidad: usa varios LIKE
        qbase = qbase.filter(
            or_(
                func.lower(SurveyQuestion.text).like("%coment%"),
                func.lower(SurveyQuestion.text).like("%sugerenc%"),
                func.lower(SurveyQuestion.text).like("%observac%"),
            )
        )

    if q:
        like = f"%{q.strip().lower()}%"
        qbase = qbase.filter(
            or_(
                func.lower(SurveyAnswer.value_text).like(like),
                func.lower(SurveyQuestion.text).like(like),
                func.lower(User.first_name).like(like),
                func.lower(User.last_name).like(like),
                func.lower(User.email).like(like),
            )
        )

    total = qbase.count()
    rows = (
        qbase.order_by(SurveyResponse.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items: List[ComentarioOut] = []
    for r in rows:
        nombre = f"{(r.first_name or '').strip()} {(r.last_name or '').strip()}".strip()
        items.append(ComentarioOut(
            id=r.id,
            pregunta_id=r.pregunta_id,
            pregunta_texto=r.pregunta_texto,
            texto=(r.texto or "").strip(),
            created_at=r.created_at.isoformat() if r.created_at else None,
            alumno=ComentarioAlumno(nombre=nombre or None, email=r.email or None),
        ))

    return ComentariosResponse(
        ciclo={"id": ciclo.id, "codigo": ciclo.codigo},
        total=total,
        items=items,
    )


# ===========================================================
# D) Serie por ciclo (promedio % global) del docente
# ===========================================================
@router.get("/reportes/encuesta/serie", response_model=SerieDocenteResponse)
def serie_docente(
    db: Session = Depends(get_db),
    current: User = Depends(require_teacher_or_admin),
):
    # Ciclos del docente
    ciclos = (
        db.query(Ciclo)
        .filter(Ciclo.docente_id == current.id)
        .order_by(Ciclo.codigo.asc())
        .all()
    )

    puntos: List[SeriePunto] = []
    for c in ciclos:
        # Promedio global (mezcla 1..5 y 0..10). Para precisión por escala,
        # habría que computar ponderado por tipo/pregunta.
        agg = (
            db.query(
                func.sum(SurveyAnswer.value_int).label("suma"),
                func.count(SurveyAnswer.value_int).label("n"),
            )
            .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
            .filter(
                SurveyResponse.ciclo_id == c.id,
                SurveyAnswer.value_int.isnot(None),
            )
            .first()
        )
        n = int(getattr(agg, "n", 0) or 0)
        if n <= 0:
            continue
        prom = float(getattr(agg, "suma", 0) or 0) / n  # promedio crudo
        pct = round((prom / 5.0) * 100.0, 1)  # heurística rápida (domina 1..5)
        puntos.append(SeriePunto(ciclo_id=c.id, ciclo_codigo=c.codigo, promedio_pct=pct, fecha=None))

    # Docente payload
    first = func.coalesce(func.trim(User.first_name), "")
    last = func.coalesce(func.trim(User.last_name), "")
    nombre = (
        db.query(func.trim(func.concat(first, literal(" "), last))))
    nombre = nombre.filter(User.id == current.id).scalar() or ""

    return SerieDocenteResponse(
        docente=DocenteMini(id=current.id, nombre=nombre),
        puntos=sorted(puntos, key=lambda p: str(p.ciclo_codigo)),
    )


# ===========================================================
# E) Serie POR PREGUNTA (línea P1..Pn, series= ciclos del docente)
#     Normaliza: likert_1_5 → /5 ; scale_0_10 → /10 ; yes_no → %Sí
# ===========================================================
class SerieLineaPregunta(BaseModel):
    id: int | str            # question_id
    label: str               # enunciado
    data: List[Dict[str, Any]]  # { x: ciclo_codigo, y: porcentaje }

class SeriePorPreguntaResponse(BaseModel):
    docente: DocenteMini
    series: List[SerieLineaPregunta]


@router.get("/reportes/encuesta/serie-por-pregunta", response_model=SeriePorPreguntaResponse)
def serie_por_pregunta_docente(
    db: Session = Depends(get_db),
    current: User = Depends(require_teacher_or_admin),
):
    # 1) ciclos del docente (ordenados)
    ciclos = (
        db.query(Ciclo.id, Ciclo.codigo)
        .filter(Ciclo.docente_id == current.id)
        .order_by(Ciclo.codigo.asc())
        .all()
    )
    if not ciclos:
        return SeriePorPreguntaResponse(
            docente=DocenteMini(id=current.id, nombre=""),
            series=[]
        )

    ciclo_ids = [c.id for c in ciclos]
    ciclo_code = {c.id: c.codigo for c in ciclos}

    # 2) preguntas activas (solo las numéricas + yes/no)
    qs = (
        db.query(SurveyQuestion.id, SurveyQuestion.text, SurveyQuestion.type)
        .filter(SurveyQuestion.active.is_(True))
        .all()
    )
    # Solo tipos soportados en %:
    SUP = {"likert_1_5", "scale_0_10", "yes_no"}
    qinfo = {q.id: {"text": q.text, "type": (q.type or "").strip()} for q in qs if (q.type or "").strip() in SUP}
    if not qinfo:
        return SeriePorPreguntaResponse(
            docente=DocenteMini(id=current.id, nombre=""),
            series=[]
        )

    # 3) agregados numéricos (value_int): promedio crudo por ciclo/pregunta
    num_rows = (
        db.query(
            SurveyResponse.ciclo_id.label("ciclo_id"),
            SurveyAnswer.question_id.label("question_id"),
            func.avg(SurveyAnswer.value_int).label("prom"),
            func.count(SurveyAnswer.value_int).label("n"),
        )
        .join(SurveyAnswer, SurveyAnswer.response_id == SurveyResponse.id)
        .join(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .filter(
            SurveyResponse.ciclo_id.in_(ciclo_ids),
            SurveyAnswer.value_int.isnot(None),
            SurveyQuestion.active.is_(True),
            SurveyQuestion.type.in_(["likert_1_5", "scale_0_10"]),
        )
        .group_by(SurveyResponse.ciclo_id, SurveyAnswer.question_id)
        .all()
    )

    # 4) agregados yes/no (value_bool): % de True
    bool_rows = (
        db.query(
            SurveyResponse.ciclo_id.label("ciclo_id"),
            SurveyAnswer.question_id.label("question_id"),
            SurveyAnswer.value_bool.label("val"),
            func.count(SurveyAnswer.id).label("n"),
        )
        .join(SurveyQuestion, SurveyQuestion.id == SurveyAnswer.question_id)
        .join(SurveyResponse, SurveyResponse.id == SurveyAnswer.response_id)
        .filter(
            SurveyResponse.ciclo_id.in_(ciclo_ids),
            SurveyAnswer.value_bool.isnot(None),
            SurveyQuestion.active.is_(True),
            SurveyQuestion.type == "yes_no",
        )
        .group_by(SurveyResponse.ciclo_id, SurveyAnswer.question_id, SurveyAnswer.value_bool)
        .all()
    )

    # 5) mapa (qid, ciclo_id) -> pct
    pct_map: dict[tuple[int, int], float] = {}

    # num: normaliza por tipo
    for r in num_rows:
        qid = int(r.question_id)
        if qid not in qinfo:
            continue
        qtype = qinfo[qid]["type"]
        denom = 5.0 if qtype == "likert_1_5" else 10.0
        prom = float(r.prom or 0.0)
        pct = round((prom / denom) * 100.0, 1)
        pct_map[(qid, int(r.ciclo_id))] = pct

    # bool: % true
    from collections import defaultdict
    tmp_counts: dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: {"t": 0, "f": 0})
    for r in bool_rows:
        key = (int(r.question_id), int(r.ciclo_id))
        if bool(r.val):
            tmp_counts[key]["t"] += int(r.n or 0)
        else:
            tmp_counts[key]["f"] += int(r.n or 0)
    for key, cnt in tmp_counts.items():
        t = cnt["t"]
        f = cnt["f"]
        tot = t + f
        if tot > 0:
            pct_map[key] = round((t / tot) * 100.0, 1)

    # 6) construir series por pregunta (id, label, data[{x=codigo,y=%}])
    series: List[SerieLineaPregunta] = []
    for qid, meta in qinfo.items():
        puntos = []
        for cid in ciclo_ids:
            pct = pct_map.get((int(qid), int(cid)))
            if pct is None:
                continue  # si no hubo respuestas, omite el punto
            puntos.append({"x": ciclo_code[cid], "y": pct})
        if puntos:
            series.append(SerieLineaPregunta(
                id=qid,
                label=meta["text"],
                data=sorted(puntos, key=lambda p: str(p["x"]))
            ))

    # Docente (nombre)
    first = func.coalesce(func.trim(User.first_name), "")
    last = func.coalesce(func.trim(User.last_name), "")
    nombre = (
        db.query(func.trim(func.concat(first, literal(" "), last)))
        .filter(User.id == current.id)
        .scalar()
        or ""
    )

    return SeriePorPreguntaResponse(
        docente=DocenteMini(id=current.id, nombre=nombre),
        series=series
    )
