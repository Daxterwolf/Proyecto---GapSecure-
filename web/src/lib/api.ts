const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface ResumenDashboard {
  total_activos_auditados: number;
  cumplimiento_promedio: number;
  brecha_promedio: number;
  total_riesgos_detectados: number;
  sugerencias_pendientes: number;
}

export interface ActivoItem {
  id_activo: number;
  nombre: string;
  area_organizativa: string;
  nivel_confidencialidad: number;
  nivel_integridad: number;
  nivel_disponibilidad: number;
  fecha_creacion: string;
  norma: string;
  cumple_norma: boolean;
  porcentaje_cumplimiento: number;
  porcentaje_brecha: number;
}

export interface DetalleActivo {
  activo: {
    id_activo: number;
    nombre: string;
    descripcion: string | null;
    area_organizativa: string;
    fecha_creacion: string;
    valoracion_cid: {
      confidencialidad: number;
      integridad: number;
      disponibilidad: number;
    };
  };
  evaluacion: {
    cumplimiento: boolean;
    fecha_evaluacion: string | null;
    metricas_gap: Record<string, unknown>;
  };
  riesgos: {
    id_riesgo: number;
    descripcion: string;
    impacto: string;
    probabilidad: string;
    nivel_riesgo: string;
  }[];
  sugerencias_remediacion: {
    id_sugerencia: number;
    recomendacion: string;
    nivel_criticidad: string;
    score_confianza: number | null;
    fecha_generacion: string;
  }[];
}

export interface RegistroHistorial {
  id_log: number;
  id_usuario: number;
  tabla_afectada: string;
  registro_id: number;
  accion: string;
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  hash_mod: string;
  fecha_modificacion: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("gapsecure_token");
}

export function setToken(token: string) {
  localStorage.setItem("gapsecure_token", token);
}

export function removeToken() {
  localStorage.removeItem("gapsecure_token");
}

async function fetchAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    throw new Error("Sesión expirada o credenciales inválidas.");
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Error HTTP ${response.status}`);
  }

  return response.json();
}

export async function loginUsuario(correo: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", correo);
  formData.append("password", password);

  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Correo o contraseña incorrectos");
  }

  const data = await response.json();
  setToken(data.access_token);
  return data;
}

export const getDashboardResumen = () =>
  fetchAuth<ResumenDashboard>("/dashboard/resumen");

export const getDashboardActivos = () =>
  fetchAuth<ActivoItem[]>("/dashboard/activos");

export const getDashboardActivoDetalle = (idActivo: number) =>
  fetchAuth<DetalleActivo>(`/dashboard/activos/${idActivo}/detalle`);

export const getDashboardHistorial = () =>
  fetchAuth<RegistroHistorial[]>("/dashboard/historial");

export async function analizarPdfAuditoria(params: {
  archivo: File;
  area_organizativa: string;
  nivel_confidencialidad: number;
  nivel_integridad: number;
  nivel_disponibilidad: number;
}) {
  const formData = new FormData();
  formData.append("archivo", params.archivo);
  formData.append("area_organizativa", params.area_organizativa);
  formData.append("nivel_confidencialidad", String(params.nivel_confidencialidad));
  formData.append("nivel_integridad", String(params.nivel_integridad));
  formData.append("nivel_disponibilidad", String(params.nivel_disponibilidad));

  return fetchAuth("/auditoria/analizar-pdf/", {
    method: "POST",
    body: formData,
  });
}