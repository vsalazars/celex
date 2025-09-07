// src/lib/api/docente.ts
"use client";

import { API_URL } from "@/lib/constants";
import type { CicloLite, AlumnoEnGrupo } from "@/lib/types/docente";
import type {
  SesionDTO,
  RegistroDTO,
  MatrizDTO,
  MatrizMarcarDTO,
} from "@/lib/types/asistencia";

function getAuthHeaders() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("celex_token")
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------- Mis grupos ----------------------
export async function listMisGrupos(
  params?: { q?: string }
): Promise<CicloLite[]> {
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
      // Asumimos que ya viene como AlumnoEnGrupo[]; si no, lo mapeas aquí.
      return data as AlumnoEnGrupo[];
    }

    // Si no es 404, lanza el error tal cual (permite ver 401/500 reales)
    if (res.status !== 404) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Error ${res.status} al listar alumnos: ${detail}`);
    }
    // Si es 404, caemos al fallback
  } catch (e) {
    // Si hubo error de red, caemos al fallback igualmente
    // console.warn("Fallo endpoint /docente/grupos/{id}/alumnos, uso fallback:", e);
  }

  // 2) Fallback: usar matriz y mapear a la forma AlumnoEnGrupo
  const matriz = await matrizCiclo(cicloId);
  // matriz.alumnos suele incluir: inscripcion_id, nombre, alumno_id, etc.
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
export async function generarSesiones(
  cicloId: number
): Promise<SesionDTO[]> {
  const res = await fetch(
    `${API_URL}/docente/asistencia/ciclos/${cicloId}/generar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    }
  );
  if (!res.ok) throw new Error(`Error ${res.status} al generar sesiones`);
  return res.json();
}

export async function listarSesiones(
  cicloId: number
): Promise<SesionDTO[]> {
  const res = await fetch(
    `${API_URL}/docente/asistencia/ciclos/${cicloId}/sesiones`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Error ${res.status} al listar sesiones`);
  return res.json();
}

export async function registrosPorSesion(
  sesionId: number
): Promise<RegistroDTO[]> {
  const res = await fetch(
    `${API_URL}/docente/asistencia/sesiones/${sesionId}/registros`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Error ${res.status} al obtener registros`);
  return res.json();
}

export async function marcarAsistenciaLote(
  sesionId: number,
  items: { inscripcion_id: number; estado: string; nota?: string | null }[]
): Promise<RegistroDTO[]> {
  const res = await fetch(
    `${API_URL}/docente/asistencia/sesiones/${sesionId}/marcar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(items),
    }
  );
  if (!res.ok) throw new Error(`Error ${res.status} al marcar asistencia`);
  return res.json();
}

// ---------------------- MATRIZ ----------------------
export async function matrizCiclo(
  cicloId: number
): Promise<MatrizDTO> {
  const res = await fetch(
    `${API_URL}/docente/asistencia/ciclos/${cicloId}/matriz`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Error ${res.status} al obtener matriz`);
  return res.json();
}

export async function marcarMatriz(
  cicloId: number,
  payload: MatrizMarcarDTO
): Promise<MatrizDTO> {
  const res = await fetch(
    `${API_URL}/docente/asistencia/ciclos/${cicloId}/matriz/marcar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`Error ${res.status} al marcar matriz`);
  return res.json();
}
