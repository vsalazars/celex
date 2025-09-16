// src/lib/student.ts
import { apiFetch, buildURL } from "@/lib/api";

export type AlumnoPerfil = {
  nombre: string;
  apellidos: string;
  email: string;
  curp: string;
  telefono?: string | null;
  direccion?: {
    calle?: string;
    numero?: string;
    colonia?: string;
    municipio?: string;
    estado?: string;
    cp?: string;
  } | null;
  is_ipn?: boolean;
  boleta?: string | null;
  ipn?: {
    nivel?: "Medio superior" | "Superior" | "Posgrado";
    unidad?: string;
  } | null;
  tutor?: {
    telefono?: string;
  } | null;
};

// Lee perfil del alumno autenticado
export async function getAlumnoPerfil(): Promise<AlumnoPerfil> {
  const url = buildURL("/alumno/perfil");
  try {
    return await apiFetch<AlumnoPerfil>(url, { method: "GET", auth: true });
  } catch {
    // Si no existe el endpoint todavía, regresamos mínimos (para que el form cargue)
    return {
      nombre: "",
      apellidos: "",
      email: "",
      curp: "",
      is_ipn: false,
      boleta: "",
    };
  }
}

// Actualiza perfil
export async function updateAlumnoPerfil(payload: Partial<AlumnoPerfil>) {
  const url = buildURL("/alumno/perfil");
  return apiFetch(url, {
    method: "PATCH",
    json: payload,
    auth: true,
  });
}
