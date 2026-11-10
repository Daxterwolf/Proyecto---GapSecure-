from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime

# ==========================================
# ESQUEMAS PARA ROL (EP-01)
# ==========================================
class RolBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class RolCreate(RolBase):
    pass # Usa los mismos campos que RolBase para crear un rol

class RolResponse(RolBase):
    id_rol: int

    # Le dice a Pydantic que lea los datos desde los modelos de SQLAlchemy
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# ESQUEMAS PARA USUARIO (EP-01)
# ==========================================
class UsuarioBase(BaseModel):
    id_rol: int
    nombre_completo: str
    rut: str
    correo: EmailStr # Valida automáticamente que tenga formato @dominio.com
    es_2fa_activo: bool = False
    activo: bool = True

class UsuarioCreate(UsuarioBase):
    password: str # El frontend envía texto plano; el backend lo hasheará antes de guardarlo

class UsuarioResponse(UsuarioBase):
    id_usuario: int
    fecha_creacion: datetime
    # SEGURIDAD: Se omiten explícitamente password_hash y secret_2fa

    model_config = ConfigDict(from_attributes=True)
    
    
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    correo: str | None = None