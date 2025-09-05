"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listCiclos,
  listInscripcionesCoord,
  validateInscripcionCoord,
} from "@/lib/api";
import { getToken } from "@/lib/sessions";
import type { CicloDTO, InscripcionDTO } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, RotateCcw as IconReload, FileDown, Eye,
  Maximize2, Minimize2, ZoomIn, ZoomOut, ExternalLink,
  RotateCw, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";


type StatusFiltro =
  | "todas"
  | "registrada"
  | "preinscrita"
  | "confirmada"
  | "rechazada"
  | "cancelada";

type TipoArchivo = "comprobante" | "estudios" | "exencion";
type FitMode = "contain" | "width" | "height" | "actual";

type PreviewState = {
  open: boolean;
  ins: InscripcionDTO | null;
  tipo: TipoArchivo | null;
  url?: string | null;
  mime?: string | null;
  loading?: boolean;
  isPdf?: boolean;
};

export default function InscripcionesSection() {
  const [ciclos, setCiclos] = useState<CicloDTO[]>([]);
  const [cicloId, setCicloId] = useState<number | null>(null);
  const [year, setYear] = useState<number | "todos">("todos");

  const [status, setStatus] = useState<StatusFiltro>("todas");
  const [q, setQ] = useState<string>("");

  const [rows, setRows] = useState<InscripcionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState<number | null>(null);

  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    ins: null,
    tipo: null,
    url: null,
    mime: null,
    loading: false,
    isPdf: false,
  });

  // ====== Fullscreen, Zoom, Rotación, Ajuste ======
  const [isFull, setIsFull] = useState(false);
  const [zoom, setZoom] = useState(1);          // imágenes y pdfs (pdf via #zoom)
  const [rotation, setRotation] = useState(0);  // solo imágenes
  const [fit, setFit] = useState<FitMode>("contain"); // solo imágenes

  // ====== Cargar ciclos ======
  async function fetchCiclos() {
    try {
      const resp = await listCiclos({ page: 1, page_size: 100 });
      setCiclos(resp.items || []);
      if (!cicloId && resp.items?.length) setCicloId(resp.items[0].id);
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Error al cargar ciclos");
    }
  }

  // ====== Cargar inscripciones ======
  async function fetchInscripciones() {
    if (!cicloId) return;
    setLoading(true);
    try {
      const params: { status?: string; ciclo_id: number; limit?: number } = {
        ciclo_id: cicloId,
        limit: 60,
      };
      if (status !== "todas") params.status = status;

      const data = await listInscripcionesCoord(params);
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRows(data);
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Error al cargar inscripciones");
    } finally {
      setLoading(false);
    }
  }

  // ====== Validar ======
  async function handleValidate(id: number, action: "APPROVE" | "REJECT") {
    setValidating(id);
    try {
      await validateInscripcionCoord(
        id,
        action,
        action === "REJECT" ? "Documentación incompleta" : undefined
      );
      toast.success(`Inscripción ${action === "APPROVE" ? "aprobada" : "rechazada"} correctamente`);
      setPreview((p) => (p.ins?.id === id ? { ...p, open: false } : p));
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Error al validar");
    } finally {
      setValidating(null);
    }
  }

  // ====== Abrir visor ======
  async function openPreview(ins: InscripcionDTO, tipo: TipoArchivo) {
    const hasMeta =
      (tipo === "comprobante" && !!ins.comprobante) ||
      (tipo === "estudios" && !!ins.comprobante_estudios) ||
      (tipo === "exencion" && !!ins.comprobante_exencion);
    if (!hasMeta) {
      toast.info("Esta inscripción no tiene ese archivo.");
      return;
    }

    setPreview({ open: true, ins, tipo, loading: true, url: null, mime: null, isPdf: false });
    setIsFull(false);
    setZoom(1);
    setRotation(0);
    setFit("contain");

    try {
      const token = getToken();
      const url = new URL(
        `${process.env.NEXT_PUBLIC_API_URL}/coordinacion/inscripciones/${ins.id}/archivo`
      );
      url.searchParams.set("tipo", tipo);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = j?.detail || msg; } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const isPdf = (blob.type === "application/pdf") || objUrl.endsWith(".pdf");

      setPreview((p) => ({
        ...p,
        url: objUrl,
        mime: blob.type || null,
        loading: false,
        isPdf,
      }));
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "No se pudo abrir el archivo");
      setPreview((p) => ({ ...p, loading: false }));
    }
  }

  function closePreview() {
    if (preview.url) {
      try { URL.revokeObjectURL(preview.url); } catch {}
    }
    setPreview({ open: false, ins: null, tipo: null, url: null, mime: null, loading: false, isPdf: false });
    setIsFull(false);
    setZoom(1);
    setRotation(0);
    setFit("contain");
  }

  // ====== Inicial ======
  useEffect(() => { fetchCiclos(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (cicloId) fetchInscripciones(); /* eslint-disable-next-line */ }, [cicloId, status]);

  // ====== Atajos (cuando el visor está abierto) ======
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!preview.open) return;
      const key = e.key.toLowerCase();

      if (key === "f") { e.preventDefault(); setIsFull((v) => !v); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault(); setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))));
      }
      if ((e.ctrlKey || e.metaKey) && key === "0") {
        e.preventDefault(); setZoom(1);
      }
      if (!preview.isPdf && (e.ctrlKey || e.metaKey) && key === "r") {
        e.preventDefault(); setRotation((deg) => (deg + 90) % 360);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview.open, preview.isPdf]);

  // ====== Años únicos ======
  const years = useMemo(() => {
    const set = new Set<number>();
    ciclos.forEach((c) => {
      const from = c.curso?.from;
      if (from) set.add(new Date(from).getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [ciclos]);

  // ====== Filtrar ciclos por año ======
  const ciclosFiltrados = useMemo(() => {
    if (year === "todos") return ciclos;
    return ciclos.filter((c) => {
      const from = c.curso?.from;
      if (!from) return false;
      return new Date(from).getFullYear() === year;
    });
  }, [ciclos, year]);

  // ====== Filtro rápido ======
  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const nombre = `${r.alumno?.first_name ?? ""} ${r.alumno?.last_name ?? ""}`.toLowerCase();
      const email = (r.alumno?.email ?? "").toLowerCase();
      const codigo = (r.ciclo?.codigo ?? "").toLowerCase();
      return nombre.includes(term) || email.includes(term) || codigo.includes(term);
    });
  }, [rows, q]);

  const headers = useMemo(
    () => ["ID", "Alumno", "Estado", "Trámite", "Comprobantes", "Fecha", "Acciones"],
    []
  );

  // ====== helpers fit (imágenes) ======
  function fitClasses(): string {
    switch (fit) {
      case "width": return "w-full h-auto";
      case "height": return "h-full w-auto";
      case "actual": return "max-w-none";
      default: return "max-w-full max-h-full"; // contain
    }
  }

  const STATUS_STYLES: Record<
  Exclude<StatusFiltro, "todas">,
  { label: string; className: string }
> = {
  registrada: {
    label: "Registrada",
    className:
      "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-200",
  },
  preinscrita: {
    label: "Preinscrita",
    className:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  },
  confirmada: {
    label: "Confirmada",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
  },
  rechazada: {
    label: "Rechazada",
    className:
      "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-200",
  },
  cancelada: {
    label: "Cancelada",
    className:
      "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200",
  },
};


  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Validar inscripciones</CardTitle>
            <p className="text-sm text-muted-foreground">
              Filtra por año y ciclo; revisa todos los comprobantes en el visor y aprueba/rechaza sin salir.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full lg:w-auto">
            {/* Año */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Año</label>
              <Select value={String(year)} onValueChange={(v) => setYear(v === "todos" ? "todos" : Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ciclo */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Ciclo</label>
              <Select value={cicloId ? String(cicloId) : ""} onValueChange={(v) => setCicloId(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {ciclosFiltrados.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.codigo} — {c.idioma.toUpperCase()} {c.nivel} ({c.modalidad})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Estado</label>
              <Select value={status} onValueChange={(v: StatusFiltro) => setStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="registrada">Registradas</SelectItem>
                  <SelectItem value="preinscrita">Preinscritas</SelectItem>
                  <SelectItem value="confirmada">Confirmadas</SelectItem>
                  <SelectItem value="rechazada">Rechazadas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buscar */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Buscar</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. Nombre / correo / código" />
            </div>

            {/* Recargar */}
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={() => fetchInscripciones()} disabled={loading}>
                {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <IconReload className="w-4 h-4 mr-2" />}
                Recargar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin w-6 h-6 mr-2" />
              Cargando inscripciones...
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {cicloId ? "No hay inscripciones para este ciclo y filtros." : "Selecciona un ciclo para comenzar."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => <TableHead key={h}>{h}</TableHead>)}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>

                    <TableCell>
                      <div className="leading-tight">
                        <div>{r.alumno?.first_name} {r.alumno?.last_name}</div>
                        <div className="text-xs text-muted-foreground">{r.alumno?.email}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {(() => {
                        const s = (r.status as Exclude<StatusFiltro, "todas">) ?? "registrada";
                        const cfg = STATUS_STYLES[s] ?? STATUS_STYLES.registrada;
                        return (
                          <Badge
                            variant="outline"
                            className={`capitalize px-2 py-0.5 text-[12px] font-medium ${cfg.className}`}
                            title={cfg.label}
                          >
                            {cfg.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="capitalize">{r.tipo}</TableCell>

                    {/* Comprobantes */}
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {r.comprobante && (
                          <Button variant="secondary" size="sm" title="Ver comprobante de pago" onClick={() => openPreview(r, "comprobante")}>
                            <Eye className="w-4 h-4 mr-1" /> Ver pago
                          </Button>
                        )}
                        {r.comprobante_estudios && (
                          <Button variant="secondary" size="sm" title="Ver comprobante de estudios (IPN)" onClick={() => openPreview(r, "estudios")}>
                            <Eye className="w-4 h-4 mr-1" /> Ver estudios
                          </Button>
                        )}
                        {r.comprobante_exencion && (
                          <Button variant="secondary" size="sm" title="Ver comprobante de exención" onClick={() => openPreview(r, "exencion")}>
                            <Eye className="w-4 h-4 mr-1" /> Ver exención
                          </Button>
                        )}
                        {!r.comprobante && !r.comprobante_estudios && !r.comprobante_exencion && (
                          <span className="text-xs text-muted-foreground">Sin archivos</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => handleValidate(r.id, "APPROVE")} disabled={validating === r.id}>
                          {validating === r.id ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                          Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleValidate(r.id, "REJECT")} disabled={validating === r.id}>
                          {validating === r.id ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                          Rechazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ====== VISOR (layout flex: no rebasa; PDF e imágenes adentro) ====== */}
      <Dialog open={preview.open} onOpenChange={(o) => (o ? null : closePreview())}>
        <DialogContent
            className={
              `${isFull
                ? "w-screen h-screen max-w-none max-h-none"
                : [
                    // ancho MUY amplio por defecto
                    "w-[98vw]",
                    // anula el max-w por defecto del modal
                    "max-w-none sm:max-w-none",
                    // y si quieres, limita un poco en pantallas grandes:
                    "lg:max-w-[1400px] xl:max-w-[1600px]",
                    // alto
                    "h-[90vh] max-h-[90vh]"
                  ].join(" ")
              } p-0 overflow-hidden`
            }
          >
          {/* Contenedor en columnas para evitar overflow */}
          <div className="flex h-full flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-white/80 backdrop-blur shrink-0">
              <DialogHeader className="p-0">
                <DialogTitle className="text-sm md:text-base">
                  {preview.tipo === "comprobante" && "Comprobante de pago"}
                  {preview.tipo === "estudios" && "Comprobante de estudios"}
                  {preview.tipo === "exencion" && "Comprobante de exención"}
                  {preview.ins ? ` · ${preview.ins.alumno?.first_name || ""} ${preview.ins.alumno?.last_name || ""}` : ""}
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-2">
                {/* Controles de IMAGEN */}
                {!preview.isPdf && (
                  <>
                    <div className="hidden md:flex items-center gap-1">
                      <Button variant={fit === "contain" ? "default" : "outline"} size="sm" onClick={() => setFit("contain")} title="Encajar">Encajar</Button>
                      <Button variant={fit === "width" ? "default" : "outline"} size="sm" onClick={() => setFit("width")} title="Ajustar al ancho">Ancho</Button>
                      <Button variant={fit === "height" ? "default" : "outline"} size="sm" onClick={() => setFit("height")} title="Ajustar al alto">Alto</Button>
                      <Button variant={fit === "actual" ? "default" : "outline"} size="sm" onClick={() => setFit("actual")} title="Tamaño real">1:1</Button>
                    </div>

                    <Button variant="outline" size="icon" title="Rotar 90° izq" onClick={() => setRotation((d) => (d + 270) % 360)}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" title="Rotar 90° der" onClick={() => setRotation((d) => (d + 90) % 360)}>
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  </>
                )}

                {/* Zoom (imágenes y PDFs) */}
                <Button variant="outline" size="icon" title="Alejar" onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="icon" title="Acercar" onClick={() => setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" title="Restablecer zoom" onClick={() => setZoom(1)}>
                  Reset
                </Button>

                {/* Abrir/Descargar */}
                {preview.url && (
                  <>
                    <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="icon" title="Abrir en nueva pestaña">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                    <a href={preview.url} download className="inline-flex">
                      <Button variant="outline" size="icon" title="Descargar">
                        <FileDown className="w-4 h-4" />
                      </Button>
                    </a>
                  </>
                )}

                {/* Pantalla completa */}
                <Button
                  variant="default"
                  size="icon"
                  title={isFull ? "Salir pantalla completa (F/Esc)" : "Pantalla completa (F)"}
                  onClick={() => setIsFull((v) => !v)}
                >
                  {isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Área de preview (flex-1 + min-h-0 => NO overflow) */}
            <div className="flex-1 min-h-0 bg-neutral-50 flex items-center justify-center">
              {preview.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin w-5 h-5" />
                  Cargando archivo...
                </div>
              ) : preview.url ? (
                preview.isPdf ? (
                  // PDF dentro del modal con zoom del visor nativo (#zoom)
                  <iframe
                    title="PDF"
                    src={`${preview.url}#zoom=${Math.round(zoom * 100)}`}
                    className="w-full h-full"
                  />
                ) : preview.mime?.startsWith("image/") ? (
                  <div className="w-full h-full overflow-auto flex items-center justify-center">
                    <img
                      src={preview.url}
                      alt="Comprobante"
                      className={`object-contain ${fitClasses()}`}
                      style={{
                        transform: `rotate(${rotation}deg) scale(${zoom})`,
                        transformOrigin: "center center",
                        willChange: "transform",
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-6 text-sm text-center text-muted-foreground">
                    No se puede previsualizar este tipo de archivo.
                    <div className="mt-3">
                      <a href={preview.url} download className="inline-flex items-center gap-2 text-primary underline">
                        <FileDown className="w-4 h-4" />
                        Descargar archivo
                      </a>
                    </div>
                  </div>
                )
              ) : (
                <div className="p-6 text-sm text-muted-foreground">No hay archivo.</div>
              )}
            </div>

            {/* Footer (shrink-0 para que no empuje) */}
            <div className="flex items-center justify-between px-3 py-2 border-t bg-white/80 shrink-0">
              <div className="text-xs text-muted-foreground">
                {preview.mime ? `Tipo: ${preview.mime}` : ""}
              </div>
              <div className="flex gap-2">
                {preview.ins && (
                  <>
                    <Button onClick={() => handleValidate(preview.ins!.id, "APPROVE")} disabled={validating === preview.ins!.id}>
                      {validating === preview.ins!.id ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                      Aprobar
                    </Button>
                    <Button variant="destructive" onClick={() => handleValidate(preview.ins!.id, "REJECT")} disabled={validating === preview.ins!.id}>
                      {validating === preview.ins!.id ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                      Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
