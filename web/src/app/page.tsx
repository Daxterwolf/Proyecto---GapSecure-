"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  removeToken,
  getDashboardResumen,
  getDashboardActivos,
  getDashboardActivoDetalle,
  getDashboardHistorial,
  analizarPdfAuditoria,
  ResumenDashboard,
  ActivoItem,
  DetalleActivo,
  RegistroHistorial,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [tabActiva, setTabActiva] = useState<"activos" | "nueva" | "historial">("activos");

  // Estados de datos
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [activos, setActivos] = useState<ActivoItem[]>([]);
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);

  // Estados de detalle de activo
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<DetalleActivo | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [filtroCriticidad, setFiltroCriticidad] = useState<string>("Todas");

  // Estados formulario subida PDF
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);
  const [areaOrganizativa, setAreaOrganizativa] = useState("Seguridad de la Información");
  const [confidencialidad, setConfidencialidad] = useState(4);
  const [integridad, setIntegridad] = useState(4);
  const [disponibilidad, setDisponibilidad] = useState(3);
  const [analizandoPdf, setAnalizandoPdf] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  async function cargarDatosDashboard() {
    setCargando(true);
    setError("");
    try {
      const [resData, actData, histData] = await Promise.all([
        getDashboardResumen(),
        getDashboardActivos(),
        getDashboardHistorial(),
      ]);
      setResumen(resData);
      setActivos(actData);
      setHistorial(histData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cargando el dashboard";
      setError(msg);
      if (msg.includes("Sesión expirada")) {
        router.push("/login");
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    cargarDatosDashboard();
  }, [router]);

  async function handleVerDetalle(idActivo: number) {
    setCargandoDetalle(true);
    setFiltroCriticidad("Todas");
    try {
      const data = await getDashboardActivoDetalle(idActivo);
      setDetalleSeleccionado(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el detalle");
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function handleSubirPdf(e: FormEvent) {
    e.preventDefault();
    if (!archivoPdf) {
      setError("Selecciona un archivo PDF antes de iniciar la auditoría.");
      return;
    }

    setAnalizandoPdf(true);
    setError("");
    setMensajeExito("");

    try {
      await analizarPdfAuditoria({
        archivo: archivoPdf,
        area_organizativa: areaOrganizativa,
        nivel_confidencialidad: confidencialidad,
        nivel_integridad: integridad,
        nivel_disponibilidad: disponibilidad,
      });

      setMensajeExito(`Auditoría completada sobre "${archivoPdf.name}".`);
      setArchivoPdf(null);
      await cargarDatosDashboard();
      setTabActiva("activos");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al analizar el PDF");
    } finally {
      setAnalizandoPdf(false);
    }
  }

  function handleCerrarSesion() {
    removeToken();
    router.push("/login");
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <p className="text-sm animate-pulse">Cargando métricas SGSI ISO 27001:2022...</p>
      </div>
    );
  }

  const sugerenciasFiltradas =
    detalleSeleccionado?.sugerencias_remediacion.filter((s) =>
      filtroCriticidad === "Todas" ? true : s.nivel_criticidad === filtroCriticidad
    ) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Barra superior */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center">
              GS
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-none">GapSecure</h1>
              <span className="text-xs text-slate-400">
                Auditoría Automatizada ISO/IEC 27001:2022
              </span>
            </div>
          </div>

          <button
            onClick={handleCerrarSesion}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Alertas globales */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        {mensajeExito && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            {mensajeExito}
          </div>
        )}

        {/* Tarjetas KPI */}
        {resumen && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Activos Auditados</p>
              <p className="text-3xl font-bold text-white mt-2">
                {resumen.total_activos_auditados}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Cumplimiento Prom.</p>
              <p className="text-3xl font-bold text-emerald-400 mt-2">
                {resumen.cumplimiento_promedio}%
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Brecha Promedio</p>
              <p className="text-3xl font-bold text-amber-400 mt-2">
                {resumen.brecha_promedio}%
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Riesgos Detectados</p>
              <p className="text-3xl font-bold text-rose-400 mt-2">
                {resumen.total_riesgos_detectados}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Sugerencias IA</p>
              <p className="text-3xl font-bold text-sky-400 mt-2">
                {resumen.sugerencias_pendientes}
              </p>
            </div>
          </section>
        )}

        {/* Navegación de Módulos */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setTabActiva("activos")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              tabActiva === "activos"
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Activos y Gap Analysis ({activos.length})
          </button>

          <button
            onClick={() => setTabActiva("nueva")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              tabActiva === "nueva"
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            + Nueva Auditoría PDF
          </button>

          <button
            onClick={() => setTabActiva("historial")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              tabActiva === "historial"
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Bitácora SHA-256 ({historial.length})
          </button>
        </div>

        {/* TAB 1: LISTA DE ACTIVOS AUDITADOS */}
        {tabActiva === "activos" && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h2 className="font-semibold text-base text-white">
                Catálogo de Activos Evaluados (ISO/IEC 27001:2022)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3.5">Activo / Documento</th>
                    <th className="px-5 py-3.5">Área</th>
                    <th className="px-5 py-3.5">Valoración CID</th>
                    <th className="px-5 py-3.5">Cumplimiento</th>
                    <th className="px-5 py-3.5">Brecha</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {activos.map((act) => (
                    <tr key={act.id_activo} className="hover:bg-slate-800/40">
                      <td className="px-5 py-4 font-medium text-white">{act.nombre}</td>
                      <td className="px-5 py-4 text-slate-300">{act.area_organizativa}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex gap-1.5 text-xs font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-700">
                          C:{act.nivel_confidencialidad} · I:{act.nivel_integridad} · D:
                          {act.nivel_disponibilidad}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${act.porcentaje_cumplimiento}%` }}
                            />
                          </div>
                          <span className="text-emerald-400 font-semibold">
                            {act.porcentaje_cumplimiento}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-amber-400 font-semibold">
                        {act.porcentaje_brecha}%
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleVerDetalle(act.id_activo)}
                          className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-medium transition cursor-pointer"
                        >
                          {cargandoDetalle ? "Cargando..." : "Ver Brechas y Sugerencias"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                        Aún no hay activos auditados. Sube tu primer PDF en &quot;+ Nueva Auditoría PDF&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: FORMULARIO NUEVA AUDITORÍA PDF */}
        {tabActiva === "nueva" && (
          <section className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              Ejecutar Nueva Auditoría Documental (93 Controles ISO 27001:2022)
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              El motor evaluará el contenido técnico del PDF, calculará el nivel de brecha y registrará la evidencia con firma SHA-256.
            </p>

            <form onSubmit={handleSubirPdf} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Documento de Evidencia / Política (PDF)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setArchivoPdf(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 bg-slate-950 border border-slate-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Área Organizativa / Asset Owner
                </label>
                <input
                  type="text"
                  required
                  value={areaOrganizativa}
                  onChange={(e) => setAreaOrganizativa(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Confidencialidad (1-5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={confidencialidad}
                    onChange={(e) => setConfidencialidad(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Integridad (1-5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={integridad}
                    onChange={(e) => setIntegridad(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Disponibilidad (1-5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={disponibilidad}
                    onChange={(e) => setDisponibilidad(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={analizandoPdf}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm transition cursor-pointer"
              >
                {analizandoPdf ? "Analizando controles ISO 27001..." : "Iniciar Análisis ISO 27001"}
              </button>
            </form>
          </section>
        )}

        {/* TAB 3: BITÁCORA DE AUDITORÍA SHA-256 */}
        {tabActiva === "historial" && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h2 className="font-semibold text-base text-white">
                Registro Inmutable de Auditoría Criptográfica (ISO 27001 A.8.15)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3.5">ID</th>
                    <th className="px-5 py-3.5">Tabla / Registro</th>
                    <th className="px-5 py-3.5">Acción</th>
                    <th className="px-5 py-3.5">Firma SHA-256</th>
                    <th className="px-5 py-3.5">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {historial.map((log) => (
                    <tr key={log.id_log} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                        #{log.id_log}
                      </td>
                      <td className="px-5 py-3.5 text-slate-200">
                        {log.tabla_afectada} (ID {log.registro_id})
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {log.accion}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-sky-400 break-all max-w-xs">
                        {log.hash_mod}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {new Date(log.fecha_modificacion).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* PANEL DETALLE DE BRECHAS Y SUGERENCIAS */}
        {detalleSeleccionado && (
          <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-sky-400 font-semibold">
                  Informe Técnico de Brechas
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {detalleSeleccionado.activo.nombre}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Área: {detalleSeleccionado.activo.area_organizativa} · CID (
                  {detalleSeleccionado.activo.valoracion_cid.confidencialidad}/
                  {detalleSeleccionado.activo.valoracion_cid.integridad}/
                  {detalleSeleccionado.activo.valoracion_cid.disponibilidad})
                </p>
              </div>

              <button
                onClick={() => setDetalleSeleccionado(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
              >
                Cerrar detalle
              </button>
            </div>

            {/* Riesgos asociados */}
            <div>
              <h4 className="text-sm font-semibold text-rose-400 mb-3">
                Riesgos Identificados ({detalleSeleccionado.riesgos.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {detalleSeleccionado.riesgos.map((r) => (
                  <div
                    key={r.id_riesgo}
                    className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase text-rose-400">
                        Nivel {r.nivel_riesgo}
                      </span>
                      <span className="text-xs text-slate-400">
                        Impacto: {r.impacto} · Prob.: {r.probabilidad}
                      </span>
                    </div>
                    <p className="text-slate-200">{r.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sugerencias de remediación */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-semibold text-emerald-400">
                  Plan de Remediación ISO 27001 ({sugerenciasFiltradas.length} controles)
                </h4>

                <div className="flex gap-1.5">
                  {["Todas", "Alta", "Media", "Baja"].map((nivel) => (
                    <button
                      key={nivel}
                      onClick={() => setFiltroCriticidad(nivel)}
                      className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                        filtroCriticidad === nivel
                          ? "bg-sky-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {nivel}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {sugerenciasFiltradas.map((sug) => (
                  <div
                    key={sug.id_sugerencia}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <p className="text-sm text-slate-200">{sug.recomendacion}</p>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        sug.nivel_criticidad === "Alta"
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : sug.nivel_criticidad === "Media"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-slate-700/40 text-slate-300"
                      }`}
                    >
                      Criticidad {sug.nivel_criticidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}