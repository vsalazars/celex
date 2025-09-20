from enum import Enum
from typing import Optional, List, Literal
from datetime import date, time, datetime

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
    model_validator,
    computed_field,
    field_serializer,
    constr,
)

MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024  # 5 MB

Parentesco = Literal["Padre", "Madre", "Tutor legal", "Hermano/a", "Abuelo/a", "Otro"]


# ==========================
# Roles y autenticación
# ==========================
class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    coordinator = "coordinator"
    superuser = "superuser"


CURP_REGEX = r"^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$"
BOLETA_REGEX = r"^\d{10}$"  # exactamente 10 dígitos


class UserCreate(BaseModel):
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)
    email: EmailStr
    is_ipn: bool
    boleta: Optional[str] = None  # requerida si is_ipn=True
    curp: str = Field(..., pattern=CURP_REGEX)
    password: str = Field(..., min_length=6)
    password_confirm: str
    role: UserRole = UserRole.student

    @field_validator("curp")
    @classmethod
    def curp_upper_and_valid(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("CURP requerida")
        import re
        if not re.fullmatch(CURP_REGEX, v):
            raise ValueError("CURP inválida")
        return v

    @field_validator("boleta")
    @classmethod
    def boleta_digits_if_present(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        import re
        if not re.fullmatch(BOLETA_REGEX, v):
            raise ValueError("Boleta inválida: deben ser 10 dígitos")
        return v

    @model_validator(mode="after")
    def check_cross_fields(self):
        if self.password != self.password_confirm:
            raise ValueError("Las contraseñas no coinciden")
        if self.is_ipn and not self.boleta:
            raise ValueError("La boleta es obligatoria para usuarios IPN")
        if (not self.is_ipn) and self.boleta:
            raise ValueError("No proporciones boleta si no eres IPN")
        return self

class Direccion(BaseModel):
    calle: Optional[str] = None
    numero: Optional[str] = None
    colonia: Optional[str] = None
    municipio: Optional[str] = None
    estado: Optional[str] = None
    cp: Optional[str] = None

class IPNInfo(BaseModel):
    nivel: Literal["Medio superior", "Superior", "Posgrado"]
    unidad: str

class TutorInfo(BaseModel):
    nombre: Optional[str] = None
    parentesco: Optional[Parentesco] = None
    telefono: Optional[str] = None


class AlumnoPerfilOut(BaseModel):
    nombre: str
    apellidos: str
    email: EmailStr
    curp: str = Field(pattern=CURP_REGEX)
    telefono: Optional[str] = None
    direccion: Optional[Direccion] = None
    is_ipn: bool
    boleta: Optional[str] = None
    ipn: Optional[IPNInfo] = None
    tutor: Optional[TutorInfo] = None

class AlumnoPerfilUpdate(BaseModel):
    # Editables en el perfil
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    email: Optional[EmailStr] = None
    curp: Optional[str] = Field(default=None, pattern=CURP_REGEX)
    telefono: Optional[str] = None

    direccion: Optional[Direccion] = None

    # El back ignora is_ipn (fuente de verdad es la BD)
    is_ipn: Optional[bool] = None
    boleta: Optional[str] = None

    ipn: Optional[IPNInfo] = None

    tutor: Optional[TutorInfo] = None

    @field_validator("boleta")
    @classmethod
    def boleta_si_viene_10dig(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return v
        import re
        if not re.fullmatch(BOLETA_REGEX, v):
            raise ValueError("Boleta inválida: 10 dígitos")
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    is_ipn: bool
    boleta: Optional[str]
    curp: str
    role: UserRole
    is_active: bool | None = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    email: EmailStr
    first_name: str
    last_name: str
    curp: str
    is_ipn: bool
    boleta: Optional[str] = None


class CoordinatorListResponse(BaseModel):
    items: List[UserOut]
    total: int
    page: int
    page_size: int
    pages: int


class ToggleActiveRequest(BaseModel):
    is_active: bool


# ==========================
# Catálogos / Enums académicos
# ==========================
class Modalidad(str, Enum):
    intensivo = "intensivo"
    sabatino = "sabatino"
    semestral = "semestral"


class Turno(str, Enum):
    matutino = "matutino"
    vespertino = "vespertino"
    mixto = "mixto"


class Idioma(str, Enum):
    ingles = "ingles"
    frances = "frances"
    aleman = "aleman"
    italiano = "italiano"
    portugues = "portugues"


class Nivel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class DiaSemana(str, Enum):
    lunes = "lunes"
    martes = "martes"
    miercoles = "miercoles"
    jueves = "jueves"
    viernes = "viernes"
    sabado = "sabado"
    domingo = "domingo"


class ModalidadAsistencia(str, Enum):
    presencial = "presencial"
    virtual = "virtual"


# ==========================
# Ciclos
# ==========================
class Periodo(BaseModel):
    from_: date = Field(..., alias="from")
    to: date

    @model_validator(mode="after")
    def check_order(self):
        if self.from_ > self.to:
            raise ValueError("La fecha inicial debe ser anterior o igual a la final")
        return self


class CicloBase(BaseModel):
    codigo: str = Field(..., min_length=3)
    idioma: Idioma
    modalidad: Modalidad
    turno: Turno
    nivel: Nivel

    cupo_total: int = Field(..., ge=0)

    dias: List[DiaSemana] = Field(..., min_length=1)
    hora_inicio: time
    hora_fin: time

    modalidad_asistencia: ModalidadAsistencia = ModalidadAsistencia.presencial
    aula: Optional[str] = None

    inscripcion: Periodo
    curso: Periodo

    examenMT: Optional[date] = None
    examenFinal: Optional[date] = None

    docente_id: Optional[int] = None

    notas: Optional[str] = None

    @model_validator(mode="after")
    def check_horario(self):
        if self.hora_inicio >= self.hora_fin:
            raise ValueError("hora_inicio debe ser estrictamente menor que hora_fin")
        return self


class CicloCreate(CicloBase):
    pass


class CicloUpdate(BaseModel):
    codigo: Optional[str] = Field(None, min_length=3)
    idioma: Optional[Idioma] = None
    modalidad: Optional[Modalidad] = None
    turno: Optional[Turno] = None
    nivel: Optional[Nivel] = None

    cupo_total: Optional[int] = Field(None, ge=0)

    dias: Optional[List[DiaSemana]] = Field(None, min_length=1)
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None

    modalidad_asistencia: Optional[ModalidadAsistencia] = None
    aula: Optional[str] = None

    inscripcion: Optional[Periodo] = None
    curso: Optional[Periodo] = None

    examenMT: Optional[date] = None
    examenFinal: Optional[date] = None

    docente_id: Optional[int] = None

    notas: Optional[str] = None

    @model_validator(mode="after")
    def check_horario_update(self):
        if self.hora_inicio and self.hora_fin and self.hora_inicio >= self.hora_fin:
            raise ValueError("hora_inicio debe ser estrictamente menor que hora_fin")
        return self


class DocenteLite(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True


class DocenteMini(BaseModel):
    id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None


class CicloOut(CicloBase):
    id: int
    docente: Optional[DocenteMini] = None
    lugares_disponibles: int = Field(0, ge=0)  # calculado en el router

    class Config:
        from_attributes = True


class CicloListResponse(BaseModel):
    items: List[CicloOut]
    total: int
    page: int
    page_size: int
    pages: int


# ==========================
# Inscripciones
# ==========================
class AlumnoMini(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    is_ipn: Optional[bool] = None
    boleta: Optional[str] = None
    curp: Optional[str] = None  # 👈 AÑADIDO

    class Config:
        from_attributes = True


class ComprobanteMeta(BaseModel):
    filename: Optional[str] = None
    mimetype: Optional[str] = None
    size_bytes: Optional[int] = Field(default=None, ge=0)
    storage_path: Optional[str] = None

    class Config:
        from_attributes = True


# --- CicloLite a nivel tope (para incrustar en InscripcionOut) ---
class CicloLite(BaseModel):
    id: int
    codigo: str
    idioma: str
    modalidad: str
    turno: str
    nivel: Optional[str] = None
    dias: List[str] = []
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    aula: Optional[str] = None
    inscripcion: Optional[dict] = None
    curso: Optional[dict] = None
    docente_nombre: Optional[str] = None

    @field_serializer("hora_inicio", "hora_fin")
    def _ser_time(self, v: Optional[time]):
        return v.strftime("%H:%M") if v is not None else None

    class Config:
        from_attributes = True


# --- Tipo de inscripción (alineado a modelo) ---
class InscripcionTipo(str, Enum):
    pago = "pago"
    exencion = "exencion"


# Request del coordinador para aprobar/rechazar
class ValidateInscripcionCoordIn(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    motivo: Optional[constr(strip_whitespace=True, min_length=6, max_length=300)] = None


class InscripcionOut(BaseModel):
    id: int
    ciclo_id: int
    status: Literal["registrada", "preinscrita", "confirmada", "rechazada", "cancelada"]

    # tipo (pago | exencion)
    tipo: InscripcionTipo

    # Pago
    fecha_pago: date | None = None
    referencia: Optional[str] = None
    importe_centavos: Optional[int] = Field(default=None, ge=0)
    comprobante: Optional[ComprobanteMeta] = None

    # Estudios (si aplica)
    comprobante_estudios: Optional[ComprobanteMeta] = None

    # Exención (si aplica)
    comprobante_exencion: Optional[ComprobanteMeta] = None

    # Motivos / notas de validación
    rechazo_motivo: Optional[str] = None
    validation_notes: Optional[str] = None

    alumno: Optional[AlumnoMini] = None
    created_at: datetime
    ciclo: Optional[CicloLite] = None

    # Validación
    validated_by_id: Optional[int] = None
    validated_at: Optional[datetime] = None

    @computed_field
    @property
    def importe_mxn(self) -> Optional[float]:
        return None if self.importe_centavos is None else round(self.importe_centavos / 100.0, 2)

    class Config:
        from_attributes = True


# Payload para validar inscripción
class ValidateInscripcionIn(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    notes: Optional[str] = Field(None, max_length=500)


# ==========================
# Evaluaciones (Docente)
# ==========================
class EvaluacionUpsertIn(BaseModel):
    medio_examen:   Optional[int] = Field(None, ge=0, le=80)
    medio_continua: Optional[int] = Field(None, ge=0, le=20)
    final_examen:   Optional[int] = Field(None, ge=0, le=60)
    final_continua: Optional[int] = Field(None, ge=0, le=20)
    final_tarea:    Optional[int] = Field(None, ge=0, le=20)


class EvaluacionOut(BaseModel):
    inscripcion_id: int
    ciclo_id: int
    medio_examen:   Optional[int] = None
    medio_continua: Optional[int] = None
    final_examen:   Optional[int] = None
    final_continua: Optional[int] = None
    final_tarea:    Optional[int] = None
    subtotal_medio: int
    subtotal_final: int
    promedio_final: float


class EvaluacionListOut(BaseModel):
    items: list[EvaluacionOut]


class AlumnoHistorialItem(BaseModel):
    inscripcion_id: int
    ciclo_id: int
    ciclo_codigo: str
    idioma: str
    nivel: str
    modalidad: str
    turno: str
    docente_nombre: Optional[str] = None

    # Fechas útiles para mostrar
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None

    # Asistencia (conteos y %)
    sesiones_total: int
    presentes: int
    ausentes: int
    retardos: int
    justificados: int
    asistencia_pct: float  # p.ej. 87.5

    # Medio (0–100)
    medio_examen: Optional[float] = None  # 0–80
    medio_cont: Optional[float] = None    # 0–20
    medio_subtotal: Optional[float] = None  # suma

    # Final (0–100)
    final_examen: Optional[float] = None  # 0–60
    final_cont: Optional[float] = None    # 0–20
    final_tarea: Optional[float] = None   # 0–20
    final_subtotal: Optional[float] = None  # suma

    # Promedio final del curso (simple 50/50)
    promedio: Optional[float] = None


class AlumnoHistorialResponse(BaseModel):
    items: List[AlumnoHistorialItem]

# ==========================
# Placement (inputs/outputs base)
# ==========================
class PlacementBaseIn(BaseModel):
    codigo: str = Field(..., min_length=2, max_length=50)
    idioma: str = Field(..., min_length=3, max_length=30)

    # strings normalizados desde el front
    fecha: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    hora:  str = Field(..., pattern=r"^\d{2}:\d{2}(:\d{2})?$")

    salon: str | None = Field(None, max_length=120)
    duracion_min: int = Field(60, gt=0)
    cupo_total:   int = Field(0, ge=0)
    costo: int | None = None

    docente_id: int | None = None
    instrucciones: str | None = None

    # 👇 NUEVO: periodo (el front manda insc_inicio / insc_fin)
    insc_inicio: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    insc_fin:    str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    # 👇 Compat opcional: por si llegan como insc_from/insc_to o inscripcion.{from,to}
    insc_from: str | None = None
    insc_to:   str | None = None
    inscripcion: dict | None = None

    # opcionales/legacy
    nombre: str | None = None
    modalidad: str | None = None
    nivel_objetivo: str | None = None
    estado: str | None = None
    link_registro: str | None = None
    activo: bool | None = True

    @model_validator(mode="before")
    @classmethod
    def _coalesce_inscripcion(cls, data):
        """
        Acepta cualquiera de:
          - insc_inicio / insc_fin
          - insc_from / insc_to
          - inscripcion = { from, to }
        y consolida en insc_inicio / insc_fin.
        """
        if not isinstance(data, dict):
            return data

        if not data.get("insc_inicio"):
            if data.get("insc_from"):
                data["insc_inicio"] = data.get("insc_from")
            elif isinstance(data.get("inscripcion"), dict) and data["inscripcion"].get("from"):
                data["insc_inicio"] = data["inscripcion"]["from"]

        if not data.get("insc_fin"):
            if data.get("insc_to"):
                data["insc_fin"] = data.get("insc_to")
            elif isinstance(data.get("inscripcion"), dict) and data["inscripcion"].get("to"):
                data["insc_fin"] = data["inscripcion"]["to"]

        return data


class PlacementCreate(PlacementBaseIn):
    pass


class PlacementUpdate(BaseModel):
    # todos opcionales (parciales)
    codigo: Optional[str] = Field(None, min_length=2, max_length=50)
    idioma: Optional[str] = Field(None, min_length=3, max_length=30)
    fecha: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    hora:  Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    salon: Optional[str] = Field(None, max_length=120)

    duracion_min: Optional[int] = Field(None, gt=0)
    cupo_total:   Optional[int] = Field(None, ge=0)
    costo: Optional[int] = None

    docente_id: Optional[int] = None
    instrucciones: Optional[str] = None

    # 👇 NUEVO: periodo (opcionales)
    insc_inicio: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    insc_fin:    Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    # opcionales/legacy
    nombre: Optional[str] = None
    modalidad: Optional[str] = None
    nivel_objetivo: Optional[str] = None
    estado: Optional[str] = None
    link_registro: Optional[str] = None
    activo: Optional[bool] = None

    # compat inputs alternos
    insc_from: Optional[str] = None
    insc_to:   Optional[str] = None
    inscripcion: Optional[dict] = None

    @model_validator(mode="before")
    @classmethod
    def _coalesce_inscripcion(cls, data):
        if not isinstance(data, dict):
            return data
        if not data.get("insc_inicio"):
            if data.get("insc_from"):
                data["insc_inicio"] = data.get("insc_from")
            elif isinstance(data.get("inscripcion"), dict) and data["inscripcion"].get("from"):
                data["insc_inicio"] = data["inscripcion"]["from"]
        if not data.get("insc_fin"):
            if data.get("insc_to"):
                data["insc_fin"] = data.get("insc_to")
            elif isinstance(data.get("inscripcion"), dict) and data["inscripcion"].get("to"):
                data["insc_fin"] = data["inscripcion"]["to"]
        return data


class PlacementOut(BaseModel):
    id: int

    codigo: str
    nombre: Optional[str] = None
    idioma: str

    # nativos desde la BD; serializamos a str
    fecha: Optional[date] = None
    hora:  Optional[time] = None

    salon: Optional[str] = None

    duracion_min: int
    cupo_total:   int
    costo: Optional[int] = None

    docente_id: Optional[int] = None
    instrucciones: Optional[str] = None

    modalidad: Optional[str] = None
    nivel_objetivo: Optional[str] = None
    estado: Optional[str] = None
    link_registro: Optional[str] = None
    activo: Optional[bool] = True

    # 👇 NUEVO: periodo y campos derivados/compat mostrados en el front
    insc_inicio: Optional[date] = None
    insc_fin:    Optional[date] = None
    cupo_disponible: Optional[int] = None  # lo calcula el router
    inscripcion: Optional[dict] = None     # { from, to } para compatibilidad

    @field_serializer("fecha")
    def _ser_fecha(self, v: Optional[date], _info):
        return v.strftime("%Y-%m-%d") if v else None

    @field_serializer("hora")
    def _ser_hora(self, v: Optional[time], _info):
        return v.strftime("%H:%M") if v else None

    @field_serializer("insc_inicio", "insc_fin")
    def _ser_insc(self, v: Optional[date], _info):
        return v.strftime("%Y-%m-%d") if v else None

    class Config:
        from_attributes = True


class PlacementList(BaseModel):
    items: list[PlacementOut]
    page: int
    pages: int
    total: int


class PlacementRegistroCreate(BaseModel):
    referencia: constr(strip_whitespace=True, min_length=1, max_length=50)
    importe_centavos: int = Field(ge=0)
    fecha_pago: constr(pattern=r"^\d{4}-\d{2}-\d{2}$")


# app/schemas.py (añadir cerca de PlacementOut / PlacementRegistroOut)

class PlacementExamMini(BaseModel):
    id: int
    codigo: str
    nombre: Optional[str] = None
    idioma: Optional[str] = None
    fecha: Optional[date] = None
    hora:  Optional[time] = None
    salon: Optional[str] = None
    cupo_total: Optional[int] = None
    costo: Optional[int] = None
    activo: Optional[bool] = None

    @field_serializer("fecha")
    def _ser_fecha(self, v: Optional[date], _info):
        return v.strftime("%Y-%m-%d") if v else None

    @field_serializer("hora")
    def _ser_hora(self, v: Optional[time], _info):
        return v.strftime("%H:%M") if v else None

    class Config:
        from_attributes = True


class PlacementRegistroOut(BaseModel):
    id: int
    exam_id: int
    status: str
    referencia: Optional[str]
    importe_centavos: Optional[int]
    fecha_pago: Optional[date]
    comprobante: Optional[ComprobanteMeta]
    created_at: datetime
    rechazo_motivo: Optional[str] = None
    validation_notes: Optional[str] = None  # <- ya lo usas en el front

    # 👇 NUEVOS para alinear con el front
    nivel_idioma: Optional[str] = None
    exam: Optional[PlacementExamMini] = None

    @field_serializer("fecha_pago")
    def _ser_fecha_pago(self, v: Optional[date], _info):
        return v.strftime("%Y-%m-%d") if v else None

    class Config:
        from_attributes = True


# ==========================
# Placement — Docente (NUEVO)
# ==========================
class PlacementExamAsignadoOut(BaseModel):
    """
    Resumen para listar exámenes de colocación asignados al docente.
    """
    id: int | str
    titulo: Optional[str] = None     # alias legible (puede mapear a nombre/codigo)
    fecha: Optional[str] = None      # ISO yyyy-mm-dd (serializa en el router)
    modalidad: Optional[str] = None
    idioma: Optional[str] = None
    nivel: Optional[str] = None
    sede: Optional[str] = None
    turno: Optional[str] = None
    inscritos: Optional[int] = None

    class Config:
        from_attributes = True


class PlacementRegistroAlumnoOut(BaseModel):
    """
    Registro por alumno dentro de un examen de colocación.
    """
    id: int | str
    alumno_nombre: Optional[str] = None
    alumno_email: Optional[EmailStr] = None
    alumno_boleta: Optional[str] = None
    nivel_asignado: Optional[str] = None

    class Config:
        from_attributes = True


class NivelIdiomaUpdate(BaseModel):
    """
    Payload para actualizar el nivel del alumno en un registro de colocación.
    """
    nivel: constr(strip_whitespace=True, min_length=1, max_length=20)



# ==========================
# Encuestas (Categorías y Preguntas)
# ==========================
from typing import Literal, Optional
from pydantic import BaseModel, Field

# Tipos de pregunta soportados en el front/back
SurveyQuestionType = Literal["likert_1_5", "yes_no", "open_text", "scale_0_10"]

# -------- Categorías --------
class SurveyCategoryBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    active: bool = True

class SurveyCategoryCreate(SurveyCategoryBase):
    pass

class SurveyCategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = None
    active: Optional[bool] = None

class SurveyCategoryOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    order: int
    active: bool
    created_at: datetime   # 👈 debe existir

    class Config:
        orm_mode = True

# -------- Preguntas --------
class SurveyQuestionBase(BaseModel):
    category_id: int
    text: str = Field(..., min_length=5)
    help_text: Optional[str] = Field(default=None, max_length=500)
    type: SurveyQuestionType = "likert_1_5"
    required: bool = True
    active: bool = True

class SurveyQuestionCreate(SurveyQuestionBase):
    pass

class SurveyQuestionUpdate(BaseModel):
    category_id: Optional[int] = None
    text: Optional[str] = Field(default=None, min_length=5)
    help_text: Optional[str] = Field(default=None, max_length=500)
    type: Optional[SurveyQuestionType] = None
    required: Optional[bool] = None
    active: Optional[bool] = None

class SurveyQuestionOut(BaseModel):
    id: int
    category_id: int
    text: str
    help_text: str | None = None
    type: str
    required: bool
    active: bool
    order: int
    created_at: datetime   # 👈 debe existir

    class Config:
        orm_mode = True

# -------- Payload para mover (orden) --------
class MovePayload(BaseModel):
    direction: Literal["up", "down"]



# ==========================
# Encuestas — Alumno
# ==========================
from typing import Dict, Union

SurveyAnswerValue = Union[int, bool, str]

class SurveyAnswerIn(BaseModel):
    question_id: int
    value: SurveyAnswerValue

class SurveySubmitIn(BaseModel):
    inscripcion_id: int
    answers: List[SurveyAnswerIn]
    comments: Optional[constr(strip_whitespace=True, min_length=1, max_length=1500)] = None


class SurveyCuestionarioOut(BaseModel):
    submitted: bool
    categories: List[SurveyCategoryOut]
    questions: List[SurveyQuestionOut]

class SurveyEstadoOut(BaseModel):
    # Mapa de inscripcion_id -> bool (true si ya envió)
    map: Dict[int, bool]
    # Por compatibilidad extra con tu front (si lo quieres usar)
    submitted: List[int] = []



class CicloLiteOut(BaseModel):
    id: int
    codigo: str
    idioma: Optional[str] = None
    nivel: Optional[str] = None
    turno: Optional[str] = None
    modalidad: Optional[str] = None

class InscripcionLiteOut(BaseModel):
    id: int
    status: str
    tipo: Literal["pago", "exencion"]
    created_at: datetime
    referencia: Optional[str] = None
    importe_centavos: Optional[int] = None
    fecha_pago: Optional[date] = None
    ciclo: Optional[CicloLiteOut] = None

class AlumnoDetalleOut(BaseModel):
    perfil: AlumnoPerfilOut
    inscripciones: List[InscripcionLiteOut]
    ultima: Optional[InscripcionLiteOut] = None


class HistorialAsistenciaSummary(BaseModel):
    presentes: int = 0
    ausentes: int = 0
    retardos: int = 0
    justificados: int = 0
    total_sesiones: int = 0
    porcentaje_asistencia: float = 0.0  # 0..100


class HistorialCicloItem(BaseModel):
    inscripcion_id: int
    ciclo_id: int
    ciclo_codigo: str
    idioma: Optional[str] = None
    nivel: Optional[str] = None
    modalidad: Optional[str] = None
    turno: Optional[str] = None

    fecha_inicio: Optional[str] = None  # ISO date
    fecha_fin: Optional[str] = None     # ISO date

    horario: Optional[str] = None       # si guardas hora_inicio/hora_fin como texto/HH:MM, lo concatenamos en back

    inscripcion_estado: Optional[str] = None
    inscripcion_tipo: Optional[str] = None
    fecha_inscripcion: Optional[str] = None  # ISO datetime

    calificacion: Optional[float] = None
    docente_nombre: Optional[str] = None  # si tienes relación, dejará None si no hay

    asistencia: HistorialAsistenciaSummary = Field(default_factory=HistorialAsistenciaSummary)


class HistorialAlumnoResponse(BaseModel):
    alumno_id: int
    total: int
    items: List[HistorialCicloItem]


