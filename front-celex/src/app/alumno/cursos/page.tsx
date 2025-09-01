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
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";

// Solo este ícono se usa en esta página
import { Loader2 } from "lucide-react";

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

// Fecha corta tipo 31/ago/25
const dShort = (s?: string | null) => {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  const day = dt.toLocaleString("es-MX", { day: "2-digit" });
  const month = dt.toLocaleString("es-MX", { month: "short" }).replace(/\./g, "");
  const year = dt.toLocaleString("es-MX", { year: "2-digit" });
  return `${day}/${month}/${year}`;
};

// Hora "HH:MM(:SS)" -> "HH:MM"
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "—");

// Días abreviados
const abrevDia = (k: string) =>
  ({ lunes:"Lun", martes:"Mar", miercoles:"Mié", jueves:"Jue", viernes:"Vie", sabado:"Sáb", domingo:"Dom" } as Record<string,string>)[k] ?? k;

// De "Idioma.ingles" -> "ingles"
const enumVal = (s?: string | null) =>
  s ? s.split(".").pop()!.replace(/_/g, " ") : "—";

// map de estilos por estatus
function statusBadge(status: InscripcionDTO["status"]) {
  switch (status) {
    case "confirmada":
      return { label: "Confirmada", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "preinscrita" as any:
      return { label: "Preinscrita", className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "registrada":
      return { label: "Registrada", className: "bg-sky-100 text-sky-800 border-sky-200" };
    case "rechazada":
      return { label: "Rechazada", className: "bg-red-100 text-red-800 border-red-200" };
    case "cancelada" as any:
      return { label: "Cancelada", className: "bg-neutral-100 text-neutral-700 border-neutral-200" };
    default:
      return { label: status, className: "bg-neutral-100 text-neutral-700 border-neutral-200" };
  }
}

// reglas para permitir cancelar desde el front
const puedeCancelar = (status: InscripcionDTO["status"]) =>
  status === "registrada" || (status as any) === "preinscrita";

/* ========== mini componentes ========== */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="text-neutral-500 text-right">{label}</div>
      <div className="truncate">{children}</div>
    </>
  );
}

function ChipsGrupo({ x }: { x: InscripcionDTO }) {
  if (!x.ciclo) return null;
  const horaInicio = hhmm(x.ciclo.hora_inicio);
  const horaFin = hhmm(x.ciclo.hora_fin);
  const aula = (x.ciclo.aula ?? "").trim(); // evita mostrar vacío

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] sm:flex-nowrap">
      {/* Idioma */}
      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700 whitespace-nowrap" title="Idioma">
        🌐
        <span className="capitalize">{enumVal(x.ciclo.idioma)}</span>
      </span>

      {/* Modalidad */}
      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700 whitespace-nowrap" title="Modalidad">
        🎓
        <span className="capitalize">{enumVal(x.ciclo.modalidad)}</span>
      </span>

      {/* Turno */}
      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700 whitespace-nowrap" title="Turno">
        ⏰
        <span className="capitalize">{enumVal(x.ciclo.turno)}</span>
      </span>

      {/* Horario */}
      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700 whitespace-nowrap" title="Horario">
        🕒
        <span className="whitespace-nowrap">{horaInicio}–{horaFin}</span>
      </span>

      {/* Aula (si aplica) */}
      {aula && (
        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700 whitespace-nowrap" title="Aula">
          🏫
          <span className="whitespace-nowrap">{aula}</span>
        </span>
      )}
    </div>
  );
}

/* ========== página ========== */
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
      [...rows].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta; // más reciente primero
      }),
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
            <p className="text-neutral-600 mt-1">
              Consulta los grupos en los que te inscribiste y el estatus de tu inscripción.
            </p>
          </div>

          <Separator />

          {loading ? (
            <div className="rounded-xl border bg-white/70 p-6 text-sm text-neutral-600 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : ordered.length === 0 ? (
            <div className="rounded-xl border bg-white/70 p-8 text-center">
              <p className="text-sm text-neutral-600">Aún no tienes inscripciones registradas.</p>
              <p className="text-xs text-neutral-500 mt-1">Cuando te inscribas a un grupo, lo verás aquí.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ordered.map((x) => {
                const badge = statusBadge(x.status);
                return (
                  <div
                    key={x.id}
                    className="rounded-2xl border bg-white/70 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* HEADER */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold tracking-tight truncate">
                          {x.ciclo?.codigo ?? `Ciclo #${x.ciclo_id}`}
                        </div>
                        <ChipsGrupo x={x} />
                      </div>

                      <div className="shrink-0 self-start sm:self-auto">
                        <Badge className={`rounded-full border px-3 ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </div>
                    </div>

                    {/* BODY */}
                    {x.ciclo && (
                      <>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-[120px,1fr] gap-x-3 gap-y-1 text-xs text-neutral-800">
                          <FieldRow label="Días">
                            {(x.ciclo.dias ?? []).map(abrevDia).join(" • ") || "—"}
                          </FieldRow>
                          <FieldRow label="Curso">
                            {x.ciclo.curso
                              ? `${dShort(x.ciclo.curso.from)} – ${dShort(x.ciclo.curso.to)}`
                              : "—"}
                          </FieldRow>
                        </div>
                      </>
                    )}

                    {/* META */}
                    <Separator className="my-3" />
                    <div className="grid grid-cols-[120px,1fr] gap-x-3 gap-y-1 text-[11px] text-neutral-700">
                      <FieldRow label="Inscrito el">{fmtDateTime(x.created_at)}</FieldRow>
                      <FieldRow label="ID inscripción">{x.id}</FieldRow>
                    </div>

                    {/* FOOTER */}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" disabled>
                        Ver detalle
                      </Button>

                      {puedeCancelar(x.status) ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200"
                              disabled={cancelingId === x.id}
                            >
                              {cancelingId === x.id ? "Cancelando…" : "Cancelar"}
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
                  </div>
                );
              })}
            </div>
          )}

          {/* Notas */}
          <div className="text-[12px] text-neutral-500 mt-2">
            <span className="font-medium">Estados:</span> Registrada = solicitud creada · Preinscrita = pago enviado (en revisión) ·
            Confirmada = lugar asegurado · Rechazada = pago no válido · Cancelada = anulada por el alumno.
          </div>
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}
