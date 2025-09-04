import enum
from sqlalchemy import (
    Column, Integer, String, Date, Time, Text, DateTime,
    Boolean, CheckConstraint, UniqueConstraint, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.types import Enum as SAEnum

Base = declarative_base()


# -------------------- Enums base --------------------
class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    coordinator = "coordinator"
    superuser = "superuser"


# -------------------- Modelo User --------------------
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


# -------------------- Enums de Ciclo --------------------
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

# Días de clase (se guardan como texto en ARRAY)
class DiaSemana(str, enum.Enum):
    lunes     = "lunes"
    martes    = "martes"
    miercoles = "miercoles"
    jueves    = "jueves"
    viernes   = "viernes"
    sabado    = "sabado"
    domingo   = "domingo"

# Modalidad de asistencia
class ModalidadAsistencia(str, enum.Enum):
    presencial = "presencial"
    virtual    = "virtual"


# -------------------- Modelo Ciclo --------------------
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
    dias        = Column(ARRAY(String), nullable=False)  # ['lunes','miercoles']
    hora_inicio = Column(Time, nullable=False)
    hora_fin    = Column(Time, nullable=False)

    # Fechas de inscripción y curso
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

    # Docente asignado (opcional)
    docente_id = Column(Integer, ForeignKey("users.id", onupdate="CASCADE", ondelete="SET NULL"), nullable=True)
    docente    = relationship("User", foreign_keys=[docente_id], lazy="joined")

    notas = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# -------------------- NUEVO: tipo de inscripción --------------------
class InscripcionTipo(str, enum.Enum):
    pago = "pago"
    exencion = "exencion"


# -------------------- Modelo Inscripcion --------------------
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

    # Estado (conservas tu string libre)
    # "registrada" | "pendiente" | "confirmada" | "rechazada" (o los que uses)
    status = Column(String(20), nullable=False, default="registrada")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # ====== NUEVO: tipo de trámite (default conserva comportamiento actual) ======
    tipo = Column(SAEnum(InscripcionTipo), nullable=False, default=InscripcionTipo.pago)

    # ====== Pago (lo que ya tenías) ======
    referencia = Column(String(50), nullable=True)
    importe_centavos = Column(Integer, nullable=True)
    comprobante_path = Column(String(255), nullable=True)
    comprobante_mime = Column(String(100), nullable=True)
    comprobante_size = Column(Integer, nullable=True)

    # ====== Estudios (snapshot IPN) ======
    alumno_is_ipn = Column(Boolean, nullable=False, default=False)
    comprobante_estudios_path = Column(String(255), nullable=True)
    comprobante_estudios_mime = Column(String(100), nullable=True)
    comprobante_estudios_size = Column(Integer, nullable=True)

    # ====== NUEVO: Exención ======
    comprobante_exencion_path = Column(String(255), nullable=True)
    comprobante_exencion_mime = Column(String(100), nullable=True)
    comprobante_exencion_size = Column(Integer, nullable=True)

    # Relaciones
    alumno = relationship("User", backref="inscripciones")
    ciclo = relationship("Ciclo", backref="inscripciones")

    __table_args__ = (
        UniqueConstraint("alumno_id", "ciclo_id", name="uq_inscripcion_alumno_ciclo"),

        # Si tipo='pago' y es IPN ⇒ debe existir comprobante de estudios
        CheckConstraint(
            "(tipo <> 'pago') OR (NOT alumno_is_ipn) OR (comprobante_estudios_path IS NOT NULL)",
            name="ck_insc_estudios_si_ipn"
        ),

        # Si tipo='exencion' ⇒ exige comprobante de exención
        CheckConstraint(
            "(tipo <> 'exencion') OR (comprobante_exencion_path IS NOT NULL)",
            name="ck_insc_exencion_requiere_comprobante"
        ),
    )
