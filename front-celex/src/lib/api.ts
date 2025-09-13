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
  await apiFetch(url, { method: "DELETE", auth: true });
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

/* ================= Placement Exams ================= */

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

// ===== Crear nuevo examen =====
export async function createPlacementExam(payload: PlacementExamCreateDTO): Promise<PlacementExam> {
  const url = buildURL(PLACEMENT_BASE);
  return apiFetch<PlacementExam>(url, {
    method: "POST",
    auth: true,
    json: payload, // usa json
  });
}

// ===== Actualizar examen existente =====
export async function updatePlacementExam(
  id: number,
  patch: Partial<PlacementExamCreateDTO>
): Promise<PlacementExam> {
  const url = buildURL(`${PLACEMENT_BASE}/${id}`);
  return apiFetch<PlacementExam>(url, {
    auth: true,
    method: "PATCH",
    json: patch, // usa json
  });
}

// ===== Eliminar examen =====
export async function deletePlacementExam(id: number): Promise<void> {
  const url = buildURL(`${PLACEMENT_BASE}/${id}`);
  await apiFetch<void>(url, { method: "DELETE", auth: true });
}

export async function listPlacementPublic(params?: { q?: string; idioma?: string }) {
  const url = buildURL("/placement-exams/public", params as any);
  return apiFetch(url);
}

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
