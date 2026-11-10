from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, DateTime, DECIMAL, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from database import Base

# 1. Rol
class Rol(Base):
    __tablename__ = "rol"

    id_rol = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)

    usuarios = relationship("Usuario", back_populates="rol")

# 2. Usuario
class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(Integer, primary_key=True, index=True)
    id_rol = Column(Integer, ForeignKey("rol.id_rol"), nullable=False)
    nombre_completo = Column(String(150), nullable=False)
    rut = Column(String(15), unique=True, nullable=False)
    correo = Column(String(150), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    secret_2fa = Column(String(255))
    es_2fa_activo = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    rol = relationship("Rol", back_populates="usuarios")
    activos_propietario = relationship("Activo", back_populates="propietario")

# 3. Categoría de Activo
class CategoriaActivo(Base):
    __tablename__ = "categoria_activo"

    id_categoria = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)

    activos = relationship("Activo", back_populates="categoria")

# 4. Activo
class Activo(Base):
    __tablename__ = "activo"
    __table_args__ = (
        CheckConstraint('nivel_confidencialidad BETWEEN 1 AND 5', name='chk_confidencialidad'),
        CheckConstraint('nivel_integridad BETWEEN 1 AND 5', name='chk_integridad'),
        CheckConstraint('nivel_disponibilidad BETWEEN 1 AND 5', name='chk_disponibilidad'),
    )

    id_activo = Column(Integer, primary_key=True, index=True)
    id_categoria = Column(Integer, ForeignKey("categoria_activo.id_categoria"), nullable=False)
    id_propietario = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=False)
    nombre = Column(String(150), nullable=False)
    area_organizativa = Column(String(100), nullable=False)
    descripcion = Column(Text)
    nivel_confidencialidad = Column(Integer)
    nivel_integridad = Column(Integer)
    nivel_disponibilidad = Column(Integer)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    categoria = relationship("CategoriaActivo", back_populates="activos")
    propietario = relationship("Usuario", back_populates="activos_propietario")
    riesgos = relationship("Riesgo", back_populates="activo", cascade="all, delete-orphan")
    politicas = relationship("ActivoPolitica", back_populates="activo", cascade="all, delete-orphan")
    sugerencias = relationship("SugerenciaIA", back_populates="activo", cascade="all, delete-orphan")
    servicios = relationship("ActivoServicio", back_populates="activo", cascade="all, delete-orphan")

# 5. Política
class Politica(Base):
    __tablename__ = "politica"

    id_politica = Column(Integer, primary_key=True, index=True)
    codigo_norma = Column(String(50), nullable=False)
    titulo_norma = Column(String(200), nullable=False)
    version = Column(String(30))
    descripcion = Column(Text)

    clausulas = relationship("Clausula", back_populates="politica", cascade="all, delete-orphan")
    activos = relationship("ActivoPolitica", back_populates="politica", cascade="all, delete-orphan")
    sugerencias = relationship("SugerenciaIA", back_populates="politica", cascade="all, delete-orphan")

# 6. Cláusula
class Clausula(Base):
    __tablename__ = "clausula"

    id_clausula = Column(Integer, primary_key=True, index=True)
    id_politica = Column(Integer, ForeignKey("politica.id_politica", ondelete="CASCADE"), nullable=False)
    codigo_clausula = Column(String(50), nullable=False)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text)

    politica = relationship("Politica", back_populates="clausulas")

# 7. Activo_Politica (Evaluación)
class ActivoPolitica(Base):
    __tablename__ = "activo_politica"

    id_activo_politica = Column(Integer, primary_key=True, index=True)
    id_activo = Column(Integer, ForeignKey("activo.id_activo", ondelete="CASCADE"), nullable=False)
    id_politica = Column(Integer, ForeignKey("politica.id_politica", ondelete="CASCADE"), nullable=False)
    cumplimiento = Column(Boolean)
    fecha_evaluacion = Column(DateTime(timezone=True), server_default=func.now())

    activo = relationship("Activo", back_populates="politicas")
    politica = relationship("Politica", back_populates="activos")

# 8. Sugerencia_IA
class SugerenciaIA(Base):
    __tablename__ = "sugerencia_ia"

    id_sugerencia = Column(Integer, primary_key=True, index=True)
    id_activo = Column(Integer, ForeignKey("activo.id_activo", ondelete="CASCADE"), nullable=False)
    id_politica = Column(Integer, ForeignKey("politica.id_politica", ondelete="CASCADE"), nullable=False)
    recomendacion = Column(Text, nullable=False)
    nivel_criticidad = Column(String(20))
    score_confianza = Column(DECIMAL(5, 2))
    fecha_generacion = Column(DateTime(timezone=True), server_default=func.now())

    activo = relationship("Activo", back_populates="sugerencias")
    politica = relationship("Politica", back_populates="sugerencias")

# 9. Riesgo
class Riesgo(Base):
    __tablename__ = "riesgo"

    id_riesgo = Column(Integer, primary_key=True, index=True)
    id_activo = Column(Integer, ForeignKey("activo.id_activo", ondelete="CASCADE"), nullable=False)
    descripcion = Column(Text, nullable=False)
    impacto = Column(String(20))
    probabilidad = Column(String(20))
    nivel_riesgo = Column(String(20))

    activo = relationship("Activo", back_populates="riesgos")

# 10. Servicio
class Servicio(Base):
    __tablename__ = "servicio"

    id_servicio = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text)

    activos = relationship("ActivoServicio", back_populates="servicio", cascade="all, delete-orphan")

# 11. Activo_Servicio (Relación M:N)
class ActivoServicio(Base):
    __tablename__ = "activo_servicio"

    id_activo = Column(Integer, ForeignKey("activo.id_activo", ondelete="CASCADE"), primary_key=True)
    id_servicio = Column(Integer, ForeignKey("servicio.id_servicio", ondelete="CASCADE"), primary_key=True)

    activo = relationship("Activo", back_populates="servicios")
    servicio = relationship("Servicio", back_populates="activos")

# 12. Historial Auditoría
class HistorialAuditoria(Base):
    __tablename__ = "historial_auditoria"

    id_log = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuario.id_usuario", ondelete="SET NULL"))
    tabla_afectada = Column(String(100), nullable=False)
    registro_id = Column(Integer)
    accion = Column(String(50), nullable=False)
    valor_anterior = Column(JSONB)
    valor_nuevo = Column(JSONB)
    hash_mod = Column(String(512), nullable=False)
    fecha_modificacion = Column(DateTime(timezone=True), server_default=func.now())