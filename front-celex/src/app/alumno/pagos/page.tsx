"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  listMisInscripciones,
  downloadArchivoInscripcion, // (id: number, tipo: "comprobante" | "exencion" | "estudios")
} from "@/lib/api";

import {
  Loader2,
  FileDown,
  ReceiptText,
  ShieldCheck,
  BadgeDollarSign,
  CalendarDays,
  Info,
} from "lucide-react";

/* ===== Tipos mínimos que usamos aquí ===== */
type InscripcionLite = {
  id: number;
  ciclo_id: number;
  status: string; // registrada | preinscrita | confirmada | rechazada | en_revision ...
  tipo?: "pago" | "exencion";
  referencia?: string | null;
  importe_centavos?: number | null;
  fecha_pago?: string | null; // YYYY-MM-DD
  ciclo?: {
    codigo?: string;
    idioma?: string;
    nivel?: string;
    modalidad?: string;
    turno?: string;
  };
  has_comprobante?: boolean;
  has_exencion?: boolean;
  has_estudios?: boolean;
};

/* ===== Helpers ===== */
function moneyMXN(centavos?: number | null) {
  if (centavos == null) return "—";
  const value = Math.round(centavos) / 100;
  try {
    return value.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    });
  } catch {
    return `MXN ${value.toFixed(2)}`;
  }
}

function d(s?: string | null) {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString("es-MX");
}

function statusBadgeTone(status: string) {
  const s = (status || "").toLowerCase();
  if (["confirmada", "validada", "aceptada"].includes(s)) {
    return { variant: "secondary" as const, className: "bg-emerald-100 text-emerald-900 border-emerald-200" };
  }
  if (["preinscrita", "en_revision", "en revisión", "pendiente"].includes(s)) {
    return { variant: "secondary" as const, className: "bg-amber-100 text-amber-900 border-amber-200" };
  }
  if (["rechazada", "cancelada"].includes(s)) {
    return { variant: "secondary" as const, className: "bg-red-100 text-red-900 border-red-200" };
  }
  return { variant: "outline" as const, className: "" };
}

export default function AlumnoPagosPage() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<InscripcionLite[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await listMisInscripciones();
        const mapped: InscripcionLite[] = (data ?? []).map((raw: any) => ({
          id: raw.id,
          ciclo_id: raw.ciclo_id ?? raw.ciclo?.id,
          status: raw.status ?? raw.estado ?? "pendiente",
          tipo: (raw.tipo ?? raw.payment_type ?? (raw.referencia ? "pago" : raw.comprobante_exencion ? "exencion" : undefined)) as any,
          referencia: raw.referencia ?? raw.payment_ref ?? null,
          importe_centavos: raw.importe_centavos ?? raw.amount_centavos ?? null,
          fecha_pago: raw.fecha_pago ?? null,
          ciclo: {
            codigo: raw.ciclo?.codigo ?? raw.curso?.codigo ?? "",
            idioma: raw.ciclo?.idioma ?? raw.curso?.idioma ?? "",
            nivel: raw.ciclo?.nivel ?? raw.curso?.nivel ?? "",
            modalidad: raw.ciclo?.modalidad ?? raw.curso?.modalidad ?? "",
            turno: raw.ciclo?.turno ?? raw.curso?.turno ?? "",
          },
          has_comprobante: raw.has_comprobante ?? !!raw.comprobante,
          has_exencion: raw.has_exencion ?? !!raw.comprobante_exencion,
          has_estudios: raw.has_estudios ?? !!raw.comprobante_estudios,
        }));
        setItems(mapped);
      } catch (e: any) {
        console.error(e);
        toast.error("No se pudieron cargar tus pagos y exenciones.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay = `${it.ciclo?.codigo ?? ""} ${it.status} ${it.tipo ?? ""} ${it.referencia ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  async function onDownload(id: number, tipo: "comprobante" | "exencion" | "estudios") {
    try {
      await downloadArchivoInscripcion(id, tipo);
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("404") || msg.includes("no encontrado")) {
        toast.error(`No hay archivo de ${tipo} para esta inscripción.`);
      } else {
        toast.error(`No se pudo descargar el archivo de ${tipo}.`);
      }
    }
  }

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Pagos y Exenciones">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Mis pagos / exenciones</CardTitle>
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Buscar por código, estatus o referencia…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay registros que coincidan.</div>
              ) : (
                <>
                  {/* ===== Vista móvil: tarjetas ===== */}
                  <div className="grid gap-3 md:hidden">
                    {filtered.map((it) => {
                      const tone = statusBadgeTone(it.status || "");
                      return (
                        <Card key={it.id} className="border">
                          <CardContent className="py-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate" title={it.ciclo?.codigo}>
                                  {it.ciclo?.codigo || "—"}
                                </div>
                                <div
                                  className="text-xs text-muted-foreground truncate"
                                  title={`${it.ciclo?.idioma ?? ""} ${it.ciclo?.nivel ?? ""} • ${it.ciclo?.modalidad ?? ""}/${it.ciclo?.turno ?? ""}`}
                                >
                                  {(it.ciclo?.idioma ?? "")} {(it.ciclo?.nivel ?? "")} • {(it.ciclo?.modalidad ?? "")}/{(it.ciclo?.turno ?? "")}
                                </div>
                              </div>
                              <Badge variant={tone.variant} className={tone.className + " whitespace-nowrap"}>
                                {it.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Tipo</div>
                                <div className="inline-flex items-center gap-1">
                                  {it.tipo === "exencion" ? (
                                    <>
                                      <ShieldCheck className="h-4 w-4" /> Exención
                                    </>
                                  ) : (
                                    <>
                                      <ReceiptText className="h-4 w-4" /> Pago
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Referencia</div>
                                <div className="font-mono text-xs truncate" title={it.referencia || ""}>
                                  {it.referencia || "—"}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Importe</div>
                                <div className="inline-flex items-center gap-1">
                                  <BadgeDollarSign className="h-4 w-4" />
                                  {it.tipo === "exencion" ? "—" : moneyMXN(it.importe_centavos)}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Fecha de pago</div>
                                <div className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-4 w-4" />
                                  {it.tipo === "exencion" ? "—" : d(it.fecha_pago)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-9 w-9"
                                      disabled={it.tipo === "exencion"}
                                      onClick={() => onDownload(it.id, "comprobante")}
                                    >
                                      <FileDown className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Comprobante de pago</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-9 w-9"
                                      disabled={it.tipo !== "exencion"}
                                      onClick={() => onDownload(it.id, "exencion")}
                                    >
                                      <FileDown className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Comprobante de exención</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-9 w-9"
                                      onClick={() => onDownload(it.id, "estudios")}
                                    >
                                      <FileDown className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Constancia de estudios</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* ===== Vista desktop: 5 columnas (Referencia solo para pagos, combinada con Importe) ===== */}
                  <div className="hidden md:block">
                    <div className="max-h-[70vh] overflow-auto rounded-md border">
                      <Table className="table-fixed">
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                          <TableRow>
                            <TableHead className="text-left w-[30rem]">Curso</TableHead>
                            <TableHead className="text-center w-[14rem]">Pago</TableHead>
                            <TableHead className="text-center w-[10rem]">Fecha de pago</TableHead>
                            <TableHead className="text-center w-[14rem]">Archivos</TableHead>
                            <TableHead className="text-center w-[10rem]">Estado</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {filtered.map((it) => {
                            const cursoTxt = `${it.ciclo?.codigo ?? "—"}`;
                            const detalleTxt = `${it.ciclo?.idioma ?? ""} ${it.ciclo?.nivel ?? ""} • ${it.ciclo?.modalidad ?? ""}/${it.ciclo?.turno ?? ""}`.trim();
                            const tone = statusBadgeTone(it.status || "");
                            const esExencion = it.tipo === "exencion";

                            return (
                              <TableRow key={it.id} className="align-top odd:bg-muted/30">
                                {/* Curso + tipo como chip pequeño */}
                                <TableCell className="py-4 w-[30rem]">
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium leading-tight truncate" title={cursoTxt}>
                                        {cursoTxt}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate" title={detalleTxt}>
                                        {detalleTxt || "—"}
                                      </div>
                                    </div>
                                    <div className="shrink-0 mt-0.5">
                                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-muted">
                                        {esExencion ? (
                                          <>
                                            <ShieldCheck className="h-3.5 w-3.5" /> Exención
                                          </>
                                        ) : (
                                          <>
                                            <ReceiptText className="h-3.5 w-3.5" /> Pago
                                          </>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Pago: referencia (solo si es pago) + importe */}
                                <TableCell className="py-4 text-center w-[14rem]">
                                  {esExencion ? (
                                    "—"
                                  ) : (
                                    <div className="space-y-1">
                                      {it.referencia ? (
                                        <div
                                          className="font-mono text-[11px] truncate"
                                          title={`Ref: ${it.referencia}`}
                                        >
                                          Ref: {it.referencia}
                                        </div>
                                      ) : null}
                                      <div className="text-sm">{moneyMXN(it.importe_centavos)}</div>
                                    </div>
                                  )}
                                </TableCell>

                                {/* Fecha */}
                                <TableCell className="py-4 text-center w-[10rem]">
                                  {esExencion ? (
                                    "—"
                                  ) : (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                      <CalendarDays className="h-4 w-4" />
                                      {d(it.fecha_pago)}
                                    </span>
                                  )}
                                </TableCell>

                                {/* Archivos */}
                                <TableCell className="py-3 w-[14rem]">
                                  <div className="flex items-center justify-center gap-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-9 w-9"
                                            disabled={esExencion}
                                            onClick={() => onDownload(it.id, "comprobante")}
                                          >
                                            <FileDown className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Comprobante de pago</TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-9 w-9"
                                            disabled={!esExencion}
                                            onClick={() => onDownload(it.id, "exencion")}
                                          >
                                            <FileDown className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Comprobante de exención</TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-9 w-9"
                                            onClick={() => onDownload(it.id, "estudios")}
                                          >
                                            <FileDown className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Constancia de estudios</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>

                                {/* Estado */}
                                <TableCell className="py-4 text-center w-[10rem]">
                                  <Badge variant={tone.variant} className={tone.className + " whitespace-nowrap"}>
                                    {it.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Nota informativa */}
                    <div className="mt-3 text-[12px] text-neutral-600 flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5" />
                      <p>
                        Si un botón de descarga marca error, puede deberse a que aún no has cargado ese archivo
                        o está en revisión. Para pagos: muestra{" "}
                        <BadgeDollarSign className="inline h-3 w-3" /> importe y{" "}
                        <CalendarDays className="inline h-3 w-3" /> fecha cuando han sido capturados.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}
