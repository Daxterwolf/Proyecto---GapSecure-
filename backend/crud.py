from sqlalchemy.orm import Session
import models
import schemas
import security

# ==========================================
# OPERACIONES PARA ROLES
# ==========================================
def get_roles(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Rol).offset(skip).limit(limit).all()

def create_rol(db: Session, rol: schemas.RolCreate):
    db_rol = models.Rol(nombre=rol.nombre, descripcion=rol.descripcion)
    db.add(db_rol)
    db.commit()
    db.refresh(db_rol)
    return db_rol

# ==========================================
# OPERACIONES PARA ÁREAS ORGANIZATIVAS
# ==========================================
def get_areas_organizativas(db: Session, solo_activas: bool = False):
    query = db.query(models.AreaOrganizativa)
    if solo_activas:
        query = query.filter(models.AreaOrganizativa.activa == True)
    return query.order_by(models.AreaOrganizativa.id_area.asc()).all()

def create_area_organizativa(db: Session, area: schemas.AreaOrganizativaCreate):
    db_area = models.AreaOrganizativa(
        nombre=area.nombre.strip(),
        descripcion=area.descripcion,
        activa=area.activa
    )
    db.add(db_area)
    db.commit()
    db.refresh(db_area)
    return db_area

def update_area_organizativa(db: Session, id_area: int, datos: schemas.AreaOrganizativaUpdate):
    db_area = db.query(models.AreaOrganizativa).filter(models.AreaOrganizativa.id_area == id_area).first()
    if not db_area:
        return None
    if datos.nombre is not None:
        db_area.nombre = datos.nombre.strip()
    if datos.descripcion is not None:
        db_area.descripcion = datos.descripcion
    if datos.activa is not None:
        db_area.activa = datos.activa
    db.commit()
    db.refresh(db_area)
    return db_area

def delete_area_organizativa(db: Session, id_area: int):
    db_area = db.query(models.AreaOrganizativa).filter(models.AreaOrganizativa.id_area == id_area).first()
    if not db_area:
        return False
    db.delete(db_area)
    db.commit()
    return True

# ==========================================
# OPERACIONES PARA USUARIOS
# ==========================================
def get_usuario_by_correo(db: Session, correo: str):
    return db.query(models.Usuario).filter(models.Usuario.correo == correo).first()

def get_usuarios(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Usuario).order_by(models.Usuario.id_usuario.asc()).offset(skip).limit(limit).all()

def create_usuario(db: Session, usuario: schemas.UsuarioCreate):
    hashed_password = security.obtener_password_hash(usuario.password)
    db_usuario = models.Usuario(
        id_rol=usuario.id_rol,
        nombre_completo=usuario.nombre_completo,
        rut=usuario.rut,
        correo=usuario.correo,
        password_hash=hashed_password,
        activo=usuario.activo,
        es_2fa_activo=usuario.es_2fa_activo
    )
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario

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
        db_usuario.password_hash = security.obtener_password_hash(datos.password)

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

# ==========================================
# CONSULTAS PARA EL DASHBOARD DE AUDITORÍA
# ==========================================
def obtener_resumen_dashboard(db: Session, id_usuario: int, es_admin: bool = False):
    query_activos = db.query(models.Activo)
    if not es_admin:
        query_activos = query_activos.filter(models.Activo.id_propietario == id_usuario)
    activos = query_activos.all()
    ids_activos = [a.id_activo for a in activos]

    if not ids_activos:
        return {
            "total_activos_auditados": 0,
            "cumplimiento_promedio": 0.0,
            "brecha_promedio": 0.0,
            "total_riesgos_detectados": 0,
            "sugerencias_pendientes": 0,
            "cumplimiento_por_departamento": []
        }

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

    # Consolidado proporcional por área (solo sobre controles asignados a cada departamento)
    acumulado_areas: dict[str, dict] = {}
    for activo in activos:
        log_act = next((l for l in logs if l.registro_id == activo.id_activo), None)
        pct_act = float(log_act.valor_nuevo.get("porcentaje_cumplimiento", 0.0)) if (log_act and log_act.valor_nuevo) else 0.0

        # Si el activo tiene áreas relacionales en activo_area, usamos esas; si no, usamos el texto
        nombres_areas = [rel.area.nombre for rel in activo.areas if rel.area]
        if not nombres_areas and activo.area_organizativa:
            nombres_areas = [a.strip() for a in activo.area_organizativa.split(",") if a.strip()]

        for nom_area in nombres_areas:
            if nom_area not in acumulado_areas:
                acumulado_areas[nom_area] = {"suma_pct": 0.0, "evaluaciones": 0}
            acumulado_areas[nom_area]["suma_pct"] += pct_act
            acumulado_areas[nom_area]["evaluaciones"] += 1

    ranking_departamentos = [
        {
            "area": area_nom,
            "documentos_evaluados": d["evaluaciones"],
            "porcentaje_cumplimiento": round(d["suma_pct"] / d["evaluaciones"], 1),
            "porcentaje_brecha": round(100.0 - (d["suma_pct"] / d["evaluaciones"]), 1),
        }
        for area_nom, d in sorted(
            acumulado_areas.items(),
            key=lambda x: (x[1]["suma_pct"] / max(1, x[1]["evaluaciones"]))
        )
    ]

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
        "sugerencias_pendientes": sugerencias_pendientes,
        "cumplimiento_por_departamento": ranking_departamentos
    }


def listar_activos_usuario(db: Session, id_usuario: int, es_admin: bool = False):
    query = (
        db.query(models.Activo, models.ActivoPolitica, models.Politica)
        .outerjoin(models.ActivoPolitica, models.Activo.id_activo == models.ActivoPolitica.id_activo)
        .outerjoin(models.Politica, models.ActivoPolitica.id_politica == models.Politica.id_politica)
    )
    if not es_admin:
        query = query.filter(models.Activo.id_propietario == id_usuario)

    resultados = query.order_by(models.Activo.id_activo.desc()).all()

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
            "areas_involucradas": metricas.get("areas_involucradas", [activo.area_organizativa]),
            "area_principal": metricas.get("area_principal", activo.area_organizativa),
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


def obtener_detalle_activo(db: Session, id_activo: int, id_usuario: int, es_admin: bool = False):
    query = db.query(models.Activo).filter(models.Activo.id_activo == id_activo)
    if not es_admin:
        query = query.filter(models.Activo.id_propietario == id_usuario)
    activo = query.first()

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
                "areas_involucradas": s.areas_involucradas,
                "score_confianza": float(s.score_confianza) if s.score_confianza is not None else None,
                "fecha_generacion": s.fecha_generacion
            }
            for s in sugerencias
        ]
    }


def listar_historial_auditoria(db: Session, id_usuario: int, limit: int = 50, es_admin: bool = False):
    query = db.query(models.HistorialAuditoria)
    if not es_admin:
        query = query.filter(models.HistorialAuditoria.id_usuario == id_usuario)
    return query.order_by(models.HistorialAuditoria.id_log.desc()).limit(limit).all()