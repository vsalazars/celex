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

// --- Genérico de paginación (para reusar si tu backend lo usa en más endpoints) ---
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
