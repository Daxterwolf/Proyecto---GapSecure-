const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface ResumenDashboard {
  total_activos_auditados: number;
  cumplimiento_promedio: number;
  brecha_promedio: number;
  total_riesgos_detectados: number;
  sugerencias_pendientes: number;
  cumplimiento_por_departamento?: {
    area: string;
    documentos_evaluados: number;
    porcentaje_cumplimiento: number;
    porcentaje_brecha: number;
  }[];
}

export interface ActivoItem {
  id_activo: number;
  nombre: string;
  area_organizativa: string;
  areas_involucradas?: string[];
  area_principal?: string;
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
    areas_involucradas?: string | null;
    score_confianza: number | null;
    fecha_generacion: string;
    resuelta?: boolean;
    fecha_resolucion?: string | null;
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

export interface AreaOrganizativa {
  id_area: number;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
}

export interface UsuarioSistema {
  id_usuario: number;
  id_rol: number;
  nombre_completo: string;
  rut: string;
  correo: string;
  es_2fa_activo: boolean;
  activo: boolean;
  fecha_creacion: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  requires_2fa?: boolean;
  temp_token?: string | null;
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

// ==========================================
// AUTENTICACIÓN Y 2FA (TOTP)
// ==========================================
export async function loginUsuario(correo: string, password: string): Promise<LoginResponse> {
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

  const data: LoginResponse = await response.json();
  if (!data.requires_2fa && data.access_token) {
    setToken(data.access_token);
  }
  return data;
}

export async function verificarCodigo2FALogin(
  tempToken: string,
  code: string
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/login/2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ temp_token: tempToken, code }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Código de verificación 2FA incorrecto");
  }

  const data: LoginResponse = await response.json();
  if (data.access_token) {
    setToken(data.access_token);
  }
  return data;
}

export const setup2FA = () =>
  fetchAuth<{ secret: string; otpauth_url: string; qr_base64: string }>("/2fa/setup", {
    method: "POST",
  });

export const confirmar2FA = (code: string) =>
  fetchAuth<UsuarioSistema>("/2fa/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

export const desactivar2FA = () =>
  fetchAuth<UsuarioSistema>("/2fa/disable", {
    method: "POST",
  });

// ==========================================
// DASHBOARD & AUDITORÍA PDF
// ==========================================
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
  areas_seleccionadas?: string[];
  nivel_confidencialidad: number;
  nivel_integridad: number;
  nivel_disponibilidad: number;
}) {
  const formData = new FormData();
  formData.append("file", params.archivo);
  formData.append("area_organizativa", params.area_organizativa);
  formData.append(
    "areas_seleccionadas",
    JSON.stringify(params.areas_seleccionadas || [params.area_organizativa])
  );
  formData.append("nivel_confidencialidad", String(params.nivel_confidencialidad));
  formData.append("nivel_integridad", String(params.nivel_integridad));
  formData.append("nivel_disponibilidad", String(params.nivel_disponibilidad));

  return fetchAuth("/auditoria/analizar-pdf/", {
    method: "POST",
    body: formData,
  });
}

export const toggleSugerenciaResuelta = (idSugerencia: number) =>
  fetchAuth<{
    id_sugerencia: number;
    id_activo: number;
    resuelta: boolean;
    fecha_resolucion: string | null;
    pendientes_restantes: number;
    porcentaje_cumplimiento: number;
  }>(`/sugerencias/${idSugerencia}/toggle-resuelta`, {
    method: "PATCH",
  });

// ==========================================
// ÁREAS ORGANIZATIVAS
// ==========================================
export const getAreasOrganizativas = (soloActivas = false) =>
  fetchAuth<AreaOrganizativa[]>(`/areas/?solo_activas=${soloActivas}`);

export const crearAreaOrganizativa = (payload: {
  nombre: string;
  descripcion?: string;
  activa?: boolean;
}) =>
  fetchAuth<AreaOrganizativa>("/areas/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const actualizarAreaOrganizativa = (
  id_area: number,
  payload: Partial<{ nombre: string; descripcion: string; activa: boolean }>
) =>
  fetchAuth<AreaOrganizativa>(`/areas/${id_area}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const eliminarAreaOrganizativa = (id_area: number) =>
  fetchAuth<{ message: string }>(`/areas/${id_area}`, {
    method: "DELETE",
  });

// ==========================================
// USUARIOS
// ==========================================
export const getUsuarioActual = () =>
  fetchAuth<UsuarioSistema>("/usuarios/me");

export const getUsuarios = () =>
  fetchAuth<UsuarioSistema[]>("/usuarios/");

export const crearUsuario = (payload: {
  id_rol: number;
  nombre_completo: string;
  rut: string;
  correo: string;
  password: string;
  es_2fa_activo?: boolean;
  activo?: boolean;
}) =>
  fetchAuth<UsuarioSistema>("/usuarios/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const actualizarUsuario = (
  id_usuario: number,
  payload: Partial<{
    id_rol: number;
    nombre_completo: string;
    rut: string;
    correo: string;
    password: string;
    es_2fa_activo: boolean;
    activo: boolean;
  }>
) =>
  fetchAuth<UsuarioSistema>(`/usuarios/${id_usuario}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const eliminarUsuario = (id_usuario: number) =>
  fetchAuth<{ message: string }>(`/usuarios/${id_usuario}`, {
    method: "DELETE",
  });