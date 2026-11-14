import re
import json
import hashlib
from io import BytesIO
from pypdf import PdfReader
from sqlalchemy.orm import Session
import models

STOPWORDS = {
    "de", "la", "el", "los", "las", "y", "o", "en", "para", "con", "por", "a", "un", "una",
    "unos", "unas", "del", "al", "se", "su", "sus", "que", "como", "más", "pero", "si", "no",
    "sobre", "entre", "hasta", "desde", "durante", "mediante", "según", "sin", "deben", "debe",
    "información", "seguridad", "organización", "sistema", "sistemas", "control", "controles",
    "otros", "asociados", "uso", "gestión", "política", "políticas", "procedimientos"
}

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
    texto_base = f"{titulo} {descripcion or ''}".lower()
    palabras = re.findall(r'\b[a-záéíóúñ]{4,}\b', texto_base)
    terminos = []
    for p in palabras:
        if p not in STOPWORDS and p not in terminos:
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
    area_organizativa: str = "Tecnologías de la Información",
    confidencialidad: int = 4,
    integridad: int = 4,
    disponibilidad: int = 3
) -> dict:
    # 1. Extraer texto del PDF
    texto_pdf = extraer_texto_pdf(contenido_bytes)
    if not texto_pdf.strip():
        raise ValueError("El archivo PDF no contiene texto extraíble.")

    texto_lower = texto_pdf.lower()

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

    # 4. Registrar el Activo evaluado (EP-02)
    nuevo_activo = models.Activo(
        id_categoria=categoria.id_categoria,
        id_propietario=id_usuario,
        nombre=f"Documento Auditado: {nombre_archivo}",
        area_organizativa=area_organizativa,
        descripcion=f"Documento PDF procesado automáticamente ({len(texto_pdf)} caracteres).",
        nivel_confidencialidad=confidencialidad,
        nivel_integridad=integridad,
        nivel_disponibilidad=disponibilidad
    )
    db.add(nuevo_activo)
    db.flush()

    cumplen = 0
    parciales = 0
    no_cumplen = 0
    detalle_controles = []

    # 5. Evaluar cada cláusula del Anexo A (EP-03 & EP-04)
    for clausula in politica.clausulas:
        terminos = extraer_terminos_clave(clausula.titulo, clausula.descripcion)
        coincidencias = [t for t in terminos if re.search(rf'\b{re.escape(t)}\b', texto_lower)]
        ratio = len(coincidencias) / len(terminos) if terminos else 0

        if len(coincidencias) >= 2 and ratio >= 0.30:
            estado = "CUMPLE"
            cumplen += 1
            hallazgo = f"Evidencia encontrada ({', '.join(coincidencias[:5])})."
            accion = None
        elif len(coincidencias) >= 1:
            estado = "CUMPLE_PARCIAL"
            parciales += 1
            hallazgo = f"Evidencia parcial detectada (términos: {', '.join(coincidencias)})."
            accion = f"Reforzar control {clausula.codigo_clausula} ({clausula.titulo}): {clausula.descripcion or 'Completar documentación según ISO/IEC 27001:2022.'}"
        else:
            estado = "NO_CUMPLE"
            no_cumplen += 1
            hallazgo = "No se detectó evidencia documental en el PDF."
            accion = f"Implementar control {clausula.codigo_clausula} ({clausula.titulo}): {clausula.descripcion or 'Definir y documentar procedimiento según ISO/IEC 27001:2022.'}"

        # Registrar SugerenciaIA para brechas detectadas
        if estado != "CUMPLE":
            criticidad = "Crítico" if estado == "NO_CUMPLE" and (confidencialidad + integridad + disponibilidad) >= 11 else (
                "Alto" if estado == "NO_CUMPLE" else "Medio"
            )
            confianza = round(min(98.0, 65.0 + (ratio * 100)), 2)

            sugerencia = models.SugerenciaIA(
                id_activo=nuevo_activo.id_activo,
                id_politica=politica.id_politica,
                recomendacion=accion,
                nivel_criticidad=criticidad,
                score_confianza=confianza
            )
            db.add(sugerencia)

        detalle_controles.append({
            "codigo_clausula": clausula.codigo_clausula,
            "titulo": clausula.titulo,
            "estado": estado,
            "hallazgo": hallazgo,
            "accion_remediacion": accion
        })

    # 6. Calcular cumplimiento global y registrar en activo_politica
    total = len(politica.clausulas)
    porcentaje_cumplimiento = round(((cumplen * 1.0) + (parciales * 0.5)) / total * 100, 2)
    porcentaje_brecha = round(100.0 - porcentaje_cumplimiento, 2)

    eval_politica = models.ActivoPolitica(
        id_activo=nuevo_activo.id_activo,
        id_politica=politica.id_politica,
        cumplimiento=(porcentaje_cumplimiento >= 80.0)
    )
    db.add(eval_politica)

    # 7. Si hay brechas significativas, registrar riesgo asociado en la tabla riesgo
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

    # 8. Registrar traza inmutable en historial_auditoria con SHA-256
    datos_auditoria = {
        "id_activo": nuevo_activo.id_activo,
        "archivo": nombre_archivo,
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

    return {
        "id_activo": nuevo_activo.id_activo,
        "archivo_analizado": nombre_archivo,
        "norma": f"{politica.codigo_norma} - {politica.titulo_norma}",
        "resumen_gap_analysis": {
            "total_controles_evaluados": total,
            "cumplen": cumplen,
            "cumplen_parcial": parciales,
            "no_cumplen": no_cumplen,
            "porcentaje_cumplimiento": f"{porcentaje_cumplimiento}%",
            "porcentaje_brecha": f"{porcentaje_brecha}%"
        },
        "detalle_controles": detalle_controles
    }