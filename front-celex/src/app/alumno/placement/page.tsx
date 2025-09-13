"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
} from "lucide-react";
import { apiFetch, downloadPlacementComprobante } from "@/lib/api";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";


/* ================= Base API desde env ================= */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/* Pequeño flag de depuración (también puedes activar con localStorage.setItem('debugPlacement','1')) */
const DEBUG =
  process.env.NODE_ENV !== "production" ||
  (typeof window !== "undefined" && localStorage.getItem("debugPlacement") === "1");

/* ================= Tipos ================= */
type PlacementExam = {
  id: number;
  codigo: string;
  nombre?: string | null;
  idioma: string | null;
  fecha?: string | null; // "YYYY-MM-DD"
  hora?: string | null; // "HH:mm"
  salon?: string | null;
  duracion_min?: number | null;
  cupo_total?: number | null;
  costo?: number | null; // MXN (pesos)
  activo?: boolean | null;
  dias?: string[];
};

type PlacementList = {
  items: PlacementExam[];
  page: number;
  pages: number;
  total: number;
};

type ComprobanteMeta = {
  filename?: string | null;
  mimetype?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
};

type PlacementRegistro = {
  id: number;
  exam_id: number;
  status: string;
  referencia?: string | null;
  importe_centavos?: number | null;
  fecha_pago?: string | null;
  comprobante?: ComprobanteMeta | null;
  created_at: string;
  exam?: Partial<PlacementExam> | null;

  // posibles campos que puede mandar el back:
  rechazo_motivo?: string | null;
  motivo_rechazo?: string | null;
  validation_notes?: string | null;
  reject_reason?: string | null;

  // 👇 NUEVO: nivel asignado por el docente (varios alias posibles)
  nivel_idioma?: string | null;
  nivel_asignado?: string | null;
  nivel?: string | null;
};


/* ============ Página con Shell ============ */
export default function PlacementAlumnoPage() {
  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Exámenes de colocación">
        <div className="p-4 sm:p-6 space-y-6">
          <header className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6" />
            <div>
              <h1 className="text-xl font-semibold">Exámenes de colocación</h1>
              <p className="text-sm text-muted-foreground">
                Consulta tus registros abajo. Usa “Ver exámenes” para abrir el
                panel lateral con los exámenes disponibles e inscribirte.
              </p>
            </div>
          </header>

          <PlacementContent />
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}

/* ============ Contenido ============ */
function PlacementContent() {
  // Sheet de exámenes
  const [openSheet, setOpenSheet] = useState(false);

  // Exámenes
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<PlacementExam[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mis registros
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [regs, setRegs] = useState<PlacementRegistro[]>([]);
  const [regsError, setRegsError] = useState<string | null>(null);

  // Diálogo/estado de inscripción
  const [openDialog, setOpenDialog] = useState(false);
  const [selected, setSelected] = useState<PlacementExam | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Campos del formulario
  const [referencia, setReferencia] = useState("");
  const [importePesos, setImportePesos] = useState<string>(""); // pesos con decimales
  const [fechaPago, setFechaPago] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ====== carga de exámenes ======
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const urlPublic = `${API_BASE}/placement-exams/public?page=1&page_size=20`;
        const dataPublic = await fetchJSON(urlPublic);
        if (!ignore) setExams((dataPublic?.items ?? []) as PlacementExam[]);
        if (DEBUG && !ignore) console.debug("[PUBLIC exams] items:", dataPublic?.items);
      } catch (e: any) {
        console.warn("[placement-exams/public] falló, fallback:", e?.message || e);
        try {
          const urlFallback = `${API_BASE}/placement-exams?page=1&page_size=20&estado=activo`;
          const dataFallback = await fetchJSON(urlFallback);
          if (!ignore) setExams((dataFallback?.items ?? []) as PlacementExam[]);
          if (DEBUG && !ignore) console.debug("[FALLBACK exams] items:", dataFallback?.items);
        } catch (e2: any) {
          if (!ignore) setError(e2?.message || "No se pudo cargar la lista.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // ====== carga de mis registros ======
  const loadMyRegs = async () => {
    setLoadingRegs(true);
    setRegsError(null);
    try {
      const data = await apiFetch<PlacementRegistro[]>(
        `${API_BASE}/placement-exams/mis-registros`,
        { auth: true }
      );
      if (DEBUG) {
        console.groupCollapsed("[mis-registros] respuesta");
        console.table(data);
        console.log(data);
        console.groupEnd();
      }
      setRegs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.message || "No se pudieron cargar tus registros.";
      setRegsError(msg);
      toast.error(msg);
      if (DEBUG) console.error("[mis-registros] error:", e);
    } finally {
      setLoadingRegs(false);
    }
  };

  useEffect(() => {
    loadMyRegs();
  }, []);

  const onOpenInscribir = (exam: PlacementExam) => {
    setSelected(exam);
    setReferencia("");
    setImportePesos("");
    setFechaPago("");
    if (fileRef.current) fileRef.current.value = "";
    setSubmitErr(null);
    setSuccessMsg(null);
    setOpenDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    setSubmitErr(null);
    setSuccessMsg(null);

    try {
      const pesos = parseFloat(importePesos.replace(",", "."));
      if (!referencia.trim()) throw new Error("Referencia requerida.");
      if (!fechaPago) throw new Error("Fecha de pago requerida (YYYY-MM-DD).");
      if (!Number.isFinite(pesos) || pesos < 0)
        throw new Error("Importe inválido (usa pesos, p.ej. 500 o 500.50).");
      const decOk = /^\d+(\.\d{1,2})?$/.test(String(pesos));
      if (!decOk) throw new Error("El importe solo admite 2 decimales.");

      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Comprobante requerido (PDF/JPG/PNG/WEBP).");

      const importeCentavos = Math.round(pesos * 100);

      const fd = new FormData();
      fd.append("referencia", referencia.trim());
      fd.append("importe_centavos", String(importeCentavos));
      fd.append("fecha_pago", fechaPago);
      fd.append("comprobante", file);

      const url = `${API_BASE}/placement-exams/${selected.id}/registros`;
      await apiFetch(url, { method: "POST", body: fd, auth: true });

      toast.success("¡Tu preinscripción fue registrada!");
      setSuccessMsg("¡Tu preinscripción fue registrada!");
      setOpenDialog(false);
      await loadMyRegs();
    } catch (e: any) {
      const msg = e?.message || "No se pudo enviar tu solicitud.";
      setSubmitErr(msg);
      toast.error(msg);
      if (DEBUG) console.error("[create_registro] error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const hasData = useMemo(() => exams && exams.length > 0, [exams]);

  // ====== acciones sobre mis registros ======
  const handleCancel = async (regId: number) => {
    if (!confirm("¿Deseas cancelar esta inscripción?")) return;
    try {
      await apiFetch(`${API_BASE}/placement-exams/registros/${regId}`, {
        method: "DELETE",
        auth: true,
      });
      toast.success("Registro cancelado.");
      await loadMyRegs();
    } catch (e: any) {
      const msg = e?.message || "No se pudo cancelar el registro.";
      toast.error(msg);
      if (DEBUG) console.error("[cancel_registro] error:", e);
    }
  };

  const handleDownload = async (regId: number) => {
    try {
      await downloadPlacementComprobante(regId);
      toast.success("Comprobante descargado.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo descargar el comprobante.");
      if (DEBUG) console.error("[download_comprobante] error:", e);
    }
  };

  function nivelTone(n: string) {
    const k = n.toUpperCase();
    if (k === "A1" || k === "A2") return "secondary"; // verdes/azules claros
    if (k === "B1" || k === "B2") return "default";   // gris/primario
    if (k === "C1" || k === "C2") return "destructive"; // rojo para destacar avanzado
    return "outline"; // fallback
  }


  return (
    <>
      {/* ——— Barra de acciones: botón que abre el sheet ——— */}
      <div className="flex justify-end">
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetTrigger asChild>
            <Button variant="outline">Ver exámenes</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>Exámenes disponibles</SheetTitle>
              <SheetDescription>
                Solo se muestran exámenes activos y con cupo disponible.
              </SheetDescription>
            </SheetHeader>

            <div className="pb-6">
              {loading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : error ? (
                <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
              ) : !hasData ? (
                <p className="text-sm text-muted-foreground">
                  No hay exámenes activos por ahora.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Idioma</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Salón</TableHead>
                        <TableHead>Cupo</TableHead>
                        <TableHead>Costo</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.map((ex) => (
                        <TableRow key={ex.id}>
                          <TableCell className="font-medium">
                            {ex.codigo || ex.nombre || `#${ex.id}`}
                          </TableCell>
                          <TableCell>{ex.idioma ?? "—"}</TableCell>
                          <TableCell>{ex.fecha ?? "—"}</TableCell>
                          <TableCell>{ex.hora ?? "—"}</TableCell>
                          <TableCell>{ex.salon ?? "—"}</TableCell>
                          <TableCell>{ex.cupo_total ?? "—"}</TableCell>
                          <TableCell>
                            {typeof ex.costo === "number"
                              ? ex.costo.toLocaleString("es-MX", {
                                  style: "currency",
                                  currency: "MXN",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => onOpenInscribir(ex)}>
                              Inscribirme
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* ——— Mis registros (contenido principal) ——— */}
      <TooltipProvider delayDuration={150}>
        <Card>
          <CardHeader>
            <CardTitle>Mis registros</CardTitle>
            <CardDescription>
              Consulta el estado, descarga tu comprobante o cancela tu registro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRegs ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : regsError ? (
              <p className="text-sm text-red-600 whitespace-pre-wrap">
                {regsError}
              </p>
            ) : regs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no tienes registros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Examen</TableHead>
                      <TableHead>Fecha pago</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Importe</TableHead>
                      <TableHead>Nivel asignado</TableHead>{/* 👈 NUEVA */}
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.exam?.codigo ?? `#${r.exam_id}`}
                        </TableCell>
                        <TableCell>{r.fecha_pago ?? "—"}</TableCell>
                        <TableCell>{r.referencia ?? "—"}</TableCell>
                        <TableCell>
                          {typeof r.importe_centavos === "number"
                            ? (r.importe_centavos / 100).toLocaleString("es-MX", {
                                style: "currency",
                                currency: "MXN",
                              })
                            : "—"}
                        </TableCell>

                        {/* 👇 Nueva celda: muestra el nivel normalizado */}
                        <TableCell>
                          {(() => {
                            const nivel = getNivelAsignado(r);
                            return nivel === "—" ? (
                              <Badge variant="outline" className="text-xs">—</Badge>
                            ) : (
                              <Badge
                                variant={nivelTone(nivel)}
                                className="text-xs tracking-wide"
                                title="Asignado por el docente"
                              >
                                {nivel}
                              </Badge>
                            );
                          })()}
                        </TableCell>

                        <TableCell>
                          <StatusCell registro={r} />
                        </TableCell>

                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDownload(r.id)}
                            disabled={!r.comprobante}
                            title={!r.comprobante ? "Sin comprobante" : ""}
                          >
                            Descargar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancel(r.id)}
                            disabled={r.status !== "preinscrita"}
                            title={
                              r.status !== "preinscrita"
                                ? "Solo puedes cancelar mientras está preinscrita"
                                : ""
                            }
                          >
                            Cancelar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* ——— Diálogo de inscripción ——— */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Inscripción a examen</DialogTitle>
            <DialogDescription>
              Carga tu comprobante de pago. Formatos permitidos: PDF/JPG/PNG/WEBP
              (máx. 5&nbsp;MB).
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Examen</Label>
              <div className="text-sm font-medium">
                {selected
                  ? `${selected.codigo || selected.nombre} · ${
                      selected.fecha || "—"
                    } ${selected.hora || ""}`
                  : "—"}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="referencia">Referencia</Label>
                <Input
                  id="referencia"
                  placeholder="Ej. 123ABC"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="importe">Importe (pesos MXN)</Label>
                <Input
                  id="importe"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="Ej. 500 o 500.50"
                  value={importePesos}
                  onChange={(e) => setImportePesos(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fecha_pago">Fecha de pago</Label>
                <Input
                  id="fecha_pago"
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="comprobante">Comprobante</Label>
                <Input
                  id="comprobante"
                  type="file"
                  ref={fileRef}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  required
                />
              </div>
            </div>
          </div>

          {submitErr && <p className="text-sm text-red-600">{submitErr}</p>}
          {successMsg && (
            <p className="text-sm text-green-600">{successMsg}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpenDialog(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                "Enviar inscripción"
              )}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ===== Helpers ===== */
async function fetchJSON(url: string) {
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  const ct = resp.headers.get("content-type") || "";
  const bodyText = await resp.text();
  const body = ct.includes("application/json") ? safeParse(bodyText) : bodyText;

  if (!resp.ok) {
    throw new Error(
      typeof body === "string"
        ? `HTTP ${resp.status}: ${body}`
        : `HTTP ${resp.status}: ${JSON.stringify(body)}`
    );
  }
  return typeof body === "string" ? safeParse(body) : body;
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function prettyStatus(s: string) {
  switch ((s || "").toLowerCase()) {
    case "preinscrita":
      return "Preinscrita";
    case "validada":
      return "Validada";
    case "rechazada":
      return "Rechazada";
    case "cancelada":
      return "Cancelada";
    default:
      return s || "—";
  }
}

function statusMeta(s: string) {
  const k = (s || "").toLowerCase();
  switch (k) {
    case "preinscrita":
      return { key: k, label: "Preinscrita", tone: "amber", Icon: Clock };
    case "validada":
      return { key: k, label: "Validada", tone: "emerald", Icon: CheckCircle2 };
    case "rechazada":
      return { key: k, label: "Rechazada", tone: "red", Icon: XCircle };
    case "cancelada":
      return { key: k, label: "Cancelada", tone: "slate", Icon: Ban };
    default:
      return { key: k, label: s || "—", tone: "zinc", Icon: Clock };
  }
}

function pillClass(tone: string) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1";
  switch (tone) {
    case "amber":
      return `${base} bg-amber-50 text-amber-700 ring-amber-200`;
    case "emerald":
      return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200`;
    case "red":
      return `${base} bg-red-50 text-red-700 ring-red-200`;
    case "slate":
      return `${base} bg-slate-50 text-slate-700 ring-slate-200`;
    default:
      return `${base} bg-zinc-50 text-zinc-700 ring-zinc-200`;
  }
}

function getRejectionReason(r: any): string {
  const raw =
    r?.rechazo_motivo ??
    r?.motivo_rechazo ??
    r?.validation_notes ??
    r?.motivo ??
    r?.reject_reason ??
    "";

  const txt = (typeof raw === "string" ? raw : String(raw ?? "")).trim();
  if (txt) return txt;

  // Si está rechazada pero no vino motivo, devolvemos un fallback
  if ((r?.status || "").toLowerCase() === "rechazada") {
    return "Motivo no disponible. Contacta a coordinación si necesitas más detalle.";
  }
  return "";
}

/* Normaliza el nivel asignado desde varias llaves posibles */
function getNivelAsignado(r: PlacementRegistro): string {
  const raw =
    r.nivel_idioma ??
    r.nivel_asignado ??
    r.nivel ??
    (r as any)?.alumno_nivel ??
    null;
  if (!raw) return "—";
  return String(raw).trim().toUpperCase();
}

/* ===== Celda de status con depuración ===== */
function StatusCell({ registro }: { registro: PlacementRegistro }) {
  const meta = statusMeta(registro.status);
  const { Icon } = meta;
  const reason = getRejectionReason(registro);

  // 🔧 Ahora el tooltip se muestra si es rechazada (el reason nunca será vacío gracias al fallback)
  const showTooltip = meta.key === "rechazada";

  const badge = (
    <span
      className={pillClass(meta.tone) + (showTooltip ? " cursor-help" : "")}
      title={showTooltip ? reason : undefined} // fallback nativo
      tabIndex={showTooltip ? 0 : -1}
      role={showTooltip ? "button" : "status"}
      aria-label={showTooltip ? `Rechazada. Motivo: ${reason}` : meta.label}
      data-status={meta.key}
      data-has-reason={String(!!reason)}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-[min(80vw,420px)] text-sm"
        >
          <div className="font-medium mb-1">Motivo del rechazo</div>
          <p className="whitespace-pre-wrap break-words max-h-60 overflow-auto">
            {reason}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <div className="flex items-center gap-2">{badge}</div>;
}
