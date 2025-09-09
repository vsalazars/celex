// src/lib/api/docente.ts
"use client";

import { API_URL } from "@/lib/constants";

// Tipos del dominio docente/evaluaciones
import type {
  CicloLite,
  AlumnoEnGrupo,
  EvaluacionOut,
  EvaluacionUpsertIn,
} from "@/lib/types/docente";

// Tipos de asistencia/matriz
import type {
  SesionDTO,
  RegistroDTO,
  MatrizDTO,
  MatrizMarcarDTO,
  AsistenciaEstadoString,
} from "@/lib/types/asistencia";

function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("celex_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------- Mis grupos ----------------------
export async function listMisGrupos(params?: { q?: string }): Promise<CicloLite[]> {
  const url = new URL(`${API_URL}/docente/grupos`);
  if (params?.q) url.searchParams.set("q", params.q);
  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Error ${res.status} al listar grupos: ${detail}`);
  }
  return res.json();
}

// ---------------------- ALUMNOS DE CICLO ----------------------
// Preferente: GET /docente/grupos/{cicloId}/alumnos
// Fallback:   GET /docente/asistencia/ciclos/{cicloId}/matriz  -> map a AlumnoEnGrupo[]
export async function listAlumnosDeCiclo(cicloId: number): Promise<AlumnoEnGrupo[]> {
  // 1) Intento directo al endpoint de alumnos del grupo
  try {
    const res = await fetch(`${API_URL}/docente/grupos/${cicloId}/alumnos`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return data as AlumnoEnGrupo[];
    }

    if (res.status !== 404) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Error ${res.status} al listar alumnos: ${detail}`);
    }
  } catch {
    // si falla, cae al fallback
  }

  // 2) Fallback: matriz → alumnos
  const matriz = await matrizCiclo(cicloId);
  const mapped: AlumnoEnGrupo[] = matriz.alumnos.map((a: any) => ({
    inscripcion_id: a.inscripcion_id ?? a.id ?? 0,
    alumno_id: a.alumno_id ?? null,
    alumno_nombre: a.nombre ?? a.alumno_nombre ?? "",
    boleta: a.boleta ?? "",
    alumno_email: a.alumno_email ?? "",
    alumno_username: a.alumno_username ?? "",
    status: a.status ?? "",
  }));
  return mapped;
}

// ---------------------- Sesiones ----------------------
export async function generarSesiones(cicloId: number): Promise<SesionDTO[]> {
  const res = await fetch(`${API_URL}/docente/asistencia/ciclos/${cicloId}/generar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) throw new Error(`Error ${res.status} al generar sesiones`);
  return res.json();
}

export async function listarSesiones(cicloId: number): Promise<SesionDTO[]> {
  const res = await fetch(`${API_URL}/docente/asistencia/ciclos/${cicloId}/sesiones`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Error ${res.status} al listar sesiones`);
  return res.json();
}

export async function registrosPorSesion(sesionId: number): Promise<RegistroDTO[]> {
  const res = await fetch(`${API_URL}/docente/asistencia/sesiones/${sesionId}/registros`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Error ${res.status} al obtener registros`);
  return res.json();
}

export async function marcarAsistenciaLote(
  sesionId: number,
  items: { inscripcion_id: number; estado: AsistenciaEstadoString; nota?: string | null }[]
): Promise<RegistroDTO[]> {
  const res = await fetch(`${API_URL}/docente/asistencia/sesiones/${sesionId}/marcar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al marcar asistencia`);
  return res.json();
}

// ---------------------- MATRIZ ----------------------
export async function matrizCiclo(cicloId: number): Promise<MatrizDTO> {
  const res = await fetch(`${API_URL}/docente/asistencia/ciclos/${cicloId}/matriz`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Error ${res.status} al obtener matriz`);
  return res.json();
}

export async function marcarMatriz(
  cicloId: number,
  payload: MatrizMarcarDTO
): Promise<MatrizDTO> {
  const res = await fetch(`${API_URL}/docente/asistencia/ciclos/${cicloId}/matriz/marcar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al marcar matriz`);
  return res.json();
}

// ---------------------- Evaluaciones ----------------------
export async function saveEvaluacion(
  cicloId: number,
  inscripcionId: number,
  payload: EvaluacionUpsertIn
): Promise<EvaluacionOut> {
  const url = new URL(`${API_URL}/docente/evaluaciones/ciclos/${cicloId}/alumnos/${inscripcionId}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Error ${res.status} al guardar evaluación: ${detail}`);
  }
  return res.json();
}

export async function listEvaluacionesCiclo(cicloId: number): Promise<EvaluacionOut[]> {
  const res = await fetch(`${API_URL}/docente/evaluaciones/ciclos/${cicloId}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Error ${res.status} al listar evaluaciones: ${detail}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data?.items ?? [];
}

// ---------------------- % Asistencia por alumno (desde Matriz) ----------------------
/**
 * Calcula el % de asistencia por inscripción usando la Matriz del backend.
 * @param cicloId
 * @param options.hastaHoy Si true, cuenta solo sesiones <= hoy. Default: true.
 * @param options.contarRetardoComo Peso del "retardo": 1 | 0.5 | 0. Default: 0.5.
 */
export async function getAlumnosConAsistencia(
  cicloId: number,
  options?: { hastaHoy?: boolean; contarRetardoComo?: 1 | 0.5 | 0 }
): Promise<
  (AlumnoEnGrupo & {
    asistenciaPct: number;
  })[]
> {
  const { hastaHoy = true, contarRetardoComo = 0.5 } = options ?? {};

  // alumnos (preferente endpoint dedicado; si no, fallback a matriz.alumnos)
  let alumnosList: AlumnoEnGrupo[];
  try {
    alumnosList = await listAlumnosDeCiclo(cicloId);
  } catch {
    const mz = await matrizCiclo(cicloId);
    alumnosList = mz.alumnos.map((a: any) => ({
      inscripcion_id: a.inscripcion_id ?? a.id ?? 0,
      alumno_id: a.alumno_id ?? null,
      alumno_nombre: a.nombre ?? "",
      boleta: "",
      alumno_email: "",
      alumno_username: "",
      status: "",
    }));
  }

  // matriz para computar % (usa registros planos)
  const matriz = await matrizCiclo(cicloId);
  const todasSesiones = Array.isArray(matriz?.sesiones) ? matriz.sesiones : [];
  const registros = Array.isArray(matriz?.registros) ? matriz.registros : [];

  // denominador: todas o hasta hoy
  let sesionesConsideradas = todasSesiones;
  if (hastaHoy) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    sesionesConsideradas = todasSesiones.filter((s: any) => {
      const d = new Date(String(s.fecha) + "T00:00:00");
      return d <= hoy;
    });
  }
  const totalSesiones = sesionesConsideradas.length || 0;
  const sesionIdSet = new Set<number>(sesionesConsideradas.map((s: any) => s.id));

  // numerador por inscripción
  const cuentaOK: Record<number, number> = Object.create(null);
  for (const r of registros) {
    if (hastaHoy && !sesionIdSet.has(r?.sesion_id)) continue; // ignora futuras si corresponde
    const inscId = r?.inscripcion_id;
    if (inscId == null) continue;
    const estado = String(r?.estado ?? "").toLowerCase();

    let inc = 0;
    if (estado === "presente" || estado === "justificado") inc = 1;
    else if (estado === "retardo") inc = contarRetardoComo;

    cuentaOK[inscId] = (cuentaOK[inscId] ?? 0) + inc;
  }

  const pctPorInscripcion: Record<number, number> = Object.create(null);
  for (const k of Object.keys(cuentaOK)) {
    const inscId = Number(k);
    const ok = cuentaOK[inscId] ?? 0;
    pctPorInscripcion[inscId] = !totalSesiones ? 0 : Math.round((ok / totalSesiones) * 100);
  }

  // unir al listado de alumnos
  return alumnosList.map((a) => {
    const inscripcionId = (a as any)?.inscripcion_id ?? (a as any)?.inscripcionId ?? (a as any)?.id ?? 0;
    const asistenciaPct = pctPorInscripcion[inscripcionId] ?? 0;
    return { ...a, asistenciaPct };
  });
}
