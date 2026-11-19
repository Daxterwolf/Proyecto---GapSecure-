import re
import json
import hashlib
import unicodedata
from io import BytesIO
from pypdf import PdfReader
from sqlalchemy.orm import Session
import models

STOPWORDS = {
    "de", "la", "el", "los", "las", "y", "o", "en", "para", "con", "por", "a", "un", "una",
    "unos", "unas", "del", "al", "se", "su", "sus", "que", "como", "más", "pero", "si", "no",
    "sobre", "entre", "hasta", "desde", "durante", "mediante", "según", "sin", "deben", "debe",
    "información", "seguridad", "organización", "sistema", "sistemas", "control", "controles",
    "otros", "asociados", "uso", "gestión", "política", "políticas", "procedimientos",
    "definir", "aplicar", "mantener", "establecer", "asegurar", "garantizar", "mediante"
}

# Diccionario de sinónimos técnicos ISO 27001 para mejorar la precisión semántica
SINONIMOS_ISO = {
    "respaldo": ["backup", "copia", "copias", "recuperacion", "restauracion"],
    "copias": ["backup", "respaldo", "respaldos", "recuperacion"],
    "autenticacion": ["mfa", "2fa", "contrasena", "credenciales", "token", "biometria"],
    "contrasenas": ["clave", "claves", "credenciales", "autenticacion", "mfa"],
    "cifrado": ["encriptacion", "criptografia", "tls", "ssl", "aes", "sha"],
    "criptografia": ["cifrado", "encriptacion", "certificados", "llaves", "claves"],
    "vulnerabilidades": ["parches", "pentesting", "escaneo", "cve", "actualizaciones"],
    "incidentes": ["brechas", "eventos", "respuesta", "csirt", "forense", "notificacion"],
    "proveedores": ["terceros", "contratos", "sla", "outsourcing", "subcontratistas"],
    "continuidad": ["bcp", "drp", "desastres", "contingencia", "disponibilidad", "rto", "rpo"],
    "fisica": ["perimetro", "cctv", "camaras", "biometrico", "guardias", "instalaciones"],
    "desarrollo": ["sdlc", "codigo", "owasp", "pruebas", "repositorio", "git"],
    "registros": ["logs", "bitacora", "auditoria", "monitoreo", "siem", "trazabilidad"],
    "privacidad": ["pii", "datos personales", "gdpr", "ley 19628", "titulares"],
}

MAPEO_AREAS_POR_CONTROL = {
    "A.5.1": ("Seguridad de la Información", ["Dirección y Gerencia"]),
    "A.5.19": ("Gestión de Proveedores", ["Legal y Cumplimiento Normativo", "Compras y Adquisiciones"]),
    "A.5.20": ("Legal y Cumplimiento Normativo", ["Gestión de Proveedores", "Compras y Adquisiciones"]),
    "A.5.21": ("Compras y Adquisiciones", ["Gestión de Proveedores", "Tecnologías de la Información (TI)"]),
    "A.5.29": ("Continuidad del Negocio", ["Tecnologías de la Información (TI)", "Operaciones y Soporte Técnico"]),
    "A.5.30": ("Continuidad del Negocio", ["Tecnologías de la Información (TI)"]),
    "A.6.1": ("Recursos Humanos", ["Seguridad de la Información"]),
    "A.6.2": ("Recursos Humanos", ["Legal y Cumplimiento Normativo"]),
    "A.6.3": ("Recursos Humanos", ["Seguridad de la Información"]),
    "A.6.5": ("Recursos Humanos", ["Tecnologías de la Información (TI)"]),
    "A.7.1": ("Seguridad Física", ["Infraestructura y Servicios Generales"]),
    "A.7.2": ("Seguridad Física", ["Infraestructura y Servicios Generales"]),
    "A.7.4": ("Seguridad Física", ["Infraestructura y Servicios Generales"]),
    "A.8.8": ("Tecnologías de la Información (TI)", ["Seguridad de la Información"]),
    "A.8.13": ("Operaciones y Soporte Técnico", ["Tecnologías de la Información (TI)", "Continuidad del Negocio"]),
    "A.8.15": ("Seguridad de la Información", ["Tecnologías de la Información (TI)", "Auditoría Interna y Gestión de Riesgos"]),
    "A.8.25": ("Desarrollo de Software", ["Seguridad de la Información"]),
    "A.8.28": ("Desarrollo de Software", ["Seguridad de la Información"]),
}


def normalizar_texto(texto: str) -> str:
    """Elimina tildes y pasa a minúsculas para evitar falsos negativos por acentuación."""
    texto = texto.lower()
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def inferir_categoria_anexo(codigo_clausula: str) -> str:
    if codigo_clausula.startswith("A.5"):
        return "A.5 Controles organizacionales"
    if codigo_clausula.startswith("A.6"):
        return "A.6 Controles de personas"
    if codigo_clausula.startswith("A.7"):
        return "A.7 Controles físicos"
    if codigo_clausula.startswith("A.8"):
        return "A.8 Controles tecnológicos"
    return "A.5 Controles organizacionales"


def inferir_responsables_control(codigo_clausula: str, area_principal_doc: str) -> tuple[str, list[str]]:
    if codigo_clausula in MAPEO_AREAS_POR_CONTROL:
        return MAPEO_AREAS_POR_CONTROL[codigo_clausula]
    if codigo_clausula.startswith("A.6"):
        return ("Recursos Humanos", ["Seguridad de la Información"])
    if codigo_clausula.startswith("A.7"):
        return ("Seguridad Física", ["Infraestructura y Servicios Generales"])
    if codigo_clausula.startswith("A.8"):
        return ("Tecnologías de la Información (TI)", ["Seguridad de la Información"])
    return (area_principal_doc or "Área no identificada", ["Seguridad de la Información"])


def extraer_texto_pdf(contenido_bytes: bytes) -> str:
    stream = BytesIO(contenido_bytes)
    reader = PdfReader(stream)
    texto = ""
    for pagina in reader.pages:
        t = pagina.extract_text()
        if t:
            texto += t + "\n"
    return texto


def extraer_terminos_clave(titulo: str, descripcion: str | None) -> list[str]:
    texto_base = normalizar_texto(f"{titulo} {descripcion or ''}")
    stopwords_norm = {normalizar_texto(s) for s in STOPWORDS}
    palabras = re.findall(r'\b[a-z0-9]{4,}\b', texto_base)
    terminos = []
    for p in palabras:
        if p not in stopwords_norm and p not in terminos:
            terminos.append(p)
    return terminos


def generar_hash_auditoria(payload: dict) -> str:
    contenido_serializado = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(contenido_serializado).hexdigest()


def analizar_pdf_iso27001(
    db: Session,
    id_usuario: int,
    nombre_archivo: str,
    contenido_bytes: bytes,
    areas_seleccionadas: list[str] | None = None,
    area_principal: str | None = None,
    confidencialidad: int = 4,
    integridad: int = 4,
    disponibilidad: int = 3
) -> dict:
    # 1. Extraer y normalizar texto del PDF
    texto_pdf = extraer_texto_pdf(contenido_bytes)
    if not texto_pdf.strip():
        raise ValueError("El archivo PDF no contiene texto extraíble.")

    texto_norm = normalizar_texto(texto_pdf)

    # Normalizar áreas seleccionadas
    lista_areas = [a.strip() for a in (areas_seleccionadas or []) if a.strip()]
    if not lista_areas:
        lista_areas = [area_principal.strip()] if area_principal else ["Área no identificada"]

    responsable_principal = (
        area_principal.strip()
        if area_principal and area_principal.strip() in lista_areas
        else lista_areas[0]
    )
    resumen_areas_texto = ", ".join(lista_areas)

    # 2. Obtener Política ISO 27001 y sus Cláusulas desde PostgreSQL
    politica = db.query(models.Politica).filter(
        models.Politica.codigo_norma.ilike("%27001%")
    ).first() or db.query(models.Politica).first()

    if not politica or not politica.clausulas:
        raise ValueError("No hay políticas o cláusulas ISO 27001 cargadas en la base de datos.")

    # 3. Obtener o crear categoría de activo por defecto
    categoria = db.query(models.CategoriaActivo).first()
    if not categoria:
        categoria = models.CategoriaActivo(
            nombre="Documentación e Inventario de Activos",
            descripcion="Activos documentales e inventarios analizados mediante PDF."
        )
        db.add(categoria)
        db.flush()

    # 4. Registrar el Activo evaluado
    nuevo_activo = models.Activo(
        id_categoria=categoria.id_categoria,
        id_propietario=id_usuario,
        nombre=f"Documento Auditado: {nombre_archivo}",
        area_organizativa=resumen_areas_texto[:255],
        descripcion=f"Documento PDF procesado ({len(texto_pdf)} caracteres). Responsable principal: {responsable_principal}.",
        nivel_confidencialidad=confidencialidad,
        nivel_integridad=integridad,
        nivel_disponibilidad=disponibilidad
    )
    db.add(nuevo_activo)
    db.flush()

    areas_db = db.query(models.AreaOrganizativa).filter(
        models.AreaOrganizativa.nombre.in_(lista_areas)
    ).all()
    for area_obj in areas_db:
        db.add(models.ActivoArea(
            id_activo=nuevo_activo.id_activo,
            id_area=area_obj.id_area,
            es_responsable_principal=(area_obj.nombre == responsable_principal)
        ))

    # Factor de exigencia según valoración CID (promedio 1..5 -> ajuste entre -0.08 y +0.08 en umbral)
    promedio_cid = (confidencialidad + integridad + disponibilidad) / 3.0
    ajuste_exigencia_cid = (promedio_cid - 3.0) * 0.04  # CID 5/5/5 exige +8% más densidad de evidencia

    umbral_cumple = min(0.55, max(0.25, 0.35 + ajuste_exigencia_cid))
    umbral_parcial = min(0.30, max(0.12, 0.18 + (ajuste_exigencia_cid * 0.5)))

    cumplen = 0
    parciales = 0
    no_cumplen = 0
    detalle_controles = []

    resumen_categorias = {
        "A.5 Controles organizacionales": {"total": 0, "cumplen": 0, "parciales": 0},
        "A.6 Controles de personas": {"total": 0, "cumplen": 0, "parciales": 0},
        "A.7 Controles físicos": {"total": 0, "cumplen": 0, "parciales": 0},
        "A.8 Controles tecnológicos": {"total": 0, "cumplen": 0, "parciales": 0},
    }

    metricas_por_area: dict[str, dict] = {}

    # 5. Evaluar cada cláusula del Anexo A con densidad + sinónimos + mención explícita de código
    for clausula in politica.clausulas:
        categoria_anexo = clausula.categoria_anexo or inferir_categoria_anexo(clausula.codigo_clausula)
        area_resp_ctrl, areas_colab_ctrl = inferir_responsables_control(
            clausula.codigo_clausula, responsable_principal
        )
        areas_ctrl_totales = list(dict.fromkeys([area_resp_ctrl] + areas_colab_ctrl))

        terminos = extraer_terminos_clave(clausula.titulo, clausula.descripcion)
        codigo_norm = normalizar_texto(clausula.codigo_clausula)

        # Detectar si el documento cita explícitamente el código de control (ej. "a.5.1" o "a.8.28")
        cita_codigo_explicito = bool(re.search(rf'\b{re.escape(codigo_norm)}\b', texto_norm))

        coincidencias = []
        frecuencia_total = 0
        for t in terminos:
            variantes = [t] + SINONIMOS_ISO.get(t, [])
            hits_termino = 0
            for var in variantes:
                hits_termino += len(re.findall(rf'\b{re.escape(var)}\b', texto_norm))
            if hits_termino > 0:
                coincidencias.append(t)
                frecuencia_total += min(hits_termino, 4)  # tope de 4 repeticiones por término

        ratio_cobertura = (len(coincidencias) / len(terminos)) if terminos else 0.0
        # Bonificación si hay profundidad (múltiples menciones) o cita explícita del control
        score_evidencia = ratio_cobertura + (0.25 if cita_codigo_explicito else 0.0) + min(0.15, frecuencia_total * 0.015)

        if cita_codigo_explicito or (len(coincidencias) >= 2 and score_evidencia >= umbral_cumple):
            estado = "CUMPLE"
            puntos = 1.0
            cumplen += 1
            hallazgo = (
                f"Evidencia sólida ({', '.join(coincidencias[:5])}"
                f"{'; referencia explícita ' + clausula.codigo_clausula if cita_codigo_explicito else ''})."
            )
            accion = None
        elif len(coincidencias) >= 2 and score_evidencia >= umbral_parcial:
            estado = "CUMPLE_PARCIAL"
            puntos = 0.5
            parciales += 1
            hallazgo = f"Evidencia parcial detectada (términos: {', '.join(coincidencias[:4])})."
            accion = (
                f"[{area_resp_ctrl}] Reforzar control {clausula.codigo_clausula} ({clausula.titulo}): "
                f"{clausula.descripcion or 'Completar documentación según ISO/IEC 27001:2022.'}"
            )
        else:
            estado = "NO_CUMPLE"
            puntos = 0.0
            no_cumplen += 1
            hallazgo = (
                "Sin evidencia suficiente en el documento."
                if not coincidencias
                else f"Mención aislada insuficiente ({', '.join(coincidencias)})."
            )
            accion = (
                f"[{area_resp_ctrl}] Implementar control {clausula.codigo_clausula} ({clausula.titulo}): "
                f"{clausula.descripcion or 'Definir y documentar procedimiento según ISO/IEC 27001:2022.'}"
            )

        if categoria_anexo in resumen_categorias:
            resumen_categorias[categoria_anexo]["total"] += 1
            if estado == "CUMPLE":
                resumen_categorias[categoria_anexo]["cumplen"] += 1
            elif estado == "CUMPLE_PARCIAL":
                resumen_categorias[categoria_anexo]["parciales"] += 1

        for area_nom in areas_ctrl_totales:
            if area_nom not in metricas_por_area:
                metricas_por_area[area_nom] = {"controles_asignados": 0, "puntos": 0.0, "brechas": 0}
            metricas_por_area[area_nom]["controles_asignados"] += 1
            metricas_por_area[area_nom]["puntos"] += puntos
            if estado != "CUMPLE":
                metricas_por_area[area_nom]["brechas"] += 1

        if estado != "CUMPLE":
            criticidad = (
                "Crítico"
                if estado == "NO_CUMPLE" and (confidencialidad + integridad + disponibilidad) >= 12
                else ("Alto" if estado == "NO_CUMPLE" else "Medio")
            )
            confianza = round(min(98.0, 62.0 + (score_evidencia * 45)), 2)

            sugerencia = models.SugerenciaIA(
                id_activo=nuevo_activo.id_activo,
                id_politica=politica.id_politica,
                recomendacion=accion,
                nivel_criticidad=criticidad,
                score_confianza=confianza,
                areas_involucradas=", ".join(areas_ctrl_totales)[:255]
            )
            db.add(sugerencia)

        detalle_controles.append({
            "codigo_clausula": clausula.codigo_clausula,
            "categoria_anexo": categoria_anexo,
            "titulo": clausula.titulo,
            "area_responsable": area_resp_ctrl,
            "areas_colaboradoras": areas_colab_ctrl,
            "estado": estado,
            "hallazgo": hallazgo,
            "accion_remediacion": accion
        })

    # 6. Calcular cumplimiento global
    total = len(politica.clausulas)
    porcentaje_cumplimiento = round(((cumplen * 1.0) + (parciales * 0.5)) / total * 100, 2)
    porcentaje_brecha = round(100.0 - porcentaje_cumplimiento, 2)

    eval_politica = models.ActivoPolitica(
        id_activo=nuevo_activo.id_activo,
        id_politica=politica.id_politica,
        cumplimiento=(porcentaje_cumplimiento >= 80.0)
    )
    db.add(eval_politica)

    # 7. Registrar riesgo si hay brecha > 20%
    if porcentaje_brecha > 20.0:
        nivel_r = "Alto" if porcentaje_brecha >= 50.0 else "Medio"
        riesgo_detectado = models.Riesgo(
            id_activo=nuevo_activo.id_activo,
            descripcion=f"Brecha de cumplimiento del {porcentaje_brecha}% frente a {politica.codigo_norma} ({no_cumplen} controles incumplidos).",
            impacto="Alto" if confidencialidad >= 4 else "Medio",
            probabilidad="Frecuente" if no_cumplen > (total / 2) else "Moderada",
            nivel_riesgo=nivel_r
        )
        db.add(riesgo_detectado)

    # 8. Registrar traza inmutable SHA-256
    datos_auditoria = {
        "id_activo": nuevo_activo.id_activo,
        "archivo": nombre_archivo,
        "area_principal": responsable_principal,
        "areas_involucradas": lista_areas,
        "valoracion_cid": {"c": confidencialidad, "i": integridad, "d": disponibilidad},
        "porcentaje_cumplimiento": porcentaje_cumplimiento,
        "cumplen": cumplen,
        "parciales": parciales,
        "no_cumplen": no_cumplen
    }
    log_auditoria = models.HistorialAuditoria(
        id_usuario=id_usuario,
        tabla_afectada="activo_politica",
        registro_id=nuevo_activo.id_activo,
        accion="INSERT",
        valor_anterior=None,
        valor_nuevo=datos_auditoria,
        hash_mod=generar_hash_auditoria(datos_auditoria)
    )
    db.add(log_auditoria)
    db.commit()

    cumplimiento_departamental = [
        {
            "area": area_nom,
            "controles_asignados": d["controles_asignados"],
            "brechas_detectadas": d["brechas"],
            "porcentaje_cumplimiento": round((d["puntos"] / d["controles_asignados"]) * 100, 1)
            if d["controles_asignados"] > 0 else 0.0,
        }
        for area_nom, d in sorted(
            metricas_por_area.items(),
            key=lambda item: (item[1]["puntos"] / max(1, item[1]["controles_asignados"]))
        )
    ]

    return {
        "id_activo": nuevo_activo.id_activo,
        "archivo_analizado": nombre_archivo,
        "norma": f"{politica.codigo_norma} - {politica.titulo_norma}",
        "area_principal": responsable_principal,
        "areas_seleccionadas": lista_areas,
        "resumen_gap_analysis": {
            "total_controles_evaluados": total,
            "cumplen": cumplen,
            "cumplen_parcial": parciales,
            "no_cumplen": no_cumplen,
            "porcentaje_cumplimiento": f"{porcentaje_cumplimiento}%",
            "porcentaje_brecha": f"{porcentaje_brecha}%"
        },
        "distribucion_anexo_a": resumen_categorias,
        "cumplimiento_por_area": cumplimiento_departamental,
        "detalle_controles": detalle_controles
    }