// src/lib/api.ts
import { API_URL } from "./constants";
import { getToken, clearSession } from "./sessions";
import type {
  CoordResp,
  CreateTeacherInput,
  Paginated,
  Teacher,
  PlacementExam,
  PlacementExamCreateDTO,
} from "./types";



/* ========== Helper ========== */
function isFormDataBody(init?: RequestInit) {
  return typeof FormData !== "undefined" && init?.body instanceof FormData;
}

type ApiInit = RequestInit & {
  auth?: boolean;
  json?: unknown; // Enviar JSON sin armar body a mano
};

function normalizeErrorDetail(json: any, fallback: string): string {
  // FastAPI: detail puede ser string, objeto o lista de objetos
  if (!json) return fallback;
  const d = json.detail ?? json.message ?? json.error ?? json;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    // typical 422
    const parts = d.map((e) => {
      if (typeof e === "string") return e;
      if (e?.msg && e?.loc) return `${e.loc.join(".")}: ${e.msg}`;
      if (e?.msg) return e.msg;
      try { return JSON.stringify(e); } catch { return String(e); }
    });
    return parts.join(" · ");
  }
  try { return JSON.stringify(d); } catch { return String(d); }
}

// 👇 Exporta apiFetch para poder usarlo desde otros módulos
export async function apiFetch<T = any>(
  input: string,
  init?: ApiInit
): Promise<T> {
  const headers = new Headers(init?.headers || {});

  // Aceptamos json por defecto si no hay preferencia
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, */*;q=0.1");
  }

  if (init?.auth) {
    const token = getToken();
    if (!token) throw new Error("Sesión inválida");
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Si nos pasaron "json", armamos el body y el Content-Type (a menos que sea FormData)
  let body: BodyInit | undefined = init?.body;
  if (!isFormDataBody(init) && init?.json !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  // ⚠️ NO forzar JSON si mandamos FormData (multipart) o si ya lo pusimos con json
  if (!isFormDataBody(init) && !headers.has("Content-Type") && body && init?.json === undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (isFormDataBody(init) && headers.has("Content-Type")) {
    headers.delete("Content-Type");
  }

  let res: Response;
  try {
    res = await fetch(input, { ...init, headers, body, cache: "no-store" });
  } catch (err: any) {
    // Aquí cae el famoso "TypeError: Failed to fetch"
    const detail = err?.message || String(err);
    throw new Error(
      `No se pudo conectar con la API (${input}). ` +
      `Posibles causas: URL inválida, CORS, certificado o mixed content. ` +
      `Detalle: ${detail}`
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      try { clearSession(); } catch {}
      throw new Error("No autorizado. Vuelve a iniciar sesión.");
    }

    let detail = `Error ${res.status}`;
    try {
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const j = await res.json();
        detail = normalizeErrorDetail(j, detail);
      } else {
        const t = await res.text();
        if (t) detail = t;
      }
    } catch {
      // swallow
    }
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as unknown as T;

  // Devuelve JSON si hay; si no, texto.
  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  return (text as unknown) as T;
}

// 👇 Exporta buildURL para que puedas importarlo como named export
export function buildURL(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  if (!API_URL) throw new Error("API_URL no está definida");
  const base = API_URL.replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/?/, "/");
  let url: URL;
  try {
    url = new URL(`${base}${p}`);
  } catch {
    throw new Error(`URL inválida: base=${base} path=${p}`);
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

/* =================== Coordinadores =================== */

export async function listCoordinators({
  q, page, page_size,
}: { q?: string; page: number; page_size: number; }): Promise<CoordResp> {
  const url = buildURL("/admin/coordinators", { q, page, page_size });
  return apiFetch<CoordResp>(url, { auth: true });
}

export async function toggleCoordinatorStatus(id: number, is_active: boolean) {
  const url = buildURL(`/admin/coordinators/${id}/status`);
  return apiFetch(url, {
    method: "PATCH",
    json: { is_active }, // usa json
    auth: true,
  });
}

export async function createCoordinator(payload: {
  first_name: string; last_name: string; email: string; curp: string;
}) {
  const url = buildURL(`/admin/coordinators`);
  return apiFetch(url, {
    method: "POST",
    json: payload, // usa json
    auth: true,
  });
}

/* ================= Docentes (Coordinación) ================= */

export async function listTeachers(params?: {
  q?: string; page?: number; page_size?: number;
}): Promise<Teacher[]> {
  const url = buildURL("/coordinacion/docentes", {
    q: params?.q,
    page: params?.page ?? "",
    page_size: params?.page_size ?? "",
  });

  const raw = await apiFetch<Teacher[] | Paginated<Teacher>>(url, { auth: true });
  const items = Array.isArray(raw) ? raw : raw?.items;
  return items || [];
}

export async function inviteTeacher(input: CreateTeacherInput): Promise<Teacher> {
  const url = buildURL("/coordinacion/docentes/invite");
  return apiFetch<Teacher>(url, {
    method: "POST",
    json: {
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email.trim().toLowerCase(),
      curp: input.curp.trim().toUpperCase(),
    },
    auth: true,
  });
}

export async function suspendTeacher(id: string | number): Promise<void> {
  const url = buildURL(`/coordinacion/docentes/${id}/suspend`);
  await apiFetch(url, { method: "POST", auth: true });
}

export async function activateTeacher(id: string | number): Promise<void> {
  const url = buildURL(`/coordinacion/docentes/${id}/activate`);
  await apiFetch(url, { method: "POST", auth: true });
}

export async function deleteTeacher(id: string | number): Promise<void> {
  const url = buildURL(`/coordinacion/docentes/${id}`);
  await apiFetch<void>(url, { method: "DELETE", auth: true });
}

/* ================= Ciclos / Grupos (Coordinación) ================= */

export type Idioma = "ingles" | "frances" | "aleman" | "italiano" | "portugues";
export type Modalidad = "intensivo" | "sabatino" | "semestral";
export type Turno = "matutino" | "vespertino" | "mixto";
export type Nivel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type ModalidadAsistencia = "presencial" | "virtual";

export type PeriodoDTO = { from: string; to: string };
export type PeriodoInput = { from: string; to: string };

export type DocenteLite = {
  id: number; first_name: string; last_name: string; email: string;
} | null;

export type CicloDTO = {
  id: number;
  codigo: string;
  idioma: Idioma;
  modalidad: Modalidad;
  turno: Turno;
  nivel: Nivel;
  cupo_total: number;
  lugares_disponibles: number;
  dias: string[];
  hora_inicio: string;
  hora_fin: string;
  inscripcion: PeriodoDTO;
  curso: PeriodoDTO;
  examenMT?: string | null;
  examenFinal?: string | null;
  modalidad_asistencia?: ModalidadAsistencia;
  aula?: string | null;
  docente_id?: number | null;
  docente?: DocenteLite;
  notas?: string | null;
};

export type CicloListResponse = {
  items: CicloDTO[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type ListCiclosParams = {
  q?: string;
  idioma?: Idioma;
  modalidad?: Modalidad;
  turno?: Turno;
  nivel?: Nivel;
  docente_id?: number;
  page?: number;
  page_size?: number;
};

export type CreateCicloInput = {
  codigo: string;
  idioma: Idioma;
  modalidad: Modalidad;
  turno: Turno;
  nivel: Nivel;
  cupo_total: number;
  dias: string[];
  hora_inicio: string;
  hora_fin: string;
  inscripcion: PeriodoInput;
  curso: PeriodoInput;
  examenMT?: string;
  examenFinal?: string;
  modalidad_asistencia?: ModalidadAsistencia;
  aula?: string;
  docente_id?: number;
  notas?: string;
};

export type UpdateCicloInput = Partial<CreateCicloInput> & { codigo?: string };

export async function listCiclos(params: ListCiclosParams = {}): Promise<CicloListResponse> {
  const url = buildURL("/coordinacion/ciclos", {
    q: params.q,
    idioma: params.idioma,
    modalidad: params.modalidad,
    turno: params.turno,
    nivel: params.nivel,
    docente_id: params.docente_id,
    page: params.page ?? 1,
    page_size: params.page_size ?? 8,
  });
  return apiFetch<CicloListResponse>(url, { auth: true });
}

export async function createCiclo(input: CreateCicloInput): Promise<CicloDTO> {
  const url = buildURL("/coordinacion/ciclos");
  return apiFetch<CicloDTO>(url, { method: "POST", json: input, auth: true });
}

export async function updateCiclo(id: number | string, input: UpdateCicloInput): Promise<CicloDTO> {
  const url = buildURL(`/coordinacion/ciclos/${id}`);
  return apiFetch<CicloDTO>(url, { method: "PUT", json: input, auth: true });
}

export async function deleteCiclo(id: number | string): Promise<void> {
  const url = buildURL(`/coordinacion/ciclos/${id}`);
  await apiFetch<void>(url, { method: "DELETE", auth: true });
}

/* ================= Alumno – Ciclos e Inscripciones ================= */

export async function listCiclosAlumno(params: {
  q?: string;
  idioma?: Idioma;
  modalidad?: Modalidad;
  turno?: Turno;
  nivel?: Nivel;
  solo_abiertos?: boolean;
  page?: number;
  page_size?: number;
} = {}): Promise<CicloListResponse> {
  const url = buildURL("/alumno/ciclos", {
    q: params.q,
    idioma: params.idioma,
    modalidad: params.modalidad,
    turno: params.turno,
    nivel: params.nivel,
    solo_abiertos: params.solo_abiertos ?? true,
    page: params.page ?? 1,
    page_size: params.page_size ?? 8,
  });
  return apiFetch<CicloListResponse>(url, { auth: true });
}

/* ===== Inscripciones ===== */

export type InscripcionTipo = "pago" | "exencion";

export type ComprobanteMeta = {
  filename?: string | null;
  mimetype?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
};

export type InscripcionDTO = {
  id: number;
  ciclo_id: number;
  status: "registrada" | "preinscrita" | "confirmada" | "rechazada" | "cancelada";
  tipo: InscripcionTipo;
  created_at: string;
  referencia?: string | null;
  importe_centavos?: number | null;
  fecha_pago?: string | null;
  comprobante?: ComprobanteMeta | null;
  comprobante_estudios?: ComprobanteMeta | null;
  comprobante_exencion?: ComprobanteMeta | null;
  ciclo?: {
    id: number;
    codigo: string;
    idioma: string;
    modalidad: string;
    turno: string;
    nivel?: string | null;
    dias: string[];
    hora_inicio?: string | null;
    hora_fin?: string | null;
    aula?: string | null;
    inscripcion?: { from: string; to: string } | null;
    curso?: { from: string; to: string } | null;
  } | null;

  validated_by_id?: number | null;
  validated_at?: string | null;

  rechazo_motivo?: string | null;
  validation_notes?: string | null;
};

// 🔽 Tipos discriminados para crear inscripción
export type CreateInscripcionPago = {
  tipo?: "pago";
  ciclo_id: number;
  referencia: string;
  importe_centavos: number;
  fecha_pago: string;
  comprobante: File;
  comprobante_estudios?: File | null;
};

export type CreateInscripcionExencion = {
  tipo: "exencion";
  ciclo_id: number;
  comprobante_exencion: File;
};

export type CreateInscripcionInput = CreateInscripcionPago | CreateInscripcionExencion;

export async function createInscripcion(input: CreateInscripcionInput): Promise<void> {
  const url = buildURL("/alumno/inscripciones");
  const fd = new FormData();
  fd.append("ciclo_id", String(input.ciclo_id));

  if (input.tipo === "exencion") {
    fd.append("tipo", "exencion");
    fd.append("comprobante_exencion", input.comprobante_exencion);
  } else {
    fd.append("tipo", "pago");
    fd.append("referencia", input.referencia);
    fd.append("importe_centavos", String(input.importe_centavos));
    fd.append("fecha_pago", input.fecha_pago);
    fd.append("comprobante", input.comprobante);
    if (input.comprobante_estudios) {
      fd.append("comprobante_estudios", input.comprobante_estudios);
    }
  }

  await apiFetch(url, { method: "POST", body: fd, auth: true });
}

export async function listMisInscripciones(): Promise<InscripcionDTO[]> {
  const url = buildURL("/alumno/inscripciones");
  const raw = await apiFetch<InscripcionDTO[] | Paginated<InscripcionDTO>>(url, { auth: true });
  return Array.isArray(raw) ? raw : raw?.items ?? [];
}

export async function cancelarInscripcion(id: number | string): Promise<void> {
  const url = buildURL(`/alumno/inscripciones/${id}`);
  await apiFetch(url, { method: "DELETE", auth: true });
}

export async function listInscripcionesCiclo(ciclo_id: number) {
  const url = buildURL(`/coordinacion/ciclos/${ciclo_id}/inscripciones`);
  const raw = await apiFetch<any>(url, { auth: true });
  const rows = Array.isArray(raw) ? raw : raw?.items || [];
  return rows.map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    alumno: {
      first_name: r.alumno?.first_name ?? null,
      last_name: r.alumno?.last_name ?? null,
      email: r.alumno?.email ?? null,
      is_ipn: !!r.alumno?.is_ipn,
      boleta: r.alumno?.boleta ?? null,
    },
  }));
}

export async function downloadArchivoInscripcion(
  inscripcionId: number,
  tipo: "comprobante" | "estudios" | "exencion",
  suggestedName?: string
) {
  const url = buildURL(`/alumno/inscripciones/${inscripcionId}/archivo`, { tipo });
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const j = await res.json(); msg = j?.detail || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  try { window.open(objUrl, "_blank", "noopener,noreferrer"); } catch {}
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = suggestedName || "archivo";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

// ================== Coordinador – Validación de inscripciones ==================

export async function listInscripcionesCoord(params: {
  status?: string;
  ciclo_id?: number;
  skip?: number;
  limit?: number;
} = {}): Promise<InscripcionDTO[]> {
  const url = buildURL("/coordinacion/inscripciones", {
    status: params.status,
    ciclo_id: params.ciclo_id,
    skip: params.skip ?? 0,
    limit: params.limit ?? 50,
  });
  return apiFetch<InscripcionDTO[]>(url, { auth: true });
}

export async function validateInscripcionCoord(
  id: number,
  action: "APPROVE" | "REJECT",
  motivo?: string
): Promise<InscripcionDTO> {
  const url = buildURL(`/coordinacion/inscripciones/${id}/validate`);
  return apiFetch<InscripcionDTO>(url, {
    method: "POST",
    json: {
      action,
      motivo,        // 👈 back valida este campo (min_length=6)
      notes: motivo, // 👈 compat si el back aún lo lee
    },
    auth: true,
  });
}

export async function downloadArchivoInscripcionCoord(
  inscripcionId: number,
  tipo: "comprobante" | "estudios" | "exencion",
  suggestedName?: string
) {
  const url = buildURL(`/coordinacion/inscripciones/${inscripcionId}/archivo`, { tipo });
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const j = await res.json(); msg = j?.detail || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  try { window.open(objUrl, "_blank", "noopener,noreferrer"); } catch {}
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = suggestedName || "archivo";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

export type AlumnoHistorialResponse = {
  items: any[];
};

export async function getAlumnoHistorial(): Promise<AlumnoHistorialResponse> {
  const url = buildURL("/alumno/historial");
  const res = await apiFetch(url, { auth: true });
  return res as AlumnoHistorialResponse;
}

export async function listCiclosPublic(params: any = {}) {
  const url = buildURL("/public/ciclos-abiertos", params);
  return apiFetch(url, { auth: false });
}

/* ================= Placement Exams (Coordinación) ================= */

const PLACEMENT_BASE = "/placement-exams";

// ===== Listar con paginación y filtros =====
export async function listPlacementExams(params?: {
  page?: number;
  page_size?: number;
  q?: string;
  idioma?: Idioma;
  fecha_from?: string; // "YYYY-MM-DD"
  fecha_to?: string;   // "YYYY-MM-DD"
}): Promise<Paginated<PlacementExam>> {
  const url = buildURL(PLACEMENT_BASE, {
    page: params?.page,
    page_size: params?.page_size,
    q: params?.q,
    idioma: params?.idioma,
    fecha_from: params?.fecha_from,
    fecha_to: params?.fecha_to,
  });
  return apiFetch<Paginated<PlacementExam>>(url, { method: "GET", auth: true });
}

// Alias para compatibilidad con código viejo
export const listPlacement = listPlacementExams;


/* ========== (nuevo) helpers de placement ========== */
function normalizeInscWindow<T extends Record<string, any>>(input: T): T {
  const insc_inicio =
    input.insc_inicio ?? input.insc_from ?? input.inscripcion?.from ?? undefined;
  const insc_fin =
    input.insc_fin ?? input.insc_to ?? input.inscripcion?.to ?? undefined;

  const out: any = { ...input, insc_inicio, insc_fin };
  delete out.insc_from;
  delete out.insc_to;
  delete out.inscripcion;
  return out;
}


// ===== Crear nuevo examen =====
export async function createPlacementExam(payload: PlacementExamCreateDTO): Promise<PlacementExam> {
  const url = buildURL(PLACEMENT_BASE);
  const json = normalizeInscWindow(payload as any);
  return apiFetch<PlacementExam>(url, {
    method: "POST",
    auth: true,
    json,
  });
}

// ===== Actualizar examen existente =====
export async function updatePlacementExam(
  id: number,
  patch: Partial<PlacementExamCreateDTO>
): Promise<PlacementExam> {
  const url = buildURL(`${PLACEMENT_BASE}/${id}`);
  const json = normalizeInscWindow(patch as any);
  return apiFetch<PlacementExam>(url, {
    auth: true,
    method: "PATCH",
    json,
  });
}



// ===== Eliminar examen =====
export async function deletePlacementExam(id: number): Promise<void> {
  const url = buildURL(`${PLACEMENT_BASE}/${id}`);
  await apiFetch<void>(url, { method: "DELETE", auth: true });
}

/** ========= Endpoints públicos de Placement (para el sitio público) ========= **/

// (Compat) lista pública alternativa
export async function listPlacementPublic(params?: { q?: string; idioma?: string }) {
  const url = buildURL("/placement-exams/public", params as any);
  return apiFetch(url);
}

// Registro público/autenticado del alumno a un examen
export async function createPlacementRegistro(examId: number, fd: FormData) {
  const url = buildURL(`/placement-exams/${examId}/registros`);
  return apiFetch(url, { method: "POST", body: fd, auth: true });
}

export async function listMyPlacementRegistros() {
  const url = buildURL(`/placement-exams/mis-registros`);
  return apiFetch(url, { auth: true });
}

export async function cancelPlacementRegistro(id: number) {
  const url = buildURL(`/placement-exams/registros/${id}`);
  return apiFetch(url, { method: "DELETE", auth: true });
}

// === NUEVO: helpers para descargas autenticadas (no JSON) ===
export async function apiFetchBlobResponse(
  input: string,
  init?: ApiInit
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "*/*");

  if (init?.auth) {
    const token = getToken();
    if (!token) throw new Error("Sesión inválida");
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(input, { ...init, headers, cache: "no-store" });
  } catch (err: any) {
    const detail = err?.message || String(err);
    throw new Error(
      `No se pudo conectar con la API (${input}). ` +
      `Posibles causas: URL inválida, CORS, certificado o mixed content. ` +
      `Detalle: ${detail}`
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      try { clearSession(); } catch {}
      throw new Error("No autorizado. Vuelve a iniciar sesión.");
    }
    let detail = `Error ${res.status}`;
    try {
      const j = await res.clone().json();
      detail = normalizeErrorDetail(j, detail);
    } catch {
      try {
        const t = await res.clone().text();
        if (t) detail = t;
      } catch {}
    }
    throw new Error(detail);
  }

  return res; // el caller hará .blob()
}

export function inferFilenameFromResponse(resp: Response): string | null {
  const cd = resp.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
  if (m?.[1]) return decodeURIComponent(m[1].replace(/\"/g, ""));
  return null;
}

export async function forceDownloadFromResponse(
  resp: Response,
  fallbackName: string = "archivo"
) {
  const blob = await resp.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = inferFilenameFromResponse(resp) || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

// === Descarga de comprobante de placement ===
export async function downloadPlacementComprobante(
  registroId: number,
  suggestedName?: string
) {
  const url = buildURL(`/placement-exams/registros/${registroId}/comprobante`);
  const resp = await apiFetchBlobResponse(url, { auth: true, method: "GET" });
  await forceDownloadFromResponse(resp, suggestedName || `comprobante_${registroId}`);
}



/* ==================== Reportes (Coordinación) ==================== */
/** Tipos específicos de reportes para no chocar con CicloDTO, etc. */
export type ReportCicloLite = {
  id: number | string;
  codigo: string;
  idioma?: string | null;
  anio?: number | null;
};

export type ReportGrupoLite = {
  id: number | string;
  nombre: string;
};

export type ReportAlumnoInscrito = {
  inscripcion_id: number | string;
  boleta?: string | null;
  nombre: string;
  email?: string | null;
  fecha_inscripcion?: string | null;
  estado?: string | null;
};

export type ReportReporteInscritos = {
  ciclo: { id: number | string; codigo: string };
  grupo?: { id: number | string; nombre: string } | null;
  total: number;
  alumnos: ReportAlumnoInscrito[];
};

export type ReportPagoRow = {
  inscripcion_id: number | string;
  alumno: string;
  email?: string | null;
  referencia?: string | null;          // ya lo tienes
  tipo?: "pago" | "exencion";          // ya lo tienes
  status: "pendiente" | "validado" | "rechazado";
  importe_centavos: number;
  fecha_pago?: string | null;          // ISO con hora

  // 👇 NUEVO: para que el front muestre hora/minutos de validación
  validated_at?: string | null;        // ISO con hora (timestamptz)
 
};


export type ReportReportePagos = {
  ciclo: { id: number | string; codigo: string };
  grupo?: { id: number | string; nombre: string } | null;
  total_registros: number;
  total_validado_centavos: number;
  rows: ReportPagoRow[];
};

/** Lista de ciclos para filtros de reportes (año/idioma opcionales). */
export async function getReportCiclos(params?: {
  anio?: string | number;
  idioma?: string;
}): Promise<ReportCicloLite[]> {
  const url = buildURL("/coordinacion/ciclos", {
    // buildURL solo agrega si hay valor (no undefined/empty)
    anio: params?.anio,
    idioma: params?.idioma,
  });
  return apiFetch<ReportCicloLite[]>(url, { auth: true });
}

/** Lista de grupos por ciclo (si tu back aún no maneja grupos, devolverá []). */
export async function getReportGrupos(cicloId: string | number): Promise<ReportGrupoLite[]> {
  const url = buildURL("/coordinacion/grupos", { cicloId: String(cicloId) });
  return apiFetch<ReportGrupoLite[]>(url, { auth: true });
}

/** Reporte de alumnos inscritos por ciclo (y opcionalmente grupo). */
export async function getReporteInscritos(args: {
  cicloId: string | number;
  grupoId?: string | number;
}): Promise<ReportReporteInscritos> {
  const url = buildURL("/coordinacion/reportes/inscritos", {
    cicloId: String(args.cicloId),
    grupoId: args.grupoId !== undefined ? String(args.grupoId) : undefined,
  });
  return apiFetch<ReportReporteInscritos>(url, { auth: true });
}

/** Reporte de pagos por ciclo (y opcionalmente grupo). */
export async function getReportePagos(args: {
  cicloId: string | number;
  grupoId?: string | number;
}): Promise<ReportReportePagos> {
  const url = buildURL("/coordinacion/reportes/pagos", {
    cicloId: String(args.cicloId),
    grupoId: args.grupoId !== undefined ? String(args.grupoId) : undefined,
  });
  return apiFetch<ReportReportePagos>(url, { auth: true });
}

/* ==================== Reporte: Encuesta (Coordinación) ==================== */

export type SurveyOptionDTO = {
  opcion: string;     // Texto de la opción
  conteo: number;     // Número de votos
};

export type SurveyQuestionDTO = {
  id: string | number;
  texto: string;                // Enunciado de la pregunta
  opciones: SurveyOptionDTO[];  // Opciones con conteos
  total_respuestas?: number;    // Opcional (si no viene, se infiere sumando conteos)
};

export type ReportReporteEncuesta = {
  ciclo: { id: number | string; codigo: string };
  preguntas: SurveyQuestionDTO[];
  total_participantes?: number; // Opcional
};

/**
 * Reporte de resultados de encuesta por ciclo (Coordinación).
 * Backend esperado: GET /coordinacion/reportes/encuesta?cicloId=...
 */
export async function getReporteEncuesta(args: {
  cicloId: string | number;
}): Promise<ReportReporteEncuesta> {
  const url = buildURL("/coordinacion/reportes/encuesta", {
    cicloId: String(args.cicloId),
  });
  return apiFetch<ReportReporteEncuesta>(url, { auth: true });
}

/* ==================== Reporte: Desempeño Docente ==================== */

export type CoordDocenteLite = { id: number | string; nombre: string };

export async function getDocentes(params?: { q?: string; incluir_inactivos?: boolean; }) {
  const url = buildURL("/coordinacion/docentes", {
    q: params?.q,
    incluir_inactivos: params?.incluir_inactivos ?? false,
  });
  return apiFetch<CoordDocenteLite[]>(url, { auth: true });
}

export type SeriePunto = {
  ciclo_id: number | string;
  ciclo_codigo: string;     // ej. "2025-01"
  promedio_pct: number;     // 0..100
  fecha?: string | null;    // ISO opcional (para ordenar)
};

export type SerieDocenteResponse = {
  docente: { id: number | string; nombre: string };
  puntos: SeriePunto[];
};

export async function getSerieEncuestaDocente(args: {
  docenteId: string | number;
}): Promise<SerieDocenteResponse> {
  const url = buildURL("/coordinacion/reportes/desempeno-docente", {
    docenteId: String(args.docenteId),
  });
  return apiFetch<SerieDocenteResponse>(url, { auth: true });
}

// lib/api.ts
export async function getSerieEncuestaDocentePorPregunta(params: { docenteId: string|number, soloProfesor?: boolean }) {
  const url = buildURL("/coordinacion/reportes/desempeno-docente-por-pregunta", {
    docenteId: params.docenteId,
    ...(params.soloProfesor !== undefined ? { soloProfesor: params.soloProfesor } : {})
  });
  return apiFetch(url, { auth: true });
}

// ===== Comentarios de encuesta (open text) =====
export type EncuestaComentario = {
  id: string | number;
  pregunta_id: string | number | null;
  pregunta_texto: string | null;
  texto: string;
  created_at?: string | null;
  alumno?: {
    nombre?: string | null;
    email?: string | null;
  } | null;
};

// lib/api.ts
export async function getEncuestaComentarios(args: {
  cicloId: string | number;
  includeGeneral?: boolean;   // ← NUEVO (default: false)
  onlyCommentLike?: boolean;  // ← NUEVO (default: true)
  q?: string;                 // ← NUEVO (búsqueda server-side, opcional)
  limit?: number;
  offset?: number;
}): Promise<{ ciclo: any; total: number; items: EncuestaComentario[] }> {
  const url = buildURL("/coordinacion/reportes/encuesta/comentarios", {
    cicloId: String(args.cicloId),
    ...(args.includeGeneral !== undefined ? { includeGeneral: args.includeGeneral } : {}),
    ...(args.onlyCommentLike !== undefined ? { onlyCommentLike: args.onlyCommentLike } : {}),
    ...(args.q ? { q: args.q } : {}),
    ...(args.limit ? { limit: args.limit } : {}),
    ...(args.offset ? { offset: args.offset } : {}),
  });
  const resp = await apiFetch(url, { auth: true });

  const items: EncuestaComentario[] = (resp?.items ?? []).map((r: any) => ({
    id: r.id ?? r.pregunta_id ?? r.id,
    pregunta_id: r.pregunta_id ?? null,
    pregunta_texto: r.pregunta_texto ?? r.pregunta ?? null,
    texto: r.texto ?? r.comentario ?? "",
    created_at: r.created_at ?? r.fecha ?? null,
    alumno: {
      nombre: r.alumno?.nombre ?? r.alumno_nombre ?? null,
      email:  r.alumno?.email  ?? r.alumno_email  ?? null,
    },
  }));

  return {
    ciclo: resp?.ciclo ?? null,
    total: resp?.total ?? items.length,
    items,
  };
}

/* ============== Reportes: Pagos Examen de Colocación ================= */

export type PlacementExamLite = {
  id: number | string;
  codigo: string;
  idioma: string;
  fecha?: string | null; // ISO "YYYY-MM-DD"
};

/* ====== Admin: registros/pagos de placement ====== */

// URL corregida al router nuevo: /placement-exams/{exam_id}/registros-admin
export async function getPlacementRegistrosAdmin(
  examId: number | string,
  params?: { page_size?: number }
): Promise<{ exam?: any; total: number; items: any[] }> {
  const url = buildURL(`${PLACEMENT_BASE}/${examId}/registros-admin`, {
    page_size: params?.page_size ?? "",
  });
  const raw = await apiFetch<any>(url, { auth: true });

  const items: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
    ? raw.items
    : [];
  return {
    exam: raw?.exam ?? null,
    total: raw?.total ?? items.length,
    items,
  };
}

// Validar/rechazar registro (admin)
export async function validatePlacementRegistroAdmin(
  registroId: number,
  action: "APPROVE" | "REJECT",
  motivo?: string
) {
  const url = buildURL(`${PLACEMENT_BASE}/registros/${registroId}/validate`);
  return apiFetch(url, {
    method: "POST",
    auth: true,
    json: { action, motivo },
  });
}

// Descargar comprobante (admin)
export async function downloadPlacementComprobanteAdmin(
  registroId: number,
  suggestedName?: string
) {
  const url = buildURL(`${PLACEMENT_BASE}/registros/${registroId}/comprobante-admin`);
  const resp = await apiFetchBlobResponse(url, { auth: true, method: "GET" });
  await forceDownloadFromResponse(resp, suggestedName || `comprobante_${registroId}`);
}

// Stats de cupo para un examen
export async function getPlacementStatsAdmin(examId: number | string): Promise<{
  cupo_total?: number | null;
  ocupados: number;
  disponibles?: number | null;
}> {
  const url = buildURL(`${PLACEMENT_BASE}/${examId}/stats-admin`);
  return apiFetch(url, { auth: true });
}





/* =================== Utilities públicos =================== */

/** Fetch público simple que respeta API_URL y parsea JSON de forma segura. */
export async function publicFetch(
  path: string,
  opts?: RequestInit & { params?: Record<string, any> }
) {
  const url = buildURL(path, opts?.params);
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    credentials: "omit",
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    // Esto te da un error legible aunque el server devuelva HTML
    throw new Error(text?.slice(0, 300) || `HTTP ${res.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`);
  }
}

/* =================== Público: listado y capacidad de Placement =================== */

/** Tipo público tolerante (por si el back ya manda la capacidad directa). */
export type PlacementExamPublic = {
  id: number | string;
  codigo: string;
  idioma: string;
  fecha?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  sede?: string | null;
  inscripcion?: { from: string; to: string } | null;

  // opcionales si el backend decide mandarlos planos
  cupo_total?: number;
  cupo_restante?: number;

  // o anidados
  capacity?: {
    cupo_total: number;
    cupo_restante: number;
    inscritos_count?: number;
    holds_activos?: number;
  } | null;
};

/** Llamada pública original para listar exámenes (no siempre incluye capacidad). */
export async function listPlacementExamsPublic(params?: {
  idioma?: string;
  anio?: number;
  vigente?: boolean;
  include_capacity?: boolean; // 👈 nuevo
  page?: number;
  page_size?: number;
}) {
  const url = buildURL("/public/placement-exams", params as any);
  return apiFetch(url, { auth: false });
}

/** Estructura de capacidad que puede devolver el endpoint público. */
export type ExamCapacity = {
  id: number | string;
  cupo_total: number;
  cupo_restante: number;
  inscritos_count?: number;
  holds_activos?: number;
};

/**
 * Obtiene capacidad pública por lote.
 * Intenta GET con query `ids=a,b,c`; si no existe el endpoint, reintenta POST {ids:[]}.
 */
export async function getPlacementExamsCapacityPublic(ids: (number | string)[]) {
  if (!ids?.length) return {} as Record<string, ExamCapacity>;

  // 1) intento GET
  const urlGet = buildURL("/public/placement-exams/capacity", {
    ids: ids.join(","), // servidor: parsea CSV
  });

  try {
    const res = await apiFetch<ExamCapacity[] | Record<string, ExamCapacity>>(urlGet, { auth: false });
    if (Array.isArray(res)) {
      return res.reduce((acc, r) => { acc[String(r.id)] = r; return acc; }, {} as Record<string, ExamCapacity>);
    }
    return res as Record<string, ExamCapacity>;
  } catch {
    // 2) fallback POST
    const urlPost = buildURL("/public/placement-exams/capacity");
    const res = await apiFetch<ExamCapacity[] | Record<string, ExamCapacity>>(urlPost, {
      auth: false,
      method: "POST",
      json: { ids },
    });
    if (Array.isArray(res)) {
      return res.reduce((acc, r) => { acc[String(r.id)] = r; return acc; }, {} as Record<string, ExamCapacity>);
    }
    return res as Record<string, ExamCapacity>;
  }
}

// ===== Historial de alumno (Coordinación) =====
export type HistorialAsistenciaSummary = {
  presentes: number;
  ausentes: number;
  retardos: number;
  justificados: number;
  total_sesiones: number;
  porcentaje_asistencia: number;
};

export type HistorialCicloItem = {
  inscripcion_id: number;
  ciclo_id: number;
  ciclo_codigo: string;
  idioma?: string | null;
  nivel?: string | null;
  modalidad?: string | null;
  turno?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  horario?: string | null;

  inscripcion_estado?: string | null;
  inscripcion_tipo?: string | null;
  fecha_inscripcion?: string | null;

  calificacion?: number | null;

  docente_id?: number | null;
  docente_nombre?: string | null;
  docente_email?: string | null;

  asistencia: HistorialAsistenciaSummary;
};

export type HistorialAlumnoResponse = {
  alumno_id: number;
  total: number;
  items: HistorialCicloItem[];
};

function normalizeHistorialQuery(params?: { idioma?: string; anio?: number | string; estado?: string }) {
  if (!params) return {};
  const out: any = {};
  if (params.idioma) out.idioma = String(params.idioma).toLowerCase();
  if (params.anio !== undefined && params.anio !== null && String(params.anio).length > 0) {
    out.anio = Number(params.anio);
  }
  if (params.estado) out.estado = String(params.estado).toLowerCase();
  return out;
}

// --- Tipos del historial con evaluación detallada ---
export type HistorialAsistenciaSummary = {
  presentes: number;
  ausentes: number;
  retardos: number;
  justificados: number;
  total_sesiones: number;
  porcentaje_asistencia: number; // 0..100
};

export type EvaluacionDetalle = {
  medio_examen?: number | null;    // 0..80
  medio_continua?: number | null;  // 0..20
  final_examen?: number | null;    // 0..60
  final_continua?: number | null;  // 0..20
  final_tarea?: number | null;     // 0..20
  subtotal_medio: number;
  subtotal_final: number;
  promedio_final: number;
};

export type HistorialCicloItem = {
  inscripcion_id: number;
  ciclo_id: number;
  ciclo_codigo: string;
  idioma?: string | null;
  nivel?: string | null;
  modalidad?: string | null;
  turno?: string | null;

  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  horario?: string | null;

  inscripcion_estado?: string | null;
  inscripcion_tipo?: string | null;
  fecha_inscripcion?: string | null;

  calificacion?: number | null;         // calificación “plana” si existe
  evaluacion?: EvaluacionDetalle | null; // ⬅️ NUEVO: desglose por bloques

  docente_id?: number | null;
  docente_nombre?: string | null;
  docente_email?: string | null;

  asistencia: HistorialAsistenciaSummary;
};

export type HistorialAlumnoResponse = {
  alumno_id: number;
  total: number;
  items: HistorialCicloItem[];
};

// --- Cliente del endpoint /coordinacion/alumnos/{alumno_id}/historial ---
export async function getHistorialAlumno(
  alumnoId: string | number,
  filters: { idioma?: string; anio?: string | number; estado?: string } = {}
) {
  const url = buildURL(`/coordinacion/alumnos/${alumnoId}/historial`, {
    idioma: filters.idioma || undefined,
    anio: filters.anio || undefined,
    estado: filters.estado || undefined,
  });
  return apiFetch<HistorialAlumnoResponse>(url, { auth: true });
}




/* ==================== Docente: Encuestas (sesión del profesor) ==================== */
// Tipos específicos del módulo Docente para evitar conflictos con los de Coordinación
export type DocCicloLite = {
  id: number | string;
  codigo: string;
  idioma?: string | null;
  anio?: number | null;
};

export type DocenteMini = {
  id: number | string;
  nombre: string;
};

export type DocSurveyOptionDTO = { opcion: string; conteo: number };
export type DocSurveyCategoryDTO = { id: number | string; name: string; order: number };

export type DocSurveyQuestionDTO = {
  id: number | string;
  texto: string;
  opciones: DocSurveyOptionDTO[];
  total_respuestas?: number | null;
  promedio?: number | null;      // 1..5 o 0..10
  promedio_pct?: number | null;  // 0..100
  favorables_pct?: number | null;
  categoria?: DocSurveyCategoryDTO | null;
};

export type DocReporteEncuesta = {
  ciclo: { id: number | string; codigo: string };
  preguntas: DocSurveyQuestionDTO[];
  total_participantes: number;
  docente?: DocenteMini | null;
};

export type DocComentarioAlumno = { nombre?: string | null; email?: string | null };
export type DocComentarioOut = {
  id?: number | string | null;
  pregunta_id?: number | string | null;
  pregunta_texto?: string | null;
  texto: string;
  created_at?: string | null;
  alumno?: DocComentarioAlumno | null;
};
export type DocComentariosResponse = {
  ciclo?: { id: number | string; codigo: string } | null;
  total: number;
  items: DocComentarioOut[];
};

export type DocSeriePunto = {
  ciclo_id: number | string;
  ciclo_codigo: string;
  promedio_pct: number;
  fecha?: string | null;
};
export type DocSerieResponse = {
  docente: DocenteMini;
  puntos: DocSeriePunto[];
};

// ---- Endpoints ----

// Lista de ciclos asignados al docente
export async function getDocenteCiclos(params?: { anio?: number; idioma?: string }) {
  const url = buildURL("/docente/ciclos", {
    anio: params?.anio,
    idioma: params?.idioma,
  });
  return apiFetch<DocCicloLite[]>(url, { auth: true });
}

// Reporte de encuesta por ciclo (docente)
export async function getDocenteReporteEncuesta(cicloId: number | string) {
  const url = buildURL("/docente/reportes/encuesta", { cicloId: String(cicloId) });
  return apiFetch<DocReporteEncuesta>(url, { auth: true });
}

// Comentarios de encuesta (open text) del ciclo del docente
export async function getDocenteEncuestaComentarios(opts: {
  cicloId: number | string;
  includeGeneral?: boolean;
  onlyCommentLike?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const url = buildURL("/docente/reportes/encuesta/comentarios", {
    cicloId: String(opts.cicloId),
    includeGeneral: opts.includeGeneral ?? undefined,
    onlyCommentLike: opts.onlyCommentLike ?? undefined,
    q: opts.q || undefined,
    limit: opts.limit ?? undefined,
    offset: opts.offset ?? undefined,
  });
  return apiFetch<DocComentariosResponse>(url, { auth: true });
}

// Serie de promedio % por ciclo para el docente
export async function getDocenteEncuestaSerie() {
  const url = buildURL("/docente/reportes/encuesta/serie");
  return apiFetch<DocSerieResponse>(url, { auth: true });
}


// ===== Docente: serie por pregunta (todos los ciclos del docente en sesión) =====
export async function getDocenteSerieEncuestaPorPregunta(): Promise<{
  docente: { id: string | number; nombre: string };
  series: { id: string; label: string; data: { x: string; y: number }[] }[];
}> {
  const url = buildURL("/docente/reportes/encuesta/serie-por-pregunta");
  return apiFetch(url, { auth: true });
}


/* ==================== Coordinación – Dashboard (con cicloId opcional) ==================== */
/** Tipos y endpoints LIMPIOS para el dashboard de Coordinación.
 *  Mantén un solo bloque como este en el archivo para evitar duplicados.
 */

/* ===== Tipos “lite” para selectores ===== */
export type DashCicloLite = {
  id: number | string;
  codigo: string;
  idioma?: string | null;
  anio?: number | null;
};

export type DashGrupoLite = {
  id: number | string;
  nombre: string;
};

/* ===== Tipos de reportes ===== */
export type DashAlumnoInscrito = {
  inscripcion_id: number | string;
  boleta?: string | null;
  nombre: string;
  email?: string | null;
  fecha_inscripcion?: string | null;
  estado?: string | null;
};

export type DashReporteInscritos = {
  ciclo: { id: number | string; codigo: string };
  grupo?: { id: number | string; nombre: string } | null;
  total: number;
  alumnos: DashAlumnoInscrito[];
};

export type DashPagoRow = {
  inscripcion_id: number | string;
  alumno: string;
  email?: string | null;
  referencia?: string | null;
  tipo?: "pago" | "exencion";
  status: "pendiente" | "validado" | "rechazado";
  importe_centavos: number;
  fecha_pago?: string | null;
};

export type DashReportePagos = {
  ciclo: { id: number | string; codigo: string };
  grupo?: { id: number | string; nombre: string } | null;
  total_registros: number;
  total_validado_centavos: number;
  rows: DashPagoRow[];
};

/* ===== Tipos de dashboard (coordinación) ===== */
export type CoordKpisOut = {
  grupos_activos: number;
  docentes_asignados: number;
  alumnos_matriculados: number;
  alumnos_ipn: number;
  alumnos_externos: number;
  pagos_verificados_pct: number;
  pagos_monto_total: number;
  promedio_global_pct: number;
};

export type CoordCategoriaAgg = {
  id: number | string;
  name: string;
  order: number;
  promedio_pct: number;
};
export type CoordCategoriasAggOut = { categorias: CoordCategoriaAgg[] };

export type CoordPreguntaAgg = {
  id: number | string;
  texto: string;
  category_id?: number | string | null;
  category_name?: string | null;
  order: number;
  promedio_pct: number;
  respuestas: number;
};
export type CoordPreguntasAggOut = { preguntas: CoordPreguntaAgg[] };

export type CoordRankingDoc = {
  docente_id: number | string;
  docente: string;
  promedio_pct: number;
  grupos: number;
};
export type CoordRankingOut = { top: CoordRankingDoc[]; bottom: CoordRankingDoc[] };

export type CoordComentario = {
  id?: number | string | null;
  ciclo: string;
  docente?: string | null;
  pregunta?: string | null;
  texto: string;
  created_at?: string | null;
};

/* ===== Endpoints (usar apiFetch/buildURL ya definidos arriba en el archivo) ===== */

/** Ciclos para selector del dashboard */
export async function getDashCiclos(params?: {
  anio?: string | number;
  idioma?: string;
}): Promise<DashCicloLite[]> {
  const url = buildURL("/coordinacion/reportes/ciclos-lite", {
    anio: params?.anio,
    idioma: params?.idioma,
  });
  return apiFetch<DashCicloLite[]>(url, { auth: true });
}

/** Grupos por ciclo (si aplica) */
export async function getDashGrupos(cicloId: string | number): Promise<DashGrupoLite[]> {
  const url = buildURL("/coordinacion/grupos", { cicloId: String(cicloId) });
  return apiFetch<DashGrupoLite[]>(url, { auth: true });
}

/** Inscritos por ciclo/grupo */
export async function getDashReporteInscritos(args: {
  cicloId: string | number;
  grupoId?: string | number;
}): Promise<DashReporteInscritos> {
  const url = buildURL("/coordinacion/reportes/inscritos", {
    cicloId: String(args.cicloId),
    grupoId: args.grupoId !== undefined ? String(args.grupoId) : undefined,
  });
  return apiFetch<DashReporteInscritos>(url, { auth: true });
}

/** Pagos por ciclo/grupo */
export async function getDashReportePagos(args: {
  cicloId: string | number;
  grupoId?: string | number;
}): Promise<DashReportePagos> {
  const url = buildURL("/coordinacion/reportes/pagos", {
    cicloId: String(args.cicloId),
    grupoId: args.grupoId !== undefined ? String(args.grupoId) : undefined,
  });
  return apiFetch<DashReportePagos>(url, { auth: true });
}

/** KPIs — por defecto todos los ciclos; si envías cicloId, filtra a ese ciclo */
export async function getCoordKpis(params?: {
  anio?: number;
  idioma?: string;
  cicloId?: number; // opcional
}): Promise<CoordKpisOut> {
  const url = buildURL("/coordinacion/resumen/kpis", {
    anio: params?.anio,
    idioma: params?.idioma,
    cicloId: params?.cicloId,
  });
  return apiFetch<CoordKpisOut>(url, { auth: true });
}

/** Agregado por categoría (puede ser allCiclos, o cicloId, o último ciclo por defecto) */
export async function getCoordCategoriasAgg(params: {
  cicloId?: number;
  anio?: number;
  idioma?: string;
  allCiclos?: boolean;
}): Promise<CoordCategoriasAggOut> {
  const url = buildURL("/coordinacion/reportes/categorias", {
    cicloId: params.cicloId,
    anio: params.anio,
    idioma: params.idioma,
    allCiclos: params.allCiclos,
  });
  return apiFetch<CoordCategoriasAggOut>(url, { auth: true });
}

/** Agregado por pregunta (igual lógica que categorías) */
export async function getCoordPreguntasAgg(params: {
  cicloId?: number;
  anio?: number;
  idioma?: string;
  allCiclos?: boolean;
}): Promise<CoordPreguntasAggOut> {
  const url = buildURL("/coordinacion/reportes/preguntas", {
    cicloId: params.cicloId,
    anio: params.anio,
    idioma: params.idioma,
    allCiclos: params.allCiclos,
  });
  return apiFetch<CoordPreguntasAggOut>(url, { auth: true });
}

/** Ranking — global por anio/idioma (sin cicloId) */
export async function getCoordRanking(params?: {
  anio?: number;
  idioma?: string;
  limitTop?: number;
  limitBottom?: number;
}): Promise<CoordRankingOut> {
  const url = buildURL("/coordinacion/reportes/ranking-docentes", {
    anio: params?.anio,
    idioma: params?.idioma,
    limitTop: params?.limitTop ?? 5,
    limitBottom: params?.limitBottom ?? 5,
  });
  return apiFetch<CoordRankingOut>(url, { auth: true });
}

/** Comentarios recientes — por defecto todos los ciclos; acepta cicloId */
export async function getCoordComentariosRecientes(params?: {
  anio?: number;
  idioma?: string;
  limit?: number;
  q?: string;
  cicloId?: number; // opcional
}): Promise<CoordComentario[]> {
  const url = buildURL("/coordinacion/encuestas/comentarios", {
    anio: params?.anio,
    idioma: params?.idioma,
    limit: params?.limit ?? 20,
    q: params?.q,
    cicloId: params?.cicloId,
  });
  return apiFetch<CoordComentario[]>(url, { auth: true });
}

/* ===== Montos (inscripciones + placement) ===== */
export type CoordMontosOut = {
  /** Suma de importes validados de inscripciones (MXN) */
  inscripciones_total_mxn: number;
  /** Suma de importes validados de exámenes de colocación (MXN) */
  placement_total_mxn: number;
  /** Total combinado (MXN) */
  total_mxn: number;
};

/** Montos combinados — sólo aplica cuando el selector está en "Todos los ciclos" */
export async function getCoordMontos(params?: {
  anio?: number;
  idioma?: string;
}): Promise<CoordMontosOut> {
  const url = buildURL("/coordinacion/resumen/montos", {
    anio: params?.anio,
    idioma: params?.idioma,
  });
  return apiFetch<CoordMontosOut>(url, { auth: true });
}



/** ============== Placement Exams LITE (Coordinación) ============== */
/** Devuelve la lista “lite” para el selector (filtra por año/idioma). 
 *  Mapea page_size → limit para compat con tu backend.
 */
export async function listPlacementExamsLite(params?: {
  anio?: number | string;
  idioma?: string;
  q?: string;
  page_size?: number; // compat con el front
  limit?: number;     // opcionalmente puedes pasar limit directo
}): Promise<PlacementExamLite[]> {
  const url = buildURL("/coordinacion/placement-exams/lite", {
    anio: params?.anio !== undefined && params?.anio !== null && String(params.anio).length > 0
      ? Number(params.anio)
      : undefined,
    idioma: params?.idioma,
    q: params?.q,
    limit: params?.limit ?? params?.page_size ?? 200,
  });

  const raw = await apiFetch<PlacementExamLite[] | { items?: PlacementExamLite[] }>(url, { auth: true });
  return Array.isArray(raw) ? raw : raw?.items ?? [];
}
