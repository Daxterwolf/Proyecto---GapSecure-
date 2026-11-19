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
} from "@/lib/api";

interface ResumenExtendido extends ResumenDashboard {
  cumplimiento_por_departamento?: {
    area: string;
    documentos_evaluados: number;
    porcentaje_cumplimiento: number;
    porcentaje_brecha: number;
  }[];
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

  // Gestión de Áreas Organizativas (Admin)
  const [nuevaArea, setNuevaArea] = useState({ nombre: "", descripcion: "" });
  const [guardandoArea, setGuardandoArea] = useState(false);

  // Carga PDF con multi-selección de áreas (compartido entre Admin y Auditor)
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

  const esAdmin = usuario?.id_rol === 1;

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
      alert(err instanceof Error ? err.message : "Error al guardar usuario");
    } finally {
      setGuardandoUser(false);
    }
  };

  const handleEliminarUsuario = async (u: UsuarioSistema) => {
    if (!confirm(`¿Seguro que deseas eliminar permanentemente a ${u.correo}?`)) return;
    try {
      await eliminarUsuario(u.id_usuario);
      setUsuarios(usuarios.filter((item) => item.id_usuario !== u.id_usuario));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar el usuario");
    }
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
      alert(err instanceof Error ? err.message : "Error al crear área");
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
      alert(err instanceof Error ? err.message : "Error al actualizar área");
    }
  };

  const handleEliminarArea = async (area: AreaOrganizativa) => {
    if (!confirm(`¿Eliminar el área "${area.nombre}"?`)) return;
    try {
      await eliminarAreaOrganizativa(area.id_area);
      setAreasCatalogo(areasCatalogo.filter((a) => a.id_area !== area.id_area));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar área");
    }
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
      alert(err instanceof Error ? err.message : "Error al obtener detalle");
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#121a2a] flex items-center justify-center text-[#d4af6a] tracking-[0.35em] text-xs uppercase">
        VERIFICANDO CREDENCIALES SGSI...
      </div>
    );
  }

  // Formulario reutilizable de carga PDF con multi-selección de áreas
  const renderFormularioPdf = () => (
    <section className="max-w-3xl mx-auto border border-slate-400/15 bg-[#1b273d]/80 p-8">
      <h2 className="text-sm tracking-[0.28em] uppercase text-[#d4af6a]">
        Análisis de Brechas ISO/IEC 27001:2022
      </h2>
      <p className="mt-2 text-xs text-slate-400">
        Selecciona una o varias áreas organizativas involucradas y carga tu evidencia PDF.
      </p>

      <form onSubmit={handleSubirPdf} className="mt-6 space-y-6 text-sm">
        <div>
          <label className="block text-[10px] tracking-[0.22em] uppercase text-slate-300 mb-2">
            Archivo PDF de Evidencia
          </label>
          <input
            type="file"
            accept=".pdf"
            required
            onChange={(e) => setArchivoPdf(e.target.files?.[0] || null)}
            className="w-full rounded-xl border border-dashed border-[#d4af6a]/40 bg-[#121a2a] p-4 text-xs text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-[#d4af6a] file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-[#121a2a]"
          />
        </div>

        {/* SELECTOR MÚLTIPLE INTERACTIVO DE ÁREAS ORGANIZATIVAS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] tracking-[0.22em] uppercase text-slate-300">
              Áreas Organizativas Involucradas
            </label>
            <span className="text-[11px] text-[#d4af6a]">
              Áreas seleccionadas: {areasSeleccionadas.length}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-400/20 bg-[#121a2a] p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        ? "border-[#d4af6a]/60 bg-[#d4af6a]/15 text-slate-100"
                        : "border-transparent hover:bg-slate-800/60 text-slate-400"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] border ${
                        marcada
                          ? "border-[#d4af6a] bg-[#d4af6a] text-[#121a2a] font-bold"
                          : "border-slate-500"
                      }`}
                    >
                      {marcada ? "✓" : ""}
                    </span>
                    <span className="truncate">{area.nombre}</span>
                  </button>
                );
              })}
          </div>

          {/* Vista de selección (Chips) + Área Responsable Principal */}
          {areasSeleccionadas.length > 0 && (
            <div className="pt-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                {areasSeleccionadas.map((nom) => (
                  <span
                    key={nom}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#d4af6a]/40 bg-[#d4af6a]/15 px-3 py-1 text-[11px] text-[#e6c687]"
                  >
                    {nom}
                    <button
                      type="button"
                      onClick={() => toggleAreaAuditor(nom)}
                      className="hover:text-white ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div>
                <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                  Área Responsable Principal del Documento
                </label>
                <select
                  value={areaPrincipal}
                  onChange={(e) => setAreaPrincipal(e.target.value)}
                  className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2 text-xs text-slate-100 focus:border-[#d4af6a] focus:outline-none"
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
            <label className="block text-[10px] tracking-[0.18em] uppercase text-slate-400 mb-1.5">
              Confidencialidad (1-5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={cid.c}
              onChange={(e) => setCid({ ...cid, c: Number(e.target.value) })}
              className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2 text-center text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.18em] uppercase text-slate-400 mb-1.5">
              Integridad (1-5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={cid.i}
              onChange={(e) => setCid({ ...cid, i: Number(e.target.value) })}
              className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2 text-center text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.18em] uppercase text-slate-400 mb-1.5">
              Disponibilidad (1-5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={cid.d}
              onChange={(e) => setCid({ ...cid, d: Number(e.target.value) })}
              className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2 text-center text-slate-100"
            />
          </div>
        </div>

        {mensajeAuditor && (
          <div className="rounded-xl border border-[#d4af6a]/40 bg-[#d4af6a]/10 p-3 text-xs text-[#e6c687] text-center">
            {mensajeAuditor}
          </div>
        )}

        <div className="pt-2 flex justify-center">
          <button
            type="submit"
            disabled={analizandoPdf || !archivoPdf}
            className="rounded-full border border-[#d4af6a] bg-[#d4af6a] px-10 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-[#121a2a] hover:bg-[#e6c687] disabled:opacity-50 transition-all"
          >
            {analizandoPdf ? "ANALIZANDO CON IA..." : "EJECUTAR AUDITORÍA PDF"}
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div className="min-h-screen bg-[#121a2a] text-slate-100 flex flex-col">
      {/* BARRA SUPERIOR EDITORIAL */}
      <header className="border-b border-slate-400/15 bg-[#162033]/90 backdrop-blur-md px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg border border-[#d4af6a]/40 bg-[#1b273d] flex items-center justify-center text-[#d4af6a] font-semibold text-xs tracking-widest">
            GS
          </div>
          <div>
            <h1 className="text-lg font-light tracking-[0.32em] text-[#d4af6a] uppercase">
              GAPSECURE
            </h1>
            <p className="text-[10px] tracking-[0.22em] text-slate-400 uppercase">
              {esAdmin
                ? "CONSOLA DE ADMINISTRACIÓN SGSI"
                : "PORTAL DE AUDITORÍA ISO/IEC 27001:2022"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-slate-200">
              {usuario?.nombre_completo || usuario?.correo}
            </p>
            <span
              className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[9px] tracking-[0.2em] uppercase border ${
                esAdmin
                  ? "border-[#d4af6a]/60 bg-[#d4af6a]/15 text-[#e6c687]"
                  : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {esAdmin ? "ROL: ADMINISTRADOR" : "ROL: AUDITOR"}
            </span>
          </div>

          <button
            onClick={cerrarSesion}
            className="rounded-full border border-slate-400/30 px-5 py-2 text-[10px] tracking-[0.22em] uppercase text-slate-300 hover:border-[#d4af6a] hover:text-[#d4af6a] transition-colors"
          >
            SALIR
          </button>
        </div>
      </header>

      {errorGlobal && (
        <div className="mx-6 md:mx-10 mt-6 rounded-xl border border-red-400/30 bg-red-950/40 px-5 py-3 text-xs text-red-200">
          {errorGlobal}
        </div>
      )}

      {/* =====================================================================
          VISTA 1: ADMINISTRADOR
         ===================================================================== */}
      {esAdmin ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-10 py-8 space-y-8">
          {/* KPIs Globales del Administrador */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5">
              <p className="text-[10px] tracking-[0.22em] uppercase text-slate-400">
                Usuarios Registrados
              </p>
              <p className="mt-2 text-3xl font-light text-[#d4af6a]">{usuarios.length}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {usuarios.filter((u) => u.id_rol === 1).length} Admin ·{" "}
                {usuarios.filter((u) => u.id_rol === 2).length} Auditores
              </p>
            </div>

            <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5">
              <p className="text-[10px] tracking-[0.22em] uppercase text-slate-400">
                Áreas Organizativas
              </p>
              <p className="mt-2 text-3xl font-light text-slate-100">
                {areasCatalogo.filter((a) => a.activa).length}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Departamentos activos</p>
            </div>

            <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5">
              <p className="text-[10px] tracking-[0.22em] uppercase text-slate-400">
                Cumplimiento Global
              </p>
              <p className="mt-2 text-3xl font-light text-emerald-400">
                {resumen?.cumplimiento_promedio?.toFixed(1) ?? 0}%
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {resumen?.total_activos_auditados ?? 0} activos auditados
              </p>
            </div>

            <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5">
              <p className="text-[10px] tracking-[0.22em] uppercase text-slate-400">
                Registros Bitácora
              </p>
              <p className="mt-2 text-3xl font-light text-slate-100">{historial.length}</p>
              <p className="mt-1 text-[11px] text-slate-400">Trazabilidad SHA-256</p>
            </div>
          </section>

          {/* Navegación interna de Administrador */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-400/15 pb-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setTabAdmin("usuarios")}
                className={`rounded-full px-5 py-2 text-[11px] tracking-[0.2em] uppercase transition-all ${
                  tabAdmin === "usuarios"
                    ? "border border-[#d4af6a] bg-[#d4af6a]/15 text-[#e6c687]"
                    : "border border-slate-400/20 text-slate-400 hover:text-white"
                }`}
              >
                Gestión de Usuarios
              </button>
              <button
                onClick={() => setTabAdmin("areas")}
                className={`rounded-full px-5 py-2 text-[11px] tracking-[0.2em] uppercase transition-all ${
                  tabAdmin === "areas"
                    ? "border border-[#d4af6a] bg-[#d4af6a]/15 text-[#e6c687]"
                    : "border border-slate-400/20 text-slate-400 hover:text-white"
                }`}
              >
                Áreas Organizativas ({areasCatalogo.length})
              </button>
              <button
                onClick={() => setTabAdmin("subir")}
                className={`rounded-full px-5 py-2 text-[11px] tracking-[0.2em] uppercase transition-all ${
                  tabAdmin === "subir"
                    ? "border border-[#d4af6a] bg-[#d4af6a]/15 text-[#e6c687]"
                    : "border border-slate-400/20 text-slate-400 hover:text-white"
                }`}
              >
                Subir Documento PDF
              </button>
              <button
                onClick={() => setTabAdmin("auditoria")}
                className={`rounded-full px-5 py-2 text-[11px] tracking-[0.2em] uppercase transition-all ${
                  tabAdmin === "auditoria"
                    ? "border border-[#d4af6a] bg-[#d4af6a]/15 text-[#e6c687]"
                    : "border border-slate-400/20 text-slate-400 hover:text-white"
                }`}
              >
                Brechas por Departamento
              </button>
              <button
                onClick={() => setTabAdmin("bitacora")}
                className={`rounded-full px-5 py-2 text-[11px] tracking-[0.2em] uppercase transition-all ${
                  tabAdmin === "bitacora"
                    ? "border border-[#d4af6a] bg-[#d4af6a]/15 text-[#e6c687]"
                    : "border border-slate-400/20 text-slate-400 hover:text-white"
                }`}
              >
                Bitácora SHA-256
              </button>
            </div>

            {tabAdmin === "usuarios" && (
              <button
                onClick={abrirCrearUsuario}
                className="rounded-full border border-[#d4af6a] bg-[#d4af6a] px-6 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-[#121a2a] hover:bg-[#e6c687] transition-colors"
              >
                + Nuevo Usuario
              </button>
            )}
          </div>

          {/* TAB 1 ADMIN: CRUD DE USUARIOS */}
          {tabAdmin === "usuarios" && (
            <section className="border border-slate-400/15 bg-[#1b273d]/80 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-400/15 text-[10px] tracking-[0.22em] uppercase text-slate-400 bg-[#162033]">
                    <th className="py-4 px-6">ID</th>
                    <th className="py-4 px-6">Nombre Completo</th>
                    <th className="py-4 px-6">RUT</th>
                    <th className="py-4 px-6">Correo Corporativo</th>
                    <th className="py-4 px-6">Rol</th>
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400/10 text-sm">
                  {usuarios.map((u) => (
                    <tr key={u.id_usuario} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6 text-slate-400">#{u.id_usuario}</td>
                      <td className="py-4 px-6 font-medium text-slate-100">{u.nombre_completo}</td>
                      <td className="py-4 px-6 text-slate-300 font-mono text-xs">{u.rut}</td>
                      <td className="py-4 px-6 text-slate-300">{u.correo}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] tracking-[0.18em] uppercase border ${
                            u.id_rol === 1
                              ? "border-[#d4af6a]/50 bg-[#d4af6a]/10 text-[#e6c687]"
                              : "border-sky-400/40 bg-sky-500/10 text-sky-300"
                          }`}
                        >
                          {u.id_rol === 1 ? "Administrador" : "Auditor"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs ${
                            u.activo ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.activo ? "bg-emerald-400" : "bg-red-400"
                            }`}
                          />
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-3">
                        <button
                          onClick={() => abrirEditarUsuario(u)}
                          className="text-xs tracking-wider uppercase text-[#d4af6a] hover:underline"
                        >
                          Editar
                        </button>
                        {u.id_usuario !== usuario?.id_usuario && (
                          <button
                            onClick={() => handleEliminarUsuario(u)}
                            className="text-xs tracking-wider uppercase text-red-400 hover:underline"
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
                className="border border-slate-400/15 bg-[#1b273d]/80 p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
              >
                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                    Nombre del Área / Departamento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ciberseguridad Operativa"
                    value={nuevaArea.nombre}
                    onChange={(e) => setNuevaArea({ ...nuevaArea, nombre: e.target.value })}
                    className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2 text-sm text-slate-100 focus:border-[#d4af6a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                    Responsabilidad Principal
                  </label>
                  <input
                    type="text"
                    placeholder="Descripción funcional del departamento"
                    value={nuevaArea.descripcion}
                    onChange={(e) => setNuevaArea({ ...nuevaArea, descripcion: e.target.value })}
                    className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2 text-sm text-slate-100 focus:border-[#d4af6a] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoArea}
                  className="rounded-full border border-[#d4af6a] bg-[#d4af6a] px-6 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-[#121a2a] hover:bg-[#e6c687]"
                >
                  {guardandoArea ? "Agregando..." : "+ Agregar Área"}
                </button>
              </form>

              <div className="border border-slate-400/15 bg-[#1b273d]/80 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-400/15 text-[10px] tracking-[0.22em] uppercase text-slate-400 bg-[#162033]">
                      <th className="py-3.5 px-6">N.º</th>
                      <th className="py-3.5 px-6">Área Organizativa</th>
                      <th className="py-3.5 px-6">Responsabilidad Principal</th>
                      <th className="py-3.5 px-6">Estado</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/10 text-sm">
                    {areasCatalogo.map((area, idx) => (
                      <tr key={area.id_area} className="hover:bg-slate-800/30">
                        <td className="py-3.5 px-6 text-slate-400">{idx + 1}</td>
                        <td className="py-3.5 px-6 font-medium text-slate-100">{area.nombre}</td>
                        <td className="py-3.5 px-6 text-xs text-slate-300">
                          {area.descripcion || "—"}
                        </td>
                        <td className="py-3.5 px-6">
                          <button
                            onClick={() => handleToggleAreaActiva(area)}
                            className={`px-3 py-0.5 rounded-full text-[10px] uppercase border ${
                              area.activa
                                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                                : "border-slate-500/40 bg-slate-700/20 text-slate-400"
                            }`}
                          >
                            {area.activa ? "Activa" : "Inactiva"}
                          </button>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => handleEliminarArea(area)}
                            className="text-xs uppercase text-red-400 hover:underline"
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
              <div className="border border-slate-400/15 bg-[#1b273d]/80 p-6 space-y-4">
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#d4af6a]">
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
                        className="border border-slate-400/15 bg-[#121a2a]/70 p-4 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium text-slate-100">{dep.area}</p>
                          <span className="text-xs font-semibold text-[#d4af6a]">
                            {dep.porcentaje_cumplimiento}% cumplimiento
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#d4af6a]"
                            style={{ width: `${dep.porcentaje_cumplimiento}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {dep.documentos_evaluados} documento(s) auditado(s) · Brecha:{" "}
                          {dep.porcentaje_brecha}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-400/15 bg-[#1b273d]/80 p-6 space-y-4">
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#d4af6a]">
                  Documentos Auditados en la Plataforma
                </h2>
                <div className="divide-y divide-slate-400/10">
                  {activos.map((a) => (
                    <div
                      key={a.id_activo}
                      className="py-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-medium text-slate-100">{a.nombre}</p>
                        <p className="text-xs text-slate-400">
                          Áreas: {a.area_organizativa} · Norma: {a.norma}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-emerald-400">
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
            <section className="border border-slate-400/15 bg-[#1b273d]/80 p-6 space-y-4">
              <h2 className="text-xs tracking-[0.25em] uppercase text-[#d4af6a]">
                Logs Criptográficos Inmutables (Control A.8.15)
              </h2>
              <div className="space-y-3">
                {historial.map((h) => (
                  <div
                    key={h.id_log}
                    className="border border-slate-400/10 bg-[#121a2a]/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="text-[#d4af6a] font-semibold uppercase">{h.accion}</span>{" "}
                      <span className="text-slate-300">
                        en tabla {h.tabla_afectada} (ID #{h.registro_id})
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono break-all">
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
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md border border-slate-400/20 bg-[#1b273d] p-7 shadow-2xl">
                <h3 className="text-sm tracking-[0.25em] uppercase text-[#d4af6a]">
                  {editandoUsuario ? "Modificar Usuario" : "Registrar Nuevo Usuario"}
                </h3>
                <form onSubmit={guardarUsuario} className="mt-6 space-y-4 text-sm">
                  <div>
                    <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formUser.nombre_completo}
                      onChange={(e) =>
                        setFormUser({ ...formUser, nombre_completo: e.target.value })
                      }
                      className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2.5 text-slate-100 focus:border-[#d4af6a] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                      RUT
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="12.345.678-9"
                      value={formUser.rut}
                      onChange={(e) => setFormUser({ ...formUser, rut: e.target.value })}
                      className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2.5 text-slate-100 focus:border-[#d4af6a] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                      Correo Corporativo
                    </label>
                    <input
                      type="email"
                      required
                      value={formUser.correo}
                      onChange={(e) => setFormUser({ ...formUser, correo: e.target.value })}
                      className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2.5 text-slate-100 focus:border-[#d4af6a] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                      {editandoUsuario ? "Nueva Contraseña (opcional)" : "Contraseña"}
                    </label>
                    <input
                      type="password"
                      required={!editandoUsuario}
                      value={formUser.password}
                      onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
                      placeholder={editandoUsuario ? "Dejar vacío para mantener" : "••••••••"}
                      className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2.5 text-slate-100 focus:border-[#d4af6a] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                        Rol en Sistema
                      </label>
                      <select
                        value={formUser.id_rol}
                        onChange={(e) =>
                          setFormUser({ ...formUser, id_rol: Number(e.target.value) })
                        }
                        className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2.5 text-slate-100 focus:border-[#d4af6a] focus:outline-none"
                      >
                        <option value={1}>Administrador</option>
                        <option value={2}>Auditor</option>
                      </select>
                    </div>

                    {editandoUsuario && (
                      <div>
                        <label className="block text-[10px] tracking-[0.2em] uppercase text-slate-400 mb-1.5">
                          Estado Cuenta
                        </label>
                        <select
                          value={formUser.activo ? "true" : "false"}
                          onChange={(e) =>
                            setFormUser({ ...formUser, activo: e.target.value === "true" })
                          }
                          className="w-full rounded-full border border-slate-400/25 bg-[#121a2a] px-4 py-2.5 text-slate-100 focus:border-[#d4af6a] focus:outline-none"
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
                      className="rounded-full border border-slate-400/30 px-5 py-2 text-[10px] tracking-[0.2em] uppercase text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoUser}
                      className="rounded-full border border-[#d4af6a] bg-[#d4af6a] px-6 py-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-[#121a2a]"
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
            VISTA 2: AUDITOR (Selector múltiple de áreas + Análisis Anexo A)
           ===================================================================== */
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-10 py-8 space-y-8">
          {/* KPIs Operativos del Auditor */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5">
              <p className="text-[10px] tracking-[0.22em] uppercase text-slate-400">
                Mis Documentos Auditados
              </p>
              <p className="mt-2 text-3xl font-light text-[#d4af6a]">
                {resumen?.total_activos_auditados ?? 0}
              </p>
            </div>
            <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5">
              <p className="text-[10px] tracking-[0.22em] uppercase text-slate-400">
                Cumplimiento Promedio
              </p>
              <p className="mt-2 text-3xl font-light text-emerald-400">
                {resumen?.cumplimiento_promedio?.toFixed(1) ?? 0}%
              </p>
            </div>
            <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5">
              <p className="text-[10px] tracking-[0.22em] uppercase text-slate-400">
                Sugerencias IA Pendientes
              </p>
              <p className="mt-2 text-3xl font-light text-amber-300">
                {resumen?.sugerencias_pendientes ?? 0}
              </p>
            </div>
          </section>

          {/* Selector de Pestañas del Auditor */}
          <div className="flex gap-3 border-b border-slate-400/15 pb-4">
            <button
              onClick={() => setTabAuditor("subir")}
              className={`rounded-full px-6 py-2 text-[11px] tracking-[0.2em] uppercase transition-all ${
                tabAuditor === "subir"
                  ? "border border-[#d4af6a] bg-[#d4af6a]/15 text-[#e6c687]"
                  : "border border-slate-400/20 text-slate-400 hover:text-white"
              }`}
            >
              1. Subir Documento PDF
            </button>
            <button
              onClick={() => setTabAuditor("resultados")}
              className={`rounded-full px-6 py-2 text-[11px] tracking-[0.2em] uppercase transition-all ${
                tabAuditor === "resultados"
                  ? "border border-[#d4af6a] bg-[#d4af6a]/15 text-[#e6c687]"
                  : "border border-slate-400/20 text-slate-400 hover:text-white"
              }`}
            >
              2. Revisar Sugerencias y Brechas ({activos.length})
            </button>
          </div>

          {/* TAB AUDITOR 1: CARGA DE PDF CON SELECTOR MÚLTIPLE DE ÁREAS */}
          {tabAuditor === "subir" && renderFormularioPdf()}

          {/* TAB AUDITOR 2: REVISIÓN DE SUGERENCIAS IA Y BRECHAS */}
          {tabAuditor === "resultados" && (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="border border-slate-400/15 bg-[#1b273d]/80 p-5 space-y-3">
                <h3 className="text-[10px] tracking-[0.24em] uppercase text-[#d4af6a]">
                  Documentos Evaluados
                </h3>
                {activos.length === 0 ? (
                  <p className="text-xs text-slate-400">Aún no has subido documentos PDF.</p>
                ) : (
                  activos.map((a) => (
                    <button
                      key={a.id_activo}
                      onClick={() => seleccionarActivo(a.id_activo)}
                      className={`w-full text-left p-4 border transition-all ${
                        detalleActivo?.activo.id_activo === a.id_activo
                          ? "border-[#d4af6a] bg-[#d4af6a]/10"
                          : "border-slate-400/15 bg-[#121a2a]/60 hover:border-slate-400/40"
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-100 truncate">{a.nombre}</p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {a.area_organizativa}
                      </p>
                      <div className="mt-2 flex justify-between text-[11px]">
                        <span className="text-emerald-400">Cumple: {a.porcentaje_cumplimiento}%</span>
                        <span className="text-amber-300">Brecha: {a.porcentaje_brecha}%</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="lg:col-span-2 border border-slate-400/15 bg-[#1b273d]/80 p-6 space-y-6">
                {!detalleActivo ? (
                  <p className="text-sm text-slate-400">
                    Selecciona un documento auditado para revisar las sugerencias de remediación.
                  </p>
                ) : (
                  <>
                    <div className="border-b border-slate-400/15 pb-4">
                      <span className="text-[10px] tracking-[0.22em] uppercase text-[#d4af6a]">
                        INFORME TÉCNICO DE REMEDIACIÓN · ANEXO A (93 CONTROLES)
                      </span>
                      <h3 className="text-xl font-light text-slate-100 mt-1">
                        {detalleActivo.activo.nombre}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Áreas involucradas: {detalleActivo.activo.area_organizativa} · Valoración CID:{" "}
                        {detalleActivo.activo.valoracion_cid.confidencialidad}/
                        {detalleActivo.activo.valoracion_cid.integridad}/
                        {detalleActivo.activo.valoracion_cid.disponibilidad}
                      </p>
                    </div>

                    {/* Referencia oficial de las 4 categorías del Anexo A */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="border border-sky-400/25 bg-sky-500/10 p-3">
                        <p className="text-[10px] uppercase text-sky-300">A.5 Organizacionales</p>
                        <p className="text-lg font-light text-slate-100 mt-1">37 controles</p>
                      </div>
                      <div className="border border-emerald-400/25 bg-emerald-500/10 p-3">
                        <p className="text-[10px] uppercase text-emerald-300">A.6 Personas</p>
                        <p className="text-lg font-light text-slate-100 mt-1">8 controles</p>
                      </div>
                      <div className="border border-amber-400/25 bg-amber-500/10 p-3">
                        <p className="text-[10px] uppercase text-amber-300">A.7 Físicos</p>
                        <p className="text-lg font-light text-slate-100 mt-1">14 controles</p>
                      </div>
                      <div className="border border-purple-400/25 bg-purple-500/10 p-3">
                        <p className="text-[10px] uppercase text-purple-300">A.8 Tecnológicos</p>
                        <p className="text-lg font-light text-slate-100 mt-1">34 controles</p>
                      </div>
                    </div>

                    {(() => {
                      const sugerenciasFiltradas =
                        detalleActivo.sugerencias_remediacion.filter((sug) => {
                          if (filtroCriticidad === "TODOS") return true;
                          return (
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
                      ];

                      return (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h4 className="text-xs tracking-[0.22em] uppercase text-slate-300">
                              Sugerencias Generadas por IA ({sugerenciasFiltradas.length}
                              {filtroCriticidad !== "TODOS"
                                ? ` de ${detalleActivo.sugerencias_remediacion.length}`
                                : ""}
                              )
                            </h4>

                            {/* BOTONES DE FILTRO POR CRITICIDAD */}
                            <div className="flex flex-wrap items-center gap-2">
                              {opcionesFiltro.map((op) => {
                                const conteo =
                                  op.id === "TODOS"
                                    ? detalleActivo.sugerencias_remediacion.length
                                    : detalleActivo.sugerencias_remediacion.filter(
                                        (s) =>
                                          (s.nivel_criticidad || "").toUpperCase() ===
                                          op.id
                                      ).length;

                                const activo = filtroCriticidad === op.id;

                                return (
                                  <button
                                    key={op.id}
                                    type="button"
                                    onClick={() => setFiltroCriticidad(op.id)}
                                    className={`rounded-full px-3.5 py-1 text-[10px] tracking-[0.16em] uppercase border transition-all ${
                                      activo
                                        ? "border-[#d4af6a] bg-[#d4af6a] text-[#121a2a] font-semibold"
                                        : "border-slate-400/25 bg-[#121a2a]/70 text-slate-300 hover:border-[#d4af6a]/60 hover:text-white"
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
                                : `No hay sugerencias con nivel de criticidad "${filtroCriticidad}" para este documento.`}
                            </p>
                          ) : (
                            sugerenciasFiltradas.map((sug) => {
                              const nivelUpper = (
                                sug.nivel_criticidad || ""
                              ).toUpperCase();
                              const badgeStyle =
                                nivelUpper === "CRÍTICO"
                                  ? "border-red-400/50 bg-red-500/15 text-red-300"
                                  : nivelUpper === "ALTO"
                                  ? "border-orange-400/50 bg-orange-500/15 text-orange-300"
                                  : nivelUpper === "MEDIO"
                                  ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                                  : "border-sky-400/40 bg-sky-500/10 text-sky-300";

                              return (
                                <div
                                  key={sug.id_sugerencia}
                                  className="border border-slate-400/15 bg-[#121a2a]/80 p-4 space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] tracking-[0.18em] uppercase border ${badgeStyle}`}
                                    >
                                      Criticidad: {sug.nivel_criticidad}
                                    </span>
                                    {sug.areas_involucradas && (
                                      <span className="text-[11px] text-[#d4af6a]">
                                        Áreas: {sug.areas_involucradas}
                                      </span>
                                    )}
                                    {sug.score_confianza !== null && (
                                      <span className="text-[11px] text-slate-400">
                                        Confianza IA: {sug.score_confianza}%
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-200 leading-relaxed">
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
    </div>
  );
}