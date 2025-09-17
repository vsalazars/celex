"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2, Search } from "lucide-react";

import { apiFetch, buildURL } from "@/lib/api";
import type { Paginated } from "@/lib/types";

// =============================
// Tipos locales (flexibles)
// =============================
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
};

const ALL = "all"; // sentinel para 'Todos' (evita value="")

export default function StudentsSection() {
  const [q, setQ] = React.useState("");
  const [anio, setAnio] = React.useState<string>(ALL);
  const [idioma, setIdioma] = React.useState<string>(ALL);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const [data, setData] = React.useState<Paginated<AlumnoFull>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    pages: 1,
  });

  const [loading, setLoading] = React.useState(false);
  const [fallbackMode, setFallbackMode] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

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

  const fetchStudents = React.useCallback(
    async (opts?: { resetPage?: boolean }) => {
      setError(null);
      setLoading(true);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // 1) Intento directo
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
        // 2) Fallback: ciclos -> grupos -> reportes/inscritos
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
                });
              }
            }
          }

          // Deduplicado suave por inscripcion_id (si existe)
          const dedup: AlumnoFull[] = [];
          const seen = new Set<string>();
          for (const it of items) {
            const key = it.inscripcion_id != null ? `i:${it.inscripcion_id}` : `e:${it.email ?? ""}|n:${it.nombre ?? ""}`;
            if (seen.has(key)) continue;
            seen.add(key);
            dedup.push(it);
          }

          // filtrado rápido por q si no hay filtro en back
          const filtered = q
            ? dedup.filter((it) => {
                const hay = [it.nombre, it.first_name, it.last_name, it.email, it.curp, it.boleta]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return hay.includes(q.toLowerCase());
              })
            : dedup;

          // paginación en cliente
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

  // =============================
  // Utilidades
  // =============================
  function fullName(a: AlumnoFull): string {
    if (a.nombre && a.nombre.trim()) return a.nombre.trim();
    return [a.last_name, a.first_name].filter(Boolean).join(" ") || "(sin nombre)";
  }

  function rowKey(a: AlumnoFull, idx: number): string {
    const id = a.id != null ? `u:${a.id}` : "";
    const ins = a.inscripcion_id != null ? `i:${a.inscripcion_id}` : "";
    const extra = a.email ? `e:${a.email}` : a.curp ? `c:${a.curp}` : "";
    const base = [id, ins, extra].filter(Boolean).join("|") || `idx:${idx}`;
    // añadimos idx para garantizar unicidad incluso con ids repetidos
    return `${base}#${idx}`;
  }

  function toCSV(rows: AlumnoFull[]): string {
    const header = [
      "id",
      "inscripcion_id",
      "nombre",
      "email",
      "curp",
      "boleta",
      "is_ipn",
      "telefono",
      "addr_calle",
      "addr_numero",
      "addr_colonia",
      "addr_municipio",
      "addr_estado",
      "addr_cp",
      "fecha_inscripcion",
      "estado",
      "created_at",
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replaceAll('"', '""');
      if (/[",\n]/.test(s)) return `"${s}"`;
      return s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      const line = header.map((k) => escape((r as any)[k])).join(",");
      lines.push(line);
    }
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

  const idiomaOptions = [
    { value: ALL, label: "Todos" },
    { value: "ingles", label: "Inglés" },
    { value: "frances", label: "Francés" },
    { value: "aleman", label: "Alemán" },
    { value: "italiano", label: "Italiano" },
    { value: "chino", label: "Chino" },
    { value: "japones", label: "Japonés" },
  ];

  // =============================
  // Render
  // =============================
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
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative md:w-80">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                className="pl-8"
                placeholder="Buscar por nombre, email, CURP, boleta…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
            </div>

            <Select value={anio} onValueChange={(v) => { setAnio(v); setPage(1); }}>
              <SelectTrigger className="w-40">
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
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                {idiomaOptions.map((opt) => (
                  <SelectItem key={`lang-${opt.value}`} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              <Button
                onClick={() => fetchStudents({ resetPage: true })}
                className="rounded-xl"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Actualizar
              </Button>
            </div>
          </div>

          {/* Tabla */}
          <div className="border rounded-xl">
            <ScrollArea className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Alumno</TableHead>
                    <TableHead className="min-w-[220px]">Email</TableHead>
                    <TableHead className="min-w-[140px]">CURP</TableHead>
                    <TableHead className="min-w-[110px]">Boleta</TableHead>
                    <TableHead className="min-w-[90px]">IPN</TableHead>
                    <TableHead className="min-w-[140px]">Teléfono</TableHead>
                    <TableHead className="min-w-[220px]">Dirección</TableHead>
                    <TableHead className="min-w-[140px]">Inscripción</TableHead>
                    <TableHead className="min-w-[120px]">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-neutral-500">
                        <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Cargando…
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!loading && data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-neutral-500">
                        {error || "Sin resultados"}
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {data.items.map((a, idx) => (
                    <TableRow key={rowKey(a, idx)}>
                      <TableCell>
                        <div className="font-medium">{fullName(a)}</div>
                        <div className="text-xs text-neutral-500">ID: {String(a.id ?? a.inscripcion_id ?? "-")}</div>
                      </TableCell>
                      <TableCell>
                        <div>{a.email || "-"}</div>
                      </TableCell>
                      <TableCell>{a.curp || "-"}</TableCell>
                      <TableCell>{a.boleta || "-"}</TableCell>
                      <TableCell>
                        {a.is_ipn == null ? (
                          <span className="text-neutral-400">-</span>
                        ) : a.is_ipn ? (
                          <Badge variant="secondary">Sí</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>{a.telefono || "-"}</TableCell>
                      <TableCell>
                        <div className="text-xs leading-tight text-neutral-700">
                          {[a.addr_calle, a.addr_numero].filter(Boolean).join(" ") || ""}
                        </div>
                        <div className="text-xs leading-tight text-neutral-500">
                          {[a.addr_colonia, a.addr_municipio, a.addr_estado]
                            .filter(Boolean)
                            .join(", ") || "-"}
                          {a.addr_cp ? `, CP ${a.addr_cp}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">{a.fecha_inscripcion || "-"}</div>
                        <div className="text-[10px] text-neutral-500">Alta: {a.created_at || "-"}</div>
                      </TableCell>
                      <TableCell>
                        {a.estado ? (
                          <Badge variant="secondary">{a.estado}</Badge>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </TableCell>
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
                <span>
                  Mostrando <b>{data.items.length}</b> de <b>{data.total}</b> alumno(s)
                  {fallbackMode ? " (modo agrupado)" : ""}
                </span>
              ) : (
                <span>Sin datos</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="Tamaño" />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={`ps-${n}`} value={String(n)}>
                      {n} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
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
          </div>
        </CardContent>
      </Card>

      {/* Nota sobre el modo */}
      {fallbackMode ? (
        <p className="text-xs text-neutral-500">
          Modo agrupado: se construye el listado a partir de <code>/coordinacion/ciclos</code>,
          <code>/coordinacion/grupos</code> y <code>/coordinacion/reportes/inscritos</code>. Se recomienda exponer
          un endpoint <code>GET /coordinacion/alumnos</code> paginado para un rendimiento óptimo (filtros: <code>q</code>,
          <code>anio</code>, <code>idioma</code>, etc.).
        </p>
      ) : null}
    </div>
  );
}
