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
    pass


class RolResponse(RolBase):
    id_rol: int
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# ESQUEMAS PARA USUARIO (EP-01)
# ==========================================
class UsuarioBase(BaseModel):
    id_rol: int
    nombre_completo: str
    rut: str
    correo: EmailStr
    es_2fa_activo: bool = False
    activo: bool = True


class UsuarioCreate(UsuarioBase):
    password: str


class UsuarioResponse(UsuarioBase):
    id_usuario: int
    fecha_creacion: datetime
    # SEGURIDAD: Se omiten explícitamente password_hash y secret_2fa
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
    requires_2fa: bool = False
    temp_token: Optional[str] = None


class TokenData(BaseModel):
    correo: str | None = None


class Verify2FALoginRequest(BaseModel):
    temp_token: str
    code: str


class Setup2FAResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_base64: str


class Confirm2FARequest(BaseModel):
    code: str


class UsuarioUpdate(BaseModel):
    id_rol: Optional[int] = None
    nombre_completo: Optional[str] = None
    rut: Optional[str] = None
    correo: Optional[EmailStr] = None
    es_2fa_activo: Optional[bool] = None
    activo: Optional[bool] = None
    password: Optional[str] = None


# ==========================================
# ESQUEMAS PARA ÁREAS ORGANIZATIVAS
# ==========================================
class AreaOrganizativaBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    activa: bool = True


class AreaOrganizativaCreate(AreaOrganizativaBase):
    pass


class AreaOrganizativaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = None


class AreaOrganizativaResponse(AreaOrganizativaBase):
    id_area: int
    model_config = ConfigDict(from_attributes=True)