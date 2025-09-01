import enum
from sqlalchemy import (
    Column, Integer, String, Date, Time, Text, DateTime,
    Boolean, 
    CheckConstraint, UniqueConstraint, func
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import declarative_base
from sqlalchemy.types import Enum as SAEnum

Base = declarative_base()


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    coordinator = "coordinator"
    superuser = "superuser"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Datos personales
    first_name = Column(String(120), nullable=False)
    last_name = Column(String(160), nullable=False)

    # Datos de acceso
    email = Column(String(255), unique=True, index=True, nullable=False)
    email_verified = Column(Boolean, default=False)
    hashed_password = Column(String(255), nullable=False)

    # Datos específicos de alumno
    is_ipn = Column(Boolean, default=False)  # True si es del IPN
    boleta = Column(String(10), nullable=True)  # Solo para IPN
    curp = Column(String(18), unique=True, index=True, nullable=False)

    # Rol de usuario
    role = Column(SAEnum(UserRole), default=UserRole.student, nullable=False)

    # Estado de la cuenta
    is_active = Column(Boolean, default=True)

    # Tiempos de registro
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# imports (asegúrate de tener estos)
from sqlalchemy import (
    Column, Integer, String, Text, Date, Time, DateTime,
    Enum as SAEnum, CheckConstraint, UniqueConstraint, ForeignKey, ARRAY
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

# ---------------- NUEVO: enums de Ciclo ----------------
class Modalidad(str, enum.Enum):
    intensivo = "intensivo"
    sabatino  = "sabatino"
    semestral = "semestral"

class Turno(str, enum.Enum):
    matutino   = "matutino"
    vespertino = "vespertino"
    mixto      = "mixto"

class Idioma(str, enum.Enum):
    ingles    = "ingles"
    frances   = "frances"
    aleman    = "aleman"
    italiano  = "italiano"
    portugues = "portugues"

class Nivel(str, enum.Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"

# 👇 Días de clase (guardados como texto en BD, validados con enum en schemas)
class DiaSemana(str, enum.Enum):
    lunes     = "lunes"
    martes    = "martes"
    miercoles = "miercoles"
    jueves    = "jueves"
    viernes   = "viernes"
    sabado    = "sabado"
    domingo   = "domingo"

# 👇 Nueva modalidad de asistencia
class ModalidadAsistencia(str, enum.Enum):
    presencial = "presencial"
    virtual    = "virtual"

# ---------------- MODELO Ciclo ----------------
class Ciclo(Base):
    __tablename__ = "ciclos"
    __table_args__ = (
        UniqueConstraint("codigo", name="uq_ciclos_codigo"),
        CheckConstraint("cupo_total >= 0", name="ck_ciclos_cupo_total_nonneg"),
        CheckConstraint("hora_inicio < hora_fin", name="ck_ciclos_horario_orden"),
    )

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(120), nullable=False)

    idioma    = Column(SAEnum(Idioma), nullable=False)
    modalidad = Column(SAEnum(Modalidad), nullable=False)
    turno     = Column(SAEnum(Turno), nullable=False)
    nivel     = Column(SAEnum(Nivel), nullable=False)

    cupo_total = Column(Integer, nullable=False, default=0)

    # Horario
    dias        = Column(ARRAY(String), nullable=False)  # ejemplo: ['lunes','miercoles']
    hora_inicio = Column(Time, nullable=False)
    hora_fin    = Column(Time, nullable=False)

    # Fechas de inscripción, curso y colocación (sin reinscripción)
    insc_inicio  = Column(Date, nullable=False)
    insc_fin     = Column(Date, nullable=False)
    curso_inicio = Column(Date, nullable=False)
    curso_fin    = Column(Date, nullable=False)
    
    # Exámenes (opcionales)
    examen_mt    = Column(Date, nullable=True)
    examen_final = Column(Date, nullable=True)

    # Modalidad de asistencia y aula
    modalidad_asistencia = Column(SAEnum(ModalidadAsistencia), nullable=False, default=ModalidadAsistencia.presencial)
    aula                 = Column(String(120), nullable=True)

    # 👇 NUEVO: asignación de docente (opcional) → users.id
    docente_id = Column(Integer, ForeignKey("users.id", onupdate="CASCADE", ondelete="SET NULL"), nullable=True)
    docente    = relationship("User", foreign_keys=[docente_id], lazy="joined")  # ajusta "User" si tu modelo se llama distinto

    notas = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())



class Inscripcion(Base):
    __tablename__ = "inscripciones"

    id = Column(Integer, primary_key=True, index=True)

    # Alumno que se inscribe
    alumno_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Ciclo/Grupo al que se inscribe
    ciclo_id = Column(
        Integer,
        ForeignKey("ciclos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Estado sencillo basado en strings (consistente con el router)
    # Valores típicos: "registrada" | "pendiente" | "confirmada" | "rechazada"
    status = Column(String(20), nullable=False, default="registrada")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones (opcionales pero útiles)
    alumno = relationship("User", backref="inscripciones")
    ciclo = relationship("Ciclo", backref="inscripciones")

    # Evita duplicados del mismo alumno en el mismo ciclo
    __table_args__ = (
        UniqueConstraint("alumno_id", "ciclo_id", name="uq_inscripcion_alumno_ciclo"),
    )