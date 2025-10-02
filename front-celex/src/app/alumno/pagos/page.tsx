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
  fecha_pago?: string | null; // YYYY-MM-DD o ISO completo
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

/* ===== Nivel → etiqueta completa ===== */
const NIVEL_LABELS: Record<string, string> = {
  INTRO: "Introductorio",
  B1: "Básico 1",
  B2: "Básico 2",
  B3: "Básico 3",
  B4: "Básico 4",
  B5: "Básico 5",
  I1: "Intermedio 1",
  I2: "Intermedio 2",
  I3: "Intermedio 3",
  I4: "Intermedio 4",
  I5: "Intermedio 5",
  A1: "Avanzado 1",
  A2: "Avanzado 2",
  A3: "Avanzado 3",
  A4: "Avanzado 4",
  A5: "Avanzado 5",
  A6: "Avanzado 6",
};

function normalizeNivelKey(n: string | null | undefined): string | null {
  if (!n) return null;
  const t = String(n).trim();
  const u = t.toUpperCase();
  if (u.startsWith("INTRO")) return "INTRO";
  if (NIVEL_LABELS[u]) return u;
  const found = Object.entries(NIVEL_LABELS).find(([, v]) => v.toLowerCase() === t.toLowerCase());
  return found ? found[0] : null;
}

function nivelFullLabel(n: string | null | undefined) {
  const key = normalizeNivelKey(n);
  return key ? NIVEL_LABELS[key] : (n || "—");
}

/* ===== Limpieza de valores que vienen con prefijo "Etiqueta." ===== */
function cleanPrefixed(val?: string | null, expectLabel?: "Idioma" | "Nivel" | "Turno" | "Modalidad") {
  if (!val) return "—";
  const s = String(val).trim();
  if (!expectLabel) return s || "—";
  const rx = new RegExp(`^${expectLabel}\\.?\\s*`, "i");
  return (s.replace(rx, "") || "—");
}

/* Capitaliza simple (primera letra en mayúscula) conservando acentos */
function capFirst(s?: string | null) {
  const t = (s ?? "").toString().trim();
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ===== Formato de fechas amigable (MX, 24h) ===== */
const MX_TZ = "America/Mexico_City";

/** Solo fecha: "06 sep 2025" */
function formatDateFriendly(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: MX_TZ,
  })
    .format(dt)
    .replace(".", "");
}

/** Fecha + hora (24h): "06 sep 2025 · 14:41" */
function formatDateTimeFriendly(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;

  const date = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: MX_TZ,
  })
    .format(dt)
    .replace(".", "");

  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,     // << 24 horas
    timeZone: MX_TZ,
  }).format(dt);

  return `${date} · ${time}`;
}

/* ===== Helpers dinero ===== */
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

/* ===== Badges (móvil) ===== */
function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 bg-muted">
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <b className="ml-1">{value}</b>
    </span>
  );
}

/* ===== Status → tono badge ===== */
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

  // ——— Formateo seguro de los 4 campos (limpieza + capitalización + nombre completo de nivel)
  function fmtIdioma(raw?: string | null) {
    return capFirst(cleanPrefixed(raw, "Idioma"));
  }
  function fmtNivel(raw?: string | null) {
    const cleaned = cleanPrefixed(raw, "Nivel");
    return nivelFullLabel(cleaned);
  }
  function fmtTurno(raw?: string | null) {
    return capFirst(cleanPrefixed(raw, "Turno"));
  }
  function fmtModalidad(raw?: string | null) {
    return capFirst(cleanPrefixed(raw, "Modalidad"));
  }

  // Decide si mostrar fecha sola o fecha+hora, y siempre en 24h si trae hora
  function renderFechaPago(v?: string | null) {
    if (!v) return "—";
    return String(v).includes("T")
      ? formatDateTimeFriendly(v)
      : formatDateFriendly(v);
  }

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Pagos y Exenciones">
        <div className="space-y-4 p-3 sm:p-0">
          <Card className="shadow-sm">
            <CardHeader className="flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <CardTitle className="text-base sm:text-lg">Mis pagos / exenciones</CardTitle>
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Buscar por código, estatus o referencia…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-10"
                />
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-6">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay registros que coincidan.</div>
              ) : (
                <>
                  {/* ===== VISTA MÓVIL (tarjetas con badges: Idioma → Nivel → Turno → Modalidad) ===== */}
                  <div className="grid gap-3 md:hidden">
                    {filtered.map((it) => {
                      const tone = statusBadgeTone(it.status || "");
                      const esExencion = it.tipo === "exencion";

                      const idioma = fmtIdioma(it.ciclo?.idioma);
                      const nivel = fmtNivel(it.ciclo?.nivel);
                      const turno = fmtTurno(it.ciclo?.turno);
                      const modalidad = fmtModalidad(it.ciclo?.modalidad);

                      return (
                        <Card key={it.id} className="border">
                          <CardContent className="py-4 px-3 space-y-4">
                            {/* Encabezado */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium break-words">
                                  {it.ciclo?.codigo || "—"}
                                </div>
                                {/* BADGES orden: Idioma → Nivel → Turno → Modalidad */}
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Pill label="Idioma" value={idioma} />
                                  <Pill label="Nivel" value={nivel} />
                                  <Pill label="Turno" value={turno} />
                                  <Pill label="Modalidad" value={modalidad} />
                                </div>
                              </div>
                              <Badge
                                variant={tone.variant}
                                className={tone.className + " shrink-0"}
                              >
                                {it.status}
                              </Badge>
                            </div>

                            {/* Cuerpo: filas etiqueta → valor */}
                            <div className="space-y-2 text-[13px]">
                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground shrink-0 inline-flex items-center gap-1">
                                  {esExencion ? <ShieldCheck className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
                                  Tipo:
                                </span>
                                <span className="font-medium break-words">
                                  {esExencion ? "Exención" : "Pago"}
                                </span>
                              </div>

                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground shrink-0">Referencia:</span>
                                <span className="font-mono break-words">
                                  {esExencion ? "—" : (it.referencia || "—")}
                                </span>
                              </div>

                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground shrink-0 inline-flex items-center gap-1">
                                  <BadgeDollarSign className="h-4 w-4" /> Importe:
                                </span>
                                <span className="break-words">
                                  {esExencion ? "—" : moneyMXN(it.importe_centavos)}
                                </span>
                              </div>

                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground shrink-0 inline-flex items-center gap-1">
                                  <CalendarDays className="h-4 w-4" /> Fecha de pago:
                                </span>
                                <span className="break-words">
                                  {esExencion ? "—" : renderFechaPago(it.fecha_pago)}
                                </span>
                              </div>
                            </div>

                            {/* Acciones */}
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-10 px-3"
                                      disabled={esExencion}
                                      onClick={() => onDownload(it.id, "comprobante")}
                                    >
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Comprobante
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Comprobante de pago</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-10 px-3"
                                      disabled={!esExencion}
                                      onClick={() => onDownload(it.id, "exencion")}
                                    >
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Exención
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Comprobante de exención</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-10 px-3"
                                      onClick={() => onDownload(it.id, "estudios")}
                                    >
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Estudios
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

                  {/* ===== VISTA DESKTOP (tabla sin scroll interno) ===== */}
                  <div className="hidden md:block">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">Curso</TableHead>
                          <TableHead className="text-left">Detalles</TableHead>
                          <TableHead className="text-left">Pago</TableHead>
                          <TableHead className="text-left">Fecha de pago</TableHead>
                          <TableHead className="text-center">Archivos</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filtered.map((it) => {
                          const esExencion = it.tipo === "exencion";
                          const tone = statusBadgeTone(it.status || "");

                          const idioma = fmtIdioma(it.ciclo?.idioma);
                          const nivel = fmtNivel(it.ciclo?.nivel);
                          const turno = fmtTurno(it.ciclo?.turno);
                          const modalidad = fmtModalidad(it.ciclo?.modalidad);

                          return (
                            <TableRow key={it.id} className="align-top">
                              {/* Curso */}
                              <TableCell className="py-4">
                                <div className="font-medium break-words">{it.ciclo?.codigo ?? "—"}</div>
                                <div className="text-xs text-muted-foreground break-words">
                                  ID #{it.ciclo_id ?? it.id}
                                </div>
                              </TableCell>

                              {/* Detalles */}
                              <TableCell className="py-4">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Idioma</div>
                                    <div className="font-medium break-words">{idioma}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Nivel</div>
                                    <div className="font-medium break-words">{nivel}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Turno</div>
                                    <div className="font-medium break-words capitalize">{turno}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Modalidad</div>
                                    <div className="font-medium break-words capitalize">{modalidad}</div>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Pago */}
                              <TableCell className="py-4">
                                {esExencion ? (
                                  <span className="text-sm">—</span>
                                ) : (
                                  <div className="space-y-1">
                                    {it.referencia ? (
                                      <div className="font-mono text-[12px] break-words">
                                        Ref: {it.referencia}
                                      </div>
                                    ) : null}
                                    <div className="text-sm">{moneyMXN(it.importe_centavos)}</div>
                                  </div>
                                )}
                              </TableCell>

                              {/* Fecha */}
                              <TableCell className="py-4">
                                {esExencion ? (
                                  <span className="text-sm">—</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    <CalendarDays className="h-4 w-4" />
                                    {renderFechaPago(it.fecha_pago)}
                                  </span>
                                )}
                              </TableCell>

                              {/* Archivos */}
                              <TableCell className="py-3">
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
                              <TableCell className="py-4 text-center">
                                <Badge variant={tone.variant} className={tone.className + " whitespace-nowrap"}>
                                  {it.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

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
