"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Download,
  Printer,
  RefreshCcw,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table as UiTable,
  TableHeader as UiTableHeader,
  TableBody as UiTableBody,
  TableRow as UiTableRow,
  TableHead as UiTableHead,
  TableCell as UiTableCell,
} from "@/components/ui/table";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { Idioma } from "./useReportFilters";
import {
  listPlacementExamsLite,
  getPlacementRegistrosAdmin,
  type PlacementExamLite,
} from "@/lib/api";
import { downloadCSV, exportNodeToPDF } from "./utils/export";

/** ========================
 *  Types y utilidades
 *  ======================= */
type PagoPlacementRow = {
  id: string | number;
  alumno?: {
    nombres?: string;
    apellidos?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  alumno_nombre?: string;
  alumno_apellidos?: string;
  alumno_email?: string;
  referencia?: string;
  tipo?: string;
  estado?: string;
  status?: string;
  validado?: boolean;
  validated_at?: string | null;
  importe_centavos?: number | null;
  importe?: number | null;
  created_at?: string; // fecha de pago
};

type Props = { anio: string; idioma: Idioma | ""; examCode: string };

function formatMoney(mxn: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(mxn);
}

function readAlumno(r: PagoPlacementRow) {
  const a = r.alumno || {};
  const nombre = [a.nombres ?? a.first_name, a.apellidos ?? a.last_name]
    .filter(Boolean)
    .join(" ");
  return {
    nombre: (nombre || r.alumno_nombre || "(Sin nombre)").trim(),
    email: a.email || r.alumno_email || "",
  };
}

function readApellidosNombres(r: PagoPlacementRow) {
  const a = r.alumno || {};
  return {
    apellidos: a.apellidos ?? a.last_name ?? r.alumno_apellidos ?? "",
    nombres: a.nombres ?? a.first_name ?? r.alumno_nombre ?? "",
  };
}

function readImporteMXN(r: PagoPlacementRow) {
  return typeof r.importe_centavos === "number"
    ? r.importe_centavos / 100
    : r.importe ?? 0;
}

function readEstado(r: PagoPlacementRow) {
  const raw = (r.estado ?? r.status ?? "").toLowerCase();
  if (raw.startsWith("valid")) return "validado";
  if (raw.startsWith("rechaz")) return "rechazado";
  if (raw.startsWith("pend")) return "pendiente";
  return r.validado ? "validado" : "pendiente";
}

function formatFechaHora24(input?: string | null) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return input || null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function EstadoBadge({ estado }: { estado: string }) {
  const e = (estado || "").toLowerCase();
  let cls = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ";
  if (e === "validado") cls += "bg-emerald-100 text-emerald-700 border-emerald-200";
  else if (e === "rechazado") cls += "bg-red-100 text-red-700 border-red-200";
  else cls += "bg-amber-100 text-amber-700 border-amber-200";
  return <span className={cls}>{estado}</span>;
}

/** ---- Card compacta ---- */
type StatCardProps = {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "slate" | "emerald" | "amber" | "red" | "indigo";
};
function StatCardCompact({ icon: Icon, label, value, tone = "slate" }: StatCardProps) {
  const tones: Record<string, string> = {
    slate: "border-border bg-background/70",
    emerald: "border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20",
    amber: "border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20",
    red: "border-red-200/60 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20",
    indigo: "border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20",
  };
  const textTones: Record<string, string> = {
    slate: "text-slate-700 dark:text-slate-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    red: "text-red-700 dark:text-red-300",
    indigo: "text-indigo-700 dark:text-indigo-300",
  };

  return (
    <div className={`rounded-xl border ${tones[tone]} p-2 md:p-3`}>
      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 md:h-8 md:w-8 inline-flex items-center justify-center rounded-lg ${textTones[tone]} bg-white/70 dark:bg-black/20`}>
          <Icon className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] md:text-xs text-muted-foreground leading-none">{label}</div>
          <div className="text-lg md:text-xl font-semibold tracking-tight mt-0.5">{value}</div>
        </div>
      </div>
    </div>
  );
}

/** ========================
 *  DataTable (TanStack + shadcn)
 *  ======================= */
type RowUI = {
  id: string | number;
  fechaPago: string | null;
  referencia: string;
  importe: number;
  alumno: string;
  correo: string;
  fechaValidacion: string | null;
  tipo: string;
  estado: string;
};

function buildRowUI(r: PagoPlacementRow): RowUI {
  const { nombre, email } = readAlumno(r);
  return {
    id: r.id,
    fechaPago: formatFechaHora24(r.created_at) || null,
    referencia: r.referencia || "—",
    importe: readImporteMXN(r),
    alumno: nombre,
    correo: email || "—",
    fechaValidacion: formatFechaHora24(r.validated_at) || null,
    tipo: (r.tipo || "pago").toLowerCase(),
    estado: readEstado(r),
  };
}

function Money({ value }: { value: number }) {
  return <span className="tabular-nums">{formatMoney(value)}</span>;
}

function SortHeader({
  children,
  canSort,
  isSorted,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  canSort: boolean;
  isSorted: false | "asc" | "desc";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={!canSort}
      onClick={canSort ? onClick : undefined}
      className={`group inline-flex items-center gap-1 select-none ${canSort ? "cursor-pointer" : "cursor-default"} ${className}`}
      aria-label={typeof children === "string" ? (children as string) : "Ordenar columna"}
    >
      <span>{children}</span>
      {canSort ? (
        <span className="opacity-40 group-hover:opacity-100 transition-opacity">
          {isSorted === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : isSorted === "desc" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5 rotate-90" />}
        </span>
      ) : null}
    </button>
  );
}

/** ========================
 *  Componente principal
 *  ======================= */
export default function ReportPagosExamen({ anio, idioma, examCode }: Props) {
  const [selectedExam, setSelectedExam] = useState<PlacementExamLite | null>(null);
  const [rows, setRows] = useState<PagoPlacementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const [resumen, setResumen] = useState({
    total: 0,
    validado: 0,
    pendiente: 0,
    rechazado: 0,
    sumaMXN: 0,
    sumaValidadoMXN: 0,
  });

  // Resolver examen
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setSelectedExam(null);
      setRows([]);
      setResumen({ total: 0, validado: 0, pendiente: 0, rechazado: 0, sumaMXN: 0, sumaValidadoMXN: 0 });
      if (!examCode) return;
      try {
        const items = await listPlacementExamsLite({ idioma, anio, page_size: 200 } as any);
        if (!mounted) return;
        const norm = (s: string) => (s || "").trim().toLowerCase();
        const found = (items || []).find((e: any) => norm(e.codigo) === norm(examCode));
        setSelectedExam(found || null);
        if (!found) setError("No se encontró el examen con el código seleccionado.");
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "No se pudo resolver el examen seleccionado.");
      }
    })();
    return () => { mounted = false; };
  }, [anio, idioma, examCode]);

  // Cargar registros
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedExam?.id) return;
      setLoading(true);
      setError(null);
      try {
        const json = await getPlacementRegistrosAdmin(selectedExam.id, { page_size: 500 });
        const items: PagoPlacementRow[] = json?.items ?? [];
        if (!mounted) return;

        // Orden “apellido, nombre”
        const coll = new Intl.Collator("es", { sensitivity: "base" });
        const sorted = items.slice().sort((a, b) => {
          const A = readApellidosNombres(a), B = readApellidosNombres(b);
          const ap = coll.compare(A.apellidos, B.apellidos);
          return ap !== 0 ? ap : coll.compare(A.nombres, B.nombres);
        });

        setRows(sorted);

        // Resumen
        const acc = sorted.reduce(
          (acc, r) => {
            const st = readEstado(r);
            const mxn = readImporteMXN(r);
            acc.total++;
            acc.sumaMXN += mxn;
            if (st === "validado") {
              acc.validado++;
              acc.sumaValidadoMXN += mxn;
            } else if (st === "rechazado") {
              acc.rechazado++;
            } else {
              acc.pendiente++;
            }
            return acc;
          },
          { total: 0, validado: 0, pendiente: 0, rechazado: 0, sumaMXN: 0, sumaValidadoMXN: 0 }
        );

        setResumen(acc);
      } catch (e: any) {
        if (!mounted) return;
        setRows([]);
        setError(e?.message || "No se pudieron cargar los pagos del examen.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [selectedExam?.id, reload]);

  const header = useMemo(() => {
    if (!selectedExam) return "Pagos de examen de colocación";
    return `Pagos — ${selectedExam.codigo} (${selectedExam.idioma})`;
  }, [selectedExam]);

  // Export CSV
  const csv = () => {
    if (!rows.length) return;
    const filename = `pagos_examen_${selectedExam?.codigo || "sin_codigo"}.csv`;
    const out = rows.map((r) => {
      const { apellidos, nombres } = readApellidosNombres(r);
      return {
        id: r.id,
        alumno: `${apellidos} ${nombres}`.trim() || "(Sin nombre)",
        email: r.alumno_email || r.alumno?.email || "",
        referencia: r.referencia || "",
        fecha_pago: r.created_at || "",
        tipo: (r.tipo || "pago").toLowerCase(),
        estado: readEstado(r),
        validated_at: r.validated_at || "",
        importe_centavos: r.importe_centavos ?? Math.round(readImporteMXN(r) * 100),
      };
    });
    downloadCSV(filename, out);
  };

  const pdf = () => exportNodeToPDF(ref.current, header);

  /** ====== DataTable config (TanStack) ====== */
  const data: RowUI[] = useMemo(() => rows.map(buildRowUI), [rows]);

  // global filter (busca en alumno, correo, referencia)
  const [globalFilter, setGlobalFilter] = useState("");
  const globalFilterFn = (row: any, _columnId: string, filterValue: string) => {
    const v = (filterValue || "").toLowerCase();
    if (!v) return true;
    const blob = `${row.original.alumno} ${row.original.correo} ${row.original.referencia}`.toLowerCase();
    return blob.includes(v);
  };

  const [sorting, setSorting] = useState<SortingState>([
    { id: "fechaPago", desc: true }, // default por fecha desc
  ]);

  const columns = useMemo<ColumnDef<RowUI>[]>(() => [
    {
      accessorKey: "fechaPago",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2 pr-3"
        >
          Fecha pago
        </SortHeader>
      ),
      // 🔹 Destacado discreto (chip)
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold whitespace-nowrap">
          {row.original.fechaPago ?? "—"}
        </span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "referencia",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2 pr-3"
        >
          Referencia
        </SortHeader>
      ),
      // 🔹 Destacado discreto (chip), mismo tamaño que demás
      cell: ({ row }) => (
        <span
          className="inline-flex max-w-[28rem] items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold break-all"
          title={row.original.referencia}
        >
          {row.original.referencia}
        </span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "importe",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2 pr-3 text-left"
        >
          Importe
        </SortHeader>
      ),
      // 🔹 Alineado a la IZQUIERDA + chip + tabular-nums
      cell: ({ row }) => (
        <div className="text-left">
          <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold tabular-nums">
            <Money value={row.original.importe} />
          </span>
        </div>
      ),
      sortingFn: "basic",
    },
    {
      accessorKey: "alumno",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2 pr-3 md:pl-6"
        >
          Alumno
        </SortHeader>
      ),
      cell: ({ row }) => (
        <span className="truncate md:pl-6" title={row.original.alumno}>{row.original.alumno}</span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "correo",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2 pr-3"
        >
          Correo
        </SortHeader>
      ),
      cell: ({ row }) => (
        <span className="break-all">{row.original.correo}</span>
      ),
      sortingFn: "alphanumeric",
      enableHiding: true,
    },
    {
      accessorKey: "fechaValidacion",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2 pr-3"
        >
          Fecha validación
        </SortHeader>
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{row.original.fechaValidacion ?? "—"}</span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "tipo",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2 pr-3"
        >
          Tipo
        </SortHeader>
      ),
      cell: ({ row }) => <span className="capitalize">{row.original.tipo}</span>,
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "estado",
      header: ({ column }) => (
        <SortHeader
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="py-2"
        >
          Estado
        </SortHeader>
      ),
      cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
      sortingFn: "alphanumeric",
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{header}</h3>
          <div className="text-sm text-muted-foreground">
            {anio && <span className="mr-2">Año: <strong>{anio}</strong></span>}
            {idioma && <span>Idioma: <strong>{idioma}</strong></span>}
          </div>
        </div>

        {/* Resumen compacto */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatCardCompact icon={Users} label="Total" value={resumen.total} tone="slate" />
          <StatCardCompact icon={CheckCircle2} label="Validados" value={resumen.validado} tone="emerald" />
          <StatCardCompact icon={Clock} label="Pendientes" value={resumen.pendiente} tone="amber" />
          <StatCardCompact icon={XCircle} label="Rechazados" value={resumen.rechazado} tone="red" />
          <StatCardCompact icon={DollarSign} label="Suma validado" value={formatMoney(resumen.sumaValidadoMXN)} tone="indigo" />
        </div>

        <Separator />

        {/* Acciones + Búsqueda */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-[12rem]">
            <Input
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar: alumno, correo, referencia…"
              className="h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={csv} disabled={!rows.length || loading}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportNodeToPDF(ref.current, header)} disabled={!rows.length || loading}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setReload((t) => t + 1)} disabled={!selectedExam?.id}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Recargar
            </Button>
          </div>
        </div>

        {/* Tarjetas (móvil) */}
        <div className="space-y-2 md:hidden">
          {loading ? (
            <div className="text-sm text-center text-muted-foreground">Cargando…</div>
          ) : !rows.length ? (
            <div className="text-sm text-center text-muted-foreground">Sin resultados.</div>
          ) : (
            data.map((r) => (
              <div key={String(r.id)} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold">
                    {r.fechaPago ?? "—"}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold tabular-nums">
                    {formatMoney(r.importe)}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold break-all">
                    {r.referencia}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate" title={r.alumno}>
                    {r.alumno}
                  </div>
                  <EstadoBadge estado={r.estado} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground break-all">{r.correo}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Validación</div>
                    <div className="whitespace-nowrap">{r.fechaValidacion ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Tipo</div>
                    <div className="capitalize">{r.tipo}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tabla (md+) */}
        <div ref={ref} className="hidden md:block overflow-x-auto">
          <UiTable className="table-auto align-middle">
            <UiTableHeader className="bg-background sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <UiTableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <UiTableHead key={header.id} className="py-2 pr-3">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </UiTableHead>
                  ))}
                </UiTableRow>
              ))}
            </UiTableHeader>
            <UiTableBody>
              {loading ? (
                <UiTableRow>
                  <UiTableCell colSpan={table.getAllColumns().length} className="py-3 text-center">
                    Cargando…
                  </UiTableCell>
                </UiTableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <UiTableRow key={row.id} className="hover:bg-muted/40">
                    {row.getVisibleCells().map((cell) => {
                      const id = cell.column.id;
                      const common = "py-2 pr-3";
                      // Fecha pago, Referencia, Importe -> “chip” y (Importe) alineado a la izquierda
                      if (id === "fechaPago") {
                        return (
                          <UiTableCell key={cell.id} className={`${common}`}>
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold whitespace-nowrap">
                              {row.original.fechaPago ?? "—"}
                            </span>
                          </UiTableCell>
                        );
                      }
                      if (id === "referencia") {
                        return (
                          <UiTableCell key={cell.id} className={`${common}`} title={row.original.referencia}>
                            <span className="inline-flex max-w-[28rem] items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold break-all">
                              {row.original.referencia}
                            </span>
                          </UiTableCell>
                        );
                      }
                      if (id === "importe") {
                        return (
                          <UiTableCell key={cell.id} className={`${common} text-left`}>
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold tabular-nums">
                              {formatMoney(row.original.importe)}
                            </span>
                          </UiTableCell>
                        );
                      }
                      if (id === "alumno") {
                        return (
                          <UiTableCell key={cell.id} className={`${common} md:pl-6 truncate`} title={row.original.alumno}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </UiTableCell>
                        );
                      }
                      if (id === "correo") {
                        return (
                          <UiTableCell key={cell.id} className={`${common} break-all`} title={row.original.correo}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </UiTableCell>
                        );
                      }
                      if (id === "fechaValidacion") {
                        return (
                          <UiTableCell key={cell.id} className={`${common} whitespace-nowrap`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </UiTableCell>
                        );
                      }
                      return (
                        <UiTableCell key={cell.id} className={common}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </UiTableCell>
                      );
                    })}
                  </UiTableRow>
                ))
              ) : (
                <UiTableRow>
                  <UiTableCell colSpan={table.getAllColumns().length} className="py-3 text-center">
                    Sin resultados.
                  </UiTableCell>
                </UiTableRow>
              )}
            </UiTableBody>
          </UiTable>

          {/* Paginación */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Página <strong>{table.getState().pagination.pageIndex + 1}</strong> de{" "}
              <strong>{table.getPageCount()}</strong> · Filas:{" "}
              <strong>{table.getFilteredRowModel().rows.length}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                «
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Siguiente
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                »
              </Button>
            </div>
          </div>
        </div>

        {/* Errores */}
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
