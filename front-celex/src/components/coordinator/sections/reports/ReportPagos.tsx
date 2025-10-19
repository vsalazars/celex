"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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

import { ReportFiltersState } from "./useReportFilters";
import { downloadCSV, exportNodeToPDF } from "./utils/export";
import { getReportePagos, type ReportReportePagos } from "@/lib/api";

// ---- Utils dinero ----
function formatMoney(mxn: number) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(mxn);
  } catch {
    return `$${mxn.toFixed(2)} MXN`;
  }
}

// ---- Orden/nombres ----
const collator = new Intl.Collator("es", { sensitivity: "base" });

function parseAlumno(full: string) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { apellidos: "", nombres: "" };
  const commaIdx = s.indexOf(",");
  if (commaIdx !== -1) {
    return { apellidos: s.slice(0, commaIdx).trim(), nombres: s.slice(commaIdx + 1).trim() };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { apellidos: "", nombres: parts[0] };
  const apellidos = parts.slice(-2).join(" ");
  const nombres = parts.slice(0, -2).join(" ");
  return { apellidos, nombres };
}

function apellidosEspacioNombres(full: string) {
  const { apellidos, nombres } = parseAlumno(full || "");
  if (!apellidos && !nombres) return (full || "").trim();
  if (!apellidos) return nombres;
  if (!nombres) return apellidos;
  return `${apellidos} ${nombres}`;
}

function compareByApellidoNombre(a: string, b: string) {
  const A = parseAlumno(a);
  const B = parseAlumno(b);
  const c1 = collator.compare(A.apellidos, B.apellidos);
  return c1 !== 0 ? c1 : collator.compare(A.nombres, B.nombres);
}

// ---- Normalizadores comunes ----
function readEstado(row: any): "pendiente" | "validado" | "rechazado" {
  const raw = (row.estado ?? row.status) as string | undefined;
  if (typeof raw === "string" && raw.trim()) return raw.trim().toLowerCase() as any;
  if (typeof row.validado === "boolean") return row.validado ? "validado" : "pendiente";
  return "pendiente";
}

function readImporteMXN(row: any) {
  if (typeof row.importe_centavos === "number") return row.importe_centavos / 100;
  if (typeof row.importe === "number") return row.importe;
  return 0;
}

// ---- Fechas: SIEMPRE dd/Mes/yyyy HH:mm (24h, con minutos) ----
const MONTH_ABBR = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function normalizeToLocalDate(value?: string | number | Date): Date | null {
  if (!value) return null;
  const s = String(value).trim();

  // Si viene sólo "YYYY-MM-DD", fijamos 00:00 locales para evitar horas fantasma.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Siempre devuelve "dd/Mes/yyyy HH:mm" en 24h (ej. 25/Sep/2025 07:05) */
function formatFechaHora24(value?: string | number | Date): string {
  const d = normalizeToLocalDate(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = MONTH_ABBR[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mon}/${yyyy} ${hh}:${mm}`;
}

function readFechaValidacion(row: any) {
  // Prioriza validated_at; si no, fecha_validacion; si no, cae a fecha_pago
  const v = row.validated_at || row.fecha_validacion || row.fecha_pago;
  return v ? formatFechaHora24(v) : "—";
}
function readFechaPago(row: any) {
  const v = row.fecha_pago;
  return v ? formatFechaHora24(v) : "—";
}

// ---- Badge por estado ----
function EstadoBadge({ estado }: { estado: "pendiente" | "validado" | "rechazado" }) {
  const base = "capitalize border";
  if (estado === "validado") return <Badge className={`${base} bg-green-100 text-green-800 border-green-200`}>validado</Badge>;
  if (estado === "rechazado") return <Badge className={`${base} bg-red-100 text-red-800 border-red-200`}>rechazado</Badge>;
  return <Badge className={`${base} bg-amber-100 text-amber-900 border-amber-200`}>pendiente</Badge>;
}

/** ---- Card de resumen compacta ---- */
type StatCardProps = { icon: React.ElementType; label: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "red" | "indigo"; };
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
 *  Tipos DataTable
 *  ======================= */
type RowUI = {
  id: string | number;
  alumno: string;
  correo: string;
  fechaPago: string | null;
  referencia: string;
  tipo: string;
  estado: "pendiente" | "validado" | "rechazado";
  fechaValidacion: string | null;
  importe: number;
  _fechaPagoTs?: number;
  _fechaValidacionTs?: number;
};

function buildRowUI(r: any): RowUI {
  // Normaliza timestamps para ordenar igual que lo mostrado (00:00 si no hay hora)
  const normPago = normalizeToLocalDate(r.fecha_pago);
  const normVal = normalizeToLocalDate(r.validated_at || r.fecha_validacion || r.fecha_pago);

  const tsPago = normPago ? normPago.getTime() : NaN;
  const tsVal = normVal ? normVal.getTime() : NaN;

  return {
    id: r.inscripcion_id ?? r.id ?? String(Math.random()),
    alumno: apellidosEspacioNombres(r.alumno || "") || "(Sin nombre)",
    correo: r.email || "—",
    fechaPago: readFechaPago(r) || null,
    referencia: r.referencia || "—",
    tipo: (r.tipo || "pago").toLowerCase(),
    estado: readEstado(r),
    fechaValidacion: readFechaValidacion(r) || null,
    importe: readImporteMXN(r),
    _fechaPagoTs: isNaN(tsPago) ? undefined : tsPago,
    _fechaValidacionTs: isNaN(tsVal) ? undefined : tsVal,
  };
}

function SortHeader({
  children, canSort, isSorted, onClick, className = "",
}: { children: React.ReactNode; canSort: boolean; isSorted: false | "asc" | "desc"; onClick?: () => void; className?: string; }) {
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

export default function ReportPagos({ filters }: { filters: ReportFiltersState }) {
  const { anio, idioma, cicloId } = filters;
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<ReportReportePagos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Cargar
  const consultar = async () => {
    if (!cicloId) {
      setError("Selecciona un ciclo");
      setReporte(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getReportePagos({ cicloId });
      setReporte(data);
    } catch (e: any) {
      setError(e?.message || "No se pudo obtener el reporte");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cicloId) consultar();
    else setReporte(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId, reloadTick]);

  // Filas ordenadas por apellidos, nombres
  const sortedRows = useMemo(() => {
    const rows = (reporte?.rows || []).slice();
    rows.sort((ra: any, rb: any) => compareByApellidoNombre(ra.alumno || "", rb.alumno || ""));
    return rows;
  }, [reporte?.rows]);

  // Resumen
  const resumen = useMemo(() => {
    const acc = (sortedRows || []).reduce(
      (acc: any, r: any) => {
        const st = readEstado(r);
        const mxn = readImporteMXN(r);
        acc.total += 1;
        acc.sumaMXN += mxn;
        if (st === "validado") {
          acc.validado += 1;
          acc.sumaValidadoMXN += mxn;
        } else if (st === "rechazado") {
          acc.rechazado += 1;
        } else {
          acc.pendiente += 1;
        }
        return acc;
      },
      { total: 0, validado: 0, pendiente: 0, rechazado: 0, sumaMXN: 0, sumaValidadoMXN: 0 }
    );
    return acc;
  }, [sortedRows]);

  // Exportaciones
  const csv = () => {
    if (!sortedRows.length || !reporte) return;
    const rows = sortedRows.map((r: any) => {
      const { apellidos, nombres } = parseAlumno(r.alumno || "");
      return {
        inscripcion_id: r.inscripcion_id,
        alumno: apellidosEspacioNombres(r.alumno || ""),
        alumno_apellidos: apellidos,
        alumno_nombres: nombres,
        email: r.email ?? "",
        tipo: (r as any).tipo ?? "",
        status: (r.status ?? r.estado ?? "").toString().toLowerCase(),
        fecha_pago: r.fecha_pago ?? "",
        referencia: r.referencia ?? "",
        importe_centavos: r.importe_centavos ?? Math.round((r.importe ?? 0) * 100),
        validated_at: r.validated_at ?? r.fecha_validacion ?? "",
        validated_by_id: r.validated_by_id ?? "",
        validated_by_name: r.validated_by_name ?? "",
      };
    });
    const filename = `pagos_${reporte?.ciclo?.codigo || cicloId}.csv`;
    downloadCSV(filename, rows);
  };

  const pdf = () => exportNodeToPDF(ref.current, "Pagos por ciclo");

  const header = useMemo(() => `Pagos — ${reporte?.ciclo?.codigo || "s/ciclo"}`, [reporte?.ciclo?.codigo]);

  /** ====== DataTable ====== */
  const data: RowUI[] = useMemo(() => (sortedRows || []).map(buildRowUI), [sortedRows]);

  // Búsqueda global
  const [globalFilter, setGlobalFilter] = useState("");
  const globalFilterFn = (row: any, _columnId: string, filterValue: string) => {
    const v = (filterValue || "").toLowerCase();
    if (!v) return true;
    const blob = `${row.original.alumno} ${row.original.correo} ${row.original.referencia}`.toLowerCase();
    return blob.includes(v);
  };

  // Default sort: Fecha pago desc
  const [sorting, setSorting] = useState<SortingState>([{ id: "fechaPago", desc: true }]);

  // >>> ORDEN EXACTO DE COLUMNAS <<<
  // Fecha pago · Referencia · Importe · Alumno · Correo · Fecha validación · Tipo · Estado
  const columns = useMemo<ColumnDef<RowUI>[]>(() => [
    {
      accessorKey: "fechaPago",
      header: ({ column }) => (
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3">
          Fecha pago
        </SortHeader>
      ),
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold whitespace-nowrap">
          {row.original.fechaPago ?? "—"}
        </span>
      ),
      sortingFn: (a, b) => {
        const A = a.original._fechaPagoTs ?? -Infinity;
        const B = b.original._fechaPagoTs ?? -Infinity;
        return A - B;
      },
    },
    {
      accessorKey: "referencia",
      header: ({ column }) => (
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3">
          Referencia
        </SortHeader>
      ),
      cell: ({ row }) => (
        <span className="inline-flex max-w-[28rem] items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold break-all" title={row.original.referencia}>
          {row.original.referencia}
        </span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "importe",
      header: ({ column }) => (
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3 text-left">
          Importe
        </SortHeader>
      ),
      cell: ({ row }) => (
        <div className="text-left">
          <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold tabular-nums">
            {formatMoney(row.original.importe)}
          </span>
        </div>
      ),
      sortingFn: "basic",
    },
    {
      accessorKey: "alumno",
      header: ({ column }) => (
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3 md:pl-6">
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
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3">
          Correo
        </SortHeader>
      ),
      cell: ({ row }) => <span className="break-all">{row.original.correo}</span>,
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "fechaValidacion",
      header: ({ column }) => (
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3">
          Fecha validación
        </SortHeader>
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{row.original.fechaValidacion ?? "—"}</span>
      ),
      sortingFn: (a, b) => {
        const A = a.original._fechaValidacionTs ?? -Infinity;
        const B = b.original._fechaValidacionTs ?? -Infinity;
        return A - B;
      },
    },
    {
      accessorKey: "tipo",
      header: ({ column }) => (
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3">
          Tipo
        </SortHeader>
      ),
      cell: ({ row }) => <span className="capitalize">{row.original.tipo}</span>,
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "estado",
      header: ({ column }) => (
        <SortHeader canSort={column.getCanSort()} isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="py-2 pr-3">
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
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Header + meta */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold">{header}</h3>
          <div className="text-sm text-muted-foreground flex gap-3 flex-wrap">
            {reporte?.ciclo && <span>Ciclo: <strong>{reporte.ciclo.codigo}</strong></span>}
            {anio && <span>Año: <strong>{anio}</strong></span>}
            {idioma && <span>Idioma: <strong>{idioma}</strong></span>}
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatCardCompact icon={Users} label="Total registros" value={resumen.total} tone="slate" />
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
            <Button size="sm" variant="outline" onClick={csv} disabled={!data.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportNodeToPDF(ref.current, header)} disabled={!data.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setReloadTick((t) => t + 1)} disabled={!cicloId}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Recargar
            </Button>
          </div>
        </div>

        {/* Tabla (md+) */}
        <div ref={ref} className="hidden md:block overflow-x-auto">
          <UiTable className="table-auto align-middle">
            <UiTableHeader className="bg-background sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <UiTableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <UiTableHead key={header.id} className="py-2 pr-3">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </UiTableHead>
                  ))}
                </UiTableRow>
              ))}
            </UiTableHeader>
            <UiTableBody>
              {loading ? (
                <UiTableRow>
                  <UiTableCell colSpan={table.getAllColumns().length} className="py-3 text-center">Cargando…</UiTableCell>
                </UiTableRow>
              ) : !cicloId ? (
                <UiTableRow>
                  <UiTableCell colSpan={table.getAllColumns().length} className="py-3 text-center text-muted-foreground">
                    Selecciona un curso en la barra superior.
                  </UiTableCell>
                </UiTableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <UiTableRow key={row.id} className="hover:bg-muted/40">
                    {row.getVisibleCells().map((cell) => {
                      const id = cell.column.id;
                      const common = "py-2 pr-3";
                      if (id === "fechaPago") {
                        return (
                          <UiTableCell key={cell.id} className={common}>
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs md:text-sm font-semibold whitespace-nowrap">
                              {row.original.fechaPago ?? "—"}
                            </span>
                          </UiTableCell>
                        );
                      }
                      if (id === "referencia") {
                        return (
                          <UiTableCell key={cell.id} className={common} title={row.original.referencia}>
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
                      if (id === "tipo" || id === "estado") {
                        return (
                          <UiTableCell key={cell.id} className={common}>
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
                  <UiTableCell colSpan={table.getAllColumns().length} className="py-3 text-center">Sin resultados.</UiTableCell>
                </UiTableRow>
              )}
            </UiTableBody>
          </UiTable>

          {/* Paginación */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Página <strong>{table.getState().pagination.pageIndex + 1}</strong> de <strong>{table.getPageCount()}</strong> · Filas: <strong>{table.getFilteredRowModel().rows.length}</strong>
            </div>

            <div className="flex items-center gap-2">
              {/* tamaño de página */}
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                aria-label="Registros por página"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / página
                  </option>
                ))}
              </select>

              <Button size="sm" variant="outline" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>«</Button>
              <Button size="sm" variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
              <Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Siguiente</Button>
              <Button size="sm" variant="outline" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>»</Button>
            </div>
          </div>

        </div>

        {/* Errores */}
        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
