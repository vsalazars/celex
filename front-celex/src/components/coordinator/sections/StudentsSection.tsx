"use client";

import React from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2, Search, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { apiFetch, buildURL, getHistorialAlumno } from "@/lib/api";
import type { Paginated } from "@/lib/types";
import type { HistorialAlumnoResponse } from "@/lib/api";

/* ===== TanStack React Table ===== */
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

/* ============================
   Tipos locales (flexibles)
   ============================ */
export type AlumnoFull = {
  id?: number | string;
  inscripcion_id?: number | string;
  first_name?: string;
  last_name?: string;
  nombre?: string;
  email?: string;
  curp?: string;
  boleta?: string | null;
  is_ipn?: boolean;
  telefono?: string | null;
  tutor_telefono?: string | null;
  tutor_nombre?: string | null;
  tutor_parentesco?: string | null;

  // Dirección
  addr_calle?: string | null;
  addr_numero?: string | null;
  addr_colonia?: string | null;
  addr_municipio?: string | null;
  addr_estado?: string | null;
  addr_cp?: string | null;

  // Inscripción (si se conoce)
  fecha_inscripcion?: string | null;
  estado?: string | null;
  created_at?: string | null;

  // (perfil IPN)
  ipn_nivel?: string | null;
  ipn_unidad_academica?: string | null;
};

const ALL = "all"; // sentinel para 'Todos'

/* ============================
   HELPERS DE UI (GLOBALES) — NUEVOS
   ============================ */

/** Base visual del pill */
const pillBase =
  "inline-flex items-center h-7 px-3.5 rounded-full border text-sm font-medium shadow-sm";

/** Normaliza a minúsculas para comparar */
function k(v?: string | null) {
  return String(v ?? "").toLowerCase();
}

/** prettyEnum en scope de módulo (para que PillTag pueda usarlo sin ReferenceError) */
function prettyEnumGlobal(v?: string | null) {
  if (!v) return "-";
  let s = String(v);

  // Si viene "Enum.valor", toma la última parte (después del punto)
  if (s.includes(".")) {
    const parts = s.split(".");
    s = parts[parts.length - 1];
  }

  s = s.replace(/_/g, " ").toLowerCase();

  const map: Record<string, string> = {
    // Idiomas
    ingles: "Inglés",
    frances: "Francés",
    aleman: "Alemán",
    italiano: "Italiano",
    portugues: "Portugués",
    japones: "Japonés",
    chino: "Chino",

    // Modalidades / Turnos / Estados
    sabatino: "Sabatino",
    intensivo: "Intensivo",
    semestral: "Semestral",
    matutino: "Matutino",
    vespertino: "Vespertino",
    mixto: "Mixto",
    pago: "Pago",
    exencion: "Exención",
    confirmada: "Confirmada",
    rechazada: "Rechazada",
    preinscrita: "Preinscrita",
    registrada: "Registrada",
    cancelada: "Cancelada",

    // Niveles (completos)
    intro: "Introductorio",
    introductorio: "Introductorio",
    b1: "Básico 1",
    b2: "Básico 2",
    b3: "Básico 3",
    b4: "Básico 4",
    b5: "Básico 5",
    i1: "Intermedio 1",
    i2: "Intermedio 2",
    i3: "Intermedio 3",
    i4: "Intermedio 4",
    i5: "Intermedio 5",
    a1: "Avanzado 1",
    a2: "Avanzado 2",
    a3: "Avanzado 3",
    a4: "Avanzado 4",
    a5: "Avanzado 5",
    a6: "Avanzado 6",
  };

  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

/** Tono por tipo de etiqueta + valor.
 *  Requerimiento: GUINDA para Idioma y Nivel; GRISES para Modalidad y Turno.
 *  Guinda: #7A003C
 */
function pillTone(kind: "idioma" | "nivel" | "modalidad" | "turno", value?: string | null) {
  const GUINDA = "bg-[#7A003C]/10 text-[#7A003C] border-[#7A003C]/30";
  const GRIS   = "bg-neutral-100 text-neutral-700 border-neutral-200";

  if (kind === "idioma")    return GUINDA;
  if (kind === "nivel")     return GUINDA;
  if (kind === "modalidad") return GRIS;
  if (kind === "turno")     return GRIS;
  return GRIS;
}

/** Pill listo para usar (usa prettyEnumGlobal para no depender del scope del componente) */
function PillTag({
  kind,
  value,
  className,
}: {
  kind: "idioma" | "nivel" | "modalidad" | "turno";
  value?: string | null;
  className?: string;
}) {
  return (
    <span className={`${pillBase} ${pillTone(kind, value)} ${className ?? ""}`}>
      {prettyEnumGlobal(value)}
    </span>
  );
}

export default function StudentsSection() {
  const [q, setQ] = React.useState("");
  const [anio, setAnio] = React.useState<string>(ALL);
  const [idioma, setIdioma] = React.useState<string>(ALL);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [data, setData] = React.useState<Paginated<AlumnoFull>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    pages: 1,
  });

  const [loading, setLoading] = React.useState(false);
  const [fallbackMode, setFallbackMode] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Modal de expediente
  const [openExp, setOpenExp] = React.useState(false);
  const [selected, setSelected] = React.useState<AlumnoFull | null>(null);

  // Historial (confirmadas)
  const [hist, setHist] = React.useState<HistorialAlumnoResponse | null>(null);
  const [histLoading, setHistLoading] = React.useState(false);
  const [histError, setHistError] = React.useState<string | null>(null);

  // Años detectados a partir de /coordinacion/ciclos
  const [years, setYears] = React.useState<number[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const url = buildURL("/coordinacion/ciclos", {});
        const ciclos = await apiFetch<any[]>(url, { auth: true });
        const ys = Array.from(
          new Set(
            (ciclos || [])
              .map((c: any) => {
                const codigo = String(c?.codigo ?? "");
                const pref = codigo.split("-", 1)[0];
                return Number(pref) || undefined;
              })
              .filter(Boolean)
          )
        )
          .sort((a, b) => (b as number) - (a as number)) as number[];
        setYears(ys);
      } catch {
        // ignora
      }
    })();
  }, []);

  /* --- Helpers de normalización/deduplicado --- */
  function normEmail(v?: string | null) {
    return (v ?? "").trim().toLowerCase();
  }
  function normCURP(v?: string | null) {
    return (v ?? "").trim().toUpperCase();
  }
  function normNombre(v?: string | null) {
    return (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }
  function alumnoKey(a: AlumnoFull) {
    const byEmail = normEmail(a.email);
    if (byEmail) return `e:${byEmail}`;
    const byCurp = normCURP(a.curp);
    if (byCurp) return `c:${byCurp}`;
    const byNombre = normNombre(a.nombre || `${a.first_name ?? ""} ${a.last_name ?? ""}`);
    return `n:${byNombre}`;
  }
  function uniqueByAlumno(list: AlumnoFull[]) {
    const map = new Map<string, AlumnoFull>();
    for (const it of list) {
      const k = alumnoKey(it);
      if (!map.has(k)) map.set(k, it);
    }
    return Array.from(map.values());
  }

  const fetchStudents = React.useCallback(
    async () => {
      setError(null);
      setLoading(true);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // 1) Intento directo (back paginado)
        const url = buildURL("/coordinacion/alumnos", {
          q: q || undefined,
          anio: anio !== ALL ? anio : undefined,
          idioma: idioma !== ALL ? idioma : undefined,
          page,
          page_size: pageSize,
        });
        const resp = await apiFetch<Paginated<AlumnoFull>>(url, { auth: true, signal: ac.signal });
        setData(resp);
        setFallbackMode(false);
      } catch {
        // 2) Fallback
        try {
          setFallbackMode(true);
          const ciclosURL = buildURL("/coordinacion/ciclos", {
            anio: anio !== ALL ? anio : undefined,
            idioma: idioma !== ALL ? idioma : undefined,
          });
          const ciclos = await apiFetch<any[]>(ciclosURL, { auth: true, signal: ac.signal });

          const items: AlumnoFull[] = [];
          for (const c of ciclos || []) {
            const gruposURL = buildURL("/coordinacion/grupos", { cicloId: c?.id });
            const grupos = await apiFetch<any[]>(gruposURL, { auth: true, signal: ac.signal });

            for (const g of grupos || []) {
              const repURL = buildURL("/coordinacion/reportes/inscritos", {
                cicloId: c?.id,
                grupoId: g?.id,
                q: q || undefined,
              });
              const rep = await apiFetch<{ alumnos: any[] }>(repURL, { auth: true, signal: ac.signal });
              for (const a of rep?.alumnos || []) {
                items.push({
                  inscripcion_id: a?.inscripcion_id ?? a?.id,
                  nombre: a?.nombre,
                  email: a?.email,
                  boleta: a?.boleta,
                  curp: a?.curp,
                  estado: a?.estado,
                  fecha_inscripcion: a?.fecha_inscripcion,

                  // NUEVO: intenta mapear lo de IPN si viene del reporte
                  is_ipn: a?.is_ipn ?? a?.ipn ?? undefined,
                  ipn_nivel: a?.ipn_nivel ?? a?.nivel ?? a?.nivel_ipn ?? null,
                  ipn_unidad_academica:
                    a?.ipn_unidad_academica ?? a?.unidad_academica ?? a?.unidad ?? null,
                });
              }
            }
          }

          const dedup = uniqueByAlumno(items);
          const filtered = q
            ? dedup.filter((it) => {
                const hay = [it.nombre, it.first_name, it.last_name, it.email, it.curp, it.boleta]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return hay.includes(q.toLowerCase());
              })
            : dedup;

          const total = filtered.length;
          const pages = Math.max(1, Math.ceil(total / pageSize));
          const safePage = Math.min(page, pages);
          const start = (safePage - 1) * pageSize;
          const pageItems = filtered.slice(start, start + pageSize);

          setData({ items: pageItems, total, page: safePage, page_size: pageSize, pages });
        } catch {
          setError("No se pudo cargar el listado de alumnos.");
        }
      } finally {
        setLoading(false);
      }
    },
    [q, anio, idioma, page, pageSize]
  );

  React.useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /* ============================
     Historial (CONFIRMADAS) al abrir modal
     ============================ */
  React.useEffect(() => {
    (async () => {
      if (!openExp) { setHist(null); setHistError(null); return; }
      if (!selected?.id) { setHist(null); setHistError("No se puede cargar historial: falta ID de alumno."); return; }

      try {
        setHistLoading(true);
        setHistError(null);
        const r = await getHistorialAlumno(String(selected.id), { estado: "confirmada" });
        setHist(r);
      } catch (e: any) {
        setHistError(e?.message || "No se pudo cargar el historial de cursos confirmados.");
        setHist(null);
        console.error("[historial alumno] error:", e);
      } finally {
        setHistLoading(false);
      }
    })();
  }, [openExp, selected?.id]);

  /* ============================
     Utilidades de UI
     ============================ */
  function fullName(a: AlumnoFull): string {
    if (a.nombre && a.nombre.trim()) return a.nombre.trim();
    return [a.last_name, a.first_name].filter(Boolean).join(" ") || "(sin nombre)";
  }

  // ⬇️ Tu prettyEnum original (lo dejo intacto)
  function prettyEnum(v?: string | null) {
    if (!v) return "-";
    let s = String(v);

    // Si viene "Enum.valor", toma la última parte (después del punto)
    if (s.includes(".")) {
      const parts = s.split(".");
      s = parts[parts.length - 1];
    }

    s = s.replace(/_/g, " ").toLowerCase();

    const map: Record<string, string> = {
      ingles: "Inglés",
      frances: "Francés",
      aleman: "Alemán",
      italiano: "Italiano",
      portugues: "Portugués",
      japones: "Japonés",
      chino: "Chino",
      sabatino: "Sabatino",
      intensivo: "Intensivo",
      semestral: "Semestral",
      matutino: "Matutino",
      vespertino: "Vespertino",
      mixto: "Mixto",
      pago: "Pago",
      exencion: "Exención",
      confirmada: "Confirmada",
      rechazada: "Rechazada",
      preinscrita: "Preinscrita",
      registrada: "Registrada",
      cancelada: "Cancelada",

      // ⬇️ Niveles completos
      intro: "Introductorio",
      introductorio: "Introductorio",
      b1: "Básico 1",
      b2: "Básico 2",
      b3: "Básico 3",
      b4: "Básico 4",
      b5: "Básico 5",
      i1: "Intermedio 1",
      i2: "Intermedio 2",
      i3: "Intermedio 3",
      i4: "Intermedio 4",
      i5: "Intermedio 5",
      a1: "Avanzado 1",
      a2: "Avanzado 2",
      a3: "Avanzado 3",
      a4: "Avanzado 4",
      a5: "Avanzado 5",
      a6: "Avanzado 6",
    };

    return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
  }

  function badgeTone(status?: string | null) {
    const s = (status || "").toLowerCase();
    if (s === "confirmada") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "rechazada")  return "bg-red-50 text-red-700 border-red-200";
    if (s === "preinscrita" || s === "registrada") return "bg-amber-50 text-amber-700 border-amber-200";
    if (s === "cancelada")  return "bg-neutral-100 text-neutral-600 border-neutral-200";
    return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }

  function rowKey(a: AlumnoFull, idx: number): string {
    const base = [normEmail(a.email), normCURP(a.curp), normNombre(a.nombre || `${a.first_name ?? ""} ${a.last_name ?? ""}`)]
      .filter(Boolean)
      .join("|");
    return base ? `${base}#${idx}` : `idx:${idx}`;
  }

  function toCSV(rows: AlumnoFull[]): string {
    const header = [
      "id","inscripcion_id","nombre","email","curp","boleta","is_ipn","telefono",
      "addr_calle","addr_numero","addr_colonia","addr_municipio","addr_estado","addr_cp",
      "fecha_inscripcion","estado","created_at",
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replaceAll('"', '""');
      if (/[",\n]/.test(s)) return `"${s}"`;
      return s;
    };
    const lines = [header.join(",")];
    for (const r of rows) lines.push(header.map((k) => escape((r as any)[k])).join(","));
    return lines.join("\n");
  }

  function downloadCSV() {
    const csv = toCSV(data.items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alumnos_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Formatos de fecha/hora:
  function fmtDate(d?: string | null) {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Mexico_City",
    });
  }

  // 13/09/25, 14:29
  function fmtDateTimeShort(d?: string | null) {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const date = dt.toLocaleDateString("es-MX", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Mexico_City",
    });
    const time = dt.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Mexico_City",
    });
    return `${date}, ${time}`;
  }

  // 13/Septiembre/2025 14:29 hrs
  function fmtDateTimeLong(d?: string | null) {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const day = dt.toLocaleDateString("es-MX", {
      day: "2-digit",
      timeZone: "America/Mexico_City",
    });
    const month = dt
      .toLocaleDateString("es-MX", { month: "long", timeZone: "America/Mexico_City" })
      .replace(/^./, (c) => c.toUpperCase()); // capitalizar
    const year = dt.toLocaleDateString("es-MX", {
      year: "numeric",
      timeZone: "America/Mexico_City",
    });
    const time = dt.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Mexico_City",
    });
    return `${day}/${month}/${year} ${time} hrs`;
  }

  // Números
  function fmtNum(n?: number | null, digits = 0) {
    if (n == null || Number.isNaN(n)) return "-";
    return n.toFixed(digits);
  }

  const idiomaOptions = [
    { value: ALL, label: "Todos" },
    { value: "ingles", label: "Inglés" },
    { value: "frances", label: "Francés" },
    { value: "aleman", label: "Alemán" },
    { value: "italiano", label: "Italiano" },
    { value: "chino", label: "Chino" },
    { value: "japones", label: "Japonés" },
  ];

  /* ========= TanStack: columnas, sorting y tabla (solo para ordenar/renderer) ========= */
  const [sorting, setSorting] = React.useState<SortingState>([]);

  function SortIcon({ column }: { column: any }) {
    const s = column.getIsSorted();
    if (s === "asc") return <ChevronUp className="w-3 h-3 ml-1" />;
    if (s === "desc") return <ChevronDown className="w-3 h-3 ml-1" />;
    return null;
  }

  const columns = React.useMemo<ColumnDef<AlumnoFull>[]>(() => [
    {
      id: "alumno",
      header: ({ column }) => (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="inline-flex items-center gap-1 cursor-pointer select-none"
        >
          Alumno <SortIcon column={column} />
        </button>
      ),
      accessorFn: (a) =>
        (a.nombre?.toLowerCase() ||
          `${a.last_name ?? ""} ${a.first_name ?? ""}`.trim().toLowerCase()),
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="font-medium">{fullName(a)}</div>
        );
      },
      sortingFn: "alphanumeric",
    },
    {
      id: "email",
      header: ({ column }) => (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="inline-flex items-center gap-1 cursor-pointer select-none"
        >
          Email <SortIcon column={column} />
        </button>
      ),
      accessorFn: (a) => (a.email ?? "").toLowerCase(),
      cell: ({ row }) => row.original.email || "-",
      sortingFn: "alphanumeric",
    },
    {
      id: "curp",
      header: ({ column }) => (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="inline-flex items-center gap-1 cursor-pointer select-none"
        >
          CURP <SortIcon column={column} />
        </button>
      ),
      accessorFn: (a) => (a.curp ?? "").toUpperCase(),
      cell: ({ row }) => row.original.curp || "-",
      sortingFn: "alphanumeric",
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data: data.items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const SCORE_THRESHOLD = 80;

  function getScoreState(score: number | null | undefined) {
    if (score == null || Number.isNaN(Number(score))) return "neutral" as const;
    return Number(score) >= SCORE_THRESHOLD ? ("pass" as const) : ("fail" as const);
  }

  function calificacionClasses(score: number | null | undefined) {
    const state = getScoreState(score);

    const base =
      "h-7 px-3.5 text-base inline-flex items-center rounded-lg border shadow-sm";

    const container =
      state === "pass"
        ? "text-emerald-800 border-emerald-300 bg-emerald-50"
        : state === "fail"
        ? "text-red-700 border-red-300 bg-red-50"
        : "text-primary border-primary/30 bg-primary/5";

    const number =
      state === "pass"
        ? "ml-1 font-mono tabular-nums font-semibold text-emerald-700"
        : state === "fail"
        ? "ml-1 font-mono tabular-nums font-semibold text-red-700"
        : "ml-1 font-mono tabular-nums font-semibold text-primary";

    return { container: `${base} ${container}`, number };
  }

  /* ============================
     Render
     ============================ */
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Alumnos</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl" onClick={downloadCSV} disabled={loading || data.total === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Listado detallado{fallbackMode ? " (modo agrupado)" : ""}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                className="pl-8"
                placeholder="Buscar por nombre, email, CURP…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
            </div>

            <Select value={anio} onValueChange={(v) => { setAnio(v); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {years.map((y) => (
                  <SelectItem key={`y-${y}`} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={idioma} onValueChange={(v) => { setIdioma(v); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: ALL, label: "Todos" },
                  { value: "ingles", label: "Inglés" },
                  { value: "frances", label: "Francés" },
                  { value: "aleman", label: "Alemán" },
                  { value: "italiano", label: "Italiano" },
                  { value: "chino", label: "Chino" },
                  { value: "japones", label: "Japonés" },
                ].map((opt) => (
                  <SelectItem key={`lang-${opt.value}`} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex sm:justify-end">
              <Button onClick={() => fetchStudents()} className="w-full sm:w-auto rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Actualizar
              </Button>
            </div>
          </div>

          {/* Tabla */}
          <div className="border rounded-xl">
            <ScrollArea className="w-full overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
                        <TableHead key={header.id} className={header.index === 0 ? "min-w-[220px]" : header.index === 1 ? "min-w-[260px]" : "min-w-[160px]"}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>

                <TableBody>
                  {loading && data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-neutral-500">
                        <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Cargando…
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!loading && data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-neutral-500">
                        {error || "Sin resultados"}
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-neutral-50"
                      onClick={() => { setSelected(row.original); setOpenExp(true); }}
                      title="Ver expediente"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cell.row.getVisibleCells().indexOf(cell) === 0 ? "align-top" : "align-top"}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="text-neutral-500">
              {data.total > 0 ? (
                (() => {
                  const start = (data.page - 1) * data.page_size + 1;
                  const end = Math.min(data.page * data.page_size, data.total);
                  return (
                    <span>
                      Mostrando <b>{start}</b>–<b>{end}</b> de <b>{data.total}</b> registro(s)
                      {fallbackMode ? " (modo agrupado)" : ""}
                    </span>
                  );
                })()
              ) : (
                <span>Sin datos</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
              >
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tamaño" /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={`ps-${n}`} value={String(n)}>{n} por página</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="rounded-xl"
                size="sm"
                disabled={loading || data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>

              <div className="px-2">{data.page} / {data.pages}</div>

              <Button
                variant="outline"
                className="rounded-xl"
                size="sm"
                disabled={loading || data.page >= data.pages}
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Modal Expediente */}
      <Dialog open={openExp} onOpenChange={setOpenExp}>
        <DialogContent
          className="
            w-[96vw] sm:w-[96vw]
            max-w-none sm:max-w-[96vw] lg:max-w-[1500px] xl:max-w-[1700px]
            h-[85vh] p-0 rounded-2xl overflow-hidden
          "
        >
          <DialogTitle className="sr-only">Expediente del alumno</DialogTitle>

          <div className="flex h-full flex-col min-h-0">
            {/* Sticky #1: Header */}
            <div className="px-5 py-3 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-40">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold">Expediente del alumno</h2>
                <div className="ml-auto">
                  <Button onClick={() => setOpenExp(false)} size="sm" className="rounded-xl">
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 min-h-0 overflow-hidden px-5 py-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full items-stretch">
                {/* Columna izquierda — 1/4 */}
                <div className="lg:col-span-3 lg:sticky lg:top=[56px] self-start">
                  <Card className="rounded-xl h-[calc(85vh-56px-2rem)] flex flex-col min-h-0">
                    <CardHeader className="pb-2 shrink-0">
                      <CardTitle className="text-sm">Datos personales</CardTitle>
                    </CardHeader>
                    <div className="flex-1 min-h-0 overflow-auto">
                      <CardContent className="space-y-3 text-sm">
                        {selected ? (
                          <>
                            <div className="space-y-1">
                              <Field label="Nombre" value={fullName(selected)} />
                              <Field label="Email" value={selected.email || "-"} />
                            </div>

                            <div className="space-y-1">
                              <Field label="CURP" value={selected.curp || "-"} />
                            </div>

                            {/* IPN y Boleta */}
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] uppercase tracking-wide text-neutral-500">IPN:</span>
                                {selected.is_ipn == null ? (
                                  <span className="text-sm text-neutral-500">-</span>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={`h-5 px-2 ${
                                      selected.is_ipn
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-neutral-100 text-neutral-700 border-neutral-200"
                                    }`}
                                  >
                                    {selected.is_ipn ? "Sí" : "No"}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] uppercase tracking-wide text-neutral-500">Boleta:</span>
                                <span className="text-sm">{selected.boleta || "-"}</span>
                              </div>
                            </div>

                            {/* (IPN extra) */}
                            {selected.is_ipn ? (
                              <div className="space-y-1">
                                <Field label="Nivel (IPN)" value={prettyEnum(selected.ipn_nivel) || "-"} />
                                <Field label="Unidad académica" value={selected.ipn_unidad_academica || "-"} />
                              </div>
                            ) : null}

                            <Field label="Teléfono" value={selected.telefono || "-"} />

                            {(selected.tutor_telefono || selected.tutor_nombre || selected.tutor_parentesco) ? (
                              <div className="space-y-1">
                                {selected.tutor_telefono ? (
                                  <Field label="Tel. tutor" value={selected.tutor_telefono} />
                                ) : null}
                                <Field label="Nombre del tutor" value={selected.tutor_nombre || "-"} />
                                <Field label="Parentesco" value={selected.tutor_parentesco || "-"} />
                              </div>
                            ) : null}

                            {/* Dirección */}
                            <div className="space-y-0.5">
                              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Dirección</div>
                              <div className="text-sm">
                                {[
                                  selected.addr_calle,
                                  selected.addr_numero,
                                  selected.addr_colonia,
                                ].filter(Boolean).join(" ") || "-"}
                              </div>
                              <div className="text-sm">
                                {[selected.addr_municipio, selected.addr_estado]
                                  .filter(Boolean)
                                  .join(", ")}
                                {selected.addr_cp ? `, CP ${selected.addr_cp}` : ""}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-neutral-500">Sin selección.</div>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                </div>

                {/* Columna derecha — 3/4 */}
                <div className="lg:col-span-9 min-h-0">
                  <Card className="rounded-xl h-[calc(85vh-56px-2rem)] flex flex-col min-h-0">
                    <CardHeader className="pb-2 shrink-0">
                      <CardTitle className="text-sm">Historial de cursos</CardTitle>
                    </CardHeader>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full pr-2">
                        <CardContent className="pt-0">
                          {histLoading ? (
                            <div className="text-xs text-neutral-500">
                              <Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> Cargando…
                            </div>
                          ) : histError ? (
                            <div className="text-xs text-red-600">{histError}</div>
                          ) : hist?.items?.length ? (
                            <div className="space-y-3">
                              {hist.items.map((it) => {
                                const ev = it.evaluacion;
                                const prom = ev?.promedio_final ?? null;
                                const calReg = it.calificacion ?? null;
                                const hayDiscrepancia =
                                  prom != null && calReg != null && Math.abs(prom - calReg) >= 0.5;

                                return (
                                  <div key={`h-${it.inscripcion_id}`} className="rounded-xl border p-3">
                                    {/* Encabezado de cada curso */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-medium">{it.ciclo_codigo || "(sin código)"}</div>

                                        {/* ======= PILLs con GUINDA y GRISES ======= */}
                                        <PillTag kind="idioma" value={it.idioma} className="text-base" />
                                        {it.nivel ? <PillTag kind="nivel" value={it.nivel} className="text-base" /> : null}
                                        {it.modalidad ? <PillTag kind="modalidad" value={it.modalidad} /> : null}
                                        {it.turno ? <PillTag kind="turno" value={it.turno} /> : null}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {calReg != null ? (
                                          <Badge
                                            variant="outline"
                                            className={calificacionClasses(calReg).container}
                                          >
                                            Calificación:
                                            <span className={calificacionClasses(calReg).number}>
                                              {fmtNum(calReg)}
                                            </span>
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>

                                    {/* Detalles */}
                                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
                                      <Field label="Horario" value={it.horario || "-"} />
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Fecha inicio" value={fmtDate(it.fecha_inicio)} />
                                        <Field label="Fecha fin" value={fmtDate(it.fecha_fin)} />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Tipo de trámite" value={prettyEnum(it.inscripcion_tipo)} />
                                        <Field label="Inscrito el" value={<span>{fmtDateTimeLong(it.fecha_inscripcion)}</span>} />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Docente" value={it.docente_nombre || "-"} />
                                        <Field label="Email docente" value={it.docente_email || "-"} />
                                      </div>
                                    </div>

                                    {/* Asistencia compacta */}
                                    <div className="mt-3">
                                      <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5">
                                        <span className="text-neutral-500">Presentes</span>
                                        <span className="font-medium">{String(it.asistencia?.presentes ?? 0)}</span>

                                        <span className="opacity-40">|</span>

                                        <span className="text-neutral-500">Ausentes</span>
                                        <span className="font-medium">{String(it.asistencia?.ausentes ?? 0)}</span>

                                        <span className="opacity-40">|</span>

                                        <span className="text-neutral-500">Retardos</span>
                                        <span className="font-medium">{String(it.asistencia?.retardos ?? 0)}</span>

                                        <span className="opacity-40">|</span>

                                        <span className="text-neutral-500">Justificados</span>
                                        <span className="font-medium">{String(it.asistencia?.justificados ?? 0)}</span>

                                        <span className="opacity-40">|</span>

                                        <span className="text-neutral-500">Sesiones</span>
                                        <span className="font-medium">{String(it.asistencia?.total_sesiones ?? 0)}</span>

                                        <span className="opacity-40">|</span>

                                        <span className="text-neutral-500">% Asistencia</span>
                                        <span className="font-medium">{`${it.asistencia?.porcentaje_asistencia ?? 0}%`}</span>
                                      </div>
                                    </div>

                                    {/* Evaluación */}
                                    {ev ? (
                                      <div className="mt-4 border rounded-lg overflow-hidden">
                                        <div className="px-3 py-2 bg-neutral-50 border-b text-[12px] font-medium flex items-center gap-2">
                                          Evaluación
                                          {hayDiscrepancia ? (
                                            <span className="inline-flex items-center gap-1 text-amber-700">
                                              <AlertTriangle className="h-3.5 w-3.5" />
                                              <span>
                                                Discrepancia: Promedio ({fmtNum(ev.promedio_final)})
                                                {" "}≠ Calificación ({fmtNum(calReg)})
                                              </span>
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="p-3 overflow-x-auto">
                                          <Table className="text-[12px]">
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="text-center">Medio · Examen<br /><span className="text-[10px] text-neutral-500">0–80</span></TableHead>
                                                <TableHead className="text-center">Medio · Cont.<br /><span className="text-[10px] text-neutral-500">0–20</span></TableHead>
                                                <TableHead className="text-center">Subtotal<br /><span className="text-[10px] text-neutral-500">Medio</span></TableHead>
                                                <TableHead className="text-center">Final · Examen<br /><span className="text-[10px] text-neutral-500">0–60</span></TableHead>
                                                <TableHead className="text-center">Final · Cont.<br /><span className="text-[10px] text-neutral-500">0–20</span></TableHead>
                                                <TableHead className="text-center">Final · Tarea<br /><span className="text-[10px] text-neutral-500">0–20</span></TableHead>
                                                <TableHead className="text-center">Subtotal<br /><span className="text-[10px] text-neutral-500">Final</span></TableHead>
                                                <TableHead className="text-center">Promedio</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              <TableRow>
                                                <TableCell className="text-center">{fmtNum(ev.medio_examen)}</TableCell>
                                                <TableCell className="text-center">{fmtNum(ev.medio_continua)}</TableCell>
                                                <TableCell className="text-center"><Badge variant="outline">{fmtNum(ev.subtotal_medio)}</Badge></TableCell>
                                                <TableCell className="text-center">{fmtNum(ev.final_examen)}</TableCell>
                                                <TableCell className="text-center">{fmtNum(ev.final_continua)}</TableCell>
                                                <TableCell className="text-center">{fmtNum(ev.final_tarea)}</TableCell>
                                                <TableCell className="text-center"><Badge variant="outline">{fmtNum(ev.subtotal_final)}</Badge></TableCell>
                                                <TableCell className="text-center">
                                                  <Badge variant={(ev.promedio_final ?? 0) >= 70 ? "default" : "secondary"}>
                                                    {fmtNum(ev.promedio_final)}
                                                  </Badge>
                                                </TableCell>
                                              </TableRow>
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-neutral-500">Sin cursos confirmados.</div>
                          )}
                        </CardContent>
                      </ScrollArea>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {fallbackMode ? (
        <p className="text-xs text-neutral-500">
          Modo agrupado: se construye el listado a partir de <code>/coordinacion/ciclos</code>,
          <code>/coordinacion/grupos</code> y <code>/coordinacion/reportes/inscritos</code>. Se recomienda exponer
          un endpoint <code>GET /coordinacion/alumnos</code> paginado para un rendimiento óptimo.
        </p>
      ) : null}
    </div>
  );
}

/** Campo compacto */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
