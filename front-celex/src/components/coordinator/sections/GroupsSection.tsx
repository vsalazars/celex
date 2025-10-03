"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PlusCircle, Search, Filter, ChevronLeft, ChevronRight,
  MoreVertical, Pencil, Trash2, Users, GraduationCap, Clock3, CalendarDays, Building2, FileDown
} from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";

import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import {
  listCiclos, createCiclo, updateCiclo, deleteCiclo, listTeachers,
  listInscripcionesCiclo,
} from "@/lib/api";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";

import type {
  CicloDTO, CicloListResponse, ListCiclosParams, Teacher
} from "@/lib/types";

/* ======== TanStack React Table ======== */
import {
  useReactTable,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";

/* ========================= Utils ========================= */
type DateRange = { from?: Date; to?: Date };
const fmt = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const fmtRange = (r?: DateRange) =>
  r?.from && r?.to ? `${fmt.format(r.from)} — ${fmt.format(r.to)}`
  : r?.from ? `${fmt.format(r.from)} — …` : "Seleccionar periodo";

const dateToISO = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const rangeToISO = (r?: DateRange) =>
  r?.from && r?.to ? ({ from: dateToISO(r.from)!, to: dateToISO(r.to)! }) : undefined;

const isoToDate = (s?: string) => (s ? new Date(`${s}T00:00:00`) : undefined);
const rangeFromDTO = (r?: { from: string; to: string }): DateRange =>
  r ? ({ from: isoToDate(r.from), to: isoToDate(r.to) }) : {};

// Horas válidas (HH:MM)
const buildHorasValidas = (desde = 6, hasta = 22, pasoMin = 30) => {
  const out: string[] = [];
  for (let h = desde; h <= hasta; h++) {
    for (let m = 0; m < 60; m += pasoMin) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      out.push(`${hh}:${mm}`);
    }
  }
  return out;
};
const horasValidas = buildHorasValidas(6, 22, 30);

// Días disponibles
const DIAS_OPCIONES = [
  { key: "lunes", label: "Lun" },
  { key: "martes", label: "Mar" },
  { key: "miercoles", label: "Mié" },
  { key: "jueves", label: "Jue" },
  { key: "viernes", label: "Vie" },
  { key: "sabado", label: "Sáb" },
];

// Zod
const RangeSchema = z.object({
  from: z.date({ required_error: "Requerido" }),
  to: z.date({ required_error: "Requerido" }),
}).refine((r) => r.from <= r.to, { message: "La fecha inicial debe ser anterior o igual a la final", path: ["to"] });

const OptionalRangeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
}).refine((r) => {
  if (!r.from && !r.to) return true;
  return !!(r.from && r.to && r.from <= r.to);
}, { message: "Completa ambas fechas y asegúrate de que el inicio sea ≤ fin", path: ["to"] });

const HoraSchema = z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM");

const FormSchema = z.object({
  codigo: z.string().min(3, "Mínimo 3 caracteres"),
  idioma: z.enum(["ingles", "frances", "aleman", "italiano", "portugues"], { required_error: "Selecciona idioma" }),
  modalidad: z.enum(["intensivo", "sabatino", "semestral"], { required_error: "Selecciona modalidad" }),
  turno: z.enum(["matutino", "vespertino", "mixto"], { required_error: "Selecciona turno" }),
  nivel: z.enum(
    ["Introductorio", "Básico 1", "Básico 2", "Básico 3", "Básico 4", "Básico 5", "Intermedio 1", "Intermedio 2", "Intermedio 3", "Intermedio 4", "Intermedio 5", "Avanzado 1", "Avanzado 2", "Avanzado 3", "Avanzado 4", "Avanzado 5", "Avanzado 6"],
    { required_error: "Selecciona nivel" }
  ),

  modalidad_asistencia: z.enum(["presencial", "virtual"]).optional(),
  aula: z.string().optional(),

  cupo_total: z.coerce.number({ required_error: "Requerido" }).int("Debe ser entero").min(0, "No puede ser negativo"),

  dias: z.array(z.string()).min(1, "Selecciona al menos un día"),
  hora_inicio: HoraSchema,
  hora_fin: HoraSchema,

  inscripcion: RangeSchema,
  curso: RangeSchema,

  examenMT: z.date().optional(),
  examenFinal: z.date().optional(),

  docente_id: z.string().optional(),

  notas: z.string().optional(),
}).refine(
  (v) => !v.hora_inicio || !v.hora_fin || v.hora_inicio < v.hora_fin,
  { path: ["hora_fin"], message: "La hora fin debe ser posterior a la de inicio" }
).superRefine((v, ctx) => {
  if (v.modalidad_asistencia === "presencial" && v.aula !== undefined && !v.aula.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["aula"],
      message: "El aula no puede estar vacía cuando la modalidad es presencial",
    });
  }
});

type FormType = z.infer<typeof FormSchema>;

const EMPTY_FORM: FormType = {
  codigo: "",
  idioma: undefined as unknown as FormType["idioma"],
  modalidad: undefined as unknown as FormType["modalidad"],
  turno: undefined as unknown as FormType["turno"],
  nivel: undefined as unknown as FormType["nivel"],
  modalidad_asistencia: "presencial",
  aula: "",
  cupo_total: 0,
  dias: [],
  hora_inicio: "" as any,
  hora_fin: "" as any,
  inscripcion: {} as any,
  curso: {} as any,
  examenMT: undefined,
  examenFinal: undefined,
  docente_id: undefined,
  notas: "",
};

/* ====== Helpers de formato para pantalla ====== */
function abreviarDia(key: string) {
  const m: Record<string, string> = {
    lunes: "Lun",
    martes: "Mar",
    miercoles: "Mié",
    jueves: "Jue",
    viernes: "Vie",
    sabado: "Sáb",
    domingo: "Dom",
  };
  return m[key] ?? key;
}
function hhmm(h?: string) {
  if (!h) return "";
  const m = h.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : h;
}
const dShort = (s?: string) => {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  const day = dt.toLocaleString("es-MX", { day: "2-digit" });
  const month = dt.toLocaleString("es-MX", { month: "short" }).replace(/\./g, "");
  const year = dt.toLocaleString("es-MX", { year: "2-digit" });
  return `${day}/${month}/${year}`;
};
// dt ISO -> "lun 02 sep 2025, 07:15"
const dWhen = (s?: string) => {
  if (!s) return "—";
  const dt = new Date(s);
  return dt
    .toLocaleString("es-MX", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/\./g, "");
};

/* ===== Tipos locales ===== */
type InscripcionLite = {
  id: number;
  created_at?: string | null;
  alumno?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    is_ipn?: boolean | null;
    boleta?: string | null;
  } | null;
};

/* ============== Exportar a PDF (Carta, encabezado 2 columnas con Docente alineado + pills + orden ascendente) ============== */
async function exportInscritosPDF(c: CicloDTO, rows: InscripcionLite[]) {
  if (!c) return;
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default as any;

  // ==== Helpers ====
  const safe = (s?: string | null) => (s?.toString() || "—").trim();

  function abreviarDia(key: string) {
    const m: Record<string, string> = {
      lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue",
      viernes: "Vie", sabado: "Sáb", domingo: "Dom",
    };
    return m[key] ?? key;
  }
  function hhmm(h?: string) {
    if (!h) return "—";
    const m = h.match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : h;
  }
  // 29/sep/25 (encabezado compacto)
  function dShortShort(s?: string) {
    if (!s) return "—";
    const dt = new Date(`${s}T00:00:00`);
    if (isNaN(dt.getTime())) return "—";
    const day = String(dt.getDate()).padStart(2, "0");
    const mesShort = dt.toLocaleString("es-MX", { month: "short" }).replace(/\./g, "").toLowerCase();
    const year = String(dt.getFullYear()).slice(-2);
    return `${day}/${mesShort}/${year}`;
  }
  // 25/Sep/2025 16:45 hrs. (tabla)
  function dWhenPDF(s?: string) {
    if (!s) return "—";
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return "—";
    const mesesAbbr = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const dia = String(dt.getDate()).padStart(2, "0");
    const mes = mesesAbbr[dt.getMonth()];
    const anio = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${anio} ${hh}:${mm}`;
  }

  // Ajusta tamaño de fuente para que "text" quepa en maxW (aprox.)
  function fitFontSize(doc: any, text: string, maxW: number, baseFs = 9.2, minFs = 8) {
    let fs = baseFs;
    doc.setFontSize(fs);
    let w = doc.getTextWidth(text);
    while (w > maxW && fs > minFs) {
      fs -= 0.2;
      doc.setFontSize(fs);
      w = doc.getTextWidth(text);
    }
    return fs;
  }

  const docenteNombre =
    c.docente && (c.docente.first_name || c.docente.last_name)
      ? `${c.docente.first_name ?? ""} ${c.docente.last_name ?? ""}`.trim()
      : "—";
  const docenteEmail = c.docente?.email || "—";
  const docenteLinea = `${docenteNombre} • ${docenteEmail}`;

  const diasTxt = ((c as any).dias ?? []).length
    ? ((c as any).dias as string[]).map(abreviarDia).join(" • ")
    : "—";
  const horarioTxt =
    (c as any).hora_inicio && (c as any).hora_fin
      ? `${hhmm((c as any).hora_inicio)}–${hhmm((c as any).hora_fin)}`
      : "—";
  const cursoTxt = `${c.curso?.from ? dShortShort(c.curso.from) : "—"} – ${c.curso?.to ? dShortShort(c.curso.to) : "—"}`;
  const inscTxt  = `${c.inscripcion?.from ? dShortShort(c.inscripcion.from) : "—"} – ${c.inscripcion?.to ? dShortShort(c.inscripcion.to) : "—"}`;

  // Totales
  const total = rows.length;
  const ipnCount = rows.reduce((acc, r) => acc + (r.alumno?.is_ipn ? 1 : 0), 0);
  const externos = Math.max(0, total - ipnCount);

  // ==== Documento carta ====
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const innerW = pageW - margin * 2;
  let y = margin;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Listado de inscritos", margin, y);
  y += 12;

  // ==== Encabezado en dos columnas (meta, con Docente en columna izquierda) ====
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);

  const gutter = 12;
  const colW = Math.floor((innerW - gutter) / 2);
  const leftX = margin;
  const rightX = margin + colW + gutter;

  // Medidas de columna izquierda (para “Docente” sin salto)
  const leftLabelW = 75;                  // ancho de la columna de etiquetas (izquierda)
  const leftValueW = colW - leftLabelW;   // ancho disponible para valores
  const cellPad = 2;                      // cellPadding usado abajo

  // Fit dinámico solo para la celda Docente
  const docenteFitFont = fitFontSize(
    doc,
    docenteLinea,
    leftValueW - cellPad * 2, // descuenta padding
    9.2,
    8
  );

  const leftRows: any[] = [
    ["Ciclo", `${safe(c.codigo)}`],
    ["Modalidad", `${safe(c.modalidad)} • Turno: ${safe(c.turno)} • Cupo: ${safe((c as any).cupo_total)}`],
    ["Inscripción", `${inscTxt}`],
    ["Días", `${diasTxt} • Horario: ${horarioTxt}`],
    // Docente alineado en su fila/columna con fuente ajustada para NO partir línea
    ["Docente", { content: docenteLinea, styles: { fontSize: docenteFitFont, overflow: "ellipsize" as const } }],
  ];

  const rightRows = [
    ["Idioma", `${safe(c.idioma)} • Nivel: ${safe((c as any).nivel)}`],
    ["Asistencia", `${safe((c as any).modalidad_asistencia)} • Aula: ${safe((c as any).aula)}`],
    ["Curso", `${cursoTxt}`],
    ["Exámenes", `MT: ${c.examenMT ? dShortShort(c.examenMT) : "—"} • Final: ${c.examenFinal ? dShortShort(c.examenFinal) : "—"}`],
  ];

  const headStyles = { halign: "left" as const, fontStyle: "bold" as const, fillColor: [255,255,255], textColor: [0,0,0] };
  const bodyStyles = { halign: "left" as const, cellPadding: cellPad, fontSize: 9.2 };

  (autoTable as any)(doc, {
    startY: y,
    theme: "plain",
    head: [["", ""]],
    body: leftRows,
    margin: { left: leftX, right: pageW - (leftX + colW) },
    tableWidth: colW,
    styles: { fontSize: 9.2, cellPadding: cellPad, overflow: "linebreak" },
    headStyles,
    bodyStyles,
    columnStyles: { 0: { cellWidth: leftLabelW, fontStyle: "bold" }, 1: { cellWidth: leftValueW } },
    didParseCell: (d: any) => {
      // Color tenue para etiquetas
      if (d.section === "body" && d.column.index === 0) d.cell.styles.textColor = [90,90,90];
      // Asegura una sola línea en “Docente” (ya forzamos font size); evita linebreak
      if (d.section === "body" && d.row.index === 4 && d.column.index === 1) {
        d.cell.styles.overflow = "ellipsize";
      }
    },
  });
  const leftEndY = (doc as any).lastAutoTable.finalY;

  (autoTable as any)(doc, {
    startY: y,
    theme: "plain",
    head: [["", ""]],
    body: rightRows,
    margin: { left: rightX, right: margin },
    tableWidth: colW,
    styles: { fontSize: 9.2, cellPadding: cellPad, overflow: "linebreak" },
    headStyles,
    bodyStyles,
    columnStyles: { 0: { cellWidth: 88, fontStyle: "bold" }, 1: { cellWidth: colW - 88 } },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 0) d.cell.styles.textColor = [90,90,90];
    },
  });
  const rightEndY = (doc as any).lastAutoTable.finalY;

  y = Math.max(leftEndY, rightEndY) + 6;

  // ==== Pills de totales (después del encabezado) ====
  const chipH = 18, padX = 8, radius = 5, gap = 6;
  doc.setFontSize(9.2);
  function chip(text: string, x: number, color: [number, number, number]) {
    const w = doc.getTextWidth(text) + padX * 2;
    doc.setFillColor(...color);
    doc.setDrawColor(...color);
    (doc as any).roundedRect(x, y, w, chipH, radius, radius, "FD");
    doc.setTextColor(255, 255, 255);
    doc.text(text, x + padX, y + chipH / 2 + 3, { baseline: "middle" as any });
    doc.setTextColor(0, 0, 0);
    return w;
  }
  let cx = margin;
  cx += chip(`Total: ${total}`, cx, [51, 103, 214]) + gap;   // azul
  cx += chip(`IPN: ${ipnCount}`, cx, [0, 150, 136]) + gap;   // verde
  cx += chip(`Externos: ${externos}`, cx, [255, 152, 0]);    // naranja
  y += chipH + 8;

  // Separador
  doc.setDrawColor(230);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ==== Tabla de inscritos (compacta, ORDENADA ASC por fecha de creación) ====
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return ta - tb; // más viejo -> más reciente
  });

  const body = sorted.map((r, idx) => {
    const name =
      `${(r.alumno?.first_name ?? "").trim()} ${(r.alumno?.last_name ?? "").trim()}`.trim() ||
      (r.alumno?.email ?? "—");
    const email = r.alumno?.email ?? "—";
    const boleta = r.alumno?.boleta ?? "—";
    const tipo = r.alumno?.is_ipn ? "IPN" : "Externo";
    const creado = dWhenPDF(r.created_at ?? undefined); // 25/Sep/2025 16:45 hrs.
    return [idx + 1, name, email, boleta, tipo, creado];
  });

  const COLS = [0.06, 0.30, 0.27, 0.12, 0.08, 0.17];
  const W = COLS.map((f) => Math.floor(innerW * f));

  (autoTable as any)(doc, {
    startY: y,
    head: [["#", "Nombre", "Email", "Boleta", "Tipo", "Inscripción"]],
    body,
    margin: { left: margin, right: margin },
    tableWidth: innerW,
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", cellWidth: "wrap" },
    headStyles: { fillColor: [242, 242, 242], textColor: [0, 0, 0], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { halign: "right", cellWidth: W[0] },
      1: { cellWidth: W[1] },
      2: { cellWidth: W[2] },
      3: { cellWidth: W[3] },
      4: { halign: "center", cellWidth: W[4] },
      5: { cellWidth: W[5] },
    },
    didParseCell: (d: any) => { d.cell.styles.minCellHeight = 12; },
    didDrawPage: () => {
      const pageW_ = doc.internal.pageSize.getWidth();
      const pageH_ = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Generado: ${new Date().toLocaleString("es-MX").replace(/\./g, "")}`, margin, pageH_ - 12, { baseline: "bottom" as any });
      const pageNo = `Página ${doc.internal.getNumberOfPages()}`;
      doc.text(pageNo, pageW_ - margin, pageH_ - 12, { align: "right", baseline: "bottom" as any });
      doc.setTextColor(0);
    },
  });

  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `${safe(c.codigo)}-inscritos-${ymd}.pdf`.replace(/\s+/g, "_");
  doc.save(filename);
}



/* ========================= MAIN ========================= */
const PAGE_SIZE_OPTIONS = [4, 10, 20, 50];

export default function GroupsSection() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<CicloDTO | null>(null);

  // Vista: tarjetas o lista
  const [view, setView] = useState<"cards" | "list">("cards");

  // Toolbar (filtros)
  const [q, setQ] = useState(""); // (sigue existiendo por si luego quieres reactivar la búsqueda)
  const [fIdioma, setFIdioma] = useState<string | undefined>();
  const [fModalidad, setFModalidad] = useState<string | undefined>();
  const [fTurno, setFTurno] = useState<string | undefined>();
  const [fNivel, setFNivel] = useState<string | undefined>();

  // Docentes
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // Paginación & data (server-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return PAGE_SIZE_OPTIONS[0];
    const raw = window.localStorage.getItem("ciclos_page_size");
    const parsed = raw ? Number(raw) : NaN;
    return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : PAGE_SIZE_OPTIONS[0];
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ciclos_page_size", String(pageSize));
    }
  }, [pageSize]);

  const [data, setData] = useState<CicloListResponse | null>(null);
  const items = data?.items ?? [];
  const canPrev = (data?.page ?? 1) > 1;
  const canNext = !!data && data.page < data.pages;

  // Sheet de inscritos
  theSheet: {
  }
  const [openIns, setOpenIns] = useState(false);
  const [insCiclo, setInsCiclo] = useState<CicloDTO | null>(null);
  const [insList, setInsList] = useState<InscripcionLite[]>([]);
  const [loadingIns, setLoadingIns] = useState(false);

  // Form
  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: EMPTY_FORM,
    mode: "onChange",
  });
  const {
    control, register, handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset, setValue
  } = form;

  // Fetch lista
  async function fetchList(params: ListCiclosParams) {
    const resp = await listCiclos(params);
    setData(resp);
  }

  useEffect(() => {
    const params: ListCiclosParams = {
      page,
      page_size: pageSize,
      q: q || undefined,
      idioma: fIdioma as any,
      modalidad: fModalidad as any,
      turno: fTurno as any,
      nivel: fNivel as any,
    };
    fetchList(params).catch((e) => {
      console.error(e);
      toast.error(e?.message || "No se pudo cargar la lista de ciclos");
    });
  }, [page, pageSize, q, fIdioma, fModalidad, fTurno, fNivel]);

  // Cargar docentes (activos)
  useEffect(() => {
    listTeachers({ page: 1, page_size: 200 })
      .then((list) => {
        const activos = (list || []).filter(t => t.status === "activo");
        setTeachers(activos);
      })
      .catch((e) => console.error("No se pudieron cargar docentes", e));
  }, []);

  const refreshFirstPage = async () => {
    await fetchList({ page: 1, page_size: pageSize });
    setPage(1);
  };

  // Submit (create / edit)
  const onSubmit = async (values: FormType) => {
    const payload: any = {
      codigo: values.codigo.trim(),
      idioma: values.idioma,
      modalidad: values.modalidad,
      turno: values.turno,
      nivel: values.nivel,

      modalidad_asistencia: values.modalidad_asistencia,
      aula: values.aula?.trim() || undefined,

      cupo_total: values.cupo_total,

      dias: values.dias,
      hora_inicio: values.hora_inicio,
      hora_fin: values.hora_fin,

      inscripcion: rangeToISO(values.inscripcion)!,
      curso: rangeToISO(values.curso)!,

      examenMT: dateToISO(values.examenMT),
      examenFinal: dateToISO(values.examenFinal),

      notas: values.notas?.trim() || undefined,
    };

    const docenteId = values.docente_id && values.docente_id.length ? Number(values.docente_id) : undefined;
    if (docenteId) payload.docente_id = docenteId;

    try {
      if (mode === "create") {
        await createCiclo(payload);
        toast.success("Ciclo creado");
      } else {
        if (!selected) throw new Error("No hay ciclo seleccionado");
        await updateCiclo(selected.id, payload);
        toast.success("Ciclo actualizado");
      }

      setOpen(false);
      setSelected(null);
      setMode("create");
      reset(EMPTY_FORM, { keepDefaultValues: false });
      await refreshFirstPage();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || (mode === "create" ? "No se pudo crear el ciclo" : "No se pudo actualizar el ciclo"));
    }
  };

  const onEdit = (c: CicloDTO) => {
    setMode("edit");
    setSelected(c);
    const diasFromDTO = ((c as any).dias ?? []) as string[];
    reset({
      codigo: c.codigo,
      idioma: c.idioma as any,
      modalidad: c.modalidad,
      turno: c.turno,
      nivel: (c as any).nivel as any,

      modalidad_asistencia: (c as any).modalidad_asistencia ?? "presencial",
      aula: (c as any).aula ?? "",

      cupo_total: (c as any).cupo_total ?? 0,

      dias: diasFromDTO,
      hora_inicio: (c as any).hora_inicio ?? "",
      hora_fin: (c as any).hora_fin ?? "",

      inscripcion: rangeFromDTO(c.inscripcion) as any,
      curso: rangeFromDTO(c.curso) as any,

      examenMT: isoToDate((c as any).examenMT),
      examenFinal: isoToDate((c as any).examenFinal),

      docente_id: c.docente_id ? String(c.docente_id) : undefined,

      notas: c.notas ?? "",
    } as FormType);
    setOpen(true);
  };

  const onDelete = async (c: CicloDTO) => {
    try {
      await deleteCiclo(c.id);
      toast.success("Ciclo eliminado");
      await refreshFirstPage();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No se pudo eliminar el ciclo");
    }
  };

  // ==== NUEVO: abrir sheet de inscritos ====
  const openInscritos = async (c: CicloDTO) => {
    setInsCiclo(c);
    setOpenIns(true);
    setLoadingIns(true);
    try {
      const rows = await listInscripcionesCiclo(c.id);
      setInsList(rows || []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "No se pudieron cargar las inscripciones");
      setInsList([]);
    } finally {
      setLoadingIns(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-neutral-900 to-neutral-500 bg-clip-text text-transparent">
              Grupos
            </span>
          </h1>
          <p className="text-sm text-neutral-600">
            Administra ciclos (grupos), idiomas, niveles, cupos, calendarios y horario.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="gap-2 rounded-xl shadow-sm"
            onClick={() => {
              setMode("create");
              setSelected(null);
              reset(EMPTY_FORM, { keepDefaultValues: false });
              setOpen(true);
            }}
          >
            <PlusCircle className="h-4 w-4" />
            Crear nuevo ciclo
          </Button>

        </div>
      </header>

      {/* Toolbar */}
      <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
        {/* === Fila 1: controles principales en un renglón === */}
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Por página */}
          <span className="text-xs text-neutral-600">Por página</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
          >
            <SelectTrigger className="w-[72px] rounded-xl h-9">
              <SelectValue placeholder={`${PAGE_SIZE_OPTIONS[0]}`} />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>

       

          {/* Idioma */}
          <Select value={fIdioma} onValueChange={(v) => { setFIdioma(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] rounded-xl h-9">
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ingles">Inglés</SelectItem>
              <SelectItem value="frances">Francés</SelectItem>
              <SelectItem value="aleman">Alemán</SelectItem>
              <SelectItem value="italiano">Italiano</SelectItem>
              <SelectItem value="portugues">Portugués</SelectItem>
            </SelectContent>
          </Select>

          {/* Modalidad */}
          <Select value={fModalidad} onValueChange={(v) => { setFModalidad(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] rounded-xl h-9">
              <SelectValue placeholder="Modalidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intensivo">Intensivo</SelectItem>
              <SelectItem value="sabatino">Sabatino</SelectItem>
              <SelectItem value="semestral">Semestral</SelectItem>
            </SelectContent>
          </Select>

          {/* Turno */}
          <Select value={fTurno} onValueChange={(v) => { setFTurno(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] rounded-xl h-9">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="matutino">Matutino</SelectItem>
              <SelectItem value="vespertino">Vespertino</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>

          {/* Nivel */}
          <Select value={fNivel} onValueChange={(v) => { setFNivel(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] rounded-xl h-9">
              <SelectValue placeholder="Nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Introductorio">Introductorio</SelectItem>
              <SelectItem value="Básico 1">Básico 1</SelectItem>
              <SelectItem value="Básico 2">Básico 2</SelectItem>
              <SelectItem value="Básico 3">Básico 3</SelectItem>
              <SelectItem value="Básico 4">Básico 4</SelectItem>
              <SelectItem value="Básico 5">Básico 5</SelectItem>
              <SelectItem value="Intermedio 1">Intermedio 1</SelectItem>
              <SelectItem value="Intermedio 2">Intermedio 2</SelectItem>
              <SelectItem value="Intermedio 3">Intermedio 3</SelectItem>
              <SelectItem value="Intermedio 4">Intermedio 4</SelectItem>
              <SelectItem value="Intermedio 5">Intermedio 5</SelectItem>
              <SelectItem value="Avanzado 1">Avanzado 1</SelectItem>
              <SelectItem value="Avanzado 2">Avanzado 2</SelectItem>
              <SelectItem value="Avanzado 3">Avanzado 3</SelectItem>
              <SelectItem value="Avanzado 4">Avanzado 4</SelectItem>
              <SelectItem value="Avanzado 5">Avanzado 5</SelectItem>
              <SelectItem value="Avanzado 6">Avanzado 6</SelectItem>
            </SelectContent>

          </Select>

          {/* Toggle vista + Búsqueda (alineados a la derecha) */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant={view === "cards" ? "default" : "outline"}
              className="rounded-xl h-9"
              onClick={() => setView("cards")}
            >
              Tarjetas
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "outline"}
              className="rounded-xl h-9"
              onClick={() => setView("list")}
            >
              Lista
            </Button>

            {/* Búsqueda siempre activa al final */}
            <div className="relative w-[220px] sm:w-[280px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Buscar ciclo por código…"
                className="pl-9 rounded-xl h-9"
              />
            </div>
          </div>
        </div>

        {/* === Fila 2: filtros seleccionados + Limpiar filtros === */}
        {(fIdioma || fModalidad || fTurno || fNivel) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-500">Filtros seleccionados:</span>

            {/* Chip: Idioma */}
            {fIdioma && (
              <button
                type="button"
                onClick={() => { setFIdioma(undefined); setPage(1); }}
                className="rounded-full border px-2 py-1 text-[11px] bg-white/80 hover:bg-neutral-50 capitalize"
                title="Quitar filtro: Idioma"
              >
                Idioma: {fIdioma} <span className="ml-1">×</span>
              </button>
            )}

            {/* Chip: Modalidad */}
            {fModalidad && (
              <button
                type="button"
                onClick={() => { setFModalidad(undefined); setPage(1); }}
                className="rounded-full border px-2 py-1 text-[11px] bg-white/80 hover:bg-neutral-50 capitalize"
                title="Quitar filtro: Modalidad"
              >
                Modalidad: {fModalidad} <span className="ml-1">×</span>
              </button>
            )}

            {/* Chip: Turno */}
            {fTurno && (
              <button
                type="button"
                onClick={() => { setFTurno(undefined); setPage(1); }}
                className="rounded-full border px-2 py-1 text-[11px] bg-white/80 hover:bg-neutral-50 capitalize"
                title="Quitar filtro: Turno"
              >
                Turno: {fTurno} <span className="ml-1">×</span>
              </button>
            )}

            {/* Chip: Nivel */}
            {fNivel && (
              <button
                type="button"
                onClick={() => { setFNivel(undefined); setPage(1); }}
                className="rounded-full border px-2 py-1 text-[11px] bg-white/80 hover:bg-neutral-50"
                title="Quitar filtro: Nivel"
              >
                Nivel: {fNivel} <span className="ml-1">×</span>
              </button>
            )}

            {/* Limpiar todos los filtros */}
            <button
              type="button"
              onClick={() => {
                setFIdioma(undefined);
                setFModalidad(undefined);
                setFTurno(undefined);
                setFNivel(undefined);
                setPage(1);
              }}
              className="rounded-full border px-2 py-1 text-[11px] bg-white/80 hover:bg-red-50 flex items-center justify-center"
              title="Limpiar todos los filtros"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </button>
          </div>
        )}

        <Separator className="my-4" />

        {/* Lista + paginación */}
        {items.length ? (
          <>
            {view === "cards" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((c) => (
                  <CardCiclo key={c.id} c={c} onEdit={onEdit} onDelete={onDelete} onShowIns={openInscritos} />
                ))}
              </div>
            ) : (
              <TableCiclos items={items} onEdit={onEdit} onDelete={onDelete} onShowIns={openInscritos} />
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-neutral-500">
                Página {data?.page} de {data?.pages} · {data?.total} resultados
              </span>

              {/* Selector de página + paginación */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-600 hidden sm:inline-block">Por página</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                >
                  <SelectTrigger className="w-[92px] rounded-xl h-9">
                    <SelectValue placeholder={`${PAGE_SIZE_OPTIONS[0]}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canNext}
                    onClick={() => setPage((p) => (data ? Math.min(data.pages, p + 1) : p + 1))}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border bg-white/70 p-6 text-sm text-neutral-600">
            {q || fIdioma || fModalidad || fTurno || fNivel ? "No hay ciclos que coincidan con los filtros." : "No hay ciclos configurados."}
          </div>
        )}
      </div>

      {/* ==== SHEET: Inscritos del ciclo ==== */}
      <Sheet open={openIns} onOpenChange={setOpenIns}>
        <SheetContent
          side="top"
          className="w-full sm:max-w-xl px-4 sm:px-6"
        >
          <SheetHeader className="px-0">
            <SheetTitle>Inscritos — {insCiclo?.codigo ?? "—"}</SheetTitle>
            <SheetDescription>Listado de alumnos inscritos con fecha y hora.</SheetDescription>
          </SheetHeader>

          {/* métricas */}
          {(() => {
            const ipnCount = insList.reduce((acc, r) => acc + (r.alumno?.is_ipn ? 1 : 0), 0);
            const total = insList.length;
            const externos = Math.max(0, total - ipnCount);

            return (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pb-1">
                <div className="rounded-xl border bg-white/60 p-3 text-center">
                  <div className="text-xs text-neutral-500">Comunidad IPN</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{ipnCount}</div>
                </div>
                <div className="rounded-xl border bg-white/60 p-3 text-center">
                  <div className="text-xs text-neutral-500">Externos</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{externos}</div>
                </div>
                <div className="rounded-xl border bg-white/60 p-3 text-center">
                  <div className="text-xs text-neutral-500">Total</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{total}</div>
                </div>
              </div>
            );
          })()}

          {/* Contenido con margen inferior */}
          <div className="mt-3 space-y-3 pb-6">
            {/* Lista */}
            <div className="rounded-xl border bg-white/60">
              {loadingIns ? (
                <div className="p-4 text-sm text-neutral-600">Cargando…</div>
              ) : insList.length === 0 ? (
                <div className="p-4 text-sm text-neutral-600">Aún no hay inscritos.</div>
              ) : (
                <ul className="max-h-[55vh] overflow-y-auto divide-y">
                  {insList.map((row) => {
                    const name = `${row.alumno?.first_name ?? ""} ${row.alumno?.last_name ?? ""}`.trim();
                    const isIpn = !!row.alumno?.is_ipn;
                    const boleta = row.alumno?.boleta;
                    return (
                      <li key={row.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate">
                              {name || row.alumno?.email || "Alumno"}
                            </div>
                            {isIpn && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                                IPN
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-neutral-500 truncate">
                            {row.alumno?.email ?? "—"}
                          </div>

                          {isIpn && boleta && (
                            <div className="text-[11px] text-primary mt-0.5">
                              Boleta: <span className="font-medium tabular-nums">{boleta}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-xs tabular-nums text-neutral-700">
                          {dWhen(row.created_at ?? undefined)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          {/* Botón Exportar PDF */}
          <div className="mt-2 mb-6 flex justify-end">
            <Button
              onClick={() => insCiclo && exportInscritosPDF(insCiclo, insList)}
              disabled={loadingIns || !insList.length || !insCiclo}
              className="rounded-xl"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportar Listado
            </Button>
          </div>

        </SheetContent>
      </Sheet>


      {/* Dialog Crear/Editar */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setMode("create");
            setSelected(null);
            reset(EMPTY_FORM, { keepDefaultValues: false });
          }
        }}
      >
        <DialogContent
          key={`${mode}-${selected?.id ?? "new"}`}
          className="w-full sm:max-w-5xl p-0 overflow-hidden rounded-2xl border bg-white/90 shadow-2xl backdrop-blur"
        >
          <DialogHeader className="sticky top-0 z-10 bg-white/70 backdrop-blur px-6 py-4 border-b">
            <DialogTitle className="text-lg font-semibold">
              {mode === "create" ? "Crear nuevo ciclo" : `Editar ciclo: ${selected?.codigo}`}
            </DialogTitle>
            <DialogDescription className="text-neutral-600">
              Fechas en formato <b>periodo</b> y horario por días.
            </DialogDescription>
          </DialogHeader>

          <FormCiclo
            onSubmit={handleSubmit(onSubmit)}
            errors={errors}
            control={control}
            register={register}
            isSubmitting={isSubmitting}
            isValid={isValid}
            setValue={setValue}
            teachers={teachers}
          />

        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================= Subcomponentes ========================= */

function CardCiclo({ c, onEdit, onDelete, onShowIns }: {
  c: CicloDTO;
  onEdit: (c: CicloDTO) => void;
  onDelete: (c: CicloDTO) => void;
  onShowIns: (c: CicloDTO) => void;
}) {
  const cupo = (c as any).cupo_total ?? 0;
  const nivel = (c as any).nivel as string | undefined;
  const dias = ((c as any).dias ?? []) as string[];
  const hInicio = (c as any).hora_inicio as string | undefined;
  const hFin = (c as any).hora_fin as string | undefined;

  const diasTexto = dias.length ? dias.map(d => abreviarDia(d)).join(" • ") : "—";
  const horarioTexto = hInicio && hFin ? `${hhmm(hInicio)}–${hhmm(hFin)}` : "—";

  const modalidadAsistencia = (c as any).modalidad_asistencia as "presencial" | "virtual" | undefined;
  const aula = (c as any).aula as string | undefined;

  const inscritosCount = (c as any).inscritos_count as number | undefined;

  return (
    <div className="rounded-2xl border bg-white/60 p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Encabezado: Código + Docente */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{c.codigo}</h3>
          {c.docente && (c.docente.first_name || c.docente.last_name) ? (
            <div className="mt-0.5 text-[12px] text-neutral-600">
              Docente:&nbsp;
              <span className="font-medium">
                {(c.docente.first_name ?? "") + " " + (c.docente.last_name ?? "")}
              </span>
              {c.docente.email ? (
                <span className="text-neutral-400"> · {c.docente.email}</span>
              ) : null}
            </div>
          ) : (
            <div className="mt-0.5 text-[12px] text-neutral-400 italic">Sin docente asignado</div>
          )}
        </div>

        {/* Menú acciones */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(c)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar ciclo</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Seguro que deseas eliminar <b>{c.codigo}</b>? Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => onDelete(c)}
                  >
                    Sí, eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chips informativos */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="rounded-full">{c.idioma}</Badge>
        <Badge variant="secondary" className="rounded-full">{c.modalidad}</Badge>
        <Badge variant="outline" className="rounded-full">{c.turno}</Badge>

        {nivel && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-neutral-700">
            <GraduationCap className="h-3.5 w-3.5" /> {nivel}
          </span>
        )}

        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-neutral-700">
          <Users className="h-3.5 w-3.5" /> {cupo} lugares
        </span>

        {typeof inscritosCount === "number" && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-neutral-700">
            <Users className="h-3.5 w-3.5" /> {inscritosCount} inscritos
          </span>
        )}

        {modalidadAsistencia && (
          <Badge variant="secondary" className="rounded-full capitalize">{modalidadAsistencia}</Badge>
        )}

        {aula && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-neutral-700">
            <Building2 className="h-3.5 w-3.5" /> {aula}
          </span>
        )}
      </div>

      <div className="my-3"><Separator /></div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-700">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="font-medium text-neutral-800">Días</span>
          </div>
          <div className="mt-1 text-[12px] text-neutral-700">
            {(((c as any).dias ?? []) as string[]).length ? ((c as any).dias as string[]).map(abreviarDia).join(" • ") : "—"}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-700">
            <Clock3 className="h-3.5 w-3.5" />
            <span className="font-medium text-neutral-800">Horario</span>
          </div>
          <div className="mt-1 text-[12px] tabular-nums">
            {((c as any).hora_inicio && (c as any).hora_fin) ? `${hhmm((c as any).hora_inicio)}–${hhmm((c as any).hora_fin)}` : "—"}
          </div>
        </div>

        <div className="rounded-xl border bg-white/50 p-3">
          <div className="text-xs font-medium text-neutral-800">Inscripción</div>
          <div className="mt-1 text-[12px] tabular-nums">
            {c.inscripcion?.from ? dShort(c.inscripcion.from) : "—"} – {c.inscripcion?.to ? dShort(c.inscripcion.to) : "—"}
          </div>

          <div className="mt-2 text-xs font-medium text-neutral-800">Periodo del curso</div>
          <div className="mt-1 text-[12px] tabular-nums">
            {c.curso?.from ? dShort(c.curso.from) : "—"} – {c.curso?.to ? dShort(c.curso.to) : "—"}
          </div>
        </div>

        {(c.examenMT || c.examenFinal) ? (
          <div className="rounded-xl border bg-white/50 p-3">
            {c.examenMT && (
              <>
                <div className="text-xs font-medium text-neutral-800">Examen MT</div>
                <div className="mt-1 text-[12px] tabular-nums">{dShort(c.examenMT)}</div>
              </>
            )}

            {c.examenFinal && (
              <>
                <div className="mt-2 text-xs font-medium text-neutral-800">Examen final</div>
                <div className="mt-1 text-[12px] tabular-nums">{dShort(c.examenFinal)}</div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border bg-white/30 p-3 text-[12px] text-neutral-400 flex items-center justify-center">
            Sin fechas de exámenes
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" onClick={() => onShowIns(c)} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50">
          <Users className="h-4 w-4 mr-2" /> Ver inscritos
        </Button>

        <Button variant="outline" onClick={() => onEdit(c)} className="rounded-xl text-green-600 border-green-200 hover:bg-green-50">
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="rounded-xl text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar ciclo</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Seguro que deseas eliminar <b>{c.codigo}</b>? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => onDelete(c)}
              >
                Sí, eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/* ====== Helpers de TableCiclos (para accessors) ====== */
function docenteNombre(c: CicloDTO) {
  return c.docente && (c.docente.first_name || c.docente.last_name)
    ? `${c.docente.first_name ?? ""} ${c.docente.last_name ?? ""}`.trim()
    : "—";
}
function horarioDe(c: any) {
  const hIni = c?.hora_inicio as string | undefined;
  const hFin = c?.hora_fin as string | undefined;
  return (hIni && hFin) ? `${hhmm(hIni)}–${hhmm(hFin)}` : "—";
}
function cursoRango(c: CicloDTO) {
  return `${c.curso?.from ? dShort(c.curso.from) : "—"} – ${c.curso?.to ? dShort(c.curso.to) : "—"}`;
}

/* ========================= LISTA con TanStack ========================= */
function TableCiclos({
  items,
  onEdit,
  onDelete,
  onShowIns,
}: {
  items: CicloDTO[];
  onEdit: (c: CicloDTO) => void;
  onDelete: (c: CicloDTO) => void;
  onShowIns: (c: CicloDTO) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<CicloDTO>[]>(() => [
    {
      accessorKey: "codigo",
      header: "Código",
      cell: ({ row }) => <span className="font-medium">{row.original.codigo}</span>,
    },
    {
      accessorKey: "idioma",
      header: "Idioma",
      cell: ({ getValue }) => <span className="capitalize">{String(getValue() ?? "—")}</span>,
    },
    {
      accessorKey: "modalidad",
      header: "Modalidad",
      cell: ({ getValue }) => <span className="capitalize">{String(getValue() ?? "—")}</span>,
    },
    {
      accessorKey: "turno",
      header: "Turno",
      cell: ({ getValue }) => <span className="capitalize">{String(getValue() ?? "—")}</span>,
    },
    {
      id: "nivel",
      header: "Nivel",
      accessorFn: (c: any) => c?.nivel ?? "—",
    },
    {
      id: "horario",
      header: "Horario",
      accessorFn: (c: any) => horarioDe(c),
      cell: ({ getValue }) => <span className="tabular-nums">{String(getValue())}</span>,
      sortingFn: "alphanumeric",
    },
    {
      id: "curso",
      header: "Curso",
      accessorFn: (c: CicloDTO) => cursoRango(c),
      cell: ({ getValue }) => <span className="tabular-nums">{String(getValue())}</span>,
      sortingFn: "alphanumeric",
    },
    {
      id: "docente",
      header: "Docente",
      accessorFn: (c: CicloDTO) => docenteNombre(c),
    },
    {
      accessorKey: "cupo_total",
      header: "Cupo",
      cell: ({ getValue }) => <span className="tabular-nums">{Number(getValue() ?? 0)}</span>,
      sortingFn: "basic",
    },
    {
      id: "modalidad_asistencia",
      header: "Modalidad Asist.",
      accessorFn: (c: any) => c?.modalidad_asistencia ?? "—",
      cell: ({ getValue }) => <span className="capitalize">{String(getValue() ?? "—")}</span>,
    },
    {
      id: "aula",
      header: "Aula",
      accessorFn: (c: any) => c?.aula ?? "—",
    },
    {
      id: "acciones",
      header: () => <span className="sr-only">Acciones</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="text-right">
            <div className="inline-flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => onShowIns(c)}
              >
                <Users className="h-4 w-4 mr-1" /> Inscritos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => onEdit(c)}
              >
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar ciclo</AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Seguro que deseas eliminar <b>{c.codigo}</b>? Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => onDelete(c)}
                    >
                      Sí, eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      },
    },
  ], [onDelete, onEdit, onShowIns]);

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-2xl border bg-white/60 p-2 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[12px] text-neutral-600">
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="[&>th]:px-3 [&>th]:py-2 text-left">
              {hg.headers.map(h => {
                const canSort = h.column.getCanSort();
                const sortDir = h.column.getIsSorted(); // false | 'asc' | 'desc'
                return (
                  <th key={h.id}>
                    {canSort ? (
                      <button
                        className="inline-flex items-center gap-1 select-none"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <span className="text-[10px] text-neutral-400">
                          {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : ""}
                        </span>
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.map(r => (
            <tr key={r.id} className="[&>td]:px-3 [&>td]:py-2 align-top">
              {r.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-neutral-500">
                Sin resultados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DatePicker({
  label, value, onChange, placeholder = "Seleccionar fecha", error,
}: { label: string; value?: Date; onChange: (d?: Date) => void; placeholder?: string; error?: string; }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {error ? <span className="text-[11px] text-red-500">{error}</span> : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start rounded-xl h-9">
            {value ? fmt.format(value) : <span className="text-neutral-400">{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus locale={es} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DateRangePicker({
  label, value, onChange, months = 2, error,
}: { label: string; value: DateRange; onChange: (r: DateRange) => void; months?: number; error?: string; }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {error ? <span className="text-[11px] text-red-500">{error}</span> : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start rounded-xl h-9">
            {fmtRange(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" sideOffset={8} className="w-auto p-0 min-w-[320px] sm:min-w-[620px]">
          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={months}
              selected={{ from: value?.from, to: value?.to } as any}
              onSelect={(val) => onChange({ from: val?.from, to: val?.to })}
              initialFocus
              defaultMonth={value?.from ?? new Date()}
              locale={es}
              classNames={{
                months: "flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4",
                month: "space-y-2",
                caption: "flex justify-center pt-2 relative items-center",
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FormCiclo({
  onSubmit, errors, control, register, isSubmitting, isValid, setValue, teachers,
}: any) {
  const modalidad: "intensivo" | "sabatino" | "semestral" | undefined = useWatch({ control, name: "modalidad" });
  const modalidadAsistencia: "presencial" | "virtual" | undefined = useWatch({ control, name: "modalidad_asistencia" });
  const mountedRef = useRef(false);
  const prevModalidadRef = useRef<typeof modalidad>(undefined);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevModalidadRef.current = modalidad;
      return;
    }
    if (prevModalidadRef.current === modalidad) return;
    prevModalidadRef.current = modalidad;

    if (modalidad === "intensivo") {
      setValue("dias", ["lunes", "martes", "miercoles", "jueves", "viernes"], { shouldValidate: true, shouldDirty: true });
    } else if (modalidad === "sabatino") {
      setValue("dias", ["sabado"], { shouldValidate: true, shouldDirty: true });
    }
  }, [modalidad, setValue]);

  return (
    <form onSubmit={onSubmit}>
      <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
        {/* Datos generales */}
        <Section title="Datos generales">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Código</Label>
                {errors.codigo && <span className="text-[11px] text-red-500">{errors.codigo.message}</span>}
              </div>
              <Input placeholder="Ej: ING-A1-G25" className="h-9" {...register("codigo")} />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Idioma</Label>
                {errors.idioma && <span className="text-[11px] text-red-500">{errors.idioma.message}</span>}
              </div>
              <Controller
                control={control}
                name="idioma"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingles">Inglés</SelectItem>
                      <SelectItem value="frances">Francés</SelectItem>
                      <SelectItem value="aleman">Alemán</SelectItem>
                      <SelectItem value="italiano">Italiano</SelectItem>
                      <SelectItem value="portugues">Portugués</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Modalidad</Label>
                {errors.modalidad && <span className="text-[11px] text-red-500">{errors.modalidad.message}</span>}
              </div>
              <Controller
                control={control}
                name="modalidad"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intensivo">Intensivo</SelectItem>
                      <SelectItem value="sabatino">Sabatino</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Turno</Label>
                {errors.turno && <span className="text-[11px] text-red-500">{errors.turno.message}</span>}
              </div>
              <Controller
                control={control}
                name="turno"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matutino">Matutino</SelectItem>
                      <SelectItem value="vespertino">Vespertino</SelectItem>
                      <SelectItem value="mixto">Mixto</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Nivel</Label>
                {errors.nivel && <span className="text-[11px] text-red-500">{errors.nivel.message}</span>}
              </div>
              <Controller
                control={control}
                name="nivel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Introductorio">Introductorio</SelectItem>
                      <SelectItem value="Básico 1">Básico 1</SelectItem>
                      <SelectItem value="Básico 2">Básico 2</SelectItem>
                      <SelectItem value="Básico 3">Básico 3</SelectItem>
                      <SelectItem value="Básico 4">Básico 4</SelectItem>
                      <SelectItem value="Básico 5">Básico 5</SelectItem>
                      <SelectItem value="Intermedio 1">Intermedio 1</SelectItem>
                      <SelectItem value="Intermedio 2">Intermedio 2</SelectItem>
                      <SelectItem value="Intermedio 3">Intermedio 3</SelectItem>
                      <SelectItem value="Intermedio 4">Intermedio 4</SelectItem>
                      <SelectItem value="Intermedio 5">Intermedio 5</SelectItem>
                      <SelectItem value="Avanzado 1">Avanzado 1</SelectItem>
                      <SelectItem value="Avanzado 2">Avanzado 2</SelectItem>
                      <SelectItem value="Avanzado 3">Avanzado 3</SelectItem>
                      <SelectItem value="Avanzado 4">Avanzado 4</SelectItem>
                      <SelectItem value="Avanzado 5">Avanzado 5</SelectItem>
                      <SelectItem value="Avanzado 6">Avanzado 6</SelectItem>
                    </SelectContent>

                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cupo (lugares)</Label>
                {errors.cupo_total && <span className="text-[11px] text-red-500">{errors.cupo_total.message}</span>}
              </div>
              <Input
                type="number"
                min={0}
                step={1}
                className="h-9"
                placeholder="0"
                {...register("cupo_total", { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Modalidad de asistencia + Aula + Docente */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Modalidad de asistencia</Label>
              </div>
              <Controller
                control={control}
                name="modalidad_asistencia"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {modalidadAsistencia === "presencial" && (
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Aula</Label>
                  {errors.aula && <span className="text-[11px] text-red-500">{errors.aula.message}</span>}
                </div>
                <Input className="h-9" placeholder="Ej: 301-B" {...register("aula")} />
              </div>
            )}

            {/* Docente opcional */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Docente (opcional)</Label>
              </div>
              <Controller
                control={control}
                name="docente_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "__none"}
                    onValueChange={(v) =>
                      field.onChange(v === "__none" ? undefined : v)
                    }
                  >
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__none">Sin asignar</SelectItem>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.first_name} {t.last_name} — {t.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

          </div>
        </Section>

        {/* Horario */}
        <Section title="Horario del grupo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Días */}
            <div className="space-y-2">
              <Label className="text-xs">Días</Label>
              <div className="grid grid-cols-3 gap-2">
                {DIAS_OPCIONES.map(({ key, label }) => (
                  <Controller
                    key={key}
                    control={control}
                    name="dias"
                    render={({ field }) => {
                      const checked = (field.value as string[]).includes(key);
                      return (
                        <label className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const arr = new Set(field.value as string[]);
                              if (v) arr.add(key); else arr.delete(key);
                              field.onChange(Array.from(arr));
                            }}
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      );
                    }}
                  />
                ))}
              </div>
              {errors.dias && <span className="text-[11px] text-red-500">{errors.dias.message as string}</span>}
            </div>

            {/* Horas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Hora inicio</Label>
                  {errors.hora_inicio && <span className="text-[11px] text-red-500">{errors.hora_inicio.message as string}</span>}
                </div>
                <Controller
                  control={control}
                  name="hora_inicio"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl h-9">
                        <SelectValue placeholder="HH:MM" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {horasValidas.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Hora fin</Label>
                  {errors.hora_fin && <span className="text-[11px] text-red-500">{errors.hora_fin.message as string}</span>}
                </div>
                <Controller
                  control={control}
                  name="hora_fin"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl h-9">
                        <SelectValue placeholder="HH:MM" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {horasValidas.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Periodo del curso */}
        <Section title="Periodo del curso">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Controller
              control={control}
              name="curso"
              render={({ field }) => (
                <DateRangePicker
                  label=""
                  value={field.value as DateRange}
                  onChange={field.onChange}
                  months={2}
                  error={errors.curso?.to?.message || errors.curso?.from?.message}
                />
              )}
            />
          </div>
        </Section>

        {/* Inscripción */}
        <Section title="Inscripción">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Controller
              control={control}
              name="inscripcion"
              render={({ field }) => (
                <DateRangePicker
                  label="Periodo de inscripción"
                  value={field.value as DateRange}
                  onChange={field.onChange}
                  months={2}
                  error={errors.inscripcion?.to?.message || errors.inscripcion?.from?.message}
                />
              )}
            />
          </div>
        </Section>

        {/* Exámenes / Colocación (opcionales) */}
        <Section title="Exámenes (opcionales)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Controller
              control={control}
              name="examenMT"
              render={({ field }) => (
                <DatePicker
                  label="Examen MT (fecha única)"
                  value={field.value as Date}
                  onChange={field.onChange}
                  error={errors.examenMT?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="examenFinal"
              render={({ field }) => (
                <DatePicker
                  label="Examen final (fecha única)"
                  value={field.value as Date}
                  onChange={field.onChange}
                  error={errors.examenFinal?.message}
                />
              )}
            />
          </div>
        </Section>

        <Section title="Avisos">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea rows={3} placeholder="Notas o avisos importantes…" className="rounded-xl" {...(register("notas"))} />
            </div>
          </div>
        </Section>
      </div>

      <Separator />
      <DialogFooter className="sticky bottom-0 bg-white/70 backdrop-blur px-6 py-3">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="rounded-xl h-9">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!isValid || isSubmitting} className="rounded-xl h-9">
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ========================= Helpers locales ========================= */
function Section({ title, children }: { title: string; children: React.ReactNode; }) {
  return (
    <section className="rounded-2xl border bg-white/60 p-4 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-700">{title}</h3>
      {children}
    </section>
  );
}
