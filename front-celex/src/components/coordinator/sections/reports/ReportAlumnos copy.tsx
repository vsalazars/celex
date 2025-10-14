"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { ReportFiltersState } from "./useReportFilters";
import { downloadCSV, exportNodeToPDF } from "./utils/export";
import { getReporteInscritos, type ReportReporteInscritos } from "@/lib/api";

import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  flexRender,
  useReactTable,
} from "@tanstack/react-table";

// ---------- Helpers ----------
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
  return { apellidos: parts.slice(-2).join(" "), nombres: parts.slice(0, -2).join(" ") };
}

function apellidosEspacioNombres(full: string) {
  const { apellidos, nombres } = parseAlumno(full || "");
  if (!apellidos && !nombres) return (full || "").trim();
  if (!apellidos) return nombres;
  if (!nombres) return apellidos;
  return `${apellidos} ${nombres}`;
}

function compareByApellidoNombre(a: string, b: string) {
  const A = parseAlumno(a || "");
  const B = parseAlumno(b || "");
  const c1 = collator.compare(A.apellidos, B.apellidos);
  return c1 !== 0 ? c1 : collator.compare(A.nombres, B.nombres);
}

function isIPNBoleta(boleta?: string | null) {
  const s = String(boleta ?? "").trim();
  return /^\d{8,10}$/.test(s);
}

/** Formato dd/Mes/yyyy HH:mm (24h) */
function formatFechaHora24(fecha?: string | null) {
  if (!fecha) return "—";
  try {
    const d = new Date(fecha);
    const dia = String(d.getDate()).padStart(2, "0");
    const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const mes = meses[d.getMonth()];
    const anio = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${anio} ${hh}:${mm}`;
  } catch {
    return fecha;
  }
}

/** Badge de estado */
function EstadoBadge({ estado }: { estado: string | null | undefined }) {
  const e = String(estado ?? "").trim().toLowerCase();
  let cls =
    "px-2 py-0.5 text-xs rounded-full border inline-flex items-center justify-center";
  let label = estado || "—";

  if (["confirmada", "confirmado", "activo", "validado", "inscrito"].includes(e)) {
    cls += " bg-green-100 text-green-800 border-green-200";
  } else if (
    ["pendiente", "pendiente_pago", "en proceso", "registrada"].includes(e)
  ) {
    cls += " bg-amber-100 text-amber-800 border-amber-200";
  } else if (["rechazada", "rechazado", "cancelado", "baja"].includes(e)) {
    cls += " bg-red-100 text-red-800 border-red-200";
  } else {
    cls += " bg-gray-100 text-gray-800 border-gray-200";
  }

  return <span className={cls}>{label}</span>;
}

// ---------- Tipos ----------
type AlumnoRow = {
  inscripcion_id: string | number;
  boleta?: string | null;
  nombre?: string | null;
  email?: string | null;
  fecha_inscripcion?: string | null;
  estado?: string | null;
  ipn: boolean;
};

export default function ReportAlumnos({ filters }: { filters: ReportFiltersState }) {
  const { anio, idioma, cicloId } = filters;
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<ReportReporteInscritos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  async function consultar() {
    if (!cicloId) {
      setError("Selecciona un ciclo");
      setReporte(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getReporteInscritos({ cicloId });
      setReporte(data);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    } catch (e: any) {
      setError(e?.message || "No se pudo obtener el reporte");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cicloId) consultar();
    else setReporte(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  const rows: AlumnoRow[] = useMemo(() => {
    return (reporte?.alumnos || [])
      .map((a) => ({
        inscripcion_id: a.inscripcion_id,
        boleta: a.boleta ?? "",
        nombre: a.nombre ?? "",
        email: a.email ?? "",
        fecha_inscripcion: a.fecha_inscripcion ?? "",
        estado: a.estado ?? "",
        ipn: isIPNBoleta(a.boleta),
      }))
      .sort((x, y) => compareByApellidoNombre(x.nombre || "", y.nombre || ""));
  }, [reporte]);

  const csv = () => {
    if (!rows.length || !reporte) return;
    const data = rows.map((r) => {
      const { apellidos, nombres } = parseAlumno(r.nombre || "");
      return {
        nombre: apellidosEspacioNombres(r.nombre || ""),
        alumno_apellidos: apellidos,
        alumno_nombres: nombres,
        email: r.email ?? "",
        fecha_inscripcion: formatFechaHora24(r.fecha_inscripcion),
        origen: r.ipn ? `IPN — ${r.boleta ?? ""}` : "Externo",
        estado: r.estado ?? "",
      };
    });
    downloadCSV(`alumnos_inscritos_${reporte.ciclo.codigo}.csv`, data);
  };

  const pdf = () => exportNodeToPDF(ref.current, "Alumnos inscritos");

  const columns = useMemo<ColumnDef<AlumnoRow>[]>(
    () => [
      {
        id: "nombre",
        accessorKey: "nombre",
        header: () => <span>Nombre (Apellidos Nombres)</span>,
        cell: ({ row }) => <span>{apellidosEspacioNombres(row.original.nombre || "")}</span>,
        enableSorting: true,
        sortingFn: (a, b) =>
          compareByApellidoNombre(a.original.nombre || "", b.original.nombre || ""),
      },
      {
        id: "email",
        accessorKey: "email",
        header: () => <span>Email</span>,
        cell: ({ row }) => <span>{row.original.email || "—"}</span>,
        enableSorting: true,
      },
      {
        id: "fecha_inscripcion",
        accessorKey: "fecha_inscripcion",
        header: () => <span>Fecha inscripción</span>,
        cell: ({ row }) => <span>{formatFechaHora24(row.original.fecha_inscripcion)}</span>,
        enableSorting: true,
      },
      {
        id: "origen",
        header: () => <span>Origen</span>,
        cell: ({ row }) =>
          row.original.ipn ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              IPN — {row.original.boleta || "—"}
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 border border-gray-200">
              Externo
            </span>
          ),
        enableSorting: true,
        sortingFn: (a, b) => Number(a.original.ipn) - Number(b.original.ipn),
      },
      {
        id: "estado",
        accessorKey: "estado",
        header: () => <span>Estado</span>,
        cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
        enableSorting: true,
      },
    ],
    []
  );

  const [sorting, setSorting] = useState<SortingState>([{ id: "nombre", desc: false }]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const SortableHeader = ({ column, title }: { column: any; title: string }) => {
    const isSorted = column.getIsSorted();
    return (
      <button
        className="flex items-center gap-1 select-none"
        onClick={column.getToggleSortingHandler()}
        title="Ordenar"
      >
        <span>{title}</span>
        <span className="text-xs opacity-60">
          {isSorted === "asc" ? "▲" : isSorted === "desc" ? "▼" : "⬍"}
        </span>
      </button>
    );
  };

  const total = reporte?.total ?? rows.length;
  const first = rows.length ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const last = Math.min((pagination.pageIndex + 1) * pagination.pageSize, rows.length);

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Alumnos inscritos</h3>
            {reporte?.ciclo && <Badge variant="secondary">Ciclo: {reporte.ciclo.codigo}</Badge>}
            {anio && <Badge variant="secondary">Año: {anio}</Badge>}
            {idioma && <Badge variant="secondary">Idioma: {idioma}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span>Mostrar:</span>
              <select
                className="border rounded-md px-2 py-1 bg-background"
                value={pagination.pageSize}
                onChange={(e) => table.setPageSize(Number((e.target as HTMLSelectElement).value))}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>por página</span>
            </div>

            <Button size="sm" variant="outline" onClick={csv} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" onClick={pdf} disabled={!rows.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        <div ref={ref}>
          <div className="overflow-x-auto rounded-md border mt-2">
            <table className="min-w-full">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th key={header.id} className="text-left text-sm font-semibold p-2">
                        {header.isPlaceholder ? null : (
                          <>
                            {header.column.getCanSort() ? (
                              <SortableHeader
                                column={header.column}
                                title={flexRender(header.column.columnDef.header, header.getContext()) as any}
                              />
                            ) : (
                              flexRender(header.column.columnDef.header, header.getContext())
                            )}
                          </>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={table.getAllLeafColumns().length} className="p-3 text-center text-gray-600">
                      Cargando…
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((r) => (
                    <tr key={String(r.original.inscripcion_id)} className="hover:bg-muted/40">
                      {r.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-2 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={table.getAllLeafColumns().length} className="p-3 text-center text-gray-600">
                      {cicloId ? "Sin resultados." : "Selecciona un curso en la barra superior."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer de paginación */}
          <div className="flex items-center justify-between gap-2 mt-3 text-sm">
            <div className="text-muted-foreground">
              Mostrando {rows.length ? `${first}–${last}` : 0} de {rows.length} registros
              {typeof total === "number" && total !== rows.length ? ` (total: ${total})` : ""}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
                « Primero
              </Button>
              <Button size="sm" variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                ‹ Anterior
              </Button>
              <span>
                Página{" "}
                <strong>
                  {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
                </strong>
              </span>
              <Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Siguiente ›
              </Button>
              <Button size="sm" variant="outline" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
                Último »
              </Button>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
