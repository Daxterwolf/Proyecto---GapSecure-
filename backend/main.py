import json
import models
import schemas
import crud
import security
import pdf_analyzer
from security import obtener_usuario_actual
from database import engine, get_db

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Cargar variables del archivo .env
load_dotenv(dotenv_path="../.env")

# Iniciar la aplicación
app = FastAPI(title="GapSecure API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def requerir_admin(
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
) -> models.Usuario:
    if usuario_actual.id_rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: se requieren privilegios de Administrador.",
        )
    return usuario_actual


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
# ENDPOINTS PARA ÁREAS ORGANIZATIVAS
# ==========================================
@app.get("/areas/", response_model=list[schemas.AreaOrganizativaResponse], tags=["Áreas Organizativas"])
def read_areas(
    solo_activas: bool = False,
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    return crud.get_areas_organizativas(db, solo_activas=solo_activas)


@app.post("/areas/", response_model=schemas.AreaOrganizativaResponse, tags=["Áreas Organizativas"])
def create_area(
    area: schemas.AreaOrganizativaCreate,
    db: Session = Depends(get_db),
    admin_actual: models.Usuario = Depends(requerir_admin),
):
    return crud.create_area_organizativa(db=db, area=area)


@app.put("/areas/{id_area}", response_model=schemas.AreaOrganizativaResponse, tags=["Áreas Organizativas"])
def update_area(
    id_area: int,
    datos: schemas.AreaOrganizativaUpdate,
    db: Session = Depends(get_db),
    admin_actual: models.Usuario = Depends(requerir_admin),
):
    actualizada = crud.update_area_organizativa(db=db, id_area=id_area, datos=datos)
    if not actualizada:
        raise HTTPException(status_code=404, detail="Área organizativa no encontrada")
    return actualizada


@app.delete("/areas/{id_area}", tags=["Áreas Organizativas"])
def delete_area(
    id_area: int,
    db: Session = Depends(get_db),
    admin_actual: models.Usuario = Depends(requerir_admin),
):
    eliminada = crud.delete_area_organizativa(db=db, id_area=id_area)
    if not eliminada:
        raise HTTPException(status_code=404, detail="Área organizativa no encontrada")
    return {"message": "Área eliminada correctamente"}


# ==========================================
# ENDPOINTS PARA USUARIOS (SOLO ADMINISTRADOR)
# ==========================================
@app.post("/usuarios/", response_model=schemas.UsuarioResponse, tags=["Usuarios"])
def create_usuario(
    usuario: schemas.UsuarioCreate,
    db: Session = Depends(get_db),
    admin_actual: models.Usuario = Depends(requerir_admin),
):
    db_usuario = crud.get_usuario_by_correo(db, correo=usuario.correo)
    if db_usuario:
        raise HTTPException(
            status_code=400, detail="El correo ya está registrado"
        )

    return crud.create_usuario(db=db, usuario=usuario)


@app.get("/usuarios/", response_model=list[schemas.UsuarioResponse], tags=["Usuarios"])
def read_usuarios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_actual: models.Usuario = Depends(requerir_admin),
):
    return crud.get_usuarios(db, skip=skip, limit=limit)


@app.get("/usuarios/me", response_model=schemas.UsuarioResponse, tags=["Usuarios"])
def read_usuario_me(usuario_actual: models.Usuario = Depends(obtener_usuario_actual)):
    return usuario_actual


@app.put("/usuarios/{id_usuario}", response_model=schemas.UsuarioResponse, tags=["Usuarios"])
def update_usuario_endpoint(
    id_usuario: int,
    datos: schemas.UsuarioUpdate,
    db: Session = Depends(get_db),
    admin_actual: models.Usuario = Depends(requerir_admin),
):
    actualizado = crud.update_usuario(db=db, id_usuario=id_usuario, datos=datos)
    if not actualizado:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return actualizado


@app.delete("/usuarios/{id_usuario}", tags=["Usuarios"])
def delete_usuario_endpoint(
    id_usuario: int,
    db: Session = Depends(get_db),
    admin_actual: models.Usuario = Depends(requerir_admin),
):
    if id_usuario == admin_actual.id_usuario:
        raise HTTPException(
            status_code=400, detail="No puedes eliminar tu propia cuenta activa."
        )
    eliminado = crud.delete_usuario(db=db, id_usuario=id_usuario)
    if not eliminado:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado correctamente"}


# ==========================================
# ENDPOINTS PARA AUTENTICACIÓN Y 2FA (A.8.5)
# ==========================================
@app.post("/login", response_model=schemas.Token, tags=["Autenticación"])
def login_para_obtener_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    usuario = crud.get_usuario_by_correo(db, correo=form_data.username)

    if not usuario or not security.verificar_password(
        form_data.password, usuario.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario inactivo"
        )

    # Si el usuario tiene 2FA activo y configurado, exigir segundo factor
    if usuario.es_2fa_activo and usuario.secret_2fa:
        temp_token = security.crear_temp_2fa_token(usuario.correo)
        return {
            "access_token": "",
            "token_type": "bearer",
            "requires_2fa": True,
            "temp_token": temp_token,
        }

    access_token = security.crear_access_token(
        data={"sub": usuario.correo, "id_rol": usuario.id_rol}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False,
        "temp_token": None,
    }


@app.post("/login/2fa", response_model=schemas.Token, tags=["Autenticación"])
def verificar_login_2fa(
    payload: schemas.Verify2FALoginRequest,
    db: Session = Depends(get_db),
):
    correo = security.verificar_temp_2fa_token(payload.temp_token)
    usuario = crud.get_usuario_by_correo(db, correo=correo)

    if not usuario or not usuario.activo or not usuario.es_2fa_activo or not usuario.secret_2fa:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Configuración 2FA no válida para este usuario.",
        )

    if not security.verificar_codigo_totp(usuario.secret_2fa, payload.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código de verificación 2FA incorrecto o expirado.",
        )

    access_token = security.crear_access_token(
        data={"sub": usuario.correo, "id_rol": usuario.id_rol}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False,
        "temp_token": None,
    }


@app.post("/2fa/setup", response_model=schemas.Setup2FAResponse, tags=["Autenticación"])
def iniciar_configuracion_2fa(
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    secret = security.generar_secreto_totp()
    usuario_actual.secret_2fa = secret
    db.commit()
    db.refresh(usuario_actual)

    otpauth_url, qr_base64 = security.generar_qr_totp_base64(usuario_actual.correo, secret)
    return {
        "secret": secret,
        "otpauth_url": otpauth_url,
        "qr_base64": qr_base64,
    }


@app.post("/2fa/confirm", response_model=schemas.UsuarioResponse, tags=["Autenticación"])
def confirmar_activacion_2fa(
    payload: schemas.Confirm2FARequest,
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    if not usuario_actual.secret_2fa:
        raise HTTPException(
            status_code=400,
            detail="Primero debes generar el código QR de vinculación.",
        )

    if not security.verificar_codigo_totp(usuario_actual.secret_2fa, payload.code):
        raise HTTPException(
            status_code=400,
            detail="El código de 6 dígitos no coincide. Verifica la hora de tu teléfono e inténtalo nuevamente.",
        )

    usuario_actual.es_2fa_activo = True
    db.commit()
    db.refresh(usuario_actual)
    return usuario_actual


@app.post("/2fa/disable", response_model=schemas.UsuarioResponse, tags=["Autenticación"])
def desactivar_2fa(
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    usuario_actual.es_2fa_activo = False
    usuario_actual.secret_2fa = None
    db.commit()
    db.refresh(usuario_actual)
    return usuario_actual


# ==========================================
# ENDPOINTS PARA AUDITORÍA ISO/IEC 27001:2022
# ==========================================
@app.post("/auditoria/analizar-pdf/", tags=["Auditoría ISO 27001"])
async def analizar_documento_pdf(
    file: UploadFile = File(...),
    area_organizativa: str = Form("Tecnologías de la Información (TI)"),
    areas_seleccionadas: str = Form("[]"),
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

    try:
        lista_areas = json.loads(areas_seleccionadas) if areas_seleccionadas else []
        if not isinstance(lista_areas, list):
            lista_areas = []
    except Exception:
        lista_areas = [a.strip() for a in areas_seleccionadas.split(",") if a.strip()]

    if not lista_areas and area_organizativa:
        lista_areas = [area_organizativa]

    contenido = await file.read()
    try:
        return pdf_analyzer.analizar_pdf_iso27001(
            db=db,
            id_usuario=usuario_actual.id_usuario,
            nombre_archivo=file.filename,
            contenido_bytes=contenido,
            areas_seleccionadas=lista_areas,
            area_principal=area_organizativa,
            confidencialidad=nivel_confidencialidad,
            integridad=nivel_integridad,
            disponibilidad=nivel_disponibilidad,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# GESTIÓN DE ESTADO DE REMEDIACIÓN
# ==========================================
@app.patch("/sugerencias/{id_sugerencia}/toggle-resuelta", tags=["Auditoría ISO 27001"])
def cambiar_estado_sugerencia(
    id_sugerencia: int,
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    resultado = crud.toggle_sugerencia_resuelta(
        db=db,
        id_sugerencia=id_sugerencia,
        id_usuario=usuario_actual.id_usuario,
    )
    if not resultado:
        raise HTTPException(status_code=404, detail="Sugerencia no encontrada")
    return resultado


# ==========================================
# ENDPOINTS PARA EL DASHBOARD
# ==========================================
@app.get("/dashboard/resumen", tags=["Dashboard"])
def get_dashboard_resumen(
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    return crud.obtener_resumen_dashboard(
        db=db,
        id_usuario=usuario_actual.id_usuario,
        es_admin=(usuario_actual.id_rol == 1),
    )


@app.get("/dashboard/activos", tags=["Dashboard"])
def get_dashboard_activos(
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    return crud.listar_activos_usuario(
        db=db,
        id_usuario=usuario_actual.id_usuario,
        es_admin=(usuario_actual.id_rol == 1),
    )


@app.get("/dashboard/activos/{id_activo}/detalle", tags=["Dashboard"])
def get_dashboard_activo_detalle(
    id_activo: int,
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    detalle = crud.obtener_detalle_activo(
        db=db,
        id_activo=id_activo,
        id_usuario=usuario_actual.id_usuario,
        es_admin=(usuario_actual.id_rol == 1),
    )
    if not detalle:
        raise HTTPException(
            status_code=404,
            detail="Activo no encontrado o no pertenece al usuario autenticado.",
        )
    return detalle


@app.get("/dashboard/historial", tags=["Dashboard"])
def get_dashboard_historial(
    limit: int = 50,
    db: Session = Depends(get_db),
    usuario_actual: models.Usuario = Depends(obtener_usuario_actual),
):
    return crud.listar_historial_auditoria(
        db=db,
        id_usuario=usuario_actual.id_usuario,
        limit=limit,
        es_admin=(usuario_actual.id_rol == 1),
    )