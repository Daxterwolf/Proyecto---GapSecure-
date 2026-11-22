"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActivoItem,
  AreaOrganizativa,
  DetalleActivo,
  RegistroHistorial,
  ResumenDashboard,
  UsuarioSistema,
  actualizarAreaOrganizativa,
  actualizarUsuario,
  analizarPdfAuditoria,
  crearAreaOrganizativa,
  crearUsuario,
  eliminarAreaOrganizativa,
  eliminarUsuario,
  getAreasOrganizativas,
  getDashboardActivoDetalle,
  getDashboardActivos,
  getDashboardHistorial,
  getDashboardResumen,
  getToken,
  getUsuarioActual,
  getUsuarios,
  removeToken,
  toggleSugerenciaResuelta,
} from "@/lib/api";

interface ResumenExtendido extends ResumenDashboard {
  cumplimiento_por_departamento?: {
    area: string;
    documentos_evaluados: number;
    porcentaje_cumplimiento: number;
    porcentaje_brecha: number;
  }[];
}

interface ConfirmacionModalState {
  abierto: boolean;
  titulo: string;
  subtitulo: string;
  mensaje: string;
  detalleDestacado?: string;
  textoConfirmar: string;
  variante: "peligro" | "advertencia";
  ejecutando: boolean;
  onConfirmar: () => Promise<void>;
}

interface AvisoModalState {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  tipo: "error" | "info";
}

function UserAvatarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  // Datos compartidos
  const [resumen, setResumen] = useState<ResumenExtendido | null>(null);
  const [activos, setActivos] = useState<ActivoItem[]>([]);
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);
  const [detalleActivo, setDetalleActivo] = useState<DetalleActivo | null>(null);
  const [areasCatalogo, setAreasCatalogo] = useState<AreaOrganizativa[]>([]);

  // Datos exclusivos de Administrador
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [tabAdmin, setTabAdmin] = useState<
    "usuarios" | "areas" | "subir" | "auditoria" | "bitacora"
  >("usuarios");
  const [modalUsuario, setModalUsuario] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState<UsuarioSistema | null>(null);
  const [formUser, setFormUser] = useState({
    nombre_completo: "",
    rut: "",
    correo: "",
    password: "",
    id_rol: 2,
    activo: true,
  });
  const [guardandoUser, setGuardandoUser] = useState(false);

  // Modales personalizados centrados
  const [confirmModal, setConfirmModal] = useState<ConfirmacionModalState>({
    abierto: false,
    titulo: "",
    subtitulo: "",
    mensaje: "",
    textoConfirmar: "Confirmar",
    variante: "peligro",
    ejecutando: false,
    onConfirmar: async () => {},
  });

  const [avisoModal, setAvisoModal] = useState<AvisoModalState>({
    abierto: false,
    titulo: "",
    mensaje: "",
    tipo: "error",
  });

  // Gestión de Áreas Organizativas (Admin)
  const [nuevaArea, setNuevaArea] = useState({ nombre: "", descripcion: "" });
  const [guardandoArea, setGuardandoArea] = useState(false);

  // Carga PDF con multi-selección de áreas
  const [tabAuditor, setTabAuditor] = useState<"subir" | "resultados">("subir");
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);
  const [areasSeleccionadas, setAreasSeleccionadas] = useState<string[]>([
    "Tecnologías de la Información (TI)",
  ]);
  const [areaPrincipal, setAreaPrincipal] = useState<string>(
    "Tecnologías de la Información (TI)"
  );
  const [cid, setCid] = useState({ c: 4, i: 4, d: 3 });
  const [analizandoPdf, setAnalizandoPdf] = useState(false);
  const [mensajeAuditor, setMensajeAuditor] = useState<string | null>(null);
  const [filtroCriticidad, setFiltroCriticidad] = useState<string>("TODOS");
  const [actualizandoSugId, setActualizandoSugId] = useState<number | null>(null);

  // Estados del Footer (Contacto)
  const [mostrarContacto, setMostrarContacto] = useState(false);
  const [telefonoCopiado, setTelefonoCopiado] = useState(false);

  const esAdmin = usuario?.id_rol === 1;

  const mostrarAviso = (titulo: string, mensaje: string, tipo: "error" | "info" = "error") => {
    setAvisoModal({ abierto: true, titulo, mensaje, tipo });
  };

  const copiarTelefono = () => {
    navigator.clipboard?.writeText("+56961793745");
    setTelefonoCopiado(true);
    setTimeout(() => setTelefonoCopiado(false), 2000);
  };

  const cargarDatos = async () => {
    try {
      setErrorGlobal(null);
      const perfil = await getUsuarioActual();
      setUsuario(perfil);

      const [resData, actData, histData, areasData] = await Promise.all([
        getDashboardResumen(),
        getDashboardActivos(),
        getDashboardHistorial(),
        getAreasOrganizativas(false),
      ]);

      setResumen(resData as ResumenExtendido);
      setActivos(actData);
      setHistorial(histData);
      setAreasCatalogo(areasData);

      if (actData.length > 0 && !detalleActivo) {
        const det = await getDashboardActivoDetalle(actData[0].id_activo);
        setDetalleActivo(det);
      }

      if (perfil.id_rol === 1) {
        const listaUsers = await getUsuarios();
        setUsuarios(listaUsers);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Sesión expirada")) {
        router.push("/login");
        return;
      }
      setErrorGlobal(err instanceof Error ? err.message : "Error cargando datos SGSI");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    cargarDatos();
  }, []);

  const cerrarSesion = () => {
    removeToken();
    router.push("/login");
  };

  // --- ACCIONES DE ADMINISTRADOR: USUARIOS ---
  const abrirCrearUsuario = () => {
    setEditandoUsuario(null);
    setFormUser({
      nombre_completo: "",
      rut: "",
      correo: "",
      password: "",
      id_rol: 2,
      activo: true,
    });
    setModalUsuario(true);
  };

  const abrirEditarUsuario = (u: UsuarioSistema) => {
    setEditandoUsuario(u);
    setFormUser({
      nombre_completo: u.nombre_completo,
      rut: u.rut,
      correo: u.correo,
      password: "",
      id_rol: u.id_rol,
      activo: u.activo,
    });
    setModalUsuario(true);
  };

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoUser(true);
    try {
      if (editandoUsuario) {
        await actualizarUsuario(editandoUsuario.id_usuario, {
          nombre_completo: formUser.nombre_completo,
          rut: formUser.rut,
          correo: formUser.correo,
          id_rol: formUser.id_rol,
          activo: formUser.activo,
          ...(formUser.password ? { password: formUser.password } : {}),
        });
      } else {
        await crearUsuario({
          nombre_completo: formUser.nombre_completo,
          rut: formUser.rut,
          correo: formUser.correo,
          password: formUser.password,
          id_rol: formUser.id_rol,
          activo: true,
        });
      }
      setModalUsuario(false);
      const lista = await getUsuarios();
      setUsuarios(lista);
    } catch (err: unknown) {
      mostrarAviso(
        "Error al Guardar Usuario",
        err instanceof Error ? err.message : "No se pudieron guardar los cambios."
      );
    } finally {
      setGuardandoUser(false);
    }
  };

  const solicitarEliminarUsuario = (u: UsuarioSistema) => {
    setConfirmModal({
      abierto: true,
      titulo: "Eliminar Usuario del Sistema",
      subtitulo: "ACCIÓN IRREVERSIBLE · CONTROL DE ACCESO",
      mensaje:
        "¿Estás seguro de que deseas eliminar permanentemente esta cuenta de usuario? Se revocarán todos sus permisos de acceso al SGSI.",
      detalleDestacado: `${u.nombre_completo} · ${u.correo}`,
      textoConfirmar: "Eliminar Usuario",
      variante: "peligro",
      ejecutando: false,
      onConfirmar: async () => {
        try {
          await eliminarUsuario(u.id_usuario);
          setUsuarios((prev) => prev.filter((item) => item.id_usuario !== u.id_usuario));
          setConfirmModal((prev) => ({ ...prev, abierto: false }));
        } catch (err: unknown) {
          setConfirmModal((prev) => ({ ...prev, abierto: false }));
          mostrarAviso(
            "Error al Eliminar Usuario",
            err instanceof Error ? err.message : "No se pudo eliminar el usuario."
          );
        }
      },
    });
  };

  // --- ACCIONES DE ADMINISTRADOR: ÁREAS ORGANIZATIVAS ---
  const handleAgregarArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaArea.nombre.trim()) return;
    setGuardandoArea(true);
    try {
      await crearAreaOrganizativa({
        nombre: nuevaArea.nombre,
        descripcion: nuevaArea.descripcion,
        activa: true,
      });
      setNuevaArea({ nombre: "", descripcion: "" });
      const actualizadas = await getAreasOrganizativas(false);
      setAreasCatalogo(actualizadas);
    } catch (err: unknown) {
      mostrarAviso(
        "Error al Crear Área",
        err instanceof Error ? err.message : "No se pudo registrar el departamento."
      );
    } finally {
      setGuardandoArea(false);
    }
  };

  const handleToggleAreaActiva = async (area: AreaOrganizativa) => {
    try {
      await actualizarAreaOrganizativa(area.id_area, { activa: !area.activa });
      const actualizadas = await getAreasOrganizativas(false);
      setAreasCatalogo(actualizadas);
    } catch (err: unknown) {
      mostrarAviso(
        "Error al Actualizar Área",
        err instanceof Error ? err.message : "No se pudo cambiar el estado del área."
      );
    }
  };

  const solicitarEliminarArea = (area: AreaOrganizativa) => {
    setConfirmModal({
      abierto: true,
      titulo: "Eliminar Área Organizativa",
      subtitulo: "CATÁLOGO DE DEPARTAMENTOS SGSI",
      mensaje:
        "¿Deseas eliminar este departamento del catálogo organizativo? Dejará de estar disponible para futuras evaluaciones.",
      detalleDestacado: area.nombre,
      textoConfirmar: "Eliminar Área",
      variante: "peligro",
      ejecutando: false,
      onConfirmar: async () => {
        try {
          await eliminarAreaOrganizativa(area.id_area);
          setAreasCatalogo((prev) => prev.filter((a) => a.id_area !== area.id_area));
          setConfirmModal((prev) => ({ ...prev, abierto: false }));
        } catch (err: unknown) {
          setConfirmModal((prev) => ({ ...prev, abierto: false }));
          mostrarAviso(
            "Error al Eliminar Área",
            err instanceof Error ? err.message : "No se pudo eliminar el área."
          );
        }
      },
    });
  };

  const ejecutarConfirmacion = async () => {
    setConfirmModal((prev) => ({ ...prev, ejecutando: true }));
    await confirmModal.onConfirmar();
  };

  // --- ACCIONES DE MULTI-SELECCIÓN DE ÁREAS Y SUBIDA PDF ---
  const toggleAreaAuditor = (nombreArea: string) => {
    if (areasSeleccionadas.includes(nombreArea)) {
      const restantes = areasSeleccionadas.filter((a) => a !== nombreArea);
      setAreasSeleccionadas(restantes);
      if (areaPrincipal === nombreArea) {
        setAreaPrincipal(restantes[0] || "Área no identificada");
      }
    } else {
      const nuevas = [...areasSeleccionadas, nombreArea];
      setAreasSeleccionadas(nuevas);
      if (nuevas.length === 1 || areaPrincipal === "Área no identificada") {
        setAreaPrincipal(nombreArea);
      }
    }
  };

  const handleSubirPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoPdf) return;
    setAnalizandoPdf(true);
    setMensajeAuditor(null);

    const areasEnviar =
      areasSeleccionadas.length > 0 ? areasSeleccionadas : ["Área no identificada"];
    const principalEnviar =
      areaPrincipal && areasEnviar.includes(areaPrincipal)
        ? areaPrincipal
        : areasEnviar[0];

    try {
      await analizarPdfAuditoria({
        archivo: archivoPdf,
        area_organizativa: principalEnviar,
        areas_seleccionadas: areasEnviar,
        nivel_confidencialidad: cid.c,
        nivel_integridad: cid.i,
        nivel_disponibilidad: cid.d,
      });
      setArchivoPdf(null);
      setMensajeAuditor("Documento auditado exitosamente bajo ISO/IEC 27001:2022.");
      await cargarDatos();
      if (esAdmin) {
        setTabAdmin("auditoria");
      } else {
        setTabAuditor("resultados");
      }
    } catch (err: unknown) {
      setMensajeAuditor(err instanceof Error ? err.message : "Error al analizar PDF");
    } finally {
      setAnalizandoPdf(false);
    }
  };

  const seleccionarActivo = async (idActivo: number) => {
    try {
      setFiltroCriticidad("TODOS");
      const det = await getDashboardActivoDetalle(idActivo);
      setDetalleActivo(det);
    } catch (err: unknown) {
      mostrarAviso(
        "Error de Consulta",
        err instanceof Error ? err.message : "No se pudo obtener el detalle del activo."
      );
    }
  };

  // --- GESTIÓN DE ESTADO DE REMEDIACIÓN ---
  const handleToggleSugerencia = async (idSugerencia: number) => {
    if (!detalleActivo) return;
    setActualizandoSugId(idSugerencia);
    try {
      await toggleSugerenciaResuelta(idSugerencia);
      const [detActualizado, resData, actData, histData] = await Promise.all([
        getDashboardActivoDetalle(detalleActivo.activo.id_activo),
        getDashboardResumen(),
        getDashboardActivos(),
        getDashboardHistorial(),
      ]);
      setDetalleActivo(detActualizado);
      setResumen(resData as ResumenExtendido);
      setActivos(actData);
      setHistorial(histData);
    } catch (err: unknown) {
      mostrarAviso(
        "Error de Actualización",
        err instanceof Error ? err.message : "No se pudo actualizar el estado de remediación."
      );
    } finally {
      setActualizandoSugId(null);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#050c17] flex flex-col items-center justify-center gap-4 text-sky-300">
        <img
          src="/img/icon-512.png"
          alt="GapSecure"
          className="h-12 w-12 rounded-xl shadow-lg animate-pulse"
        />
        <span className="tracking-[0.35em] text-xs font-semibold uppercase text-slate-300">
          VERIFICANDO CREDENCIALES SGSI...
        </span>
      </div>
    );
  }

  // Formulario reutilizable de carga PDF con multi-selección de áreas
  const renderFormularioPdf = () => (
    <section className="max-w-3xl mx-auto rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-8 shadow-[0_24px_60px_rgba(2,8,20,0.75)]">
      <h2 className="text-sm font-semibold tracking-[0.24em] uppercase text-sky-300">
        Análisis de Brechas ISO/IEC 27001:2022
      </h2>
      <p className="mt-2 text-xs text-slate-300/80">
        Selecciona una o varias áreas organizativas involucradas y carga tu evidencia PDF.
      </p>

      <form onSubmit={handleSubirPdf} className="mt-6 space-y-6 text-sm">
        <div>
          <label className="block text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-300 mb-2">
            Archivo PDF de Evidencia
          </label>
          <input
            type="file"
            accept=".pdf"
            required
            onChange={(e) => setArchivoPdf(e.target.files?.[0] || null)}
            className="w-full rounded-xl border border-dashed border-sky-400/40 bg-[#040b16]/85 p-4 text-xs text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-sky-400 file:px-4 file:py-1.5 file:text-xs file:font-bold file:text-[#041527] hover:file:bg-sky-300 transition-colors"
          />
        </div>

        {/* SELECTOR MÚLTIPLE INTERACTIVO DE ÁREAS ORGANIZATIVAS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-300">
              Áreas Organizativas Involucradas
            </label>
            <span className="text-[11px] font-medium text-sky-300">
              Áreas seleccionadas: {areasSeleccionadas.length}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-sky-200/15 bg-[#040b16]/80 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {areasCatalogo
              .filter((a) => a.activa)
              .map((area) => {
                const marcada = areasSeleccionadas.includes(area.nombre);
                return (
                  <button
                    type="button"
                    key={area.id_area}
                    onClick={() => toggleAreaAuditor(area.nombre)}
                    className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                      marcada
                        ? "border-sky-400/55 bg-sky-400/15 text-white font-medium shadow-sm"
                        : "border-transparent hover:bg-sky-300/[0.06] text-slate-400"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] border ${
                        marcada
                          ? "border-sky-400 bg-sky-400 text-[#041527] font-bold"
                          : "border-slate-600 bg-transparent"
                      }`}
                    >
                      {marcada ? "✓" : ""}
                    </span>
                    <span className="truncate">{area.nombre}</span>
                  </button>
                );
              })}
          </div>

          {areasSeleccionadas.length > 0 && (
            <div className="pt-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                {areasSeleccionadas.map((nom) => (
                  <span
                    key={nom}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/15 px-3 py-1 text-[11px] font-medium text-sky-200"
                  >
                    {nom}
                    <button
                      type="button"
                      onClick={() => toggleAreaAuditor(nom)}
                      className="text-sky-300 hover:text-white ml-1 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                  Área Responsable Principal del Documento
                </label>
                <select
                  value={areaPrincipal}
                  onChange={(e) => setAreaPrincipal(e.target.value)}
                  className="w-full rounded-full border border-sky-200/20 bg-[#040b16]/90 px-4 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {areasSeleccionadas.map((nom) => (
                    <option key={nom} value={nom}>
                      {nom}
                    </option>
                  ))}
                  <option value="Área no identificada">Área no identificada</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Valoración CID */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1.5">
              Confidencialidad (1-5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={cid.c}
              onChange={(e) => setCid({ ...cid, c: Number(e.target.value) })}
              className="w-full rounded-full border border-sky-200/20 bg-[#040b16]/90 px-4 py-2 text-center font-semibold text-slate-100 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1.5">
              Integridad (1-5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={cid.i}
              onChange={(e) => setCid({ ...cid, i: Number(e.target.value) })}
              className="w-full rounded-full border border-sky-200/20 bg-[#040b16]/90 px-4 py-2 text-center font-semibold text-slate-100 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1.5">
              Disponibilidad (1-5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={cid.d}
              onChange={(e) => setCid({ ...cid, d: Number(e.target.value) })}
              className="w-full rounded-full border border-sky-200/20 bg-[#040b16]/90 px-4 py-2 text-center font-semibold text-slate-100 focus:border-sky-400 focus:outline-none"
            />
          </div>
        </div>

        {mensajeAuditor && (
          <div className="rounded-xl border border-sky-400/40 bg-sky-400/15 p-3 text-xs font-medium text-sky-200 text-center">
            {mensajeAuditor}
          </div>
        )}

        <div className="pt-2 flex justify-center">
          <button
            type="submit"
            disabled={analizandoPdf || !archivoPdf}
            className="rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-10 py-3 text-xs font-bold tracking-[0.25em] uppercase text-[#041527] hover:from-sky-300 hover:to-cyan-200 disabled:opacity-50 transition-all shadow-[0_0_28px_rgba(56,189,248,0.35)]"
          >
            {analizandoPdf ? "ANALIZANDO CON IA..." : "EJECUTAR AUDITORÍA PDF"}
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050c17] text-slate-100 flex flex-col">
      {/* IMAGEN DE FONDO FIJA */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: "url('/img/imagen-fondo.jpg')",
          filter: "brightness(0.72) contrast(1.1) saturate(1.08)",
        }}
      />

      {/* CAPA DE INTEGRACIÓN AMBIENTAL ZAFIRO / CIAN */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(14, 165, 233, 0.16) 0%, transparent 48%), radial-gradient(circle at 82% 85%, rgba(245, 158, 11, 0.08) 0%, transparent 45%), linear-gradient(to bottom, rgba(5, 12, 23, 0.42), rgba(4, 10, 20, 0.72))",
        }}
      />

      {/* BARRA SUPERIOR TRANSLÚCIDA */}
      <header className="sticky top-0 z-30 border-b border-sky-300/15 bg-[#06101f]/85 backdrop-blur-xl px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-4 shadow-[0_8px_32px_rgba(2,8,20,0.65)]">
        <div className="flex items-center gap-3.5">
          <img
            src="/img/icon-512.png"
            alt="Logotipo GapSecure"
            className="h-10 w-10 rounded-xl object-cover shadow-md border border-sky-400/35"
          />
          <div>
            <h1 className="text-lg font-semibold tracking-[0.28em] text-white uppercase">
              GAP<span className="text-sky-400">SECURE</span>
            </h1>
            <p className="text-[10px] font-medium tracking-[0.22em] text-sky-200/70 uppercase">
              {esAdmin
                ? "CONSOLA DE ADMINISTRACIÓN SGSI"
                : "PORTAL DE AUDITORÍA ISO/IEC 27001:2022"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-sky-300/25 bg-sky-400/10 text-sky-300">
              <UserAvatarIcon className="h-4 w-4" />
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-100">
                {usuario?.nombre_completo || usuario?.correo}
              </p>
              <span
                className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-[0.18em] uppercase border ${
                  esAdmin
                    ? "border-amber-400/45 bg-amber-400/12 text-amber-300"
                    : "border-sky-400/45 bg-sky-400/12 text-sky-300"
                }`}
              >
                {esAdmin ? "ROL: ADMINISTRADOR" : "ROL: AUDITOR"}
              </span>
            </div>
          </div>

          <button
            onClick={cerrarSesion}
            className="rounded-full border border-sky-200/20 bg-white/[0.04] px-5 py-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-200 hover:border-red-400/55 hover:bg-red-500/15 hover:text-red-300 transition-all"
          >
            SALIR
          </button>
        </div>
      </header>

      {errorGlobal && (
        <div className="relative z-10 mx-6 md:mx-10 mt-6 rounded-xl border border-red-400/40 bg-red-950/85 backdrop-blur-md px-5 py-3 text-xs font-medium text-red-200 shadow-lg">
          {errorGlobal}
        </div>
      )}

      {/* =====================================================================
          VISTA 1: ADMINISTRADOR
         ===================================================================== */}
      {esAdmin ? (
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 md:px-10 py-8 space-y-8">
          {/* KPIs Globales del Administrador */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(2,8,20,0.65)] hover:border-amber-400/45 transition-all">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-400">
                Usuarios Registrados
              </p>
              <p className="mt-2 text-3xl font-semibold text-amber-300">{usuarios.length}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {usuarios.filter((u) => u.id_rol === 1).length} Admin ·{" "}
                {usuarios.filter((u) => u.id_rol === 2).length} Auditores
              </p>
            </div>

            <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(2,8,20,0.65)] hover:border-sky-400/45 transition-all">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-400">
                Áreas Organizativas
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {areasCatalogo.filter((a) => a.activa).length}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Departamentos activos</p>
            </div>

            <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(2,8,20,0.65)] hover:border-sky-400/45 transition-all">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-400">
                Cumplimiento Global
              </p>
              <p className="mt-2 text-3xl font-semibold text-sky-400">
                {resumen?.cumplimiento_promedio?.toFixed(1) ?? 0}%
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {resumen?.total_activos_auditados ?? 0} activos auditados
              </p>
            </div>

            <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(2,8,20,0.65)] hover:border-sky-400/45 transition-all">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-400">
                Registros Bitácora
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{historial.length}</p>
              <p className="mt-1 text-[11px] text-slate-400">Trazabilidad SHA-256</p>
            </div>
          </section>

          {/* Navegación interna de Administrador */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sky-300/15 pb-4">
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setTabAdmin("usuarios")}
                className={`rounded-full px-5 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                  tabAdmin === "usuarios"
                    ? "bg-gradient-to-r from-sky-400 to-cyan-300 text-[#041527] font-bold shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                    : "border border-sky-300/20 bg-[#071324]/80 backdrop-blur-md text-slate-300 hover:border-sky-400/50 hover:text-white"
                }`}
              >
                Gestión de Usuarios
              </button>
              <button
                onClick={() => setTabAdmin("areas")}
                className={`rounded-full px-5 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                  tabAdmin === "areas"
                    ? "bg-gradient-to-r from-sky-400 to-cyan-300 text-[#041527] font-bold shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                    : "border border-sky-300/20 bg-[#071324]/80 backdrop-blur-md text-slate-300 hover:border-sky-400/50 hover:text-white"
                }`}
              >
                Áreas Organizativas ({areasCatalogo.length})
              </button>
              <button
                onClick={() => setTabAdmin("subir")}
                className={`rounded-full px-5 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                  tabAdmin === "subir"
                    ? "bg-gradient-to-r from-sky-400 to-cyan-300 text-[#041527] font-bold shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                    : "border border-sky-300/20 bg-[#071324]/80 backdrop-blur-md text-slate-300 hover:border-sky-400/50 hover:text-white"
                }`}
              >
                Subir Documento PDF
              </button>
              <button
                onClick={() => setTabAdmin("auditoria")}
                className={`rounded-full px-5 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                  tabAdmin === "auditoria"
                    ? "bg-gradient-to-r from-sky-400 to-cyan-300 text-[#041527] font-bold shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                    : "border border-sky-300/20 bg-[#071324]/80 backdrop-blur-md text-slate-300 hover:border-sky-400/50 hover:text-white"
                }`}
              >
                Brechas por Departamento
              </button>
              <button
                onClick={() => setTabAdmin("bitacora")}
                className={`rounded-full px-5 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                  tabAdmin === "bitacora"
                    ? "bg-gradient-to-r from-sky-400 to-cyan-300 text-[#041527] font-bold shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                    : "border border-sky-300/20 bg-[#071324]/80 backdrop-blur-md text-slate-300 hover:border-sky-400/50 hover:text-white"
                }`}
              >
                Bitácora SHA-256
              </button>
            </div>

            {tabAdmin === "usuarios" && (
              <button
                onClick={abrirCrearUsuario}
                className="rounded-full border border-amber-400/55 bg-amber-400/15 px-6 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-300 hover:bg-amber-400 hover:text-[#041527] transition-all shadow-[0_0_20px_rgba(251,191,36,0.18)]"
              >
                + Nuevo Usuario
              </button>
            )}
          </div>

          {/* TAB 1 ADMIN: CRUD DE USUARIOS */}
          {tabAdmin === "usuarios" && (
            <section className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl overflow-x-auto shadow-[0_24px_60px_rgba(2,8,20,0.75)]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sky-300/15 text-[10px] font-semibold tracking-[0.22em] uppercase text-sky-200/75 bg-sky-400/[0.05]">
                    <th className="py-4 px-6">ID</th>
                    <th className="py-4 px-6">Nombre Completo</th>
                    <th className="py-4 px-6">RUT</th>
                    <th className="py-4 px-6">Correo Corporativo</th>
                    <th className="py-4 px-6">Rol</th>
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-200/[0.08] text-sm">
                  {usuarios.map((u) => (
                    <tr key={u.id_usuario} className="hover:bg-sky-400/[0.05] transition-colors">
                      <td className="py-4 px-6 text-slate-400 font-mono text-xs">#{u.id_usuario}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                              u.id_rol === 1
                                ? "border-amber-400/40 bg-amber-400/12 text-amber-300"
                                : "border-sky-400/40 bg-sky-400/12 text-sky-300"
                            }`}
                          >
                            <UserAvatarIcon className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-slate-100">{u.nombre_completo}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-300 font-mono text-xs">{u.rut}</td>
                      <td className="py-4 px-6 text-slate-300">{u.correo}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-[0.16em] uppercase border ${
                            u.id_rol === 1
                              ? "border-amber-400/45 bg-amber-400/12 text-amber-300"
                              : "border-sky-400/45 bg-sky-400/12 text-sky-300"
                          }`}
                        >
                          {u.id_rol === 1 ? "Administrador" : "Auditor"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            u.activo ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              u.activo ? "bg-emerald-400" : "bg-red-400"
                            }`}
                          />
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-3">
                        <button
                          onClick={() => abrirEditarUsuario(u)}
                          className="text-xs font-semibold tracking-wider uppercase text-sky-300 hover:text-sky-200 hover:underline"
                        >
                          Editar
                        </button>
                        {u.id_usuario !== usuario?.id_usuario && (
                          <button
                            onClick={() => solicitarEliminarUsuario(u)}
                            className="text-xs font-semibold tracking-wider uppercase text-rose-400 hover:text-rose-300 hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* TAB 2 ADMIN: GESTIÓN DE ÁREAS ORGANIZATIVAS */}
          {tabAdmin === "areas" && (
            <section className="space-y-6">
              <form
                onSubmit={handleAgregarArea}
                className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end shadow-[0_24px_60px_rgba(2,8,20,0.75)]"
              >
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                    Nombre del Área / Departamento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ciberseguridad Operativa"
                    value={nuevaArea.nombre}
                    onChange={(e) => setNuevaArea({ ...nuevaArea, nombre: e.target.value })}
                    className="w-full rounded-full border border-sky-200/20 bg-[#040b16]/90 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                    Responsabilidad Principal
                  </label>
                  <input
                    type="text"
                    placeholder="Descripción funcional del departamento"
                    value={nuevaArea.descripcion}
                    onChange={(e) => setNuevaArea({ ...nuevaArea, descripcion: e.target.value })}
                    className="w-full rounded-full border border-sky-200/20 bg-[#040b16]/90 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoArea}
                  className="rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-6 py-2.5 text-[11px] font-bold tracking-[0.2em] uppercase text-[#041527] hover:from-sky-300 hover:to-cyan-200 transition-colors shadow-[0_0_20px_rgba(56,189,248,0.28)]"
                >
                  {guardandoArea ? "Agregando..." : "+ Agregar Área"}
                </button>
              </form>

              <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl overflow-x-auto shadow-[0_24px_60px_rgba(2,8,20,0.75)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-sky-300/15 text-[10px] font-semibold tracking-[0.22em] uppercase text-sky-200/75 bg-sky-400/[0.05]">
                      <th className="py-3.5 px-6">N.º</th>
                      <th className="py-3.5 px-6">Área Organizativa</th>
                      <th className="py-3.5 px-6">Responsabilidad Principal</th>
                      <th className="py-3.5 px-6">Estado</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-200/[0.08] text-sm">
                    {areasCatalogo.map((area, idx) => (
                      <tr key={area.id_area} className="hover:bg-sky-400/[0.05] transition-colors">
                        <td className="py-3.5 px-6 text-slate-400">{idx + 1}</td>
                        <td className="py-3.5 px-6 font-medium text-slate-100">{area.nombre}</td>
                        <td className="py-3.5 px-6 text-xs text-slate-300/80">
                          {area.descripcion || "—"}
                        </td>
                        <td className="py-3.5 px-6">
                          <button
                            onClick={() => handleToggleAreaActiva(area)}
                            className={`px-3 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                              area.activa
                                ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-300"
                                : "border-slate-600 bg-slate-800/70 text-slate-400"
                            }`}
                          >
                            {area.activa ? "Activa" : "Inactiva"}
                          </button>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => solicitarEliminarArea(area)}
                            className="text-xs font-semibold uppercase text-rose-400 hover:underline"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 3 ADMIN: SUBIR DOCUMENTO PDF */}
          {tabAdmin === "subir" && renderFormularioPdf()}

          {/* TAB 4 ADMIN: CUMPLIMIENTO PROPORCIONAL POR DEPARTAMENTO */}
          {tabAdmin === "auditoria" && (
            <section className="space-y-6">
              <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-6 space-y-4 shadow-[0_24px_60px_rgba(2,8,20,0.75)]">
                <h2 className="text-xs font-semibold tracking-[0.22em] uppercase text-sky-300">
                  Cumplimiento Proporcional por Departamento (Controles Asignados)
                </h2>
                {!resumen?.cumplimiento_por_departamento ||
                resumen.cumplimiento_por_departamento.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Aún no hay evaluaciones departamentales registradas.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resumen.cumplimiento_por_departamento.map((dep) => (
                      <div
                        key={dep.area}
                        className="rounded-xl border border-sky-200/15 bg-[#040b16]/80 p-4 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-semibold text-slate-100">{dep.area}</p>
                          <span className="text-xs font-bold text-sky-400">
                            {dep.porcentaje_cumplimiento}% cumplimiento
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 rounded-full"
                            style={{ width: `${dep.porcentaje_cumplimiento}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {dep.documentos_evaluados} documento(s) auditado(s) · Brecha:{" "}
                          <span className="font-medium text-amber-300">{dep.porcentaje_brecha}%</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-6 space-y-4 shadow-[0_24px_60px_rgba(2,8,20,0.75)]">
                <h2 className="text-xs font-semibold tracking-[0.22em] uppercase text-sky-300">
                  Documentos Auditados en la Plataforma
                </h2>
                <div className="divide-y divide-sky-200/[0.08]">
                  {activos.map((a) => (
                    <div
                      key={a.id_activo}
                      className="py-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-100">{a.nombre}</p>
                        <p className="text-xs text-slate-400">
                          Áreas: {a.area_organizativa} · Norma: {a.norma}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-xs font-semibold">
                        <span className="text-sky-400">
                          Cumplimiento: {a.porcentaje_cumplimiento}%
                        </span>
                        <span className="text-amber-300">Brecha: {a.porcentaje_brecha}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB 5 ADMIN: BITÁCORA SHA-256 */}
          {tabAdmin === "bitacora" && (
            <section className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-6 space-y-4 shadow-[0_24px_60px_rgba(2,8,20,0.75)]">
              <h2 className="text-xs font-semibold tracking-[0.22em] uppercase text-sky-300">
                Logs Criptográficos Inmutables (Control A.8.15)
              </h2>
              <div className="space-y-3">
                {historial.map((h) => (
                  <div
                    key={h.id_log}
                    className="rounded-xl border border-sky-200/15 bg-[#040b16]/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="text-sky-400 font-bold uppercase">{h.accion}</span>{" "}
                      <span className="text-slate-200 font-medium">
                        en tabla {h.tabla_afectada} (ID #{h.registro_id})
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono break-all">
                        SHA-256: {h.hash_mod}
                      </p>
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(h.fecha_modificacion).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* MODAL CREAR / EDITAR USUARIO */}
          {modalUsuario && (
            <div className="fixed inset-0 z-50 bg-[#02060e]/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl border border-sky-300/25 bg-[#071324]/95 backdrop-blur-xl p-7 shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
                <h3 className="text-sm font-semibold tracking-[0.22em] uppercase text-sky-300">
                  {editandoUsuario ? "Modificar Usuario" : "Registrar Nuevo Usuario"}
                </h3>
                <form onSubmit={guardarUsuario} className="mt-6 space-y-4 text-sm">
                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formUser.nombre_completo}
                      onChange={(e) =>
                        setFormUser({ ...formUser, nombre_completo: e.target.value })
                      }
                      className="w-full rounded-full border border-sky-200/20 bg-[#040b16] px-4 py-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                      RUT
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="12.345.678-9"
                      value={formUser.rut}
                      onChange={(e) => setFormUser({ ...formUser, rut: e.target.value })}
                      className="w-full rounded-full border border-sky-200/20 bg-[#040b16] px-4 py-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                      Correo Corporativo
                    </label>
                    <input
                      type="email"
                      required
                      value={formUser.correo}
                      onChange={(e) => setFormUser({ ...formUser, correo: e.target.value })}
                      className="w-full rounded-full border border-sky-200/20 bg-[#040b16] px-4 py-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                      {editandoUsuario ? "Nueva Contraseña (opcional)" : "Contraseña"}
                    </label>
                    <input
                      type="password"
                      required={!editandoUsuario}
                      value={formUser.password}
                      onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
                      placeholder={editandoUsuario ? "Dejar vacío para mantener" : "••••••••"}
                      className="w-full rounded-full border border-sky-200/20 bg-[#040b16] px-4 py-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                        Rol en Sistema
                      </label>
                      <select
                        value={formUser.id_rol}
                        onChange={(e) =>
                          setFormUser({ ...formUser, id_rol: Number(e.target.value) })
                        }
                        className="w-full rounded-full border border-sky-200/20 bg-[#040b16] px-4 py-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                      >
                        <option value={1}>Administrador</option>
                        <option value={2}>Auditor</option>
                      </select>
                    </div>

                    {editandoUsuario && (
                      <div>
                        <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 mb-1.5">
                          Estado Cuenta
                        </label>
                        <select
                          value={formUser.activo ? "true" : "false"}
                          onChange={(e) =>
                            setFormUser({ ...formUser, activo: e.target.value === "true" })
                          }
                          className="w-full rounded-full border border-sky-200/20 bg-[#040b16] px-4 py-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                        >
                          <option value="true">Activo</option>
                          <option value="false">Inactivo</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setModalUsuario(false)}
                      className="rounded-full border border-sky-200/20 px-5 py-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoUser}
                      className="rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-6 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-[#041527] hover:from-sky-300 hover:to-cyan-200"
                    >
                      {guardandoUser ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* =====================================================================
            VISTA 2: AUDITOR
           ===================================================================== */
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 md:px-10 py-8 space-y-8">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(2,8,20,0.65)]">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-400">
                Mis Documentos Auditados
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {resumen?.total_activos_auditados ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(2,8,20,0.65)]">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-400">
                Cumplimiento Promedio
              </p>
              <p className="mt-2 text-3xl font-semibold text-sky-400">
                {resumen?.cumplimiento_promedio?.toFixed(1) ?? 0}%
              </p>
            </div>
            <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 shadow-[0_18px_45px_rgba(2,8,20,0.65)]">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-400">
                Sugerencias IA Pendientes
              </p>
              <p className="mt-2 text-3xl font-semibold text-amber-300">
                {resumen?.sugerencias_pendientes ?? 0}
              </p>
            </div>
          </section>

          <div className="flex flex-wrap gap-3 border-b border-sky-300/15 pb-4">
            <button
              onClick={() => setTabAuditor("subir")}
              className={`rounded-full px-6 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                tabAuditor === "subir"
                  ? "bg-gradient-to-r from-sky-400 to-cyan-300 text-[#041527] font-bold shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                  : "border border-sky-300/20 bg-[#071324]/80 backdrop-blur-md text-slate-300 hover:border-sky-400/50 hover:text-white"
              }`}
            >
              1. Subir Documento PDF
            </button>
            <button
              onClick={() => setTabAuditor("resultados")}
              className={`rounded-full px-6 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all ${
                tabAuditor === "resultados"
                  ? "bg-gradient-to-r from-sky-400 to-cyan-300 text-[#041527] font-bold shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                  : "border border-sky-300/20 bg-[#071324]/80 backdrop-blur-md text-slate-300 hover:border-sky-400/50 hover:text-white"
              }`}
            >
              2. Revisar Sugerencias y Brechas ({activos.length})
            </button>
          </div>

          {tabAuditor === "subir" && renderFormularioPdf()}

          {tabAuditor === "resultados" && (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* COLUMNA IZQUIERDA CON SCROLL INDEPENDIENTE */}
              <div className="rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-5 space-y-3 shadow-[0_24px_60px_rgba(2,8,20,0.75)] max-h-[75vh] overflow-y-auto pr-3 lg:sticky lg:top-24">
                <h3 className="text-[10px] font-semibold tracking-[0.24em] uppercase text-sky-300 sticky top-0 bg-[#071324]/95 backdrop-blur-md py-1.5 z-10">
                  Documentos Evaluados
                </h3>
                {activos.length === 0 ? (
                  <p className="text-xs text-slate-400">Aún no has subido documentos PDF.</p>
                ) : (
                  activos.map((a) => (
                    <button
                      key={a.id_activo}
                      onClick={() => seleccionarActivo(a.id_activo)}
                      className={`w-full text-left rounded-xl p-4 border transition-all ${
                        detalleActivo?.activo.id_activo === a.id_activo
                          ? "border-sky-400/65 bg-sky-400/15 shadow-md"
                          : "border-sky-200/12 bg-[#040b16]/80 hover:border-sky-300/35 hover:bg-sky-400/[0.06]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-100 truncate">{a.nombre}</p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {a.area_organizativa}
                      </p>
                      <div className="mt-2 flex justify-between text-[11px] font-semibold">
                        <span className="text-sky-400">Cumple: {a.porcentaje_cumplimiento}%</span>
                        <span className="text-amber-300">Brecha: {a.porcentaje_brecha}%</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* TARJETA DERECHA SIN SCROLL INTERNO */}
              <div className="lg:col-span-2 rounded-2xl border border-sky-300/20 bg-[#071324]/84 backdrop-blur-xl p-6 space-y-6 shadow-[0_24px_60px_rgba(2,8,20,0.75)]">
                {!detalleActivo ? (
                  <p className="text-sm text-slate-400">
                    Selecciona un documento auditado para revisar las sugerencias de remediación.
                  </p>
                ) : (
                  <>
                    <div className="border-b border-sky-300/15 pb-4">
                      <span className="text-[10px] font-semibold tracking-[0.22em] uppercase text-sky-300">
                        INFORME TÉCNICO DE REMEDIACIÓN · ANEXO A (93 CONTROLES)
                      </span>
                      <h3 className="text-xl font-semibold text-white mt-1">
                        {detalleActivo.activo.nombre}
                      </h3>
                      <p className="text-xs text-slate-300/80 mt-1">
                        Áreas involucradas: {detalleActivo.activo.area_organizativa} · Valoración CID:{" "}
                        {detalleActivo.activo.valoracion_cid.confidencialidad}/
                        {detalleActivo.activo.valoracion_cid.integridad}/
                        {detalleActivo.activo.valoracion_cid.disponibilidad}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="rounded-xl border border-sky-400/30 bg-sky-400/12 p-3">
                        <p className="text-[10px] font-semibold uppercase text-sky-300">A.5 Organizacionales</p>
                        <p className="text-lg font-semibold text-white mt-1">37 controles</p>
                      </div>
                      <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/12 p-3">
                        <p className="text-[10px] font-semibold uppercase text-cyan-300">A.6 Personas</p>
                        <p className="text-lg font-semibold text-white mt-1">8 controles</p>
                      </div>
                      <div className="rounded-xl border border-amber-400/30 bg-amber-400/12 p-3">
                        <p className="text-[10px] font-semibold uppercase text-amber-300">A.7 Físicos</p>
                        <p className="text-lg font-semibold text-white mt-1">14 controles</p>
                      </div>
                      <div className="rounded-xl border border-indigo-400/30 bg-indigo-400/12 p-3">
                        <p className="text-[10px] font-semibold uppercase text-indigo-300">A.8 Tecnológicos</p>
                        <p className="text-lg font-semibold text-white mt-1">34 controles</p>
                      </div>
                    </div>

                    {(() => {
                      const sugerenciasFiltradas =
                        detalleActivo.sugerencias_remediacion.filter((sug) => {
                          if (filtroCriticidad === "TODOS") return true;
                          if (filtroCriticidad === "RESUELTAS") return Boolean(sug.resuelta);
                          return (
                            !sug.resuelta &&
                            (sug.nivel_criticidad || "").toUpperCase() ===
                              filtroCriticidad
                          );
                        });

                      const opcionesFiltro = [
                        { id: "TODOS", label: "Todos" },
                        { id: "CRÍTICO", label: "Crítico" },
                        { id: "ALTO", label: "Alto" },
                        { id: "MEDIO", label: "Medio" },
                        { id: "BAJO", label: "Bajo" },
                        { id: "RESUELTAS", label: "Resueltas" },
                      ];

                      return (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h4 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-300">
                              Sugerencias Generadas por IA ({sugerenciasFiltradas.length}
                              {filtroCriticidad !== "TODOS"
                                ? ` de ${detalleActivo.sugerencias_remediacion.length}`
                                : ""}
                              )
                            </h4>

                            <div className="flex flex-wrap items-center gap-2">
                              {opcionesFiltro.map((op) => {
                                const conteo =
                                  op.id === "TODOS"
                                    ? detalleActivo.sugerencias_remediacion.length
                                    : op.id === "RESUELTAS"
                                    ? detalleActivo.sugerencias_remediacion.filter((s) =>
                                        Boolean(s.resuelta)
                                      ).length
                                    : detalleActivo.sugerencias_remediacion.filter(
                                        (s) =>
                                          !s.resuelta &&
                                          (s.nivel_criticidad || "").toUpperCase() ===
                                            op.id
                                      ).length;

                                const activo = filtroCriticidad === op.id;

                                return (
                                  <button
                                    key={op.id}
                                    type="button"
                                    onClick={() => setFiltroCriticidad(op.id)}
                                    className={`rounded-full px-3.5 py-1 text-[10px] tracking-[0.14em] uppercase border transition-all ${
                                      activo
                                        ? "border-sky-400 bg-sky-400 text-[#041527] font-bold"
                                        : "border-sky-200/15 bg-[#040b16]/85 text-slate-300 hover:border-sky-400/50 hover:text-white"
                                    }`}
                                  >
                                    {op.label} ({conteo})
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {sugerenciasFiltradas.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4">
                              {detalleActivo.sugerencias_remediacion.length === 0
                                ? "No se registraron brechas críticas en este documento."
                                : `No hay sugerencias en la categoría "${filtroCriticidad}" para este documento.`}
                            </p>
                          ) : (
                            sugerenciasFiltradas.map((sug) => {
                              const estaResuelta = Boolean(sug.resuelta);
                              const nivelUpper = (
                                sug.nivel_criticidad || ""
                              ).toUpperCase();
                              const badgeStyle = estaResuelta
                                ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-300"
                                : nivelUpper === "CRÍTICO"
                                ? "border-rose-400/45 bg-rose-500/15 text-rose-300"
                                : nivelUpper === "ALTO"
                                ? "border-orange-400/45 bg-orange-400/15 text-orange-300"
                                : nivelUpper === "MEDIO"
                                ? "border-amber-400/45 bg-amber-400/15 text-amber-300"
                                : "border-sky-400/45 bg-sky-400/15 text-sky-300";

                              return (
                                <div
                                  key={sug.id_sugerencia}
                                  className={`rounded-xl border p-4 space-y-3 transition-all ${
                                    estaResuelta
                                      ? "border-emerald-400/25 bg-emerald-950/25"
                                      : "border-sky-200/15 bg-[#040b16]/80"
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.16em] uppercase border ${badgeStyle}`}
                                      >
                                        {estaResuelta
                                          ? "Estado: Implementada"
                                          : `Criticidad: ${sug.nivel_criticidad}`}
                                      </span>
                                      {sug.areas_involucradas && (
                                        <span className="text-[11px] font-medium text-sky-300">
                                          Áreas: {sug.areas_involucradas}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {sug.score_confianza !== null && (
                                        <span className="text-[11px] text-slate-400">
                                          Confianza IA: {sug.score_confianza}%
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        disabled={actualizandoSugId === sug.id_sugerencia}
                                        onClick={() =>
                                          handleToggleSugerencia(sug.id_sugerencia)
                                        }
                                        className={`rounded-full px-3.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase border transition-all disabled:opacity-50 ${
                                          estaResuelta
                                            ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
                                            : "border-sky-400 bg-sky-400 text-[#041527] hover:bg-sky-300"
                                        }`}
                                      >
                                        {actualizandoSugId === sug.id_sugerencia
                                          ? "Actualizando..."
                                          : estaResuelta
                                          ? "✓ Implementada (Reabrir)"
                                          : "Marcar como Resuelta"}
                                      </button>
                                    </div>
                                  </div>

                                  <p
                                    className={`text-sm leading-relaxed ${
                                      estaResuelta
                                        ? "text-slate-500 line-through"
                                        : "text-slate-200"
                                    }`}
                                  >
                                    {sug.recomendacion}
                                  </p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </section>
          )}
        </main>
      )}

      {/* =====================================================================
          MODAL PERSONALIZADO DE CONFIRMACIÓN (CENTRADO EN PANTALLA)
         ===================================================================== */}
      {confirmModal.abierto && (
        <div
          className="fixed inset-0 z-50 bg-[#02060e]/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() =>
            !confirmModal.ejecutando &&
            setConfirmModal((prev) => ({ ...prev, abierto: false }))
          }
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-sky-300/25 bg-[#071324]/95 backdrop-blur-xl p-7 shadow-[0_25px_70px_rgba(0,0,0,0.85)] space-y-5"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/45 bg-rose-500/15 text-rose-300 shadow-inner">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <div>
                <span className="block text-[9px] font-semibold tracking-[0.22em] uppercase text-rose-300/90">
                  {confirmModal.subtitulo}
                </span>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {confirmModal.titulo}
                </h3>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              {confirmModal.mensaje}
            </p>

            {confirmModal.detalleDestacado && (
              <div className="rounded-xl border border-sky-200/15 bg-[#040b16]/90 px-4 py-3 text-xs font-mono font-medium text-amber-300 break-all">
                {confirmModal.detalleDestacado}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-sky-300/15">
              <button
                type="button"
                disabled={confirmModal.ejecutando}
                onClick={() => setConfirmModal((prev) => ({ ...prev, abierto: false }))}
                className="rounded-full border border-sky-200/20 bg-white/[0.04] px-5 py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-300 hover:border-sky-300/40 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmModal.ejecutando}
                onClick={ejecutarConfirmacion}
                className="rounded-full border border-rose-400/50 bg-rose-500/20 px-6 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase text-rose-200 hover:bg-rose-500 hover:text-white disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(244,63,94,0.28)]"
              >
                {confirmModal.ejecutando ? "Procesando..." : confirmModal.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL PERSONALIZADO DE NOTIFICACIÓN / ERROR (CENTRADO EN PANTALLA)
         ===================================================================== */}
      {avisoModal.abierto && (
        <div
          className="fixed inset-0 z-50 bg-[#02060e]/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAvisoModal((prev) => ({ ...prev, abierto: false }))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-sky-300/25 bg-[#071324]/95 backdrop-blur-xl p-7 shadow-[0_25px_70px_rgba(0,0,0,0.85)] space-y-5"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                  avisoModal.tipo === "error"
                    ? "border-amber-400/45 bg-amber-400/15 text-amber-300"
                    : "border-sky-400/45 bg-sky-400/15 text-sky-300"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                  />
                </svg>
              </div>
              <div>
                <span className="block text-[9px] font-semibold tracking-[0.22em] uppercase text-sky-300/80">
                  NOTIFICACIÓN DEL SISTEMA SGSI
                </span>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {avisoModal.titulo}
                </h3>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              {avisoModal.mensaje}
            </p>

            <div className="pt-2 flex justify-end border-t border-sky-300/15">
              <button
                type="button"
                onClick={() => setAvisoModal((prev) => ({ ...prev, abierto: false }))}
                className="rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-6 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-[#041527] hover:from-sky-300 hover:to-cyan-200 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER INSTITUCIONAL */}
      <footer className="relative z-20 mt-12 border-t border-sky-300/15 bg-[#06101f]/88 backdrop-blur-xl px-6 md:px-10 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/img/icon-512.png"
              alt="GapSecure"
              className="h-7 w-7 rounded-lg border border-sky-400/35"
            />
            <div className="text-xs text-slate-400">
              <span className="font-semibold tracking-[0.2em] text-slate-200 uppercase">
                GAP<span className="text-sky-400">SECURE</span>
              </span>{" "}
              · Plataforma SGSI ISO/IEC 27001:2022
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.google.com/maps/search/?api=1&query=Duoc+UC+Sede+Melipilla"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/45 bg-sky-400/12 px-5 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-sky-300 hover:bg-sky-400 hover:text-[#041527] transition-all"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                />
              </svg>
              Ubicación
            </a>

            <button
              type="button"
              onClick={() => setMostrarContacto(!mostrarContacto)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/45 bg-amber-400/12 px-5 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-amber-300 hover:bg-amber-400 hover:text-[#041527] transition-all"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              Contáctanos
            </button>

            {mostrarContacto && (
              <div className="inline-flex items-center gap-2.5 rounded-full border border-sky-300/20 bg-[#071324] px-4 py-1.5 text-xs text-slate-100 shadow-lg">
                <a
                  href="tel:+56961793745"
                  className="font-mono font-semibold text-sky-300 hover:underline"
                >
                  +56961793745
                </a>
                <button
                  type="button"
                  onClick={copiarTelefono}
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-slate-300 hover:bg-white/20"
                >
                  {telefonoCopiado ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}