"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";

import { toast } from "sonner";
import {
  RefreshCw,
  UserPlus,
  Search,
  Clock3,
  CalendarDays,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

import { EMAIL_REGEX, CURP_REGEX } from "@/lib/constants";
import { listTeachers, inviteTeacher, suspendTeacher, listCiclos } from "@/lib/api";
import type {
  Teacher,
  CreateTeacherInput,
  CicloDTO,
  CicloListResponse,
  ListCiclosParams,
} from "@/lib/types";
import { Languages, Layers, Clock, GraduationCap } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


/* ===================== Helpers ===================== */
const dmx = (s?: string) => {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  const day = dt.toLocaleString("es-MX", { day: "2-digit" });
  const month = dt.toLocaleString("es-MX", { month: "short" });
  const year = dt.toLocaleString("es-MX", { year: "2-digit" });
  return `${day}/${month}/${year}`;
};
const hhmm = (h?: string) => (h?.match(/^(\d{2}):(\d{2})/) ? RegExp.$1 + ":" + RegExp.$2 : (h ?? ""));
const nombreCompleto = (t: Teacher) =>
  `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim();

/* ============================================================
 *  TeachersSection (MAIN)
 * ============================================================ */
export default function TeachersSection() {
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);

  // sheet historial
  const [openHist, setOpenHist] = useState(false);
  const [teacherSel, setTeacherSel] = useState<Teacher | null>(null);

  // dialog alta
  const [openInvite, setOpenInvite] = useState(false);

  // tabla: estados de búsqueda, filtros, sort, etc.
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(""); // "", "activo", "invitado", "suspendido"

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listTeachers();
      setItems(data);
    } catch (e: any) {
      toast.error(e?.message || "No fue posible actualizar la lista");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleInvite = async (input: CreateTeacherInput) => {
    await inviteTeacher(input);
    toast.success("Docente invitado. La contraseña se envió por correo.");
    setOpenInvite(false);
    await refresh();
  };

  const handleSuspend = async (id: string | number) => {
    try {
      await suspendTeacher(id);
      toast.success("Docente deshabilitado");
      await refresh();
    } catch (e:any) {
      toast.error(e?.message || "No fue posible deshabilitar");
    }
  };

  const openHistorial = (t: Teacher) => {
    setTeacherSel(t);
    setOpenHist(true);
  };

  // datos filtrados por status antes de mandar a la tabla (para no complicar con filterFns)
  const data = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((t) => ((t as any).status ?? "") === statusFilter);
  }, [items, statusFilter]);

  // columnas de la tabla
  const columns = React.useMemo<ColumnDef<Teacher>[]>(() => [
    {
      id: "name",
      header: () => "Nombre",
      accessorFn: (row) => nombreCompleto(row),
      cell: ({ row }) => (
        <div className="font-medium">{nombreCompleto(row.original)}</div>
      ),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "email",
      header: () => "Correo",
      cell: ({ row }) => <span className="lowercase">{row.original.email}</span>,
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "curp",
      header: () => "CURP",
      cell: ({ row }) => row.original.curp,
      sortingFn: "alphanumeric",
    },
    {
      id: "status",
      header: () => "Estado",
      accessorFn: (row) => (row as any).status ?? "",
      cell: ({ getValue }) => {
        const v = (getValue() as string) || "";
        if (v === "activo") return <Badge>Activo</Badge>;
        if (v === "invitado") return <Badge variant="secondary">Invitado</Badge>;
        if (v === "suspendido") return <Badge variant="destructive">Suspendido</Badge>;
        return <span className="text-neutral-500">—</span>;
      },
      enableSorting: true,
      sortingFn: "alphanumeric",
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openHistorial(t)}>
              Ver ciclos
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-red-600">
                  Deshabilitar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deshabilitar docente</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Seguro que deseas deshabilitar a <strong>{nombreCompleto(t)}</strong>?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <Button variant="destructive" onClick={() => handleSuspend(t.id)}>
                    Deshabilitar
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
      enableSorting: false,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [items]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Docentes</h1>
          <p className="text-sm text-neutral-600">Alta/baja de docentes y asignación.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button className="gap-2" onClick={() => setOpenInvite(true)}>
            <UserPlus className="h-4 w-4" /> Alta de docente
          </Button>
        </div>
      </header>

      {/* Card listado con DataTable */}
      <div className="rounded-2xl border bg-white p-4">
        <DataTableToolbar
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
        <Separator className="my-3" />
        <DataTable
          data={data}
          columns={columns}
          globalFilter={globalFilter}
          emptyText={loading ? "Cargando docentes…" : "No hay docentes registrados."}
        />
      </div>

      {/* Sheet historial (slide-over) */}
      <TeacherCyclesSheetInline
        open={openHist}
        onOpenChange={setOpenHist}
        teacher={teacherSel}
      />

      {/* Dialog: Alta docente */}
      <AddTeacherDialogInline
        open={openInvite}
        onOpenChange={setOpenInvite}
        invite={handleInvite}
      />
    </div>
  );
}

/* ============================================================
 * DataTable (shadcn + @tanstack/react-table)
 * ============================================================ */
function DataTable<TData, TValue>({
  columns,
  data,
  globalFilter,
  emptyText = "Sin datos",
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  globalFilter?: string;
  emptyText?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pageSize, setPageSize] = useState(10);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      pagination: { pageIndex: 0, pageSize },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
  });

  useEffect(() => {
    table.setGlobalFilter(globalFilter ?? "");
  }, [globalFilter, table]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="text-left text-neutral-500">
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-3 py-2 select-none">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 ${header.column.getCanSort() ? "hover:underline" : ""}`}
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          <span className="text-[11px] text-neutral-400">
                            {{ asc: "↑", desc: "↓" }[header.column.getIsSorted() as string] ?? "↕"}
                          </span>
                        ) : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-t">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-neutral-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: paginación & densidad */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-neutral-500">
          Mostrando {table.getRowModel().rows.length ? (table.getState().pagination.pageIndex * pageSize) + 1 : 0}
          {"–"}
          {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, data.length)} de {data.length}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => { const ps = Number(v); setPageSize(ps); table.setPageIndex(0); }}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="Tamaño" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 / página</SelectItem>
              <SelectItem value="10">10 / página</SelectItem>
              <SelectItem value="20">20 / página</SelectItem>
              <SelectItem value="50">50 / página</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Toolbar (search + filter status)
 * ============================================================ */
function DataTableToolbar({
  globalFilter, setGlobalFilter,
  statusFilter, setStatusFilter,
}: {
  globalFilter: string;
  setGlobalFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}) {
  const internalValue = statusFilter || "all"; // mapea "" -> "all"

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          placeholder="Buscar por nombre, correo o CURP…"
          className="pl-9"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={internalValue}
          onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="invitado">Invitado</SelectItem>
            <SelectItem value="suspendido">Suspendido</SelectItem>
          </SelectContent>
        </Select>

        {statusFilter || globalFilter ? (
          <Button
            variant="outline"
            className="h-9"
            onClick={() => { setGlobalFilter(""); setStatusFilter(""); }}
          >
            Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}


/* ============================================================
 * Sheet: historial de ciclos del docente
 * ============================================================ */
function TeacherCyclesSheetInline({
  open,
  onOpenChange,
  teacher,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teacher: Teacher | null;
}) {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<CicloListResponse | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // 🔎 Filtros locales (con sentinel "all" para Radix)
  const [qSheet, setQSheet] = useState("");
  const [fIdioma, setFIdioma] = useState<string>("all");
  const [fModalidad, setFModalidad] = useState<string>("all");
  const [fTurno, setFTurno] = useState<string>("all");
  const [fNivel, setFNivel] = useState<string>("all");

  const canPrev = (resp?.page ?? 1) > 1;
  const canNext = !!resp && resp.page < resp.pages;

  const mapAll = (v: string) => (v && v !== "all" ? v : undefined);

  const fetchData = async (pageNum = 1) => {
    if (!teacher?.id) return;
    setLoading(true);
    try {
      const params: ListCiclosParams = {
        page: pageNum,
        page_size: PAGE_SIZE,
        docente_id: Number(teacher.id) as any, // filtro por docente
        q: qSheet || undefined,
        idioma: mapAll(fIdioma) as any,
        modalidad: mapAll(fModalidad) as any,
        turno: mapAll(fTurno) as any,
        nivel: mapAll(fNivel) as any,
      } as any;
      const data = await listCiclos(params);
      setResp(data);
    } catch (e: any) {
      toast.error(e?.message || "No fue posible cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  // Cargar cuando se abre o cambia el docente
  useEffect(() => {
    if (open) {
      setPage(1);
      fetchData(1);
    } else {
      setResp(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teacher?.id]);

  // Reaplicar filtros al cambiar cualquiera
  useEffect(() => {
    if (!open) return;
    const p = 1;
    setPage(p);
    fetchData(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSheet, fIdioma, fModalidad, fTurno, fNivel]);

  const items = resp?.items ?? [];


// Combobox reutilizable con Tooltip + Popover + Command
function FilterCombobox({
  icon,
  value,
  onChange,
  options,
  tooltip, // 👈 NUEVO
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  tooltip: string; // 👈 NUEVO
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button variant="outline" className="h-9 min-w-[120px] justify-between">
                <div className="flex items-center gap-2">
                  {icon}
                  <span className="truncate text-sm">
                    {current ? current.label : "—"}
                  </span>
                </div>
                <SlidersHorizontal className="ml-1 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>

          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar opción…" />
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
              <div className="max-h-56 overflow-auto">
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            </Command>

            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  onChange(options[0]?.value ?? "all");
                  setOpen(false);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <TooltipContent side="top">
          {tooltip}
          {current && current.value !== "all" ? `: ${current.label}` : ""}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}




  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-6xl p-0 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-white/70 backdrop-blur">
          <SheetHeader>
            <SheetTitle>
              Historial de ciclos — {teacher ? `${teacher.first_name} ${teacher.last_name}` : ""}
            </SheetTitle>
            <SheetDescription>Grupos asignados al docente (pasados y actuales).</SheetDescription>
          </SheetHeader>
        </div>

        {/* Toolbar de filtros — versión moderna */}
<div className="px-6 py-3 border-b bg-white">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    {/* Buscador */}
    <div className="relative w-full md:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <Input
        placeholder="Buscar por código…"
        className="pl-9 h-9"
        value={qSheet}
        onChange={(e) => setQSheet(e.target.value)}
      />
    </div>

   {/* Comboboxes por filtro (buscables) */}
      <div className="flex flex-wrap items-center gap-2">
      <FilterCombobox
        icon={<Languages className="h-4 w-4" />}
        value={fIdioma}
        onChange={setFIdioma}
        tooltip="Idioma" // 👈 NUEVO
        options={[
          { label: "Todos", value: "all" },
          { label: "Inglés", value: "ingles" },
          { label: "Francés", value: "frances" },
          { label: "Alemán", value: "aleman" },
          { label: "Italiano", value: "italiano" },
          { label: "Portugués", value: "portugues" },
        ]}
      />

      <FilterCombobox
        icon={<Layers className="h-4 w-4" />}
        value={fModalidad}
        onChange={setFModalidad}
        tooltip="Modalidad" // 👈 NUEVO
        options={[
          { label: "Todas", value: "all" },
          { label: "Intensivo", value: "intensivo" },
          { label: "Sabatino", value: "sabatino" },
          { label: "Semestral", value: "semestral" },
        ]}
      />

      <FilterCombobox
        icon={<Clock className="h-4 w-4" />}
        value={fTurno}
        onChange={setFTurno}
        tooltip="Turno" // 👈 NUEVO
        options={[
          { label: "Todos", value: "all" },
          { label: "Matutino", value: "matutino" },
          { label: "Vespertino", value: "vespertino" },
          { label: "Mixto", value: "mixto" },
        ]}
      />

      <FilterCombobox
        icon={<GraduationCap className="h-4 w-4" />}
        value={fNivel}
        onChange={setFNivel}
        tooltip="Nivel" // 👈 NUEVO
        options={[
          { label: "Todos", value: "all" },
          { label: "A1", value: "A1" },
          { label: "A2", value: "A2" },
          { label: "B1", value: "B1" },
          { label: "B2", value: "B2" },
          { label: "C1", value: "C1" },
          { label: "C2", value: "C2" },
        ]}
      />



        {(qSheet || fIdioma !== "all" || fModalidad !== "all" || fTurno !== "all" || fNivel !== "all") ? (
          <Button
            variant="outline"
            className="h-9"
            onClick={() => {
              setQSheet("");
              setFIdioma("all");
              setFModalidad("all");
              setFTurno("all");
              setFNivel("all");
            }}
          >
            Limpiar
          </Button>
        ) : null}
      </div>

  </div>

  {/* Chips de filtros activos */}
  {(qSheet || fIdioma !== "all" || fModalidad !== "all" || fTurno !== "all" || fNivel !== "all") && (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {qSheet ? (
        <Badge variant="secondary" className="gap-1">
          Código: “{qSheet}”
          <button
            className="ml-1 rounded-sm hover:bg-neutral-200"
            onClick={() => setQSheet("")}
            aria-label="Quitar filtro código"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      ) : null}

      {fIdioma !== "all" ? (
        <Badge variant="secondary" className="gap-1">
          Idioma: {fIdioma}
          <button
            className="ml-1 rounded-sm hover:bg-neutral-200"
            onClick={() => setFIdioma("all")}
            aria-label="Quitar filtro idioma"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      ) : null}

      {fModalidad !== "all" ? (
        <Badge variant="secondary" className="gap-1">
          Modalidad: {fModalidad}
          <button
            className="ml-1 rounded-sm hover:bg-neutral-200"
            onClick={() => setFModalidad("all")}
            aria-label="Quitar filtro modalidad"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      ) : null}

      {fTurno !== "all" ? (
        <Badge variant="secondary" className="gap-1">
          Turno: {fTurno}
          <button
            className="ml-1 rounded-sm hover:bg-neutral-200"
            onClick={() => setFTurno("all")}
            aria-label="Quitar filtro turno"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      ) : null}

      {fNivel !== "all" ? (
        <Badge variant="secondary" className="gap-1">
          Nivel: {fNivel}
          <button
            className="ml-1 rounded-sm hover:bg-neutral-200"
            onClick={() => setFNivel("all")}
            aria-label="Quitar filtro nivel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      ) : null}
    </div>
  )}
</div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-neutral-500">Cargando…</div>
          ) : !items.length ? (
            <div className="py-8 text-center text-sm text-neutral-500">
              Sin ciclos registrados para este docente.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Idioma</th>
                      <th className="px-3 py-2">Nivel</th>
                      <th className="px-3 py-2">Modalidad</th>
                      <th className="px-3 py-2">Turno</th>
                      <th className="px-3 py-2">Horario</th>
                      <th className="px-3 py-2">Curso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c: CicloDTO) => {
                      const dias = ((c as any).dias ?? []) as string[];
                      const diasTxt = dias.length ? dias.map(abreviarDia).join(" • ") : "—";
                      const hi = (c as any).hora_inicio as string | undefined;
                      const hf = (c as any).hora_fin as string | undefined;
                      const horario = hi && hf ? `${hhmm(hi)}–${hhmm(hf)}` : "—";
                      return (
                        <tr key={c.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{c.codigo}</td>
                          <td className="px-3 py-2 capitalize">{c.idioma}</td>
                          <td className="px-3 py-2">{(c as any).nivel ?? "—"}</td>
                          <td className="px-3 py-2 capitalize">{c.modalidad}</td>
                          <td className="px-3 py-2 capitalize">{c.turno}</td>
                          <td className="px-3 py-2 tabular-nums">
                            <div className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                               {horario}
                            </div>
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {c.curso?.from ? dmx(c.curso.from) : "—"} – {c.curso?.to ? dmx(c.curso.to) : "—"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                <span>Página {resp?.page} de {resp?.pages} · {resp?.total} resultados</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canPrev}
                    onClick={() => { const p = Math.max(1, (resp?.page ?? 1) - 1); setPage(p); fetchData(p); }}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canNext}
                    onClick={() => { const p = resp ? Math.min(resp.pages, (resp.page + 1)) : 1; setPage(p); fetchData(p); }}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <Separator className="my-0" />
        <SheetFooter className="px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ============================================================
 * Dialog: Alta de docente
 * ============================================================ */
function AddTeacherDialogInline({
  open,
  onOpenChange,
  invite,
  onCreated,
  disabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invite: (data: CreateTeacherInput) => Promise<void>;
  onCreated?: () => void;
  disabled?: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [email2, setEmail2]       = useState("");
  const [curp, setCurp]           = useState("");
  const [errs, setErrs] = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setEmail2(""); setCurp("");
    setErrs({});
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const validate = () => {
    const e: Record<string,string> = {};
    if (firstName.trim().length < 2) e.firstName = "Ingresa el/los nombre(s)";
    if (lastName .trim().length < 2) e.lastName  = "Ingresa los apellidos";
    if (!EMAIL_REGEX.test(email))    e.email     = "Correo inválido";
    if (email.toLowerCase() !== email2.toLowerCase()) e.email2 = "Los correos no coinciden";
    if (!CURP_REGEX.test(curp.trim())) e.curp = "CURP inválido (18 caracteres)";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await invite({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        curp: curp.trim().toUpperCase(),
      });
      onCreated?.();
      onOpenChange(false);
    } catch (e:any) {
      toast.error(e?.message || "Error al crear docente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {/* Este botón lo controlas arriba; aquí no se renderiza nada extra */}
        <span />
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar de alta docente</DialogTitle>
          <DialogDescription>
            Captura los datos del docente. La <strong>contraseña se enviará por correo</strong> automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="t-first">Nombre(s)</Label>
            <Input id="t-first" value={firstName}
              onChange={(e)=>setFirstName(e.target.value)}
              placeholder="María Fernanda" required />
            {errs.firstName && <p className="text-xs text-red-600">{errs.firstName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-last">Apellidos</Label>
            <Input id="t-last" value={lastName}
              onChange={(e)=>setLastName(e.target.value)}
              placeholder="García López" required />
            {errs.lastName && <p className="text-xs text-red-600">{errs.lastName}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-email">Correo</Label>
          <Input id="t-email" type="email" value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="tunombre@correo.com" autoComplete="email" required />
          {errs.email && <p className="text-xs text-red-600">{errs.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-email2">Confirmar correo</Label>
          <Input id="t-email2" type="email" value={email2}
            onChange={(e)=>setEmail2(e.target.value)}
            placeholder="Repite tu correo" autoComplete="email" required />
          {errs.email2 && <p className="text-xs text-red-600">{errs.email2}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-curp">CURP</Label>
          <Input id="t-curp" value={curp}
            onChange={(e)=>setCurp(e.target.value.toUpperCase())}
            placeholder="GAXX000101HDFLRN09" maxLength={18} required />
          {errs.curp && <p className="text-xs text-red-600">{errs.curp}</p>}
          <p className="text-[11px] text-neutral-500">Se convierte a mayúsculas automáticamente.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Guardando…" : "Crear e invitar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== utils locales ===== */
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
