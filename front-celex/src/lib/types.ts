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


// === Docente – Ciclo Lite (para listados) ===
export type CicloLite = {
  id: number;
  codigo: string;
  idioma: Idioma;
  nivel: Nivel;
  modalidad: Modalidad;
  turno: Turno;
};

// === Docente – Alumnos en un ciclo/grupo ===
export type AlumnoEnGrupo = {
  inscripcion_id: number;          // id de Inscripcion
  alumno_id: number | null;        // puede venir null según el endpoint
  alumno_nombre: string;
  alumno_email?: string;
  curp?: string;
  boleta?: string;
  status?: string;

  // calculado en el front (o devuelto por el back si lo decides)
  asistenciaPct?: number;          // 0..100

  // ===== Evaluaciones (opcionales si ya existen en back) =====
  // Medio curso
  medio_examen?: number | null;    // 0..80
  medio_continua?: number | null;  // 0..20

  // Final de curso
  final_examen?: number | null;    // 0..60
  final_continua?: number | null;  // 0..20
  final_tarea?: number | null;     // 0..20

  // Derivados (si los trae el back)
  subtotal_medio?: number;         // 0..100
  subtotal_final?: number;         // 0..100
  promedio_final?: number;         // 0..100
};

// === Docente – Evaluaciones ===
export type EvaluacionUpsertIn = {
  medio_examen?: number | null;    // 0..80
  medio_continua?: number | null;  // 0..20
  final_examen?: number | null;    // 0..60
  final_continua?: number | null;  // 0..20
  final_tarea?: number | null;     // 0..20
};

export type EvaluacionOut = {
  inscripcion_id: number;
  ciclo_id: number;

  medio_examen: number | null;
  medio_continua: number | null;
  final_examen: number | null;
  final_continua: number | null;
  final_tarea: number | null;

  subtotal_medio: number;          // 0..100
  subtotal_final: number;          // 0..100
  promedio_final: number;          // 0..100 (el back lo manda con 2 decimales)
};


// --- Historial (Alumno) ---
export type AlumnoHistorialItem = {
  inscripcion_id: number;
  ciclo_id: number;
  ciclo_codigo: string;
  idioma: string;
  nivel: string;
  modalidad: string;
  turno: string;
  docente_nombre?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;

  sesiones_total: number;
  presentes: number;
  ausentes: number;
  retardos: number;
  justificados: number;
  asistencia_pct: number;

  medio_examen?: number | null;    // 0–80
  medio_cont?: number | null;      // 0–20
  medio_subtotal?: number | null;  // suma

  final_examen?: number | null;    // 0–60
  final_cont?: number | null;      // 0–20
  final_tarea?: number | null;     // 0–20
  final_subtotal?: number | null;  // suma

  promedio?: number | null;        // 0–100
};

export type AlumnoHistorialResponse = {
  items: AlumnoHistorialItem[];
};
