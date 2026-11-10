from sqlalchemy.orm import Session
import models
import schemas

# ==========================================
# OPERACIONES PARA ROLES
# ==========================================
def get_roles(db: Session, skip: int = 0, limit: int = 100):
    """Obtiene una lista de roles paginada."""
    return db.query(models.Rol).offset(skip).limit(limit).all()

def create_rol(db: Session, rol: schemas.RolCreate):
    """Crea un nuevo rol en la base de datos."""
    db_rol = models.Rol(nombre=rol.nombre, descripcion=rol.descripcion)
    db.add(db_rol)
    db.commit()
    db.refresh(db_rol)
    return db_rol

# ==========================================
# OPERACIONES PARA USUARIOS
# ==========================================
def get_usuario_by_correo(db: Session, correo: str):
    """Busca un usuario por su correo electrónico (útil para el login o evitar duplicados)."""
    return db.query(models.Usuario).filter(models.Usuario.correo == correo).first()

def get_usuarios(db: Session, skip: int = 0, limit: int = 100):
    """Obtiene una lista de usuarios paginada."""
    return db.query(models.Usuario).offset(skip).limit(limit).all()

import security  # Importar módulo de seguridad

def create_usuario(db: Session, usuario: schemas.UsuarioCreate):
    # Generar el hash seguro de la contraseña recibida en schemas (usuario.password)
    hashed_password = security.obtener_password_hash(usuario.password)
    
    db_usuario = models.Usuario(
        id_rol=usuario.id_rol,
        nombre_completo=usuario.nombre_completo,
        rut=usuario.rut,
        correo=usuario.correo,
        password_hash=hashed_password,  # <-- Usar password_hash (nombre en models.py)
        activo=usuario.activo,
        es_2fa_activo=usuario.es_2fa_activo
    )
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario