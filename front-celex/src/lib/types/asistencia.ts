// lib/types/asistencia.ts

export type SesionDTO = {
  id: number;
  fecha: string; // ISO date "YYYY-MM-DD"
};

export type RegistroDTO = {
  id?: number;
  sesion_id: number;
  inscripcion_id: number;
  alumno_id?: number | null;
  alumno_nombre?: string | null;
  estado: AsistenciaEstadoString; // backend serializa a string
  nota?: string | null;
};

export type MatrizSesion = {
  id: number;
  fecha: string; // ISO date
};

export type MatrizAlumno = {
  inscripcion_id: number;
  alumno_id?: number | null;
  nombre?: string | null;
};

export type MatrizRegistro = {
  sesion_id: number;
  inscripcion_id: number;
  estado: AsistenciaEstadoString;
  nota?: string | null;
};

export type MatrizDTO = {
  sesiones: MatrizSesion[];
  alumnos: MatrizAlumno[];
  registros: MatrizRegistro[]; // sparse
};

// Enum como strings que devuelve/acepta el backend
export type AsistenciaEstadoString = "presente" | "ausente" | "retardo" | "justificado";

// Para marcar desde el front
export type MatrizMarcarItem = {
  sesion_id: number;
  inscripcion_id: number;
  estado: AsistenciaEstadoString;
  nota?: string | null;
};

export type MatrizMarcarDTO = {
  items: MatrizMarcarItem[];
};
