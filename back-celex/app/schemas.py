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
    curp: Optional[str] = None   # 👈 AÑADIR

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


# --- NUEVO: tipo de inscripción (para alinear con el modelo) ---
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

    # NUEVO: tipo de trámite (pago | exencion)
    tipo: InscripcionTipo

    # Pago
    fecha_pago: date | None = None  # <-- NUEVO
    referencia: Optional[str] = None
    importe_centavos: Optional[int] = Field(default=None, ge=0)
    comprobante: Optional["ComprobanteMeta"] = None

    # Estudios (si aplica)
    comprobante_estudios: Optional["ComprobanteMeta"] = None

    # NUEVO: Exención
    comprobante_exencion: Optional["ComprobanteMeta"] = None

    # Motivo / notas de validación (para que el front pueda mostrarlos)
    rechazo_motivo: Optional[str] = None
    validation_notes: Optional[str] = None

    alumno: Optional["AlumnoMini"] = None
    created_at: datetime
    ciclo: Optional["CicloLite"] = None

    # === Nuevos campos de validación ===
    validated_by_id: Optional[int] = None
    validated_at: Optional[datetime] = None

    @computed_field
    @property
    def importe_mxn(self) -> Optional[float]:
        return None if self.importe_centavos is None else round(self.importe_centavos / 100.0, 2)

    class Config:
        from_attributes = True

# --- Payload para validar inscripción ---
class ValidateInscripcionIn(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    notes: Optional[str] = Field(None, max_length=500)



# --- Evaluaciones (Docente) ---
from typing import Optional
from pydantic import BaseModel, Field

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