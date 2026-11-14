import models
import schemas
import crud
import security
import pdf_analyzer
from security import obtener_usuario_actual
from database import engine, get_db

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Cargar variables del archivo .env
load_dotenv(dotenv_path="../.env")

# Iniciar la aplicación
app = FastAPI(title="GapSecure API")


@app.get("/", tags=["Inicio"])
def read_root():
    return {"message": "¡Servidor GapSecure funcionando correctamente!"}


# ==========================================
# ENDPOINTS PARA ROLES
# ==========================================
@app.post("/roles/", response_model=schemas.RolResponse, tags=["Roles"])
def create_rol(rol: schemas.RolCreate, db: Session = Depends(get_db)):
    return crud.create_rol(db=db, rol=rol)


@app.get("/roles/", response_model=list[schemas.RolResponse], tags=["Roles"])
def read_roles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_roles(db, skip=skip, limit=limit)


# ==========================================
# ENDPOINTS PARA USUARIOS
# ==========================================
@app.post("/usuarios/", response_model=schemas.UsuarioResponse, tags=["Usuarios"])
def create_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    # Verificar si el correo ya existe por seguridad
    db_usuario = crud.get_usuario_by_correo(db, correo=usuario.correo)
    if db_usuario:
        raise HTTPException(
            status_code=400, detail="El correo ya está registrado"
        )

    return crud.create_usuario(db=db, usuario=usuario)


# Proteger la consulta de usuarios: solo usuarios autenticados pueden ver la lista
@app.get("/usuarios/", response_model=list[schemas.UsuarioResponse], tags=["Usuarios"])
def read_usuarios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    return crud.get_usuarios(db, skip=skip, limit=limit)


# Endpoint de prueba para verificar el perfil del usuario autenticado
@app.get("/usuarios/me", response_model=schemas.UsuarioResponse, tags=["Usuarios"])
def read_usuario_me(usuario_actual: models.Usuario = Depends(obtener_usuario_actual)):
    return usuario_actual


# ==========================================
# ENDPOINTS PARA AUTENTICACIÓN
# ==========================================
@app.post("/login", response_model=schemas.Token, tags=["Autenticación"])
def login_para_obtener_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # form_data.username recibe el correo ingresado
    usuario = crud.get_usuario_by_correo(db, correo=form_data.username)

    # 1. Validar usuario y verificar el hash con Bcrypt
    if not usuario or not security.verificar_password(
        form_data.password, usuario.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Validar estado de la cuenta
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario inactivo"
        )

    # 3. Generar JWT firmado
    access_token = security.crear_access_token(
        data={"sub": usuario.correo, "id_rol": usuario.id_rol}
    )

    return {"access_token": access_token, "token_type": "bearer"}


# ==========================================
# ENDPOINTS PARA AUDITORÍA ISO/IEC 27001:2022
# ==========================================
@app.post("/auditoria/analizar-pdf/", tags=["Auditoría ISO 27001"])
async def analizar_documento_pdf(
    file: UploadFile = File(...),
    area_organizativa: str = Form("Tecnologías de la Información"),
    nivel_confidencialidad: int = Form(4, ge=1, le=5),
    nivel_integridad: int = Form(4, ge=1, le=5),
    nivel_disponibilidad: int = Form(3, ge=1, le=5),
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400, detail="El archivo debe estar en formato PDF."
        )

    contenido = await file.read()
    try:
        return pdf_analyzer.analizar_pdf_iso27001(
            db=db,
            id_usuario=usuario_actual.id_usuario,
            nombre_archivo=file.filename,
            contenido_bytes=contenido,
            area_organizativa=area_organizativa,
            confidencialidad=nivel_confidencialidad,
            integridad=nivel_integridad,
            disponibilidad=nivel_disponibilidad,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))