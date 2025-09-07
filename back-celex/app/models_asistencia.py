# app/models_asistencia.py
from sqlalchemy import (
    Column, Integer, Date, Enum as SAEnum, ForeignKey, Text,
    UniqueConstraint, DateTime, func
)
from sqlalchemy.orm import relationship
import enum

from .models import Base  # solo Base; evitamos importar Ciclo/Inscripcion/User para no forzar orden


class AsistenciaEstado(str, enum.Enum):
    presente = "presente"
    ausente = "ausente"
    retardo = "retardo"
    justificado = "justificado"


class AsistenciaSesion(Base):
    __tablename__ = "asistencia_sesion"

    id = Column(Integer, primary_key=True)
    # 🔒 Literal exacto de la tabla real para evitar problemas de inferencia/orden
    ciclo_id = Column(Integer, ForeignKey("ciclos.id", ondelete="CASCADE"), index=True, nullable=False)
    fecha = Column(Date, index=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 🚧 Relación explícita sin backref en Ciclo
    # (si quieres el lado inverso luego, lo agregamos en models.Ciclo con back_populates)
    ciclo = relationship(
        "Ciclo",
        primaryjoin="AsistenciaSesion.ciclo_id == Ciclo.id",
        foreign_keys=[ciclo_id],
        lazy="joined",
    )

    registros = relationship(
        "AsistenciaRegistro",
        cascade="all, delete-orphan",
        back_populates="sesion",
    )

    __table_args__ = (
        UniqueConstraint("ciclo_id", "fecha", name="uq_asistencia_sesion_ciclo_fecha"),
    )


class AsistenciaRegistro(Base):
    __tablename__ = "asistencia_registro"

    id = Column(Integer, primary_key=True)

    sesion_id = Column(Integer, ForeignKey("asistencia_sesion.id", ondelete="CASCADE"), index=True, nullable=False)
    inscripcion_id = Column(Integer, ForeignKey("inscripciones.id", ondelete="CASCADE"), index=True, nullable=False)

    estado = Column(SAEnum(AsistenciaEstado, name="asistencia_estado"), nullable=False, default=AsistenciaEstado.presente)
    nota = Column(Text, nullable=True)

    marcado_por_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Lados de relación definidos de forma explícita
    sesion = relationship(
        "AsistenciaSesion",
        primaryjoin="AsistenciaRegistro.sesion_id == AsistenciaSesion.id",
        foreign_keys=[sesion_id],
        back_populates="registros",
    )

    # acceso a la inscripción si lo necesitas en el futuro:
    inscripcion = relationship(
        "Inscripcion",
        primaryjoin="AsistenciaRegistro.inscripcion_id == Inscripcion.id",
        foreign_keys=[inscripcion_id],
        lazy="joined",
    )

    __table_args__ = (
        UniqueConstraint("sesion_id", "inscripcion_id", name="uq_asistencia_registro_sesion_inscripcion"),
    )
