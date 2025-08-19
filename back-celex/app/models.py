from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, Enum
from .database import Base
import enum


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
    role = Column(Enum(UserRole), default=UserRole.student, nullable=False)

    # Estado de la cuenta
    is_active = Column(Boolean, default=True)

    # Tiempos de registro
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
