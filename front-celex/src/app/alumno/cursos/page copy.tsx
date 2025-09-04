"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import { listMisInscripciones, cancelarInscripcion } from "@/lib/api";
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
} from "lucide-react";

/* ========== helpers de formato ========== */
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

/* ========== UI helpers ========== */
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

/* ========== Tarjeta de inscripción con cards ========== */
function InscripcionCard({
  x,
  onCancel,
  canceling,
}: {
  x: InscripcionDTO;
  onCancel: (id: number) => void;
  canceling: boolean;
}) {
  const meta = statusMeta(x.status);
  const tone = toneClasses(meta.tone);

  const horaInicio = hhmm(x.ciclo?.hora_inicio);
  const horaFin = hhmm(x.ciclo?.hora_fin);
  const dias = (x.ciclo?.dias ?? []).map(abrevDia).join(" · ") || "—";
  const puedeCancelar = x.status === "registrada" || (x.status as any) === "preinscrita";

  // Fechas para Calendario
  const curso = x.ciclo?.curso ? `${dShort(x.ciclo.curso.from)} – ${dShort(x.ciclo.curso.to)}` : "—";
  const insc = x.ciclo?.inscripcion ? `${dShort(x.ciclo.inscripcion.from)} – ${dShort(x.ciclo.inscripcion.to)}` : "—";

  // Docente (fallbacks)
  const docente =
    x.ciclo?.docente_nombre ??
    (x as any)?.ciclo?.docente ??
    (x as any)?.ciclo?.profesor ??
    (x as any)?.ciclo?.teacher ??
    null;

  const isExencion = x.tipo === "exencion";

  return (
    <article className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${tone.stripe}`} />

      {/* Encabezado: ciclo, estatus, Grupo compacto + calificación */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold tracking-tight truncate">
              {x.ciclo?.codigo ?? `Ciclo #${x.ciclo_id}`}
            </h3>
            <Badge className={`rounded-full border px-3 ${tone.badge}`}>{meta.label}</Badge>

            {/* NUEVO: tipo de trámite */}
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

            {/* Docente destacado */}
            <div className="flex items-center gap-2 col-span-2">
              <User className="h-4 w-4 opacity-70" />
              <Badge variant="secondary" className="text-sm font-medium px-3 py-1 rounded-full">
                {docente ?? "—"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="md:w-32">
          <div className="text-[11px] text-neutral-500 mb-1 text-right">Calificación</div>
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
              <p className="font-medium text-neutral-900">
                {dShort(x.ciclo?.examenMT ?? null)}
              </p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Examen final</p>
              <p className="font-medium text-neutral-900">
                {dShort(x.ciclo?.examenFinal ?? null)}
              </p>
            </div>
          </div>
        </div>

        {/* Trámite: Pago o Exención */}
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
            // ===== EXENCIÓN =====
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-neutral-500 text-xs">Tipo</p>
                <p className="font-medium text-neutral-900">Exención de pago</p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Comprobante de exención</p>
                <p className="font-medium text-neutral-900">
                  {x.comprobante_exencion?.filename ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Estado</p>
                <div className="flex items-center gap-2 font-medium text-neutral-900">
                  <Info className="h-3.5 w-3.5 opacity-70" />
                  <span>{meta.label}</span>
                </div>
              </div>
            </div>
          ) : (
            // ===== PAGO =====
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-neutral-500 text-xs">Referencia</p>
                <p className="font-medium text-neutral-900 truncate">
                  {x.referencia ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Importe</p>
                <p className="font-medium text-neutral-900">
                  {fmtMXNfromCentavos(x.importe_centavos)}
                </p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Comprobante de pago</p>
                <p className="font-medium text-neutral-900">
                  {x.comprobante?.filename ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Estado</p>
                <div className="flex items-center gap-2 font-medium text-neutral-900">
                  <Info className="h-3.5 w-3.5 opacity-70" />
                  <span>{meta.label}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <Separator className="my-4" />

      {/* Footer: metadatos + acciones */}
      <footer className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1 text-[11px] text-neutral-700">
          <div>
            Inscrito el: <b>{fmtDateTime(x.created_at)}</b>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Ver detalle
          </Button>

          {puedeCancelar ? (
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
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => onCancel(x.id)}
                  >
                    Sí, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" size="sm" disabled>
              No cancelable
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}

/* ========== Página ========== */
export default function Page() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InscripcionDTO[]>([]);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await listMisInscripciones();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "No se pudieron cargar tus cursos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const ordered = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ),
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
      toast.error(e?.message || "No se pudo cancelar la inscripción");
    } finally {
      setCancelingId(null);
    }
  };

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
                />
              ))}
            </div>
          )}
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}
