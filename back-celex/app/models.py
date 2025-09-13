# app/models.py
import enum
from sqlalchemy import (
    Column, Integer, String, Date, Time, Text, DateTime,
    Boolean, CheckConstraint, UniqueConstraint, ForeignKey, Numeric, func
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.types import Enum as SAEnum
from datetime import datetime

# 👇 Usa SIEMPRE el Base único del proyecto
from .database import Base


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

class DiaSemana(str, enum.Enum):
    lunes     = "lunes"
    martes    = "martes"
    miercoles = "miercoles"
    jueves    = "jueves"
    viernes   = "viernes"
    sabado    = "sabado"
    domingo   = "domingo"

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


# -------------------- Tipo de inscripción --------------------
class InscripcionTipo(str, enum.Enum):
    pago = "pago"
    exencion = "exencion"


# -------------------- Modelo Inscripcion --------------------
class Inscripcion(Base):
    __tablename__ = "inscripciones"

    id = Column(Integer, primary_key=True, index=True)

    # Alumno que se inscribe
    alumno_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Ciclo/Grupo al que se inscribe
    ciclo_id = Column(Integer, ForeignKey("ciclos.id", ondelete="CASCADE"), nullable=False, index=True)

    # Estado
    status = Column(String(20), nullable=False, default="registrada")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Tipo de trámite
    tipo = Column(SAEnum(InscripcionTipo), nullable=False, default=InscripcionTipo.pago)

    # Pago
    referencia = Column(String(50), nullable=True)
    importe_centavos = Column(Integer, nullable=True)
    fecha_pago = Column(Date, nullable=True, index=True)

    comprobante_path = Column(String(255), nullable=True)
    comprobante_mime = Column(String(100), nullable=True)
    comprobante_size = Column(Integer, nullable=True)

    # Estudios (IPN)
    alumno_is_ipn = Column(Boolean, nullable=False, default=False)
    comprobante_estudios_path = Column(String(255), nullable=True)
    comprobante_estudios_mime = Column(String(100), nullable=True)
    comprobante_estudios_size = Column(Integer, nullable=True)

    # Exención
    comprobante_exencion_path = Column(String(255), nullable=True)
    comprobante_exencion_mime = Column(String(100), nullable=True)
    comprobante_exencion_size = Column(Integer, nullable=True)

     # NUEVO: motivo del rechazo
    rechazo_motivo = Column(Text, nullable=True, default=None)

    # Validación por coordinador
    validated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_at = Column(DateTime(timezone=True))
    validation_notes = Column(Text, nullable=True)

    # Relaciones
    alumno = relationship("User", foreign_keys=[alumno_id], backref="inscripciones")
    ciclo = relationship("Ciclo", backref="inscripciones")
    validador = relationship("User", foreign_keys=[validated_by_id])

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


# -------------------- Modelo Evaluacion --------------------
class Evaluacion(Base):
    __tablename__ = "evaluaciones"

    id = Column(Integer, primary_key=True, index=True)

    inscripcion_id = Column(Integer, ForeignKey("inscripciones.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    ciclo_id       = Column(Integer, ForeignKey("ciclos.id", ondelete="CASCADE"), nullable=False, index=True)

    # Medio curso
    medio_examen   = Column(Integer, nullable=True)   # 0..80
    medio_continua = Column(Integer, nullable=True)   # 0..20

    # Final de curso
    final_examen   = Column(Integer, nullable=True)   # 0..60
    final_continua = Column(Integer, nullable=True)   # 0..20
    final_tarea    = Column(Integer, nullable=True)   # 0..20

    # Derivados
    subtotal_medio = Column(Integer, nullable=False, default=0)    # 0..100
    subtotal_final = Column(Integer, nullable=False, default=0)    # 0..100
    promedio_final = Column(Numeric(5,2), nullable=False, default=0)  # 0.00..100.00

    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    inscripcion = relationship("Inscripcion", foreign_keys=[inscripcion_id], lazy="joined")
    ciclo       = relationship("Ciclo", foreign_keys=[ciclo_id], lazy="joined")
    updated_by  = relationship("User", foreign_keys=[updated_by_id])

    __table_args__ = (
        CheckConstraint("(medio_examen IS NULL OR (medio_examen BETWEEN 0 AND 80))", name="ck_eval_medio_examen"),
        CheckConstraint("(medio_continua IS NULL OR (medio_continua BETWEEN 0 AND 20))", name="ck_eval_medio_continua"),
        CheckConstraint("(final_examen IS NULL OR (final_examen BETWEEN 0 AND 60))", name="ck_eval_final_examen"),
        CheckConstraint("(final_continua IS NULL OR (final_continua BETWEEN 0 AND 20))", name="ck_eval_final_continua"),
        CheckConstraint("(final_tarea IS NULL OR (final_tarea BETWEEN 0 AND 20))", name="ck_eval_final_tarea"),
    )


# -------------------- Modelo PlacementExam --------------------
class PlacementExam(Base):
    __tablename__ = "placement_exams"
    __table_args__ = (
        UniqueConstraint("codigo", name="uq_placement_codigo"),
        CheckConstraint("cupo_total >= 0", name="ck_place_cupo_nonneg"),
        CheckConstraint("duracion_min > 0", name="ck_place_duracion_pos"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # NUEVOS / ajustados
    codigo = Column(String(50), nullable=False, index=True)     # único por __table_args__
    idioma = Column(String(30), nullable=False, index=True)     # ingles | frances | ...
    fecha = Column(Date, nullable=False)
    hora = Column(Time, nullable=False)

    salon = Column(String(120), nullable=True)
    duracion_min = Column(Integer, nullable=False, default=60)
    cupo_total = Column(Integer, nullable=False, default=0)
    costo = Column(Integer, nullable=True)                      # MXN opcional (en pesos o centavos según tu decisión global)

    docente_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    docente = relationship("User", foreign_keys=[docente_id], lazy="joined")

    # existentes
    nombre = Column(String(120), nullable=False, index=True)    # puedes usar nombre=codigo o un título más legible
    modalidad = Column(String(30), nullable=True)
    nivel_objetivo = Column(String(10), nullable=True)
    estado = Column(String(20), nullable=False, default="borrador")
    instrucciones = Column(Text, nullable=True)
    link_registro = Column(String(255), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)


# -------------------- Enums y Modelo PlacementRegistro --------------------
class PlacementRegistroStatus(str, enum.Enum):
    PREINSCRITA = "preinscrita"
    VALIDADA    = "validada"
    RECHAZADA   = "rechazada"
    CANCELADA   = "cancelada"


class PlacementRegistro(Base):
    __tablename__ = "placement_registros"

    id = Column(Integer, primary_key=True)

    alumno_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    exam_id   = Column(Integer, ForeignKey("placement_exams.id", ondelete="CASCADE"), index=True, nullable=False)

    status = Column(SAEnum(PlacementRegistroStatus, native_enum=False), nullable=False, default=PlacementRegistroStatus.PREINSCRITA)

    referencia = Column(String(50), nullable=True)
    importe_centavos = Column(Integer, nullable=True)
    fecha_pago = Column(Date, nullable=True)

    comprobante_path = Column(String(255), nullable=True)
    comprobante_mime = Column(String(100), nullable=True)
    comprobante_size = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # ✅ NUEVO: nivel asignado al alumno para este examen (ej. A1, B2, INTERMEDIO…)
    nivel_idioma = Column(String(20), nullable=True, index=True)  # <-- NUEVO

    # Campos de validación / rechazo
    rechazo_motivo   = Column(Text, nullable=True, default=None)
    validation_notes = Column(Text, nullable=True, default=None)
    validated_by_id  = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_at     = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    alumno = relationship("User", foreign_keys=[alumno_id], backref="placement_registros")
    exam   = relationship("PlacementExam", foreign_keys=[exam_id], backref="registros")
    validated_by = relationship("User", foreign_keys=[validated_by_id])

    __table_args__ = (
        UniqueConstraint("alumno_id", "exam_id", name="uq_alumno_exam"),
        CheckConstraint("(importe_centavos IS NULL) OR (importe_centavos >= 0)", name="ck_pago_no_neg"),
        # (Opcional) valida largo razonable del nivel:
        CheckConstraint("(nivel_idioma IS NULL) OR (length(nivel_idioma) BETWEEN 1 AND 20)", name="ck_nivel_idioma_len"),
    )
