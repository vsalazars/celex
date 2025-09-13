"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import {
  listMisInscripciones,
  cancelarInscripcion,
  downloadArchivoInscripcion, // para ArchivoLink
  apiFetch, // para encuesta
} from "@/lib/api";
import { API_URL } from "@/lib/constants";
import type { InscripcionDTO } from "@/lib/api";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

import {
  Loader2,
  Info,
  Globe,
  BookOpen,
  Clock3,
  Building2,
  GraduationCap,
  CalendarDays,
  Receipt,
  User,
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";

/* ====================== Tipos de encuesta (front) ====================== */
type SurveyQuestionType = "likert_1_5" | "yes_no" | "open_text" | "scale_0_10";

type SurveyCategory = {
  id: number;
  name: string;
  description?: string | null;
  order: number;
  active: boolean;
};

type SurveyQuestion = {
  id: number;
  category_id: number;
  text: string;
  help_text?: string | null;
  type: SurveyQuestionType;
  required: boolean;
  active: boolean;
  order: number;
};

type SurveyAnswerItem = { question_id: number; value: string | number | boolean };

type SurveyPayload = {
  inscripcion_id: number;
  answers: SurveyAnswerItem[];
  // opcional: lo enviamos si no hay pregunta open_text de comentarios
  comments?: string;
};

/* ====================== Helpers de formato ====================== */
const fmtDateTime = (iso?: string) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt
    .toLocaleString("es-MX", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/\./g, "");
};

const dShort = (s?: string | null) => {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  const day = dt.toLocaleString("es-MX", { day: "2-digit" });
  const month = dt.toLocaleString("es-MX", { month: "short" }).replace(/\./g, "");
  const year = dt.toLocaleString("es-MX", { year: "2-digit" });
  return `${day}/${month}/${year}`;
};

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "—");

const abrevDia = (k: string) =>
  ({
    lunes: "Lun",
    martes: "Mar",
    miercoles: "Mié",
    jueves: "Jue",
    viernes: "Vie",
    sabado: "Sáb",
    domingo: "Dom",
  } as Record<string, string>)[k] ?? k;

const enumVal = (s?: string | null) => (s ? s.split(".").pop()!.replace(/_/g, " ") : "—");

const fmtMXNfromCentavos = (cent?: number | null) =>
  cent == null
    ? "—"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 2,
      }).format(cent / 100);

/* === Helper de errores === */
function errorToText(e: any) {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  if (e.detail) return typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail);
  if (e.message && typeof e.message === "string" && e.message !== "[object Object]") return e.message;
  if (e.error?.message) return e.error.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/* === Helper para motivo de rechazo === */
function getRejectReason(x: InscripcionDTO): string | null {
  // intentamos múltiples campos/alias por retrocompatibilidad
  const cand =
    x.rechazo_motivo ??
    (x as any).rechazoMotivo ??
    x.validation_notes ??
    (x as any).validationNotes ??
    (x as any).validation_notes ??
    null;
  const s = cand != null ? String(cand).trim() : "";
  return s.length ? s : null;
}

/** Construye respuestas con el campo único "value" que espera el backend */
function buildAnswers(
  answers: Record<number, string>,
  questions: { id: number; type: SurveyQuestionType }[]
): SurveyAnswerItem[] {
  return Object.entries(answers).map(([qid, raw]) => {
    const q = questions.find((qq) => qq.id === Number(qid));
    let value: string | number | boolean = String(raw ?? "");
    if (q) {
      if (q.type === "likert_1_5" || q.type === "scale_0_10") {
        const n = Number(raw);
        value = isNaN(n) ? 0 : n;
      } else if (q.type === "yes_no") {
        value = String(raw) === "yes";
      } else {
        value = String(raw ?? "").trim(); // open_text
      }
    }
    return { question_id: Number(qid), value };
  });
}

/* ================= ArchivoLink ================= */
type ArchivoMeta = {
  filename?: string | null;
  mimetype?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
};

function ArchivoLink({
  inscId,
  tipo,
  meta,
  label,
}: {
  inscId: number;
  tipo: "comprobante" | "estudios" | "exencion";
  meta?: ArchivoMeta | null;
  label?: string;
}) {
  if (!meta?.filename) {
    return <p className="font-medium text-neutral-900">—</p>;
  }

  const prettySize =
    typeof meta.size_bytes === "number" && meta.size_bytes >= 0
      ? `${(meta.size_bytes / 1024).toFixed(0)} KB`
      : undefined;

  const defaultLabel =
    label ??
    (tipo === "comprobante"
      ? "pago"
      : tipo === "estudios"
      ? "estudios"
      : "exención");

  const handleClick = async () => {
    try {
      await downloadArchivoInscripcion(inscId, tipo, meta.filename as string);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo abrir el archivo");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group inline-flex items-center gap-1.5 text-sky-700 hover:text-sky-800 hover:underline font-medium"
      title={[meta.filename, prettySize ? `(${prettySize})` : null].filter(Boolean).join(" ")}
    >
      <span className="sr-only">{meta.filename}</span>
      <svg
        className="h-4 w-4 opacity-80 group-hover:opacity-100"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
        <path d="M17 3v4h4" />
        <path d="M12 11v6" />
        <path d="M9 14h6" />
      </svg>
      <span>{defaultLabel}</span>
    </button>
  );
}

/* ================= UI helpers ================= */
function statusMeta(status: InscripcionDTO["status"]) {
  switch (status) {
    case "confirmada":
      return { label: "Confirmada", tone: "emerald" as const, step: 2 };
    case "preinscrita" as any:
      return { label: "Preinscrita", tone: "amber" as const, step: 1 };
    case "registrada":
      return { label: "Registrada", tone: "sky" as const, step: 0 };
    case "rechazada":
      return { label: "Rechazada", tone: "red" as const, step: 2 };
    case "cancelada" as any:
      return { label: "Cancelada", tone: "neutral" as const, step: 2 };
    default:
      return { label: String(status), tone: "neutral" as const, step: 0 };
  }
}

function toneClasses(tone: ReturnType<typeof statusMeta>["tone"]) {
  const map = {
    emerald: { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", stripe: "bg-emerald-500/80" },
    amber: { badge: "bg-amber-100 text-amber-800 border-amber-200", stripe: "bg-amber-500/80" },
    sky: { badge: "bg-sky-100 text-sky-800 border-sky-200", stripe: "bg-sky-500/80" },
    red: { badge: "bg-red-100 text-red-800 border-red-200", stripe: "bg-red-500/80" },
    neutral: { badge: "bg-neutral-100 text-neutral-700 border-neutral-200", stripe: "bg-neutral-500/70" },
  } as const;
  return map[tone];
}

/* ================= Tarjeta de inscripción (con botón de encuesta) ================= */
function InscripcionCard({
  x,
  onCancel,
  canceling,
  onOpenSurvey,
  surveyAvailable,
  surveySubmitted,
  openingFor,
}: {
  x: InscripcionDTO;
  onCancel: (id: number) => void;
  canceling: boolean;
  onOpenSurvey: (insc: InscripcionDTO) => void;
  surveyAvailable: boolean;
  surveySubmitted: boolean;
  openingFor: number | null;
}) {
  const meta = statusMeta(x.status);
  const tone = toneClasses(meta.tone);

  const horaInicio = hhmm(x.ciclo?.hora_inicio);
  const horaFin = hhmm(x.ciclo?.hora_fin);
  const dias = (x.ciclo?.dias ?? []).map(abrevDia).join(" · ") || "—";

  const curso = x.ciclo?.curso ? `${dShort(x.ciclo.curso.from)} – ${dShort(x.ciclo.curso.to)}` : "—";
  const insc = x.ciclo?.inscripcion ? `${dShort(x.ciclo.inscripcion.from)} – ${dShort(x.ciclo.inscripcion.to)}` : "—";

  const docente =
    (x as any)?.ciclo?.docente_nombre ??
    (x as any)?.ciclo?.docente ??
    (x as any)?.ciclo?.profesor ??
    (x as any)?.ciclo?.teacher ??
    null;

  const isExencion = (x as any).tipo === "exencion";
  const rejectReason = x.status === "rechazada" ? getRejectReason(x) : null;

  return (
    <article className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${tone.stripe}`} />

      {/* Encabezado */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold tracking-tight truncate">
              {x.ciclo?.codigo ?? `Ciclo #${x.ciclo_id}`}
            </h3>
            <Badge className={`rounded-full border px-3 ${tone.badge}`}>{meta.label}</Badge>
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
              Trámite: {isExencion ? "Exención" : "Pago"}
            </Badge>
          </div>

          {/* Grupo */}
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-neutral-700">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 opacity-70" />
              <span>{x.ciclo ? enumVal(x.ciclo.idioma) : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 opacity-70" />
              <span>{x.ciclo?.nivel ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 opacity-70" />
              <span>{x.ciclo ? enumVal(x.ciclo.modalidad) : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 opacity-70" />
              <span>{x.ciclo ? `${horaInicio}–${horaFin}` : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 opacity-70" />
              <span>{x.ciclo?.aula ?? "—"}</span>
            </div>

            <div className="col-span-2 text-xs text-neutral-600">{dias !== "—" ? `Días: ${dias}` : ""}</div>

            <div className="flex items-center gap-2 col-span-2">
              <User className="h-4 w-4 opacity-70" />
              <Badge variant="secondary" className="text-sm font-medium px-3 py-1 rounded-full">
                {docente ?? "—"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="md:w-32">
          <div className="text:[11px] text-neutral-500 mb-1 text-right">Calificación</div>
          <div className="flex items-center justify-end">
            <div className="h-9 w-16 rounded-xl border border-dashed text-sm font-semibold grid place-items-center text-neutral-700">
              —
            </div>
          </div>
          <div className="text-[10px] text-neutral-400 mt-1 text-right">(se asigna al finalizar)</div>
        </div>
      </header>

      <Separator className="my-4" />

      {/* Cards: Calendario y Trámite */}
      <section className="grid gap-3 md:grid-cols-2">
        {/* Calendario */}
        <div className="rounded-2xl border bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-neutral-900">Calendario</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs">Inscripción</p>
              <p className="font-medium text-neutral-900">{insc}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Curso</p>
              <p className="font-medium text-neutral-900">{curso}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Examen MT</p>
              <p className="font-medium text-neutral-900">{dShort(x.ciclo?.examenMT ?? null)}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Examen final</p>
              <p className="font-medium text-neutral-900">{dShort(x.ciclo?.examenFinal ?? null)}</p>
            </div>
          </div>
        </div>

        {/* Trámite */}
        <div className="rounded-2xl border bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            {isExencion ? (
              <ShieldCheck className="h-4 w-4 text-amber-600" />
            ) : (
              <Receipt className="h-4 w-4 text-emerald-600" />
            )}
            <h3 className="text-sm font-semibold text-neutral-900">Trámite</h3>
          </div>

          {isExencion ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-neutral-500 text-xs">Tipo</p>
                <p className="font-medium text-neutral-900">Exención de pago</p>
              </div>
              <div className="space-y-1">
                <p className="text-neutral-500 text-xs">Comprobante de</p>
                <ArchivoLink inscId={x.id} tipo="exencion" meta={(x as any).comprobante_exencion as any} />
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Estado</p>
                <div className="flex items-center gap-2 font-medium text-neutral-900">
                  <Info className="h-3.5 w-3.5 opacity-70" />
                  <span>{meta.label}</span>
                </div>
              </div>

              {rejectReason && (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
                  <p className="text-[11px] font-semibold text-red-800">Motivo del rechazo</p>
                  <p className="mt-1 text-xs leading-snug text-red-900/90 whitespace-pre-wrap break-words">{rejectReason}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-neutral-500 text-xs">Referencia</p>
                <p className="font-medium text-neutral-900 truncate">{x.referencia ?? "—"}</p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Importe</p>
                <p className="font-medium text-neutral-900">{fmtMXNfromCentavos(x.importe_centavos)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-neutral-500 text-xs">Comprobante de</p>
                <ArchivoLink inscId={x.id} tipo="comprobante" meta={(x as any).comprobante as any} />
              </div>
              {(x as any).comprobante_estudios && (
                <div className="space-y-1">
                  <p className="text-neutral-500 text-xs">Comprobante de</p>
                  <ArchivoLink inscId={x.id} tipo="estudios" meta={(x as any).comprobante_estudios as any} />
                </div>
              )}
              <div>
                <p className="text-neutral-500 text-xs">Estado</p>
                <div className="flex items-center gap-2 font-medium text-neutral-900">
                  <Info className="h-3.5 w-3.5 opacity-70" />
                  <span>{meta.label}</span>
                </div>
              </div>

              {rejectReason && (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
                  <p className="text-[11px] font-semibold text-red-800">Motivo del rechazo</p>
                  <p className="mt-1 text-xs leading-snug text-red-900/90 whitespace-pre-wrap break-words">{rejectReason}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Separator className="my-4" />

      {/* Footer: dos filas (texto y botones) */}
      <footer className="mt-4">
        <div className="grid gap-2">
          <div className="text-[11px] text-neutral-700">
            Inscrito el: <b>{fmtDateTime(x.created_at)}</b>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {surveySubmitted ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Encuesta enviada
              </span>
            ) : surveyAvailable ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => onOpenSurvey(x)}
                disabled={openingFor === x.id}
                className="gap-2"
              >
                <ClipboardList className="h-4 w-4" />
                {openingFor === x.id ? "Abriendo…" : "Evaluar docente"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled title="Disponible al terminar el curso">
                Evaluar docente
              </Button>
            )}

            <Button variant="outline" size="sm" disabled>
              Ver detalle
            </Button>

            {(() => {
              const puedeCancelar = x.status === "registrada" || (x.status as any) === "preinscrita";
              return puedeCancelar ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200"
                      disabled={canceling}
                    >
                      {canceling ? "Cancelando…" : "Cancelar"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar inscripción</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Seguro que deseas cancelar tu inscripción en{" "}
                        <b>{x.ciclo?.codigo ?? `ciclo #${x.ciclo_id}`}</b>? Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Volver</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => onCancel(x.id)}>
                        Sí, cancelar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  No cancelable
                </Button>
              );
            })()}
          </div>
        </div>
      </footer>
    </article>
  );
}

/* ================= Página ================= */
export default function Page() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InscripcionDTO[]>([]);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  // Encuesta: dialog y estados
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyCategories, setSurveyCategories] = useState<SurveyCategory[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentInscripcion, setCurrentInscripcion] = useState<InscripcionDTO | null>(null);
  const [openingFor, setOpeningFor] = useState<number | null>(null);
  const [submittedMap, setSubmittedMap] = useState<Record<number, boolean>>({});

  // wizard 1x1
  const [qIndex, setQIndex] = useState(0);
  // comentarios adicionales (opcional)
  const [extraComments, setExtraComments] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await listMisInscripciones();
      const items = Array.isArray(data) ? data : [];
      setRows(items);

      try {
        const ids = items.map((r) => r.id);
        if (ids.length) {
          const resp = await apiFetch(`${API_URL}/alumno/encuestas/estado?inscripcion_ids=${ids.join(",")}`, { auth: true });
          const map: Record<number, boolean> =
            resp?.map ??
            (Array.isArray(resp?.submitted)
              ? Object.fromEntries((resp.submitted as number[]).map((id: number) => [id, true]))
              : {});
          setSubmittedMap(map);
        } else {
          setSubmittedMap({});
        }
      } catch {
        setSubmittedMap({});
      }
    } catch (e: any) {
      console.error(e);
      toast.error(errorToText(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const ordered = useMemo(
    () =>
      [...rows].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    [rows]
  );

  const onCancel = async (id: number) => {
    setCancelingId(id);
    try {
      await cancelarInscripcion(id);
      toast.success("Inscripción cancelada");
      await fetchRows();
    } catch (e: any) {
      console.error(e);
      toast.error(errorToText(e));
    } finally {
      setCancelingId(null);
    }
  };

  // disponibilidad: terminado y confirmada
  const surveyAvailability: Record<number, boolean> = useMemo(() => {
    const now = new Date();
    const map: Record<number, boolean> = {};
    for (const r of ordered) {
      const fin = r.ciclo?.curso?.to ? new Date(`${r.ciclo.curso.to}T23:59:59`) : null;
      const terminado = fin ? fin.getTime() <= now.getTime() : false;
      const statusOK = r.status === "confirmada";
      map[r.id] = !!(terminado && statusOK);
    }
    return map;
  }, [ordered]);

  // abrir encuesta
  const onOpenSurvey = async (insc: InscripcionDTO) => {
    setOpeningFor(insc.id);
    setCurrentInscripcion(insc);
    setSurveyOpen(true);
    setSurveyLoading(true);
    setAnswers({});
    setExtraComments("");  // <- reset comentarios
    setQIndex(0);
    try {
      const resp = await apiFetch(`${API_URL}/alumno/encuestas/cuestionario?ciclo_id=${insc.ciclo_id}`, { auth: true });
      if (resp?.submitted) {
        setSubmittedMap((m) => ({ ...m, [insc.id]: true }));
        toast.info("Ya enviaste esta encuesta.");
      }
      const cats = (resp?.categories ?? []).filter((c: SurveyCategory) => c.active !== false);
      const qs = (resp?.questions ?? [])
        .filter((q: SurveyQuestion) => q.active !== false)
        .map((q: SurveyQuestion) => ({ ...q, order: Number(q.order ?? 0) }));

      setSurveyCategories(cats);
      setSurveyQuestions(qs);
    } catch (e: any) {
      console.error(e);
      toast.error(errorToText(e));
      setSurveyOpen(false);
    } finally {
      setSurveyLoading(false);
      setOpeningFor(null);
    }
  };

  // flatten ordenado para 1x1
  const flatQs: SurveyQuestion[] = useMemo(() => {
    const cats = [...surveyCategories].sort((a, b) => a.order - b.order);
    const byCat: Record<number, SurveyQuestion[]> = {};
    for (const q of surveyQuestions) {
      if (!byCat[q.category_id]) byCat[q.category_id] = [];
      byCat[q.category_id].push(q);
    }
    for (const cid of Object.keys(byCat)) {
      byCat[Number(cid)].sort((a, b) => a.order - b.order);
    }
    const list: SurveyQuestion[] = [];
    for (const cat of cats) {
      const qs = byCat[cat.id] || [];
      for (const q of qs) list.push(q);
    }
    const orphan = surveyQuestions.filter((q) => !cats.find((c) => c.id === q.category_id));
    orphan.sort((a, b) => a.order - b.order);
    return [...list, ...orphan];
  }, [surveyCategories, surveyQuestions]);

  const questionCount = flatQs.length;
  const currentQ = questionCount > 0 && qIndex >= 0 && qIndex < questionCount ? flatQs[qIndex] : null;
  const currentCat = useMemo(() => {
    if (!currentQ) return null;
    return surveyCategories.find((c) => c.id === currentQ.category_id) || null;
  }, [currentQ, surveyCategories]);

  // navegación
  const canGoPrev = qIndex > 0;
  const canGoNext = qIndex < questionCount - 1;

  const goPrev = () => { if (canGoPrev) setQIndex((i) => i - 1); };
  const goNext = () => {
    if (!currentQ) return;
    const val = answers[currentQ.id];
    if (currentQ.required && (val == null || String(val).trim() === "")) {
      toast.error("Esta pregunta es obligatoria.");
      return;
    }
    if (canGoNext) setQIndex((i) => i + 1);
  };

  // control por tipo
  const renderQuestionControl = (q: SurveyQuestion) => {
    const val = answers[q.id] ?? "";
    const setVal = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }));

    switch (q.type) {
      case "likert_1_5":
        return (
          <RadioGroup
            value={String(val || "")}
            onValueChange={(v) => setVal(v)}
            className="grid grid-cols-5 gap-2 mt-3"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const id = `q${q.id}-${n}`;
              const selected = String(val) === String(n);
              return (
                <Label
                  key={id}
                  htmlFor={id}
                  className={[
                    "flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm cursor-pointer",
                    selected ? "bg-neutral-900 text-white" : "hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <RadioGroupItem value={String(n)} id={id} className="sr-only" />
                  {n}
                </Label>
              );
            })}
          </RadioGroup>
        );

      case "scale_0_10":
        return (
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={10}
              value={val as any}
              onChange={(e) => setVal(e.target.value)}
              className="w-24"
            />
            <span className="text-xs text-neutral-500">0 = Mínimo · 10 = Máximo</span>
          </div>
        );

      case "yes_no":
        return (
          <RadioGroup
            value={String(val || "")}
            onValueChange={(v) => setVal(v)}
            className="mt-3 flex items-center gap-3"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id={`q${q.id}-yes`} value="yes" />
              <Label htmlFor={`q${q.id}-yes`}>Sí</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id={`q${q.id}-no`} value="no" />
              <Label htmlFor={`q${q.id}-no`}>No</Label>
            </div>
          </RadioGroup>
        );

      case "open_text":
      default:
        return (
          <Textarea
            value={String(val)}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Escribe tu comentario…"
            className="mt-3"
          />
        );
    }
  };

  // detecta si hay pregunta de comentarios
  const findCommentQuestion = () => {
    const rx = /coment|sugerenc|observaci/i;
    return (
      flatQs.find((q) => q.type === "open_text" && rx.test(`${q.text} ${q.help_text ?? ""}`)) ||
      null
    );
  };

  // enviar
  const onSubmitSurvey = async () => {
    if (!currentInscripcion) return;

    const missing = flatQs.filter((q) => q.required).filter((q) => {
      const v = answers[q.id];
      return v == null || String(v).trim() === "";
    });
    if (missing.length > 0) {
      toast.error(`Faltan ${missing.length} respuesta(s) obligatoria(s).`);
      return;
    }

    // si hay comentarios extra y existe una pregunta open_text de comentarios, los mapeamos ahí si no fue respondida
    const commentQ = findCommentQuestion();
    if (extraComments.trim().length > 0 && commentQ && !answers[commentQ.id]) {
      answers[commentQ.id] = extraComments.trim();
    }

    const payload: SurveyPayload = {
      inscripcion_id: currentInscripcion.id,
      answers: buildAnswers(answers, flatQs.map((q) => ({ id: q.id, type: q.type }))),
    };

    // si NO existe pregunta de comentarios, enviamos top-level comments (el back puede ignorarlo o guardarlo si lo soporta)
    if (!commentQ && extraComments.trim().length > 0) {
      (payload as any).comments = extraComments.trim();
    }

    try {
      await apiFetch(`${API_URL}/alumno/encuestas/responder`, {
        method: "POST",
        auth: true,
        json: payload, // <-- apiFetch soporta 'json'
      });

      toast.success("¡Gracias! Tu evaluación fue enviada.");
      setSubmittedMap((m) => ({ ...m, [currentInscripcion.id]: true }));
      setSurveyOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(errorToText(e));
    }
  };

  const progressPct = questionCount > 0 ? Math.round(((qIndex + 1) / questionCount) * 100) : 0;

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Mis cursos">
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">Mis cursos</h1>
            <p className="text-neutral-600 mt-1">Tu expediente de cursos e inscripciones.</p>
          </div>

          <Separator />

          {loading ? (
            <div className="rounded-xl border bg-white/70 p-6 text-sm text-neutral-600 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : ordered.length === 0 ? (
            <div className="rounded-2xl border bg-white/70 p-8 text-center">
              <p className="text-sm text-neutral-600">Aún no tienes inscripciones registradas.</p>
              <p className="text-xs text-neutral-500 mt-1">Cuando te inscribas a un grupo, lo verás aquí.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {ordered.map((x) => (
                <InscripcionCard
                  key={x.id}
                  x={x}
                  onCancel={onCancel}
                  canceling={cancelingId === x.id}
                  onOpenSurvey={onOpenSurvey}
                  surveyAvailable={!!surveyAvailability[x.id]}
                  surveySubmitted={!!submittedMap[x.id]}
                  openingFor={openingFor}
                />
              ))}
            </div>
          )}
        </div>
      </AlumnoShell>

      {/* Dialog de Encuesta (1x1) */}
      <Dialog open={surveyOpen} onOpenChange={setSurveyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evaluación del docente</DialogTitle>
            <DialogDescription>Responde cada pregunta y avanza con “Siguiente”.</DialogDescription>
          </DialogHeader>

          {surveyLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-600 py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando encuesta…
            </div>
          ) : !currentInscripcion ? null : questionCount === 0 ? (
            <div className="text-sm text-neutral-600 py-6">No hay preguntas configuradas.</div>
          ) : (
            <div className="space-y-4">
              {/* Contexto */}
              <div className="rounded-xl border bg-neutral-50 p-3 text-sm">
                <div className="font-medium">
                  {currentInscripcion.ciclo?.codigo ?? `Ciclo #${currentInscripcion.ciclo_id}`}
                </div>
                <div className="text-neutral-600">
                  {currentInscripcion.ciclo?.idioma?.toUpperCase()} · {currentInscripcion.ciclo?.nivel} ·{" "}
                  {enumVal(currentInscripcion.ciclo?.modalidad)} · {enumVal(currentInscripcion.ciclo?.turno)}
                </div>
              </div>

              {/* Progreso */}
              <div className="w-full">
                <div className="flex items-center justify-between text-xs text-neutral-600 mb-1">
                  <span>Pregunta {qIndex + 1} de {questionCount}</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-2 bg-neutral-900 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              {/* Categoría actual */}
              {(() => {
                const cat = currentCat;
                if (!cat) return null;
                return (
                  <div className="text-xs font-semibold text-neutral-700">
                    {cat.name}
                    {cat.description ? (
                      <span className="block font-normal text-neutral-500 mt-0.5">{cat.description}</span>
                    ) : null}
                  </div>
                );
              })()}

              {/* Pregunta actual */}
              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{currentQ?.text}</p>
                    {currentQ?.help_text && <p className="text-xs text-neutral-500 mt-1">{currentQ.help_text}</p>}
                  </div>
                  {currentQ?.required && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Obligatoria
                    </span>
                  )}
                </div>
                {currentQ && renderQuestionControl(currentQ)}
              </div>

              {/* Comentarios adicionales (sólo en el último paso) */}
              {qIndex === questionCount - 1 && (
                <div className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Comentarios adicionales (opcional)</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Comparte sugerencias u observaciones generales sobre el curso o el docente.
                      </p>
                    </div>
                  </div>
                  <Textarea
                    value={extraComments}
                    onChange={(e) => setExtraComments(e.target.value)}
                    placeholder="Escribe tus comentarios…"
                    className="mt-3"
                  />
                </div>
              )}

              {/* Navegación */}
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={goPrev} disabled={!canGoPrev}>
                  Anterior
                </Button>

                {canGoNext ? (
                  <div className="flex items-center gap-2">
                    {!currentQ?.required && (
                      <Button variant="ghost" onClick={() => setQIndex((i) => Math.min(i + 1, questionCount - 1))}>
                        Omitir
                      </Button>
                    )}
                    <Button onClick={goNext}>Siguiente</Button>
                  </div>
                ) : (
                  <Button onClick={onSubmitSurvey}>Enviar evaluación</Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSurveyOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireAuth>
  );
}
