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

# ==========================================
# CONSULTAS PARA EL DASHBOARD DE AUDITORÍA
# ==========================================

def obtener_resumen_dashboard(db: Session, id_usuario: int):
    activos = db.query(models.Activo).filter(
        models.Activo.id_propietario == id_usuario
    ).all()
    ids_activos = [a.id_activo for a in activos]

    if not ids_activos:
        return {
            "total_activos_auditados": 0,
            "cumplimiento_promedio": 0.0,
            "brecha_promedio": 0.0,
            "total_riesgos_detectados": 0,
            "sugerencias_pendientes": 0
        }

    # Extraemos el porcentaje_cumplimiento guardado en el JSONB valor_nuevo del historial
    logs = db.query(models.HistorialAuditoria).filter(
        models.HistorialAuditoria.tabla_afectada == "activo_politica",
        models.HistorialAuditoria.registro_id.in_(ids_activos)
    ).all()

    porcentajes = [
        float(log.valor_nuevo["porcentaje_cumplimiento"])
        for log in logs
        if log.valor_nuevo and "porcentaje_cumplimiento" in log.valor_nuevo
    ]

    cumplimiento_prom = round(sum(porcentajes) / len(porcentajes), 2) if porcentajes else 0.0

    total_riesgos = db.query(models.Riesgo).filter(
        models.Riesgo.id_activo.in_(ids_activos)
    ).count()

    sugerencias_pendientes = db.query(models.SugerenciaIA).filter(
        models.SugerenciaIA.id_activo.in_(ids_activos)
    ).count()

    return {
        "total_activos_auditados": len(activos),
        "cumplimiento_promedio": cumplimiento_prom,
        "brecha_promedio": round(100.0 - cumplimiento_prom, 2),
        "total_riesgos_detectados": total_riesgos,
        "sugerencias_pendientes": sugerencias_pendientes
    }


def listar_activos_usuario(db: Session, id_usuario: int):
    resultados = (
        db.query(models.Activo, models.ActivoPolitica, models.Politica)
        .outerjoin(models.ActivoPolitica, models.Activo.id_activo == models.ActivoPolitica.id_activo)
        .outerjoin(models.Politica, models.ActivoPolitica.id_politica == models.Politica.id_politica)
        .filter(models.Activo.id_propietario == id_usuario)
        .order_by(models.Activo.id_activo.desc())
        .all()
    )

    # Mapa rápido de métricas desde HistorialAuditoria (JSONB) por registro_id
    ids_activos = [a.id_activo for a, _, _ in resultados]
    logs = db.query(models.HistorialAuditoria).filter(
        models.HistorialAuditoria.tabla_afectada == "activo_politica",
        models.HistorialAuditoria.registro_id.in_(ids_activos)
    ).all() if ids_activos else []
    metricas_por_activo = {log.registro_id: (log.valor_nuevo or {}) for log in logs}

    lista = []
    for activo, eval_pol, politica in resultados:
        metricas = metricas_por_activo.get(activo.id_activo, {})
        cumplimiento = float(metricas.get("porcentaje_cumplimiento", 100.0 if (eval_pol and eval_pol.cumplimiento) else 0.0))
        lista.append({
            "id_activo": activo.id_activo,
            "nombre": activo.nombre,
            "area_organizativa": activo.area_organizativa,
            "nivel_confidencialidad": activo.nivel_confidencialidad,
            "nivel_integridad": activo.nivel_integridad,
            "nivel_disponibilidad": activo.nivel_disponibilidad,
            "fecha_creacion": activo.fecha_creacion,
            "norma": politica.codigo_norma if politica else "N/A",
            "cumple_norma": eval_pol.cumplimiento if eval_pol else False,
            "porcentaje_cumplimiento": cumplimiento,
            "porcentaje_brecha": round(100.0 - cumplimiento, 2)
        })
    return lista


def obtener_detalle_activo(db: Session, id_activo: int, id_usuario: int):
    activo = db.query(models.Activo).filter(
        models.Activo.id_activo == id_activo,
        models.Activo.id_propietario == id_usuario
    ).first()

    if not activo:
        return None

    evaluacion = db.query(models.ActivoPolitica).filter(
        models.ActivoPolitica.id_activo == id_activo
    ).first()

    log_auditoria = db.query(models.HistorialAuditoria).filter(
        models.HistorialAuditoria.tabla_afectada == "activo_politica",
        models.HistorialAuditoria.registro_id == id_activo
    ).order_by(models.HistorialAuditoria.id_log.desc()).first()

    metricas = log_auditoria.valor_nuevo if (log_auditoria and log_auditoria.valor_nuevo) else {}

    sugerencias = db.query(models.SugerenciaIA).filter(
        models.SugerenciaIA.id_activo == id_activo
    ).order_by(models.SugerenciaIA.id_sugerencia.asc()).all()

    riesgos = db.query(models.Riesgo).filter(
        models.Riesgo.id_activo == id_activo
    ).all()

    return {
        "activo": {
            "id_activo": activo.id_activo,
            "nombre": activo.nombre,
            "descripcion": activo.descripcion,
            "area_organizativa": activo.area_organizativa,
            "fecha_creacion": activo.fecha_creacion,
            "valoracion_cid": {
                "confidencialidad": activo.nivel_confidencialidad,
                "integridad": activo.nivel_integridad,
                "disponibilidad": activo.nivel_disponibilidad
            }
        },
        "evaluacion": {
            "cumplimiento": evaluacion.cumplimiento if evaluacion else False,
            "fecha_evaluacion": evaluacion.fecha_evaluacion if evaluacion else None,
            "metricas_gap": metricas
        },
        "riesgos": [
            {
                "id_riesgo": r.id_riesgo,
                "descripcion": r.descripcion,
                "impacto": r.impacto,
                "probabilidad": r.probabilidad,
                "nivel_riesgo": r.nivel_riesgo
            }
            for r in riesgos
        ],
        "sugerencias_remediacion": [
            {
                "id_sugerencia": s.id_sugerencia,
                "recomendacion": s.recomendacion,
                "nivel_criticidad": s.nivel_criticidad,
                "score_confianza": float(s.score_confianza) if s.score_confianza is not None else None,
                "fecha_generacion": s.fecha_generacion
            }
            for s in sugerencias
        ]
    }


def listar_historial_auditoria(db: Session, id_usuario: int, limit: int = 50):
    registros = (
        db.query(models.HistorialAuditoria)
        .filter(models.HistorialAuditoria.id_usuario == id_usuario)
        .order_by(models.HistorialAuditoria.id_log.desc())
        .limit(limit)
        .all()
    )
    return registros

def update_usuario(db: Session, id_usuario: int, datos: schemas.UsuarioUpdate):
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not db_usuario:
        return None

    if datos.nombre_completo is not None:
        db_usuario.nombre_completo = datos.nombre_completo
    if datos.rut is not None:
        db_usuario.rut = datos.rut
    if datos.correo is not None:
        db_usuario.correo = datos.correo
    if datos.id_rol is not None:
        db_usuario.id_rol = datos.id_rol
    if datos.es_2fa_activo is not None:
        db_usuario.es_2fa_activo = datos.es_2fa_activo
    if datos.activo is not None:
        db_usuario.activo = datos.activo
    if datos.password:
        db_usuario.password_hash = security.obtener_hash_password(datos.password)

    db.commit()
    db.refresh(db_usuario)
    return db_usuario


def delete_usuario(db: Session, id_usuario: int):
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not db_usuario:
        return False
    db.delete(db_usuario)
    db.commit()
    return True