import os
import re
import json
import time
import hashlib
import unicodedata
from io import BytesIO
from pypdf import PdfReader
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from google import genai
from google.genai import types
import models

load_dotenv(dotenv_path="../.env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()

STOPWORDS = {
    "de", "la", "el", "los", "las", "y", "o", "en", "para", "con", "por", "a", "un", "una",
    "unos", "unas", "del", "al", "se", "su", "sus", "que", "como", "más", "pero", "si", "no",
    "sobre", "entre", "hasta", "desde", "durante", "mediante", "según", "sin", "deben", "debe",
    "información", "seguridad", "organización", "sistema", "sistemas", "control", "controles",
    "otros", "asociados", "uso", "gestión", "política", "políticas", "procedimientos",
    "definir", "aplicar", "mantener", "establecer", "asegurar", "garantizar", "mediante",
    "estado", "evidencia", "implementado", "cumplimiento", "anexo", "iso", "27001"
}

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

INDICADORES_NO_APPLICABLE = [
    "no aplica",
    "excluido",
    "excluida",
]

INDICADORES_NO_CUMPLE = [
    "no implementado",
    "no implementada",
    "sin implementar",
    "no cumple",
    "incumple",
    "incumplimiento",
    "inexistente",
    "no existe",
    "no se cuenta con",
    "no cuenta con",
    "carece de",
    "sin evidencia",
    "no documentado",
    "no documentada",
    "no definido",
    "no definida",
    "pendiente de implementacion",
    "brecha critica",
    "brecha alta",
    "0%",
]

INDICADORES_PARCIAL = [
    "parcial",
    "cumplimiento parcial",
    "cumple parcialmente",
    "parcialmente implementado",
    "parcialmente implementada",
    "en proceso",
    "en desarrollo",
    "en curso",
    "en revision",
    "en borrador",
    "borrador",
    "preliminar",
    "informal",
    "sin formalizar",
    "requiere mejora",
    "requiere actualizacion",
    "desactualizado",
    "desactualizada",
    "solo en algunas areas",
    "50%",
]

INDICADORES_CUMPLE = [
    "implementado",
    "implementada",
    "cumple totalmente",
    "cumplimiento total",
    "operativo",
    "operativa",
    "vigente",
    "formalizado",
    "formalizada",
    "conforme",
    "100%",
]

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
    """Elimina tildes, unifica caracteres griegos homógrafos (ej. Α -> A) y pasa a minúsculas."""
    texto = texto.replace("\u0391", "A").replace("\u03b1", "a")
    texto = texto.lower()
    texto = re.sub(r'\s+', ' ', texto)
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


def aislar_seccion_detalle_soa(texto_norm: str) -> str:
    inicio_sec3 = re.search(r'3\.\s*detalle de controles', texto_norm)
    texto_trabajo = texto_norm[inicio_sec3.start():] if inicio_sec3 else texto_norm

    fin_sec3 = re.search(r'4\.\s*controles excluidos|5\.\s*plan de tratamiento', texto_trabajo)
    if fin_sec3:
        texto_trabajo = texto_trabajo[:fin_sec3.start()]

    return texto_trabajo


def extraer_estado_control_soa(texto_detalle: str, codigo_norm: str) -> tuple[str | None, str | None]:
    matches = list(re.finditer(rf'\b{re.escape(codigo_norm)}\b', texto_detalle))
    if not matches:
        return None, None

    match = matches[0]
    pre_ventana = texto_detalle[max(0, match.start() - 160):match.start()]
    codigos_previos = re.findall(r'\ba\.[5-8]\.\d{1,2}\b', pre_ventana)

    post_texto = texto_detalle[match.end():min(len(texto_detalle), match.end() + 950)]

    codigos_consecutivos = re.match(r'^(?:\s*a\.[5-8]\.\d{1,2}\b)+', post_texto)
    if codigos_consecutivos:
        resto_bloque = post_texto[codigos_consecutivos.end():]
        siguiente_grupo = re.search(r'\ba\.[5-8]\.\d{1,2}\b', resto_bloque)
        if siguiente_grupo:
            resto_bloque = resto_bloque[:siguiente_grupo.start()]

        estados_en_bloque = re.findall(
            r'\b(no implementado|no aplica|parcial|implementado)\b',
            resto_bloque
        )
        indice_en_grupo = len(codigos_previos)
        if estados_en_bloque and indice_en_grupo < len(estados_en_bloque):
            estado_tok = estados_en_bloque[indice_en_grupo]
            return estado_tok, resto_bloque[:220]

    siguiente_ctrl = re.search(r'\ba\.[5-8]\.\d{1,2}\b', post_texto)
    fragmento = post_texto[:siguiente_ctrl.start()] if siguiente_ctrl else post_texto

    if any(ind in fragmento for ind in INDICADORES_NO_APPLICABLE):
        return "no aplica", fragmento
    if any(ind in fragmento for ind in INDICADORES_NO_CUMPLE):
        return "no implementado", fragmento
    if any(ind in fragmento for ind in INDICADORES_PARCIAL):
        return "parcial", fragmento
    if any(ind in fragmento for ind in INDICADORES_CUMPLE):
        return "implementado", fragmento

    return "indeterminado", fragmento


def generar_hash_auditoria(payload: dict) -> str:
    contenido_serializado = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(contenido_serializado).hexdigest()


# ==============================================================================
# MOTOR DE INTELIGENCIA ARTIFICIAL GENERATIVA (GOOGLE GEMINI API CON CASCADA)
# ==============================================================================
def consultar_gemini_auditoria_iso27001(
    texto_pdf: str,
    clausulas: list[models.Clausula],
    areas_seleccionadas: list[str],
    area_principal: str,
    confidencialidad: int,
    integridad: int,
    disponibilidad: int,
) -> tuple[dict[str, dict] | None, str | None]:
    """
    Evalúa el texto real del documento PDF contra los controles del Anexo A de ISO/IEC 27001:2022
    usando Google Gemini con timeout de 75s, reintentos y modelos vigentes en cascada.
    Retorna (mapa_resultados, modelo_efectivo) o (None, None) si falla por completo.
    """
    if not GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY no configurada en .env. Ejecutando motor heurístico de respaldo.", flush=True)
        return None, None

    modelos_candidatos = list(dict.fromkeys([
        "gemini-3.5-flash-lite",
        GEMINI_MODEL,
        "gemini-3.8-flash",
    ]))

    client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options={"timeout": 75},
    )

    catalogo_resumido = "\n".join(
        f"- {c.codigo_clausula}: {c.titulo}"
        for c in clausulas
    )
    texto_recortado = texto_pdf[:22000]

    prompt = f"""
Eres un Auditor Líder Certificado en ISO/IEC 27001:2022 (SGSI).
Analiza el siguiente documento PDF proporcionado por la organización y evalúa su nivel de cumplimiento frente a los 93 controles del Anexo A listados abajo.

CONTEXTO DEL ACTIVO EVALUADO:
- Área Responsable Principal: {area_principal}
- Áreas Organizativas Involucradas: {", ".join(areas_seleccionadas)}
- Valoración CID (escala 1 a 5): Confidencialidad={confidencialidad}, Integridad={integridad}, Disponibilidad={disponibilidad}

INSTRUCCIONES DE EVALUACIÓN (sé conciso en cada campo para optimizar velocidad):
1. Revisa rigurosamente la evidencia real contenida en el texto del documento.
2. Si el documento es una Declaración de Aplicabilidad (SoA) o matriz de controles, respeta los estados declarados ("Implementado", "Parcial", "No implementado", "No aplica").
3. Si el documento es narrativa/política/informe, clasifica cada control como "CUMPLE", "CUMPLE_PARCIAL", "NO_CUMPLE" o "NO_APLICA".
4. Para "NO_CUMPLE" o "CUMPLE_PARCIAL", redacta una recomendación técnica breve y accionable (máximo 1 oración).
5. Asigna "score_confianza" entre 70.0 y 99.0.

CATÁLOGO OFICIAL DE CONTROLES ANEXO A (ISO/IEC 27001:2022):
{catalogo_resumido}

TEXTO EXTRAÍDO DEL DOCUMENTO PDF:
\"\"\"
{texto_recortado}
\"\"\"

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{{
  "evaluaciones": [
    {{
      "codigo_clausula": "A.5.1",
      "estado": "CUMPLE | CUMPLE_PARCIAL | NO_CUMPLE | NO_APLICA",
      "hallazgo": "Explicación técnica breve (1 oración)",
      "recomendacion": "Acción de remediación breve si NO_CUMPLE/CUMPLE_PARCIAL, o null si cumple",
      "criticidad": "Crítico | Alto | Medio | Bajo",
      "score_confianza": 92.5
    }}
  ]
}}
"""

    for modelo_actual in modelos_candidatos:
        for intento in range(2):
            try:
                print(f"🤖 Consultando IA Generativa ({modelo_actual}, intento {intento + 1}/2)...", flush=True)
                response = client.models.generate_content(
                    model=modelo_actual,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.15,
                    ),
                )

                if not response or not response.text:
                    continue

                data = json.loads(response.text)
                evaluaciones_lista = data.get("evaluaciones", [])
                if not isinstance(evaluaciones_lista, list) or len(evaluaciones_lista) == 0:
                    continue

                mapa_resultados: dict[str, dict] = {}
                for item in evaluaciones_lista:
                    cod = str(item.get("codigo_clausula", "")).strip().upper()
                    if cod:
                        mapa_resultados[cod] = item

                print(f"✅ Auditoría ejecutada con IA Generativa ({modelo_actual}): {len(mapa_resultados)} controles evaluados.", flush=True)
                return mapa_resultados, modelo_actual

            except Exception as e:
                err_str = str(e)
                if (
                    "503" in err_str
                    or "UNAVAILABLE" in err_str
                    or "429" in err_str
                    or "timeout" in err_str.lower()
                    or "timed out" in err_str.lower()
                ):
                    espera = 2
                    print(f"⏳ {modelo_actual} saturado o lento (intento {intento + 1}/2), esperando {espera}s...", flush=True)
                    time.sleep(espera)
                    continue
                print(f"⚠️ Modelo {modelo_actual} no disponible ({e}), probando siguiente...", flush=True)
                break

    print("⚠️ Todos los modelos Gemini estuvieron temporalmente saturados. Activando respaldo determinístico.", flush=True)
    return None, None


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
    texto_detalle_soa = aislar_seccion_detalle_soa(texto_norm)

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

    # 3. Intentar evaluación con Inteligencia Artificial Generativa (Gemini)
    evaluacion_ia_mapa, modelo_efectivo = consultar_gemini_auditoria_iso27001(
        texto_pdf=texto_pdf,
        clausulas=politica.clausulas,
        areas_seleccionadas=lista_areas,
        area_principal=responsable_principal,
        confidencialidad=confidencialidad,
        integridad=integridad,
        disponibilidad=disponibilidad,
    )
    motor_utilizado = (
        f"IA Generativa ({modelo_efectivo})"
        if evaluacion_ia_mapa and modelo_efectivo
        else "Motor Heurístico ISO-27001 (Respaldo)"
    )

    # 4. Obtener o crear categoría de activo por defecto
    categoria = db.query(models.CategoriaActivo).first()
    if not categoria:
        categoria = models.CategoriaActivo(
            nombre="Documentación e Inventario de Activos",
            descripcion="Activos documentales e inventarios analizados mediante PDF."
        )
        db.add(categoria)
        db.flush()

    # 5. Registrar el Activo evaluado
    nuevo_activo = models.Activo(
        id_categoria=categoria.id_categoria,
        id_propietario=id_usuario,
        nombre=f"Documento Auditado: {nombre_archivo}",
        area_organizativa=resumen_areas_texto[:255],
        descripcion=f"Documento PDF procesado con {motor_utilizado} ({len(texto_pdf)} caracteres). Responsable principal: {responsable_principal}.",
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

    promedio_cid = (confidencialidad + integridad + disponibilidad) / 3.0
    ajuste_exigencia_cid = (promedio_cid - 3.0) * 0.03

    umbral_cumple = min(0.72, max(0.45, 0.56 + ajuste_exigencia_cid))
    umbral_parcial = min(0.44, max(0.24, 0.32 + (ajuste_exigencia_cid * 0.5)))

    cumplen = 0
    parciales = 0
    no_cumplen = 0
    excluidos = 0
    detalle_controles = []

    resumen_categorias = {
        "A.5 Controles organizacionales": {"total": 0, "cumplen": 0, "parciales": 0},
        "A.6 Controles de personas": {"total": 0, "cumplen": 0, "parciales": 0},
        "A.7 Controles físicos": {"total": 0, "cumplen": 0, "parciales": 0},
        "A.8 Controles tecnológicos": {"total": 0, "cumplen": 0, "parciales": 0},
    }

    metricas_por_area: dict[str, dict] = {}

    # 6. Consolidar evaluación por cada cláusula del Anexo A
    for clausula in politica.clausulas:
        categoria_anexo = clausula.categoria_anexo or inferir_categoria_anexo(clausula.codigo_clausula)
        area_resp_ctrl, areas_colab_ctrl = inferir_responsables_control(
            clausula.codigo_clausula, responsable_principal
        )
        areas_ctrl_totales = list(dict.fromkeys([area_resp_ctrl] + areas_colab_ctrl))
        codigo_upper = clausula.codigo_clausula.strip().upper()

        ia_item = evaluacion_ia_mapa.get(codigo_upper) if evaluacion_ia_mapa else None

        # --- RAMA 1: EVALUACIÓN GENERADA POR GEMINI IA ---
        if ia_item and ia_item.get("estado") in ("CUMPLE", "CUMPLE_PARCIAL", "NO_CUMPLE", "NO_APLICA"):
            estado = ia_item["estado"]
            hallazgo = str(ia_item.get("hallazgo") or f"Evaluado por {modelo_efectivo}.")
            rec_ia = ia_item.get("recomendacion")

            if estado == "NO_APLICA":
                puntos = 0.0
                excluidos += 1
                accion = None
            elif estado == "CUMPLE":
                puntos = 1.0
                cumplen += 1
                accion = None
            elif estado == "CUMPLE_PARCIAL":
                puntos = 0.5
                parciales += 1
                accion = (
                    f"[{area_resp_ctrl}] {rec_ia}"
                    if rec_ia
                    else f"[{area_resp_ctrl}] Reforzar control {clausula.codigo_clausula} ({clausula.titulo}): {clausula.descripcion or 'Completar evidencia formal.'}"
                )
            else:  # NO_CUMPLE
                puntos = 0.0
                no_cumplen += 1
                accion = (
                    f"[{area_resp_ctrl}] {rec_ia}"
                    if rec_ia
                    else f"[{area_resp_ctrl}] Implementar control {clausula.codigo_clausula} ({clausula.titulo}): {clausula.descripcion or 'Definir y documentar procedimiento.'}"
                )

            crit_ia = str(ia_item.get("criticidad") or "").capitalize()
            if crit_ia in ("Critico", "Crítico"):
                criticidad = "Crítico"
            elif crit_ia in ("Alto", "Medio", "Bajo"):
                criticidad = crit_ia
            else:
                criticidad = (
                    "Crítico"
                    if estado == "NO_CUMPLE" and (confidencialidad + integridad + disponibilidad) >= 12
                    else ("Alto" if estado == "NO_CUMPLE" else "Medio")
                )

            try:
                confianza = round(min(99.0, max(70.0, float(ia_item.get("score_confianza", 88.5)))), 2)
            except (TypeError, ValueError):
                confianza = 88.5

        # --- RAMA 2: RESPALDO DETERMINÍSTICO SI NO HAY CONEXIÓN CON IA ---
        else:
            terminos = extraer_terminos_clave(clausula.titulo, clausula.descripcion)
            codigo_norm = normalizar_texto(clausula.codigo_clausula)

            estado_soa, fragmento_soa = extraer_estado_control_soa(texto_detalle_soa, codigo_norm)
            ambito_busqueda = fragmento_soa if fragmento_soa is not None else texto_norm

            coincidencias = []
            frecuencia_total = 0
            for t in terminos:
                variantes = [t] + SINONIMOS_ISO.get(t, [])
                hits_termino = 0
                for var in variantes:
                    hits_termino += len(re.findall(rf'\b{re.escape(var)}\b', ambito_busqueda))
                if hits_termino > 0:
                    coincidencias.append(t)
                    frecuencia_total += min(hits_termino, 3)

            ratio_cobertura = (len(coincidencias) / len(terminos)) if terminos else 0.0
            score_evidencia = ratio_cobertura + min(0.10, frecuencia_total * 0.012)

            if estado_soa is not None:
                if estado_soa == "no aplica":
                    estado = "NO_APLICA"
                    puntos = 0.0
                    excluidos += 1
                    hallazgo = f"Control {clausula.codigo_clausula} excluido con justificación en SoA (No aplica)."
                    accion = None
                elif estado_soa == "no implementado":
                    estado = "NO_CUMPLE"
                    puntos = 0.0
                    no_cumplen += 1
                    hallazgo = f"Control {clausula.codigo_clausula} declarado como No implementado (sin evidencia)."
                    accion = (
                        f"[{area_resp_ctrl}] Implementar control {clausula.codigo_clausula} ({clausula.titulo}): "
                        f"{clausula.descripcion or 'Definir y documentar procedimiento según ISO/IEC 27001:2022.'}"
                    )
                elif estado_soa == "parcial":
                    estado = "CUMPLE_PARCIAL"
                    puntos = 0.5
                    parciales += 1
                    hallazgo = f"Control {clausula.codigo_clausula} con implementación parcial o en borrador."
                    accion = (
                        f"[{area_resp_ctrl}] Reforzar control {clausula.codigo_clausula} ({clausula.titulo}): "
                        f"{clausula.descripcion or 'Completar y aprobar documentación según ISO/IEC 27001:2022.'}"
                    )
                elif estado_soa == "implementado":
                    estado = "CUMPLE"
                    puntos = 1.0
                    cumplen += 1
                    hallazgo = f"Control {clausula.codigo_clausula} implementado y respaldado con evidencia documental."
                    accion = None
                else:
                    estado = "CUMPLE_PARCIAL"
                    puntos = 0.5
                    parciales += 1
                    hallazgo = f"Control {clausula.codigo_clausula} citado sin estado concluyente."
                    accion = (
                        f"[{area_resp_ctrl}] Reforzar control {clausula.codigo_clausula} ({clausula.titulo}): "
                        f"{clausula.descripcion or 'Completar evidencia formal según ISO/IEC 27001:2022.'}"
                    )
            else:
                min_terminos_cumple = min(3, max(2, len(terminos)))
                if len(coincidencias) >= min_terminos_cumple and score_evidencia >= umbral_cumple:
                    estado = "CUMPLE"
                    puntos = 1.0
                    cumplen += 1
                    hallazgo = f"Evidencia semántica sólida ({', '.join(coincidencias[:5])})."
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

            criticidad = (
                "Crítico"
                if estado == "NO_CUMPLE" and (confidencialidad + integridad + disponibilidad) >= 12
                else ("Alto" if estado == "NO_CUMPLE" else "Medio")
            )
            confianza = round(min(98.0, 74.0 + (score_evidencia * 25)), 2)

        if estado != "NO_APLICA":
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

        if estado in ("NO_CUMPLE", "CUMPLE_PARCIAL"):
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

    # 7. Calcular cumplimiento global sobre controles aplicables
    total_catalogo = len(politica.clausulas)
    total_aplicables = max(1, total_catalogo - excluidos)
    porcentaje_cumplimiento = round(((cumplen * 1.0) + (parciales * 0.5)) / total_aplicables * 100, 2)
    porcentaje_brecha = round(100.0 - porcentaje_cumplimiento, 2)

    eval_politica = models.ActivoPolitica(
        id_activo=nuevo_activo.id_activo,
        id_politica=politica.id_politica,
        cumplimiento=(porcentaje_cumplimiento >= 80.0)
    )
    db.add(eval_politica)

    # 8. Registrar riesgo si hay brecha > 20%
    if porcentaje_brecha > 20.0:
        nivel_r = "Alto" if porcentaje_brecha >= 50.0 else "Medio"
        riesgo_detectado = models.Riesgo(
            id_activo=nuevo_activo.id_activo,
            descripcion=f"Brecha de cumplimiento del {porcentaje_brecha}% frente a {politica.codigo_norma} ({no_cumplen} controles incumplidos, {parciales} parciales).",
            impacto="Alto" if confidencialidad >= 4 else "Medio",
            probabilidad="Frecuente" if no_cumplen > (total_aplicables / 2) else "Moderada",
            nivel_riesgo=nivel_r
        )
        db.add(riesgo_detectado)

    # 9. Registrar traza inmutable SHA-256
    datos_auditoria = {
        "id_activo": nuevo_activo.id_activo,
        "archivo": nombre_archivo,
        "motor_analisis": motor_utilizado,
        "area_principal": responsable_principal,
        "areas_involucradas": lista_areas,
        "valoracion_cid": {"c": confidencialidad, "i": integridad, "d": disponibilidad},
        "porcentaje_cumplimiento": porcentaje_cumplimiento,
        "controles_aplicables": total_aplicables,
        "controles_excluidos": excluidos,
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
        "motor_analisis": motor_utilizado,
        "norma": f"{politica.codigo_norma} - {politica.titulo_norma}",
        "area_principal": responsable_principal,
        "areas_seleccionadas": lista_areas,
        "resumen_gap_analysis": {
            "total_controles_evaluados": total_aplicables,
            "controles_excluidos": excluidos,
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