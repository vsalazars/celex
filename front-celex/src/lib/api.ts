import { API_URL } from "./constants";
import { getToken, clearSession } from "./sessions";
import type {
  CoordResp, CreateTeacherInput, Paginated, Teacher
} from "./types";

/* ========== Helper ========== */
function isFormDataBody(init?: RequestInit) {
  // Navegador / Next client
  return typeof FormData !== "undefined" && init?.body instanceof FormData;
}

// 👇 Exporta apiFetch para poder usarlo desde otros módulos
export async function apiFetch<T = any>(
  input: string,
  init?: RequestInit & { auth?: boolean }
): Promise<T> {
  const headers = new Headers(init?.headers || {});

  if (init?.auth) {
    const token = getToken();
    if (!token) throw new Error("Sesión inválida");
    headers.set("Authorization", `Bearer ${token}`);
  }

  // ⚠️ NO forzar JSON si mandamos FormData (multipart)
  if (!isFormDataBody(init) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // Si el body es FormData y alguien puso Content-Type, quitarlo para permitir el boundary
  if (isFormDataBody(init) && headers.has("Content-Type")) {
    headers.delete("Content-Type");
  }

  const res = await fetch(input, { ...init, headers, cache: "no-store" });

  if (!res.ok) {
    if (res.status === 401) {
      try { clearSession(); } catch {}
      throw new Error("No autorizado. Vuelve a iniciar sesión.");
    }
    let detail = `Error ${res.status}`;
    try {
      const json = await res.json();
      detail = json?.detail || json?.message || detail;
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  if (!text) return undefined as unknown as T;

  try { return JSON.parse(text) as T; }
  catch { return undefined as unknown as T; }
}

// 👇 Exporta buildURL para que puedas importarlo como named export
export function buildURL(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  const url = new URL(`${API_URL}${path.startsWith("/") ? "" : "/"}${path}`);
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
    body: JSON.stringify({ is_active }),
    auth: true,
  });
}

export async function createCoordinator(payload: {
  first_name: string; last_name: string; email: string; curp: string;
}) {
  const url = buildURL(`/admin/coordinators`);
  return apiFetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
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
    body: JSON.stringify({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email.trim().toLowerCase(),
      curp: input.curp.trim().toUpperCase(),
    }),
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
  return apiFetch<CicloDTO>(url, { method: "POST", body: JSON.stringify(input), auth: true });
}

export async function updateCiclo(id: number | string, input: UpdateCicloInput): Promise<CicloDTO> {
  const url = buildURL(`/coordinacion/ciclos/${id}`);
  return apiFetch<CicloDTO>(url, { method: "PUT", body: JSON.stringify(input), auth: true });
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
  fecha_pago?: string | null;           // <--- NUEVO
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

  // === CAMPOS DE VALIDACIÓN ===
  validated_by_id?: number | null;
  validated_at?: string | null;

  // Motivos de rechazo
  rechazo_motivo?: string | null;       // 👈 preferido (nuevo)
  validation_notes?: string | null;     // 👈 compatibilidad
};


// 🔽 Tipos discriminados para crear inscripción
export type CreateInscripcionPago = {
  tipo?: "pago";
  ciclo_id: number;
  referencia: string;
  importe_centavos: number;
  fecha_pago: string;            // <--- requerido
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
    fd.append("fecha_pago", input.fecha_pago);  // <--- NUEVO
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
    body: JSON.stringify({
      action,
      motivo,           // 👈 el back valida este campo (min_length=6)
      notes: motivo,    // 👈 opcional, por compat si tu back aún lo lee
    }),
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


export async function getAlumnoHistorial(): Promise<AlumnoHistorialResponse> {
  const url = buildURL("/alumno/historial");
  const res = await apiFetch(url, { auth: true });
  return res as AlumnoHistorialResponse;
}


export async function listCiclosPublic(params: any = {}) {
  const url = buildURL("/public/ciclos-abiertos", params);
  return apiFetch(url, { auth: false }); // <-- sin Authorization
}



// src/lib/api.ts
import type { Paginated, PlacementExam, PlacementExamCreateDTO, Idioma } from "./types";

// Base de los endpoints en el backend
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
  const s = new URLSearchParams();
  if (params?.page != null) s.set("page", String(params.page));
  if (params?.page_size != null) s.set("page_size", String(params.page_size));
  if (params?.q) s.set("q", params.q);
  if (params?.idioma) s.set("idioma", params.idioma);
  if (params?.fecha_from) s.set("fecha_from", params.fecha_from);
  if (params?.fecha_to) s.set("fecha_to", params.fecha_to);

  return apiFetch<Paginated<PlacementExam>>(
    `${PLACEMENT_BASE}?${s.toString()}`,
    { method: "GET", auth: true }
  );
}

// Alias para compatibilidad con código viejo que use listPlacement
export const listPlacement = listPlacementExams;

// ===== Crear nuevo examen =====
export async function createPlacementExam(payload: PlacementExamCreateDTO): Promise<PlacementExam> {
  return apiFetch<PlacementExam>(PLACEMENT_BASE, {
    method: "POST", auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ===== Actualizar examen existente =====
export async function updatePlacementExam(
  id: number,
  patch: Partial<PlacementExamCreateDTO>
): Promise<PlacementExam> {
  return apiFetch<PlacementExam>(`${PLACEMENT_BASE}/${id}`, { auth: true,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

// ===== Eliminar examen =====
export async function deletePlacementExam(id: number): Promise<void> {
  await apiFetch<void>(`${PLACEMENT_BASE}/${id}`, { method: "DELETE", auth: true });
}



export async function listPlacementPublic(params?: { q?: string; idioma?: string }) {
  const search = new URLSearchParams(params as any).toString();
  return apiFetch(`/placement-exams/public${search ? `?${search}` : ""}`);
}

export async function createPlacementRegistro(examId: number, fd: FormData) {
  // fd: referencia, importe_centavos, fecha_pago, comprobante (File)
  return apiFetch(`/placement-exams/${examId}/registros`, { method: "POST", body: fd, auth: true });
}

export async function listMyPlacementRegistros() {
  return apiFetch(`/placement-exams/mis-registros`, { auth: true });
}

export async function cancelPlacementRegistro(id: number) {
  return apiFetch(`/placement-exams/registros/${id}`, { method: "DELETE", auth: true });
}


// === NUEVO: helpers para descargas autenticadas (no JSON) ===
export async function apiFetchBlobResponse(
  input: string,
  init?: RequestInit & { auth?: boolean }
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "*/*");

  if (init?.auth) {
    const token = getToken();
    if (!token) throw new Error("Sesión inválida");
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers, cache: "no-store" });

  if (!res.ok) {
    if (res.status === 401) {
      try { clearSession(); } catch {}
      throw new Error("No autorizado. Vuelve a iniciar sesión.");
    }
    let detail = `Error ${res.status}`;
    try {
      const j = await res.clone().json();
      detail = j?.detail || j?.message || detail;
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

// === NUEVO: función específica para el comprobante de placement ===
export async function downloadPlacementComprobante(
  registroId: number,
  suggestedName?: string
) {
  const url = buildURL(`/placement-exams/registros/${registroId}/comprobante`);
  const resp = await apiFetchBlobResponse(url, { auth: true, method: "GET" });
  await forceDownloadFromResponse(resp, suggestedName || `comprobante_${registroId}`);
}
