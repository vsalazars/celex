export type CicloLite = {
  id: number;
  codigo: string;
  idioma: string | null;
  modalidad: string | null;
  turno: string | null;
  nivel?: string | null;
  dias: string[];
  hora_inicio?: string | null;
  hora_fin?: string | null;
  aula?: string | null;
  inscripcion?: { from?: string; to?: string } | null;
  curso?: { from?: string; to?: string } | null;
  docente_nombre?: string | null;
};

export type AlumnoEnGrupo = {
  inscripcion_id: number;
  alumno_id: number;
  alumno_nombre: string | null;
  alumno_email: string | null;
  alumno_username: string | null;
  boleta: string | null;
  status: string | null; // "aprobada" | "pendiente" | ...
};


export type AsistenciaEstado =
  | "presente"
  | "ausente"
  | "retardo"
  | "justificado";

/** Sesión de asistencia (una fecha del curso) */
export interface SesionDTO {
  id: number;
  /** ISO date (YYYY-MM-DD) */
  fecha: string;
}

/** Registro de asistencia por sesión × inscripción */
export interface RegistroDTO {
  id: number;
  sesion_id: number;
  inscripcion_id: number;
  alumno_id?: number | null;
  alumno_nombre?: string | null;
  /** estado como string plano (usar AsistenciaEstado) */
  estado: AsistenciaEstado | string;
  nota?: string | null;
}

/** Estructura de la matriz (forma dispersa) */
export interface MatrizSesion {
  id: number;
  /** ISO date (YYYY-MM-DD) */
  fecha: string;
}

export interface MatrizAlumno {
  inscripcion_id: number;
  alumno_id?: number | null;
  nombre?: string | null;
}

export interface MatrizRegistro {
  sesion_id: number;
  inscripcion_id: number;
  estado: AsistenciaEstado | string;
  nota?: string | null;
}

export interface MatrizDTO {
  sesiones: MatrizSesion[];
  alumnos: MatrizAlumno[];
  registros: MatrizRegistro[]; // sparse
}

/** Payload para marcar varias celdas de la matriz en bloque */
export interface MatrizMarcarItem {
  sesion_id: number;
  inscripcion_id: number;
  estado: AsistenciaEstado;
  nota?: string | null;
}

export interface MatrizMarcarDTO {
  items: MatrizMarcarItem[];
}

/** (Opcional) etiquetas amigables por estado */
export const ASISTENCIA_LABEL: Record<AsistenciaEstado, string> = {
  presente: "Presente",
  ausente: "Ausente",
  retardo: "Retardo",
  justificado: "Justificado",
};