import os
import io
import base64
import bcrypt
import pyotp
import qrcode
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models, crud
from database import get_db

load_dotenv(dotenv_path="../.env")

SECRET_KEY = os.getenv("SECRET_KEY", "secret_key_temporal")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# ==========================================
# FUNCIONES DE CONTRASEÑA (BCRYPT NATIVO)
# ==========================================
def obtener_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verificar_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)


# ==========================================
# FUNCIONES DE JWT
# ==========================================
def crear_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "stage": "full"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def crear_temp_2fa_token(correo: str) -> str:
    """Token de corta duración (5 min) válido únicamente para completar el paso 2FA."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    to_encode = {"sub": correo, "stage": "2fa_pending", "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verificar_temp_2fa_token(temp_token: str) -> str:
    try:
        payload = jwt.decode(temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        correo: str | None = payload.get("sub")
        stage: str | None = payload.get("stage")
        if correo is None or stage != "2fa_pending":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token temporal de verificación 2FA inválido o expirado.",
            )
        return correo
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El tiempo para ingresar el código 2FA expiró. Inicia sesión nuevamente.",
        )


# ==========================================
# FUNCIONES TOTP (GOOGLE AUTHENTICATOR / AUTHY)
# ==========================================
def generar_secreto_totp() -> str:
    return pyotp.random_base32()


def generar_qr_totp_base64(correo: str, secret: str) -> tuple[str, str]:
    totp = pyotp.TOTP(secret)
    otpauth_url = totp.provisioning_uri(name=correo, issuer_name="GapSecure SGSI")
    qr_img = qrcode.make(otpauth_url)
    buffer = io.BytesIO()
    qr_img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return otpauth_url, f"data:image/png;base64,{qr_b64}"


def verificar_codigo_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    clean_code = code.strip().replace(" ", "")
    totp = pyotp.TOTP(secret)
    # valid_window=1 tolera +/- 30 segundos de desfase de reloj
    return totp.verify(clean_code, valid_window=1)


# ==========================================
# DEPENDENCIA DE AUTENTICACIÓN (PROTECCIÓN DE RUTAS)
# ==========================================
def obtener_usuario_actual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.Usuario:
    credenciales_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales o el token ha expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        correo: str = payload.get("sub")
        stage: str = payload.get("stage", "full")
        if correo is None or stage == "2fa_pending":
            raise credenciales_exception
    except JWTError:
        raise credenciales_exception

    usuario = crud.get_usuario_by_correo(db, correo=correo)
    if usuario is None:
        raise credenciales_exception

    return usuario