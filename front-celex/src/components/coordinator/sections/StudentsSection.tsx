"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  ExternalLink,
  FileText,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/constants";

// ----------------------
// Types
// ----------------------
export type AlumnoDTO = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  curp: string;
  boleta?: string | null;
  is_ipn?: boolean | null;
};

export type CicloDTO = {
  id: number;
  codigo: string;
  idioma: string;
  nivel: string;
  turno: string;
  modalidad: string;
  insc_inicio: string;
  insc_fin: string;
  curso_inicio: string;
  curso_fin: string;
};

export type InscripcionDTO = {
  id: number;
  alumno_id: number;
  ciclo_id: number;
  status: string;
  created_at: string;
  referencia?: string | null;
  importe_centavos?: number | null;
  comprobante_path?: string | null;
  comprobante_mime?: string | null;
  comprobante_size?: number | null;
  tipo: "pago" | "exencion";
  fecha_pago?: string | null;
  alumno_is_ipn?: boolean;
  validated_by_id?: number | null;
  validated_at?: string | null;
  validation_notes?: string | null;
  rechazo_motivo?: string | null;
  rechazada_at?: string | null;
  alumno?: AlumnoDTO;
  ciclo?: CicloDTO;
};

export type StudentSummary = {
  alumno: AlumnoDTO;
  inscripciones: InscripcionDTO[];
  ultima?: InscripcionDTO;
};

type Filters = {
  q: string;
  idioma: string | "all";
  nivel: string | "all";
  turno: string | "all";
  modalidad: string | "all";
  status: string | "all";
};

const initialFilters: Filters = {
  q: "",
  idioma: "all",
  nivel: "all",
  turno: "all",
  modalidad: "all",
  status: "all",
};

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString() : "–";
const fmtMoney = (c?: number | null) =>
  typeof c === "number"
    ? (c / 100).toLocaleString(undefined, {
        style: "currency",
        currency: "MXN",
      })
    : "–";

const STATUS_COLORS: Record<string, string> = {
  registrada: "bg-blue-100 text-blue-800",
  preinscrita: "bg-amber-100 text-amber-800",
  confirmada: "bg-emerald-100 text-emerald-800",
  validada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
};

export default function StudentsSection() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [qDebounced, setQDebounced] = useState(filters.q);

  const [loading, setLoading] = useState(false);
  const [inscripciones, setInscripciones] = useState<InscripcionDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<StudentSummary | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // debounce de input de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => setQDebounced(filters.q), 400);
    return () => clearTimeout(handler);
  }, [filters.q]);

  // Cuando cambian filtros (excepto page/pageSize) reinicia a página 1
  useEffect(() => {
    setPage(1);
  }, [
    qDebounced,
    filters.status,
    filters.idioma,
    filters.nivel,
    filters.turno,
    filters.modalidad,
  ]);

  async function fetchInscripciones() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (qDebounced) params.set("q", qDebounced);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.idioma !== "all") params.set("idioma", filters.idioma);
      if (filters.nivel !== "all") params.set("nivel", filters.nivel);
      if (filters.turno !== "all") params.set("turno", filters.turno);
      if (filters.modalidad !== "all") params.set("modalidad", filters.modalidad);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const url = `${API_URL}/coordinacion/inscripciones?${params.toString()}`;
      const data = (await apiFetch(url, {
        auth: true,
      })) as { items: InscripcionDTO[]; total?: number } | InscripcionDTO[];

      const items = Array.isArray(data) ? data : data.items;
      setInscripciones(items || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Error al cargar inscripciones");
      toast.error("No se pudieron cargar las inscripciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInscripciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    qDebounced,
    filters.status,
    filters.idioma,
    filters.nivel,
    filters.turno,
    filters.modalidad,
    page,
    pageSize,
  ]);

  const students = useMemo<StudentSummary[]>(() => {
    const map = new Map<number, StudentSummary>();
    for (const insc of inscripciones) {
      const alumno =
        insc.alumno ||
        ({
          id: insc.alumno_id,
          first_name: "(Sin nombre)",
          last_name: "",
          email: "",
          curp: "",
          boleta: null,
          is_ipn: null,
        } as AlumnoDTO);

      const current = map.get(alumno.id);
      if (!current) {
        map.set(alumno.id, { alumno, inscripciones: [insc], ultima: insc });
      } else {
        current.inscripciones.push(insc);
        const a = new Date(current.ultima?.created_at || 0).getTime();
        const b = new Date(insc.created_at).getTime();
        if (b > a) current.ultima = insc;
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.alumno.last_name} ${a.alumno.first_name}`.localeCompare(
        `${b.alumno.last_name} ${b.alumno.first_name}`
      )
    );
  }, [inscripciones]);

  const totalPages = Math.max(1, Math.ceil(students.length / pageSize));

  // Si cambian students o pageSize, asegura que page esté dentro del rango
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return students.slice(start, start + pageSize);
  }, [students, page, pageSize]);

  function openDetail(s: StudentSummary) {
    setDetail(s);
    setDetailOpen(true);
  }

  async function downloadComprobante(
    insc: InscripcionDTO,
    adminView = true
  ) {
    try {
      const path = adminView
        ? `${API_URL}/coordinacion/inscripciones/${insc.id}/archivo`
        : `${API_URL}/alumno/inscripciones/${insc.id}/archivo`;
      const resp = await apiFetch(path, { auth: true });
      const isUrlLike =
        typeof resp === "object" && "url" in (resp as any) && (resp as any).url;
      if (isUrlLike) {
        window.open((resp as any).url as string, "_blank");
        return;
      }
      if (resp && (resp as any).base64) {
        const {
          base64,
          filename = `comprobante_${insc.id}.pdf`,
          mime = "application/pdf",
        } = resp as any;
        const blob = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const file = new Blob([blob], { type: mime });
        const href = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
        return;
      }
      toast.info("El backend debe devolver URL firmada o base64 del archivo");
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo descargar el comprobante");
    }
  }

  function exportCSV() {
    const rows: string[] = [];
    rows.push(
      [
        "Alumno",
        "Email",
        "CURP",
        "Boleta",
        "IPN",
        "#Inscripciones",
        "Último status",
        "Último ciclo",
        "Idioma",
        "Nivel",
        "Turno",
        "Modalidad",
        "Fecha registro",
        "Referencia",
        "Importe",
      ].join(",")
    );

    students.forEach((s) => {
      const u = s.ultima;
      rows.push(
        [
          `${s.alumno.last_name} ${s.alumno.first_name}`,
          s.alumno.email,
          s.alumno.curp,
          s.alumno.boleta || "",
          s.alumno.is_ipn ? "Sí" : "No",
          String(s.inscripciones.length),
          u?.status || "",
          u?.ciclo?.codigo || "",
          u?.ciclo?.idioma || "",
          u?.ciclo?.nivel || "",
          u?.ciclo?.turno || "",
          u?.ciclo?.modalidad || "",
          u?.created_at ? new Date(u.created_at).toISOString() : "",
          u?.referencia || "",
          typeof u?.importe_centavos === "number"
            ? String(u.importe_centavos / 100)
            : "",
        ]
          .map((x) => `"${(x || "").toString().replaceAll('"', '""')}"`)
          .join(",")
      );
    });

    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="overflow-hidden border-0 shadow-sm bg-white/50 dark:bg-neutral-900/50">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Estudiantes
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchInscripciones} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Recargar
            </Button>
            <Button variant="outline" onClick={exportCSV}>
              <FileText className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Explora estudiantes a partir de sus inscripciones y consulta el detalle.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email, CURP, boleta…"
                className="pl-8"
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
              />
            </div>
          </div>

          <Select
            value={filters.status}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, status: v as Filters["status"] }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="registrada">Registrada</SelectItem>
              <SelectItem value="preinscrita">Preinscrita</SelectItem>
              <SelectItem value="confirmada">Confirmada</SelectItem>
              <SelectItem value="validada">Validada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.idioma}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, idioma: v as Filters["idioma"] }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos idiomas</SelectItem>
              <SelectItem value="ingles">Inglés</SelectItem>
              <SelectItem value="frances">Francés</SelectItem>
              <SelectItem value="aleman">Alemán</SelectItem>
              <SelectItem value="italiano">Italiano</SelectItem>
              <SelectItem value="portugues">Portugués</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.nivel}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, nivel: v as Filters["nivel"] }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos niveles</SelectItem>
              {(["A1", "A2", "B1", "B2", "C1", "C2"] as const).map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.turno}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, turno: v as Filters["turno"] }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos turnos</SelectItem>
              <SelectItem value="matutino">Matutino</SelectItem>
              <SelectItem value="vespertino">Vespertino</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tamaño página" />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / pág
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        <div className="mt-4 border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>CURP / Boleta</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Inscripciones
                </TableHead>
                <TableHead>Último ciclo</TableHead>
                <TableHead className="hidden md:table-cell">
                  Fecha reg.
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow key="loading">
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}

              {!loading && error && (
                <TableRow key="error">
                  <TableCell colSpan={8} className="text-center py-6 text-rose-600">
                    {error}
                  </TableCell>
                </TableRow>
              )}

              {!loading && !error && paginated.length === 0 && (
                <TableRow key="empty">
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                !error &&
                paginated.map((s, idx) => {
                  const u = s.ultima;
                  const status = (u?.status || "").toLowerCase();
                  // clave única y estable por fila de alumno (usa alumno + última inscripción)
                  const rowKey = `al-${s.alumno.id}-${u?.id ?? "x"}-${idx}`;
                  return (
                    <TableRow key={rowKey} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="font-medium">
                          {s.alumno.last_name} {s.alumno.first_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.alumno.is_ipn ? "IPN" : "Externo"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{s.alumno.curp}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.alumno.boleta || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[220px]">
                          {s.alumno.email}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {s.inscripciones.length}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {u?.ciclo?.codigo || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {u?.ciclo
                            ? `${u.ciclo.idioma.toUpperCase()} · ${u.ciclo.nivel} · ${u.ciclo.turno} · ${u.ciclo.modalidad}`
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {fmtDate(u?.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_COLORS[status] || ""}`}>
                          {u?.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDetail(s)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" /> Detalle
                          </Button>
                          {u?.comprobante_path && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => downloadComprobante(u)}
                            >
                              <Download className="h-4 w-4 mr-1" /> Comprobante
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            {students.length} alumnos · página {page} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Detalle */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de estudiante</DialogTitle>
            <DialogDescription>
              Inscripciones, comprobantes y estados
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <Card className="border-0 bg-muted/40">
                <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Nombre</div>
                    <div className="font-medium">
                      {detail.alumno.last_name} {detail.alumno.first_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Email</div>
                    <div className="font-medium break-all">
                      {detail.alumno.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">CURP</div>
                    <div className="font-medium break-all">
                      {detail.alumno.curp}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Boleta</div>
                    <div className="font-medium">
                      {detail.alumno.boleta || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Origen</div>
                    <div className="font-medium">
                      {detail.alumno.is_ipn ? "IPN" : "Externo"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Inscripciones ({detail.inscripciones.length})
                </div>
                <ScrollArea className="h-[360px] pr-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ciclo</TableHead>
                        <TableHead>
                          Idioma / Nivel / Turno / Modalidad
                        </TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pago</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.inscripciones
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime()
                        )
                        .map((insc, idx) => {
                          const rowKey = `insc-${insc.id ?? "x"}-${
                            insc.ciclo_id ?? "y"
                          }-${idx}`;
                          return (
                            <TableRow key={rowKey}>
                              <TableCell>
                                <div className="font-medium">
                                  {insc.ciclo?.codigo || insc.ciclo_id}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ID #{insc.id}
                                </div>
                              </TableCell>
                              <TableCell>
                                {insc.ciclo ? (
                                  <div className="text-sm">
                                    {insc.ciclo.idioma.toUpperCase()} ·{" "}
                                    {insc.ciclo.nivel} · {insc.ciclo.turno} ·{" "}
                                    {insc.ciclo.modalidad}
                                  </div>
                                ) : (
                                  <div className="text-sm">—</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {fmtDate(insc.created_at)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`${
                                    STATUS_COLORS[
                                      (insc.status || "").toLowerCase()
                                    ] || ""
                                  }`}
                                >
                                  {insc.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {fmtMoney(insc.importe_centavos)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {insc.referencia || ""}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {insc.comprobante_path && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        downloadComprobante(insc)
                                      }
                                    >
                                      <Download className="h-4 w-4 mr-1" />{" "}
                                      Comprobante
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
