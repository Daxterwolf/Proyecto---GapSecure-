from datetime import datetime, timezone
import json
import hashlib
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
# FUNCIÓN AUXILIAR: RECÁLCULO CON REMEDIACIONES
# ==========================================
def _calcular_cumplimiento_actualizado(
    metricas_log: dict,
    sugerencias_activo: list[models.SugerenciaIA],
    fallback_cumple: bool = False
) -> float:
    base_pct = float(metricas_log.get("porcentaje_cumplimiento", 100.0 if fallback_cumple else 0.0))
    total_sug = len(sugerencias_activo)
    if total_sug == 0:
        return base_pct

    resueltas = sum(1 for s in sugerencias_activo if getattr(s, "resuelta", False))
    if resueltas == 0:
        return round(base_pct, 2)

    brecha_inicial = max(0.0, 100.0 - base_pct)
    puntos_recuperados = brecha_inicial * (resueltas / total_sug)
    return round(min(100.0, base_pct + puntos_recuperados), 2)

# ==========================================
# GESTIÓN DE ESTADO DE REMEDIACIÓN
# ==========================================
def toggle_sugerencia_resuelta(db: Session, id_sugerencia: int, id_usuario: int):
    sug = db.query(models.SugerenciaIA).filter(
        models.SugerenciaIA.id_sugerencia == id_sugerencia
    ).first()
    if not sug:
        return None

    estado_anterior = bool(sug.resuelta)
    sug.resuelta = not estado_anterior
    sug.fecha_resolucion = datetime.now(timezone.utc) if sug.resuelta else None
    db.flush()

    todas_sug = db.query(models.SugerenciaIA).filter(
        models.SugerenciaIA.id_activo == sug.id_activo
    ).all()
    pendientes_activo = sum(1 for s in todas_sug if not s.resuelta)

    log_base = db.query(models.HistorialAuditoria).filter(
        models.HistorialAuditoria.tabla_afectada == "activo_politica",
        models.HistorialAuditoria.registro_id == sug.id_activo
    ).order_by(models.HistorialAuditoria.id_log.asc()).first()

    metricas_base = log_base.valor_nuevo if (log_base and log_base.valor_nuevo) else {}
    nuevo_pct = _calcular_cumplimiento_actualizado(metricas_base, todas_sug)

    eval_pol = db.query(models.ActivoPolitica).filter(
        models.ActivoPolitica.id_activo == sug.id_activo
    ).first()
    if eval_pol:
        eval_pol.cumplimiento = (pendientes_activo == 0 or nuevo_pct >= 80.0)

    # Registrar traza inmutable SHA-256
    payload_log = {
        "id_sugerencia": sug.id_sugerencia,
        "id_activo": sug.id_activo,
        "resuelta_anterior": estado_anterior,
        "resuelta_nueva": sug.resuelta,
        "pendientes_restantes": pendientes_activo,
        "porcentaje_cumplimiento_actualizado": nuevo_pct,
    }
    hash_str = hashlib.sha256(
        json.dumps(payload_log, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()

    db.add(models.HistorialAuditoria(
        id_usuario=id_usuario,
        tabla_afectada="sugerencia_ia",
        registro_id=sug.id_sugerencia,
        accion="UPDATE",
        valor_anterior={"resuelta": estado_anterior},
        valor_nuevo={
            "resuelta": sug.resuelta,
            "pendientes_restantes": pendientes_activo,
            "porcentaje_cumplimiento": nuevo_pct
        },
        hash_mod=hash_str
    ))

    db.commit()
    db.refresh(sug)
    return {
        "id_sugerencia": sug.id_sugerencia,
        "id_activo": sug.id_activo,
        "resuelta": sug.resuelta,
        "fecha_resolucion": sug.fecha_resolucion,
        "pendientes_restantes": pendientes_activo,
        "porcentaje_cumplimiento": nuevo_pct
    }

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

    todas_sugerencias = db.query(models.SugerenciaIA).filter(
        models.SugerenciaIA.id_activo.in_(ids_activos)
    ).all()

    sug_por_activo: dict[int, list[models.SugerenciaIA]] = {}
    for s in todas_sugerencias:
        sug_por_activo.setdefault(s.id_activo, []).append(s)

    porcentajes = []
    acumulado_areas: dict[str, dict] = {}

    for activo in activos:
        log_act = next((l for l in logs if l.registro_id == activo.id_activo), None)
        metricas_log = log_act.valor_nuevo if (log_act and log_act.valor_nuevo) else {}
        pct_act = _calcular_cumplimiento_actualizado(
            metricas_log,
            sug_por_activo.get(activo.id_activo, [])
        )
        porcentajes.append(pct_act)

        nombres_areas = [rel.area.nombre for rel in activo.areas if rel.area]
        if not nombres_areas and activo.area_organizativa:
            nombres_areas = [a.strip() for a in activo.area_organizativa.split(",") if a.strip()]

        for nom_area in nombres_areas:
            if nom_area not in acumulado_areas:
                acumulado_areas[nom_area] = {"suma_pct": 0.0, "evaluaciones": 0}
            acumulado_areas[nom_area]["suma_pct"] += pct_act
            acumulado_areas[nom_area]["evaluaciones"] += 1

    cumplimiento_prom = round(sum(porcentajes) / len(porcentajes), 2) if porcentajes else 0.0

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

    sugerencias_pendientes = sum(1 for s in todas_sugerencias if not s.resuelta)

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

    todas_sug = db.query(models.SugerenciaIA).filter(
        models.SugerenciaIA.id_activo.in_(ids_activos)
    ).all() if ids_activos else []
    sug_por_activo: dict[int, list[models.SugerenciaIA]] = {}
    for s in todas_sug:
        sug_por_activo.setdefault(s.id_activo, []).append(s)

    lista = []
    for activo, eval_pol, politica in resultados:
        metricas = metricas_por_activo.get(activo.id_activo, {})
        cumplimiento = _calcular_cumplimiento_actualizado(
            metricas,
            sug_por_activo.get(activo.id_activo, []),
            fallback_cumple=bool(eval_pol and eval_pol.cumplimiento)
        )
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
    ).order_by(models.SugerenciaIA.resuelta.asc(), models.SugerenciaIA.id_sugerencia.asc()).all()

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
                "fecha_generacion": s.fecha_generacion,
                "resuelta": bool(s.resuelta),
                "fecha_resolucion": s.fecha_resolucion
            }
            for s in sugerencias
        ]
    }


def listar_historial_auditoria(db: Session, id_usuario: int, limit: int = 50, es_admin: bool = False):
    query = db.query(models.HistorialAuditoria)
    if not es_admin:
        query = query.filter(models.HistorialAuditoria.id_usuario == id_usuario)
    return query.order_by(models.HistorialAuditoria.id_log.desc()).limit(limit).all()