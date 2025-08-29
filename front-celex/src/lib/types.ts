// --- Coordinadores ---
export type CoordItem = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  curp: string;
  role: string;
  is_active?: boolean;
};

export type CoordResp = {
  items: CoordItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

// --- Genérico de paginación ---
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

// --- Docentes ---
export type TeacherStatus = "activo" | "invitado" | "suspendido";

export type Teacher = {
  id: string | number;
  first_name: string;
  last_name: string;
  email: string;
  curp: string;
  status: TeacherStatus;
  created_at?: string;
};

export type CreateTeacherInput = {
  first_name: string;
  last_name: string;
  email: string;
  curp: string;
};

// ======================
// ====== Ciclos ========
// ======================

// Enums alineados con el backend
export type Idioma = "ingles" | "frances" | "aleman" | "italiano" | "portugues";
export type Modalidad = "intensivo" | "sabatino" | "semestral";
export type Turno = "matutino" | "vespertino" | "mixto";
export type Nivel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type ModalidadAsistencia = "presencial" | "virtual";

// Periodos
export type PeriodoDTO = { from: string; to: string };
export type PeriodoInput = { from: string; to: string };

// Ciclo DTO (respuesta del backend)
export type CicloDTO = {
  id: number;
  codigo: string;

  idioma: Idioma;
  modalidad: Modalidad;
  turno: Turno;
  nivel: Nivel;

  cupo_total: number;

  // Horario
  dias: string[];      // ["lunes","miercoles",...]
  hora_inicio: string; // "HH:MM"
  hora_fin: string;    // "HH:MM"

  // Fechas requeridas
  inscripcion: PeriodoDTO;
  curso: PeriodoDTO;

  // Fechas opcionales
  colocacion?: PeriodoDTO | null;

  // Exámenes opcionales
  examenMT?: string | null;      // YYYY-MM-DD
  examenFinal?: string | null;   // YYYY-MM-DD

  // Asistencia
  modalidad_asistencia?: ModalidadAsistencia; // back default = "presencial"
  aula?: string | null;

  // Docente asignado (opcional si el back lo expone)
  docente_id?: number | null;
  docente?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;

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
  page?: number;
  page_size?: number;
  q?: string;
  idioma?: Idioma;
  modalidad?: Modalidad;
  turno?: Turno;
  nivel?: Nivel;
};

// Inputs para crear/actualizar (alineados con el back)
export type CreateCicloInput = {
  codigo: string;

  idioma: Idioma;
  modalidad: Modalidad;
  turno: Turno;
  nivel: Nivel;

  cupo_total: number;

  dias: string[];
  hora_inicio: string; // "HH:MM"
  hora_fin: string;    // "HH:MM"

  inscripcion: PeriodoInput;
  curso: PeriodoInput;

  colocacion?: PeriodoInput; // opcional
  examenMT?: string;         // opcional YYYY-MM-DD
  examenFinal?: string;      // opcional YYYY-MM-DD

  modalidad_asistencia?: ModalidadAsistencia; // opcional (default back = "presencial")
  aula?: string;

  // futura asignación (opcional)
  docente_id?: number;

  notas?: string;
  docente?: { id?: number; nombre?: string; email?: string } | null;

};

export type UpdateCicloInput = Partial<CreateCicloInput> & {
  codigo?: string;
};
