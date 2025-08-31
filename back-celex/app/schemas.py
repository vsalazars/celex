from enum import Enum
from typing import Optional, List
from datetime import date, time
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ---- Roles permitidos ----
class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    coordinator = "coordinator"
    superuser = "superuser"


# ---- Helpers regex ----
CURP_REGEX = r"^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$"
BOLETA_REGEX = r"^\d{10}$"  # exactamente 10 dígitos (ej. 2025070109)


# -------- IN --------
class UserCreate(BaseModel):
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)
    email: EmailStr
    is_ipn: bool
    boleta: Optional[str] = None  # requerida si is_ipn=True
    curp: str = Field(..., pattern=CURP_REGEX)
    password: str = Field(..., min_length=6)
    password_confirm: str
    # El registro público crea alumnos; el backend puede sobreescribir para staff
    role: UserRole = UserRole.student

    # Normaliza CURP a mayúsculas
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

    # Valida que la boleta sea 10 dígitos si is_ipn=True
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

    # Reglas cruzadas: confirmar password y boleta requerida cuando is_ipn=True
    @model_validator(mode="after")
    def check_cross_fields(self):
        if self.password != self.password_confirm:
            raise ValueError("Las contraseñas no coinciden")
        if self.is_ipn and not self.boleta:
            raise ValueError("La boleta es obligatoria para usuarios IPN")
        if (not self.is_ipn) and self.boleta:
            # opcional: evitar que externos envíen boleta
            raise ValueError("No proporciones boleta si no eres IPN")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# -------- OUT --------
class UserOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    is_ipn: bool
    boleta: Optional[str]
    curp: str
    role: UserRole
    # Campos útiles en listados
    # Nota: asumo que tu modelo User tiene estos campos:
    # - is_active: bool
    # - created_at: datetime
    is_active: bool | None = None

    class Config:
        from_attributes = True  # pydantic v2: permite ORM -> schema


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    email: EmailStr
    first_name: str
    last_name: str
    curp: str
    is_ipn: bool                 # 👈 NUEVO
    boleta: Optional[str] = None # 👈 NUEVO


# ---------- Listados de coordinadores ----------
class CoordinatorListResponse(BaseModel):
    items: List[UserOut]
    total: int
    page: int
    page_size: int
    pages: int


# ---------- Toggle estado ----------
class ToggleActiveRequest(BaseModel):
    is_active: bool

# ---------------- Enums (coinciden con models) ----------------
class Modalidad(str, Enum):
    intensivo = "intensivo"
    sabatino  = "sabatino"
    semestral = "semestral"

class Turno(str, Enum):
    matutino   = "matutino"
    vespertino = "vespertino"
    mixto      = "mixto"

class Idioma(str, Enum):
    ingles    = "ingles"
    frances   = "frances"
    aleman    = "aleman"
    italiano  = "italiano"
    portugues = "portugues"

class Nivel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"

class DiaSemana(str, Enum):
    lunes     = "lunes"
    martes    = "martes"
    miercoles = "miercoles"
    jueves    = "jueves"
    viernes   = "viernes"
    sabado    = "sabado"
    domingo   = "domingo"

class ModalidadAsistencia(str, Enum):
    presencial = "presencial"
    virtual    = "virtual"

# ---------------- Periodo ----------------
class Periodo(BaseModel):
    from_: date = Field(..., alias="from")
    to: date

    @model_validator(mode="after")
    def check_order(self):
        if self.from_ > self.to:
            raise ValueError("La fecha inicial debe ser anterior o igual a la final")
        return self

# ---------------- Schemas de Ciclo ----------------
class CicloBase(BaseModel):
    codigo: str = Field(..., min_length=3)
    idioma: Idioma
    modalidad: Modalidad
    turno: Turno
    nivel: Nivel

    cupo_total: int = Field(..., ge=0)

    # Horario
    dias: List[DiaSemana] = Field(..., min_length=1)
    hora_inicio: time
    hora_fin: time

    # Modalidad de asistencia (default = presencial) y aula (opcional)
    modalidad_asistencia: ModalidadAsistencia = ModalidadAsistencia.presencial
    aula: Optional[str] = None

    # Periodos (sin reinscripción)
    inscripcion: Periodo
    curso: Periodo

    # Exámenes (opcionales)
    examenMT: Optional[date] = None
    examenFinal: Optional[date] = None

    # Asignación de docente (opcional)
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

# Salida: incluimos docente resumido
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

    class Config:
        from_attributes = True


class CicloListResponse(BaseModel):
    items: List[CicloOut]
    total: int
    page: int
    page_size: int
    pages: int