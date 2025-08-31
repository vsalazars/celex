import { API_URL } from "./constants";
import { getToken, clearSession } from "./sessions";
import type { CoordResp, CreateTeacherInput, Paginated, Teacher } from "./types";

/* ========== Helper ========== */
async function apiFetch<T = any>(
  input: string,
  init?: RequestInit & { auth?: boolean }
): Promise<T> {
  const headers = new Headers(init?.headers || {});

  if (init?.auth) {
    const token = getToken();
    if (!token) throw new Error("Sesión inválida");
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(input, { ...init, headers, cache: "no-store" });

  if (!res.ok) {
    // Si expira el token
    if (res.status === 401) {
      try { clearSession(); } catch {}
      throw new Error("No autorizado. Vuelve a iniciar sesión.");
    }

    let detail = `Error ${res.status}`;
    try {
      const json = await res.json();
      detail = json?.detail || json?.message || detail;
    } catch { /* sin cuerpo */ }
    throw new Error(detail);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  if (!text) return undefined as unknown as T;

  try { return JSON.parse(text) as T; }
  catch { return undefined as unknown as T; }
}

function buildURL(path: string, params?: Record<string, string | number | boolean | undefined>) {
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

/* =========================================================================================
 * ========== Coordinadores ================================================================
 * =======================================================================================*/

export async function listCoordinators({
  q,
  page,
  page_size,
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

/* =========================================================================================
 * ========== Docentes (Coordinación) ======================================================
 * =======================================================================================*/

// Lista normaliza tanto arreglo simple como respuesta paginada
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

/* =========================================================================================
 * ========== Ciclos / Grupos (Coordinación) ===============================================
 * =======================================================================================*/

/** Debe coincidir con el backend */
export type Idioma =
  | "ingles"
  | "frances"
  | "aleman"
  | "italiano"
  | "portugues";

export type Modalidad = "intensivo" | "sabatino" | "semestral";
export type Turno = "matutino" | "vespertino" | "mixto";
export type Nivel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type ModalidadAsistencia = "presencial" | "virtual";

export type PeriodoDTO = { from: string; to: string };
export type PeriodoInput = { from: string; to: string };

// 👉 Docente ligero devuelto por el back (si se incluye)
export type DocenteLite = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
} | null;

export type CicloDTO = {
  id: number;
  codigo: string;
  idioma: Idioma;
  modalidad: Modalidad;
  turno: Turno;
  nivel: Nivel;

  cupo_total: number;

  // Horario
  dias: string[];                // ["lunes","miercoles",...]
  hora_inicio: string;           // "HH:MM"
  hora_fin: string;              // "HH:MM"

  // Fechas
  inscripcion: PeriodoDTO;
  curso: PeriodoDTO;

  // Exámenes (opcionales)
  examenMT?: string | null;            // YYYY-MM-DD
  examenFinal?: string | null;         // YYYY-MM-DD

  // Asistencia (el back default = "presencial")
  modalidad_asistencia?: ModalidadAsistencia;
  aula?: string | null;

  // 👉 Docente asignado (opcional)
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
  docente_id?: number;           // 👈 NUEVO
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
  hora_inicio: string;   // "HH:MM"
  hora_fin: string;      // "HH:MM"

  inscripcion: PeriodoInput;
  curso: PeriodoInput;

  examenMT?: string;                   // opcional
  examenFinal?: string;                // opcional

  modalidad_asistencia?: ModalidadAsistencia; // opcional (back default = "presencial")
  aula?: string;

  // 👉 Asignación opcional de docente al crear
  docente_id?: number;

  notas?: string;
};

export type UpdateCicloInput = Partial<CreateCicloInput> & {
  codigo?: string;
};

/** Listar ciclos (paginado + filtros) — **Coordinación** */
export async function listCiclos(params: ListCiclosParams = {}): Promise<CicloListResponse> {
  const url = buildURL("/coordinacion/ciclos", {
    q: params.q,
    idioma: params.idioma,
    modalidad: params.modalidad,
    turno: params.turno,
    nivel: params.nivel,
    docente_id: params.docente_id,     // 👈 NUEVO
    page: params.page ?? 1,
    page_size: params.page_size ?? 8,
  });
  return apiFetch<CicloListResponse>(url, { auth: true });
}

/** Crear ciclo — **Coordinación** */
export async function createCiclo(input: CreateCicloInput): Promise<CicloDTO> {
  const url = buildURL("/coordinacion/ciclos");
  // JSON.stringify ya omite undefined, así no mandamos campos opcionales vacíos
  return apiFetch<CicloDTO>(url, {
    method: "POST",
    body: JSON.stringify(input),
    auth: true,
  });
}

/** Actualizar ciclo — **Coordinación** */
export async function updateCiclo(id: number | string, input: UpdateCicloInput): Promise<CicloDTO> {
  const url = buildURL(`/coordinacion/ciclos/${id}`);
  return apiFetch<CicloDTO>(url, {
    method: "PUT",
    body: JSON.stringify(input),
    auth: true,
  });
}

/** Eliminar ciclo — **Coordinación** */
export async function deleteCiclo(id: number | string): Promise<void> {
  const url = buildURL(`/coordinacion/ciclos/${id}`);
  await apiFetch<void>(url, { method: "DELETE", auth: true });
}

/* =========================================================================================
 * ========== Alumno – Ciclos visibles e Inscripciones =====================================
 * =======================================================================================*/

/** Listar ciclos que el alumno puede ver (evita 403).
 *   Usa el endpoint de alumno: GET /alumno/ciclos
 *   Por defecto: solo_abiertos=true para mostrar periodos con inscripción vigente.
 */
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

/** Crear inscripción del alumno al ciclo actual.
 *  Endpoint sugerido: POST /alumno/inscripciones  { ciclo_id }
 */
export async function createInscripcion(payload: { ciclo_id: number }) {
  const url = buildURL("/alumno/inscripciones");
  return apiFetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    auth: true,
  });
}

/** (Opcional) Listar mis inscripciones */
export type InscripcionDTO = {
  id: number;
  ciclo_id: number;
  status: "registrada" | "pendiente" | "confirmada" | "rechazada";
  created_at: string;
  ciclo?: CicloDTO;
};

export async function listMisInscripciones(): Promise<InscripcionDTO[]> {
  const url = buildURL("/alumno/inscripciones");
  const raw = await apiFetch<InscripcionDTO[] | Paginated<InscripcionDTO>>(url, { auth: true });
  return Array.isArray(raw) ? raw : raw?.items ?? [];
}

/** (Opcional) Cancelar mi inscripción */
export async function cancelarInscripcion(id: number | string): Promise<void> {
  const url = buildURL(`/alumno/inscripciones/${id}`);
  await apiFetch(url, { method: "DELETE", auth: true });
}
