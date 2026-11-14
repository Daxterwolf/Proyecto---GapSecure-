from database import SessionLocal
import models

CONTROLES_ANEXO_A = [
    # 5. Controles Organizacionales (37 controles)
    ("A.5.1", "Políticas para la seguridad de la información", "Definir, aprobar, publicar, comunicar y revisar políticas de seguridad de la información."),
    ("A.5.2", "Roles y responsabilidades de seguridad de la información", "Definir y asignar responsabilidades y autoridades de seguridad de la información."),
    ("A.5.3", "Segregación de funciones", "Separar funciones y áreas de responsabilidad en conflicto para reducir el riesgo de modificaciones no autorizadas."),
    ("A.5.4", "Responsabilidades de la dirección", "Exigir al personal que aplique la seguridad de la información conforme a las políticas establecidas."),
    ("A.5.5", "Contacto con las autoridades", "Establecer y mantener contacto con las autoridades pertinentes."),
    ("A.5.6", "Contacto con grupos de interés especial", "Mantener contacto con grupos de interés especial o foros profesionales de seguridad."),
    ("A.5.7", "Inteligencia de amenazas", "Recopilar y analizar información sobre amenazas de seguridad de la información."),
    ("A.5.8", "Seguridad de la información en la gestión de proyectos", "Integrar la seguridad de la información en la gestión de proyectos."),
    ("A.5.9", "Inventario de información y otros activos asociados", "Desarrollar y mantener un inventario de información y otros activos asociados, incluidos sus propietarios."),
    ("A.5.10", "Uso aceptable de la información y otros activos asociados", "Identificar, documentar e implementar reglas para el uso aceptable de la información y activos."),
    ("A.5.11", "Devolución de activos", "Devolver todos los activos de la organización tras el cambio o terminación de empleo o contrato."),
    ("A.5.12", "Clasificación de la información", "Clasificar la información según las necesidades de seguridad de confidencialidad, integridad y disponibilidad."),
    ("A.5.13", "Etiquetado de la información", "Desarrollar e implementar procedimientos para el etiquetado de la información conforme al esquema de clasificación."),
    ("A.5.14", "Transferencia de información", "Establecer reglas, procedimientos o acuerdos para todos los tipos de transferencia de información."),
    ("A.5.15", "Control de acceso", "Establecer e implementar reglas para controlar el acceso físico y lógico a la información y activos."),
    ("A.5.16", "Gestión de identidades", "Gestionar el ciclo de vida completo de las identidades."),
    ("A.5.17", "Información de autenticación", "Controlar la asignación y gestión de la información de autenticación mediante un proceso formal."),
    ("A.5.18", "Derechos de acceso", "Aprovisionar, revisar, modificar y revocar derechos de acceso de acuerdo con la política de control de acceso."),
    ("A.5.19", "Seguridad de la información en las relaciones con proveedores", "Definir e implementar procesos y procedimientos para gestionar los riesgos asociados al uso de productos o servicios de proveedores."),
    ("A.5.20", "Abordar la seguridad de la información en los acuerdos con proveedores", "Establecer y acordar requisitos de seguridad relevantes con cada proveedor."),
    ("A.5.21", "Gestión de la seguridad de la información en la cadena de suministro TIC", "Definir e implementar procesos para gestionar los riesgos de seguridad en la cadena de suministro TIC."),
    ("A.5.22", "Seguimiento, revisión y gestión de cambios de los servicios de proveedores", "Supervisar, revisar, evaluar y gestionar regularmente los cambios en las prácticas de seguridad de los proveedores."),
    ("A.5.23", "Seguridad de la información para el uso de servicios en la nube", "Establecer procesos para la adquisición, uso, gestión y salida de los servicios en la nube."),
    ("A.5.24", "Planificación y preparación de la gestión de incidentes de seguridad de la información", "Planificar y preparar la gestión de incidentes definiendo procesos, roles y responsabilidades."),
    ("A.5.25", "Evaluación y decisión sobre eventos de seguridad de la información", "Evaluar los eventos de seguridad y decidir si deben clasificarse como incidentes."),
    ("A.5.26", "Respuesta a incidentes de seguridad de la información", "Responder a los incidentes de seguridad de la información de acuerdo con los procedimientos documentados."),
    ("A.5.27", "Aprender de los incidentes de seguridad de la información", "Utilizar el conocimiento adquirido de los incidentes para fortalecer y mejorar los controles."),
    ("A.5.28", "Recopilación de evidencias", "Establecer e implementar procedimientos para la identificación, recopilación, adquisición y preservación de evidencias."),
    ("A.5.29", "Seguridad de la información durante una interrupción", "Planificar cómo mantener la seguridad de la información a un nivel adecuado durante una interrupción."),
    ("A.5.30", "Preparación de las TIC para la continuidad del negocio", "Planificar, implementar, mantener y probar la preparación de las TIC según los objetivos de continuidad del negocio."),
    ("A.5.31", "Requisitos legales, estatutarios, reglamentarios y contractuales", "Identificar, documentar y mantener actualizados los requisitos legales, reglamentarios y contractuales aplicables."),
    ("A.5.32", "Derechos de propiedad intelectual", "Implementar procedimientos adecuados para proteger los derechos de propiedad intelectual."),
    ("A.5.33", "Protección de registros", "Proteger los registros contra pérdida, destrucción, falsificación, acceso no autorizado y divulgación."),
    ("A.5.34", "Privacidad y protección de datos personales (PII)", "Identificar y cumplir los requisitos relativos a la preservación de la privacidad y protección de datos personales."),
    ("A.5.35", "Revisión independiente de la seguridad de la información", "Revisar de forma independiente el enfoque de gestión de seguridad a intervalos planificados."),
    ("A.5.36", "Cumplimiento de políticas, reglas y estándares para la seguridad de la información", "Revisar regularmente el cumplimiento de las políticas y estándares de seguridad."),
    ("A.5.37", "Procedimientos operativos documentados", "Documentar los procedimientos operativos de las instalaciones de procesamiento de información."),

    # 6. Controles de Personas (8 controles)
    ("A.6.1", "Selección", "Realizar verificaciones de antecedentes de todos los candidatos a incorporarse a la organización."),
    ("A.6.2", "Términos y condiciones de empleo", "Establecer las responsabilidades de seguridad en los acuerdos contractuales de empleo."),
    ("A.6.3", "Concienciación, educación y formación en seguridad de la información", "Proporcionar concienciación, educación y capacitación adecuada en seguridad al personal."),
    ("A.6.4", "Proceso disciplinario", "Formalizar y comunicar un proceso disciplinario para quienes cometan violaciones de seguridad."),
    ("A.6.5", "Responsabilidades tras la terminación o cambio de empleo", "Definir, hacer cumplir y comunicar las responsabilidades que permanecen vigentes tras finalizar el empleo."),
    ("A.6.6", "Acuerdos de confidencialidad o no divulgación", "Identificar, documentar, revisar regularmente y firmar acuerdos de confidencialidad."),
    ("A.6.7", "Trabajo remoto", "Implementar medidas de seguridad cuando el personal trabaja de forma remota para proteger la información."),
    ("A.6.8", "Notificación de eventos de seguridad de la información", "Proporcionar un mecanismo para que el personal informe oportuna y directamente eventos de seguridad."),

    # 7. Controles Físicos (14 controles)
    ("A.7.1", "Perímetros de seguridad física", "Definir y utilizar perímetros de seguridad para proteger áreas que contengan información y activos."),
    ("A.7.2", "Entrada física", "Proteger las áreas seguras mediante controles de entrada y puntos de acceso adecuados."),
    ("A.7.3", "Seguridad de oficinas, despachos e instalaciones", "Diseñar e implementar seguridad física para oficinas, salas e instalaciones."),
    ("A.7.4", "Monitorización de la seguridad física", "Monitorizar continuamente las instalaciones contra acceso físico no autorizado."),
    ("A.7.5", "Protección contra amenazas físicas y ambientales", "Diseñar e implementar protección contra amenazas físicas y ambientales como incendios, inundaciones o sismos."),
    ("A.7.6", "Trabajo en áreas seguras", "Diseñar e implementar medidas de seguridad para el trabajo dentro de áreas seguras."),
    ("A.7.7", "Escritorio limpio y pantalla limpia", "Definir y hacer cumplir reglas de escritorio limpio para papeles y medios extraíbles, y pantalla limpia."),
    ("A.7.8", "Emplazamiento y protección de equipos", "Ubicar y proteger los equipos para reducir los riesgos de amenazas ambientales y acceso no autorizado."),
    ("A.7.9", "Seguridad de los activos fuera de las instalaciones", "Proteger los activos ubicados fuera de las instalaciones de la organización."),
    ("A.7.10", "Medios de almacenamiento", "Gestionar los medios de almacenamiento a lo largo de su ciclo de vida de adquisición, uso, transporte y eliminación."),
    ("A.7.11", "Servicios de suministro", "Proteger las instalaciones de procesamiento contra fallos de energía y otras interrupciones de suministros."),
    ("A.7.12", "Seguridad del cableado", "Proteger los cables que transportan energía, datos o servicios de información contra interceptación o daños."),
    ("A.7.13", "Mantenimiento de equipos", "Mantener correctamente los equipos para asegurar la disponibilidad, integridad y confidencialidad."),
    ("A.7.14", "Eliminación o reutilización segura de equipos", "Verificar que cualquier dato sensible o software con licencia haya sido eliminado o sobrescrito antes de desechar equipos."),

    # 8. Controles Tecnológicos (34 controles)
    ("A.8.1", "Dispositivos de punto final de usuario", "Proteger la información almacenada, procesada o accesible a través de dispositivos de usuario final."),
    ("A.8.2", "Derechos de acceso privilegiado", "Restringir y controlar la asignación y el uso de derechos de acceso privilegiado."),
    ("A.8.3", "Restricción del acceso a la información", "Restringir el acceso a la información y a las funciones de los sistemas de aplicación conforme a la política."),
    ("A.8.4", "Acceso al código fuente", "Gestionar adecuadamente el acceso de lectura y escritura al código fuente, herramientas de desarrollo y bibliotecas."),
    ("A.8.5", "Autenticación segura", "Implementar tecnologías y procedimientos de autenticación segura basados en las restricciones de acceso."),
    ("A.8.6", "Gestión de la capacidad", "Monitorizar y ajustar el uso de los recursos de acuerdo con los requisitos de capacidad actuales y futuros."),
    ("A.8.7", "Protección contra malware", "Implementar protección contra malware respaldada por una adecuada concienciación del usuario."),
    ("A.8.8", "Gestión de vulnerabilidades técnicas", "Obtener información sobre vulnerabilidades técnicas, evaluar la exposición y tomar medidas adecuadas."),
    ("A.8.9", "Gestión de la configuración", "Establecer, documentar, implementar, monitorizar y revisar las configuraciones de hardware, software y redes."),
    ("A.8.10", "Eliminación de información", "Eliminar la información almacenada en sistemas y dispositivos cuando ya no sea necesaria."),
    ("A.8.11", "Enmascaramiento de datos", "Utilizar enmascaramiento de datos de acuerdo con la política de control de acceso y requisitos legales."),
    ("A.8.12", "Prevención de fuga de datos (DLP)", "Aplicar medidas de prevención de fuga de datos a sistemas, redes y dispositivos que procesan información sensible."),
    ("A.8.13", "Copias de seguridad de la información (Backup)", "Mantener y probar periódicamente copias de seguridad de la información, software y sistemas."),
    ("A.8.14", "Redundancia de las instalaciones de procesamiento de información", "Implementar instalaciones de procesamiento de información con redundancia suficiente para cumplir requisitos de disponibilidad."),
    ("A.8.15", "Registro de eventos (Logging)", "Producir, almacenar, proteger y analizar registros que registren actividades, excepciones, fallos y eventos."),
    ("A.8.16", "Actividades de monitorización", "Monitorizar redes, sistemas y aplicaciones para detectar comportamientos anómalos y posibles incidentes."),
    ("A.8.17", "Sincronización de relojes", "Sincronizar los relojes de los sistemas de procesamiento de información con fuentes de tiempo aprobadas."),
    ("A.8.18", "Uso de programas de utilidad privilegiados", "Restringir y controlar estrictamente el uso de programas de utilidad capaces de anular controles del sistema."),
    ("A.8.19", "Instalación de software en sistemas operativos", "Implementar procedimientos y medidas para gestionar de forma segura la instalación de software en producción."),
    ("A.8.20", "Seguridad de redes", "Asegurar, gestionar y controlar las redes y dispositivos de red para proteger la información en sistemas y aplicaciones."),
    ("A.8.21", "Seguridad de los servicios de red", "Identificar, implementar y monitorizar mecanismos de seguridad y niveles de servicio para todos los servicios de red."),
    ("A.8.22", "Segregación de redes", "Segregar los grupos de servicios de información, usuarios y sistemas en las redes."),
    ("A.8.23", "Filtrado web", "Gestionar el acceso a sitios web externos para reducir la exposición a contenido malicioso."),
    ("A.8.24", "Uso de criptografía", "Definir e implementar reglas para el uso eficaz de la criptografía, incluida la gestión de claves."),
    ("A.8.25", "Ciclo de vida de desarrollo seguro", "Establecer y aplicar reglas para el desarrollo seguro de software y sistemas."),
    ("A.8.26", "Requisitos de seguridad de las aplicaciones", "Identificar, especificar y aprobar requisitos de seguridad al desarrollar o adquirir aplicaciones."),
    ("A.8.27", "Arquitectura de sistemas seguros y principios de ingeniería", "Establecer, documentar, mantener y aplicar principios para la ingeniería de sistemas seguros."),
    ("A.8.28", "Codificación segura", "Aplicar principios de codificación segura al desarrollo de software."),
    ("A.8.29", "Pruebas de seguridad en desarrollo y aceptación", "Definir e implementar procesos de pruebas de seguridad en el ciclo de vida de desarrollo."),
    ("A.8.30", "Desarrollo subcontratado", "Dirigir, monitorizar y revisar las actividades relacionadas con el desarrollo subcontratado de sistemas."),
    ("A.8.31", "Separación de entornos de desarrollo, prueba y producción", "Separar y asegurar los entornos de desarrollo, pruebas y producción."),
    ("A.8.32", "Gestión de cambios", "Someter los cambios en las instalaciones de procesamiento y sistemas de información a procedimientos de gestión de cambios."),
    ("A.8.33", "Información de pruebas", "Seleccionar, proteger y gestionar adecuadamente la información utilizada para pruebas."),
    ("A.8.34", "Protección de los sistemas de información durante las pruebas de auditoría", "Planificar y acordar las pruebas de auditoría y actividades de aseguramiento para minimizar el impacto operacional.")
]

def cargar_iso27001():
    db = SessionLocal()
    try:
        politica = db.query(models.Politica).filter_by(codigo_norma="ISO/IEC 27001:2022").first()
        if not politica:
            politica = models.Politica(
                codigo_norma="ISO/IEC 27001:2022",
                titulo_norma="Seguridad de la información, ciberseguridad y protección de la privacidad — Requisitos (Anexo A)",
                descripcion="Marco normativo internacional con los 93 controles del Anexo A de ISO/IEC 27001:2022."
            )
            db.add(politica)
            db.commit()
            db.refresh(politica)

        existentes = {c.codigo_clausula for c in db.query(models.Clausula).filter_by(id_politica=politica.id_politica).all()}
        nuevas = 0

        for codigo, titulo, descripcion in CONTROLES_ANEXO_A:
            if codigo not in existentes:
                clausula = models.Clausula(
                    id_politica=politica.id_politica,
                    codigo_clausula=codigo,
                    titulo=titulo,
                    descripcion=descripcion
                )
                db.add(clausula)
                nuevas += 1

        db.commit()
        print(f"✅ ¡Carga completada! Se insertaron {nuevas} cláusulas bajo la norma {politica.codigo_norma}.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al cargar datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cargar_iso27001()