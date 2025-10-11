// app/alumno/historial/page.tsx
"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";

import { getAlumnoHistorial } from "@/lib/api";
import { AlumnoHistorialItem } from "@/lib/types";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Loader2,
  CalendarCheck, // Asistencia
  FileText,        // Examen
  ClipboardList,   // Continua
  Calculator,      // Subtotal
  CheckCheck,      // Tarea
  Gauge,           // Promedio
  CalendarDays,    // Fechas
  UserRound,       // Docente
  Languages,
  GraduationCap,
  Clock,
  Layers,
} from "lucide-react";

/* ===================== Helpers ===================== */
function fmt(n?: number | null, digits = 1) {
  if (n === null || n === undefined) return "—";
  return Number.isInteger(n) ? `${n}` : Number(n).toFixed(digits);
}
function badge(n?: number | null, max?: number) {
  if (n === null || n === undefined) return "—";
  if (typeof max === "number") return <span className="text-[#7c0040]">{`${fmt(n)}/${max}`}</span>;
  return <span className="text-[#7c0040]">{fmt(n)}</span>;
}
function toneClasses(n?: number | null) {
  if (n === null || n === undefined) {
    return "bg-muted text-muted-foreground";
  }
  return n < 80
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
}
function capFirst(s?: string | null) {
  const t = (s ?? "").toString().trim();
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function cleanPrefixed(
  val?: string | null,
  expect?: "Idioma" | "Nivel" | "Turno" | "Modalidad"
) {
  if (!val) return "—";
  const s = String(val).trim();
  if (!expect) return s || "—";
  const rx = new RegExp(`^${expect}\\.?\\s*`, "i");
  return s.replace(rx, "") || "—";
}

/* ====== Nivel → etiqueta completa ====== */
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
  const found = Object.entries(NIVEL_LABELS).find(
    ([, v]) => v.toLowerCase() === t.toLowerCase()
  );
  return found ? found[0] : null;
}
function nivelFullLabel(n?: string | null) {
  const key = normalizeNivelKey(n);
  return key ? NIVEL_LABELS[key] : n || "—";
}

/* ====== Fechas amigables (solo fecha) ====== */
const MX_TZ = "America/Mexico_City";
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
function formatDateRange(from?: string | null, to?: string | null) {
  if (!from || !to) return "—";
  return `${formatDateFriendly(from)} – ${formatDateFriendly(to)}`;
}

function CodeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide"
      style={{
        color: "#7c0040",
        borderColor: "#7c0040",
        backgroundColor: "rgba(124, 0, 64, 0.08)", // leve tinte
      }}
    >
      {children}
    </span>
  );
}




/* ===== Progress circular (desktop/móvil) ===== */
function ProgressCircle({
  value,
  size = 48,
  stroke = 4,
  n,
  label,
}: {
  value?: number | null;
  size?: number;
  stroke?: number;
  n?: number | null;
  label?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <div
        className="relative inline-flex items-center justify-center rounded-full"
        style={{ width: size, height: size }}
        aria-label="Sin valor"
      >
        <div className="absolute inset-0 rounded-full bg-muted" />
        <span className="text-[11px] font-semibold text-muted-foreground">—</span>
      </div>
    );
  }
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;

  const trackClass = "text-muted";
  const barClass =
    n != null && n < 80
      ? "text-red-500"
      : n != null && n >= 80
      ? "text-green-500"
      : "text-muted-foreground";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Progreso ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          className={trackClass}
          stroke="currentColor"
          opacity={0.25}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          className={barClass}
          stroke="currentColor"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold leading-none select-none">
        {label ?? `${fmt(value)}%`}
      </span>
    </div>
  );
}

/* ===== Subfila de detalles (desktop) ===== */
function DetailsSubrow({
  docente,
  fechas,
  sesiones,
  idioma,
  nivel,
  modalidad,
  turno,
}: {
  docente?: string | null;
  fechas?: string;
  idioma?: string;
  nivel?: string;
  modalidad?: string;
  turno?: string;
  sesiones: {
    total?: number | null;
    presentes?: number | null;
    ausentes?: number | null;
    retardos?: number | null;
    justificados?: number | null;
  };
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span><strong>Idioma:</strong> <span className="text-[#7c0040]">{idioma ?? "—"}</span></span>
        <span className="opacity-50">•</span>
        <span><strong>Nivel:</strong> <span className="text-[#7c0040]">{nivel ?? "—"}</span></span>
        <span className="opacity-50">•</span>
        <span><strong>Modalidad:</strong> <span className="text-[#7c0040]">{modalidad ?? "—"}</span></span>
        <span className="opacity-50">•</span>
        <span><strong>Turno:</strong> <span className="text-[#7c0040]">{turno ?? "—"}</span></span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {docente ? (
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-4 w-4" />
            <strong>Docente:</strong> <span className="text-[#7c0040]">{docente}</span>
          </span>
        ) : null}
        {fechas ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            <span className="text-[#7c0040]">{fechas}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>Sesiones: <span className="text-[#7c0040]">{sesiones.total ?? "—"}</span></span>
        <span className="opacity-50">•</span>
        <span>Presente: <span className="text-[#7c0040]">{sesiones.presentes ?? "—"}</span></span>
        <span className="opacity-50">•</span>
        <span>Ausente: <span className="text-[#7c0040]">{sesiones.ausentes ?? "—"}</span></span>
        <span className="opacity-50">•</span>
        <span>Retardos: <span className="text-[#7c0040]">{sesiones.retardos ?? "—"}</span></span>
        <span className="opacity-50">•</span>
        <span>Justificados: <span className="text-[#7c0040]">{sesiones.justificados ?? "—"}</span></span>
      </div>
    </div>
  );
}

/* ===== Header con tooltip (icono arriba, texto abajo) ===== */
function HeadLabel({
  icon,
  text,
  hint,
}: {
  icon?: React.ReactNode;
  text: string;
  hint?: React.ReactNode;
}) {
  const content = (
    <div className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground">
      {/* Icono arriba (cuando exista) */}
      {icon ? (
        <span className="h-4 w-4 shrink-0 flex items-center justify-center">
          {icon}
        </span>
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}

      {/* Texto al pie */}
      <span className="mt-auto text-[10px] leading-tight font-medium text-center whitespace-normal break-words">
        {text}
      </span>
    </div>
  );

  if (!hint) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{content}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

/* ===================== Página ===================== */
export default function AlumnoHistorialPage() {
  const [data, setData] = useState<AlumnoHistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await getAlumnoHistorial();
        setData(res.items ?? []);
      } catch (e: any) {
        console.error(e);
        toast.error("No se pudo cargar tu historial.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((it) => {
      const hay = `${it.ciclo_codigo} ${it.idioma} ${it.nivel} ${it.modalidad} ${it.turno} ${it.docente_nombre ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [data, q]);

  /* === formateos visuales seguros === */
  function fIdioma(s?: string | null) { return capFirst(cleanPrefixed(s, "Idioma")); }
  function fNivel(s?: string | null) { return nivelFullLabel(cleanPrefixed(s, "Nivel")); }
  function fTurno(s?: string | null) { return capFirst(cleanPrefixed(s, "Turno")); }
  function fModalidad(s?: string | null) { return capFirst(cleanPrefixed(s, "Modalidad")); }

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Historial de calificaciones">
        <div className="space-y-4 p-3 sm:p-0">
          <Card className="shadow-sm">
            <CardHeader className="flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <CardTitle className="text-base sm:text-lg">
                Historial de calificaciones
              </CardTitle>
              <div className="w-full sm:w-80">
                <Input
                  placeholder="Filtrar por código, idioma, nivel, docente…"
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
                  Cargando historial…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No hay registros.
                </div>
              ) : (
                <>
                  
                  
                  {/* ======= Vista MÓVIL (tarjetas) ======= */}
                  <div className="grid gap-3 md:hidden">
                    {filtered.map((it) => {
                      const idioma = fIdioma(it.idioma);
                      const nivel = fNivel(it.nivel);
                      const turno = fTurno(it.turno);
                      const modalidad = fModalidad(it.modalidad);

                      return (
                        <Card key={it.inscripcion_id} className="border">
                          <CardContent className="py-4 px-3 space-y-3">
                            {/* Encabezado: código */}
                            <div className="space-y-1">
                              <div className="font-semibold leading-tight break-words">
                                <CodeBadge>{it.ciclo_codigo || "—"}</CodeBadge>
                              </div>

                              {/* Fila de metadatos con íconos (Idioma → Nivel → Turno → Modalidad) */}
                              <div className="text-[13px] flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span className="inline-flex items-center gap-1.5">
                                  <Languages className="h-4 w-4" />
                                  <span className="font-semibold text-[#7c0040]">{idioma}</span>
                                </span>
                                <span className="opacity-50">•</span>
                                <span className="inline-flex items-center gap-1.5">
                                  <GraduationCap className="h-4 w-4" />
                                  <span className="font-semibold text-[#7c0040]">{nivel}</span>
                                </span>
                                <span className="opacity-50">•</span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-semibold text-[#7c0040]">{turno}</span>
                                </span>
                                <span className="opacity-50">•</span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Layers className="h-4 w-4" />
                                  <span className="font-semibold text-[#7c0040]">{modalidad}</span>
                                </span>
                              </div>
                            </div>

                            {/* Docente / Fechas */}
                            {(it.docente_nombre || (it.fecha_inicio && it.fecha_fin)) && (
                              <div className="text-[13px] flex flex-wrap items-center gap-2">
                                {it.docente_nombre ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <UserRound className="h-4 w-4" />
                                    <strong>Docente:</strong>{" "}
                                    <span className="text-[#7c0040] font-semibold">
                                      {it.docente_nombre}
                                    </span>
                                  </span>
                                ) : null}
                                {it.fecha_inicio && it.fecha_fin ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="h-4 w-4" />
                                    <span className="text-[#7c0040] font-semibold">
                                      ({formatDateRange(it.fecha_inicio, it.fecha_fin)})
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            )}

                            {/* Sesiones compacto */}
                            <div className="text-[11px]">
                              Sesiones:{" "}
                              <span className="text-[#7c0040] font-semibold">
                                {it.sesiones_total ?? "—"}
                              </span>{" "}
                              • Presente:{" "}
                              <span className="text-[#7c0040] font-semibold">
                                {it.presentes ?? "—"}
                              </span>{" "}
                              • Ausente:{" "}
                              <span className="text-[#7c0040] font-semibold">
                                {it.ausentes ?? "—"}
                              </span>{" "}
                              • Retardos:{" "}
                              <span className="text-[#7c0040] font-semibold">
                                {it.retardos ?? "—"}
                              </span>{" "}
                              • Justificados:{" "}
                              <span className="text-[#7c0040] font-semibold">
                                {it.justificados ?? "—"}
                              </span>
                            </div>

                            {/* Métricas clave */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="rounded-lg border p-2">
                                <div className="text-[11px] text-muted-foreground mb-1 inline-flex items-center gap-1">
                                  <CalendarCheck className="h-3.5 w-3.5" />
                                  Asistencia
                                </div>
                                <div className="flex items-center justify-center">
                                  <ProgressCircle
                                    value={it.asistencia_pct}
                                    n={it.asistencia_pct}
                                    size={48}
                                    stroke={4}
                                    label={
                                      it.asistencia_pct == null ? "—" : `${fmt(it.asistencia_pct)}%`
                                    }
                                  />
                                </div>
                              </div>

                              <div className="rounded-lg border p-2">
                                <div className="text-[11px] text-muted-foreground mb-1 inline-flex items-center gap-1">
                                  <Gauge className="h-3.5 w-3.5" />
                                  Promedio
                                </div>
                                <div className="flex items-center justify-center">
                                  <ProgressCircle
                                    value={it.promedio}
                                    n={it.promedio}
                                    size={48}
                                    stroke={4}
                                    label={it.promedio == null ? "—" : fmt(it.promedio)}
                                  />
                                </div>
                              </div>

                            
                            
                            </div>

                            {/* Evaluaciones */}
                            <div className="rounded-lg border p-2">
                              <div className="text-[11px] text-muted-foreground mb-2">
                                Evaluaciones
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" /> Medio · Examen
                                  </span>
                                  <span className="font-medium">{badge(it.medio_examen, 80)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <ClipboardList className="h-3.5 w-3.5" /> Medio · Cont.
                                  </span>
                                  <span className="font-medium">{badge(it.medio_cont, 20)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <Calculator className="h-3.5 w-3.5" /> Subtotal Medio
                                  </span>
                                  <span className="font-medium">
                                    {badge(it.medio_subtotal, 100)}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" /> Final · Examen
                                  </span>
                                  <span className="font-medium">{badge(it.final_examen, 60)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <ClipboardList className="h-3.5 w-3.5" /> Final · Cont.
                                  </span>
                                  <span className="font-medium">{badge(it.final_cont, 20)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <CheckCheck className="h-3.5 w-3.5" /> Final · Tarea
                                  </span>
                                  <span className="font-medium">{badge(it.final_tarea, 20)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                    <Calculator className="h-3.5 w-3.5" /> Subtotal Final
                                  </span>
                                  <span className="font-medium">
                                    {badge(it.final_subtotal, 100)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>


                  {/* ======= Vista DESKTOP (tabla) ======= */}
                  <div className="hidden md:block">
                    {/* 👇 dejamos que el wrapper interno del Table sea el que scrollee */}
                    <div className="relative rounded-md border [&>div]:max-h-[70vh] [&>div]:overflow-auto">
                      <TooltipProvider delayDuration={150}>
                        <Table className="w-full table-fixed">
                          <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                            <TableRow className="[&>th]:h-14 [&>th]:align-bottom [&>th]:px-1.5 [&>th]:py-1">
                              {/* Curso */}
                              <TableHead style={{ width: "26%" }} className="text-left whitespace-normal break-words">
                                <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground">
                                  <span className="h-4 w-4 shrink-0" />
                                  <span className="mt-auto text-[10px] leading-tight font-medium text-center">Curso</span>
                                </span>
                              </TableHead>

                              {/* Asist. */}
                              <TableHead style={{ width: "8%" }} className="text-center whitespace-normal break-words">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <CalendarCheck className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">Asist.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Porcentaje de asistencia total (meta ≥ 80%).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* M. Exam. */}
                              <TableHead style={{ width: "8%" }} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <FileText className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">M. Exam.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Examen de medio curso (máx. 80).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* M. Cont. */}
                              <TableHead style={{ width: "7%" }} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <ClipboardList className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">M. Cont.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Evaluación continua de medio (máx. 20).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* M. Subt. */}
                              <TableHead style={{ width: "9%" }} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <Calculator className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">M. Subt.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Subtotal medio: Examen + Continua (máx. 100).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* F. Exam. */}
                              <TableHead style={{ width: "8%" }} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <FileText className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">F. Exam.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Examen final (máx. 60).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* F. Cont. */}
                              <TableHead style={{ width: "7%" }} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <ClipboardList className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">F. Cont.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Evaluación continua final (máx. 20).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* F. Tarea */}
                              <TableHead style={{ width: "7%" }} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <CheckCheck className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">F. Tarea</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Tarea / proyecto final (máx. 20).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* F. Subt. */}
                              <TableHead style={{ width: "9%" }} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <Calculator className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">F. Subt.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Subtotal final: Examen + Continua + Tarea (máx. 100).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>

                              {/* Prom. */}
                              <TableHead style={{ width: "11%" }} className="text-center whitespace-normal break-words">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-[54px] w-full flex flex-col items-center justify-start text-muted-foreground cursor-help">
                                      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                                        <Gauge className="h-4 w-4" />
                                      </span>
                                      <span className="mt-auto text-[10px] leading-tight font-medium text-center">Prom.</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Promedio final del curso (0–100).
                                  </TooltipContent>
                                </Tooltip>
                              </TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {filtered.map((it) => (
                              <Fragment key={it.inscripcion_id}>
                                <TableRow className="align-top [&>td]:py-3">
                                  {/* Curso */}
                                  <TableCell>
                                    <div className="font-medium leading-tight break-words">
                                      {it.ciclo_codigo || "—"}
                                    </div>
                                  </TableCell>

                                  {/* Asistencia */}
                                  <TableCell className="text-center">
                                    <ProgressCircle
                                      value={it.asistencia_pct}
                                      n={it.asistencia_pct}
                                      size={44}
                                      stroke={4}
                                      label={it.asistencia_pct == null ? "—" : `${fmt(it.asistencia_pct)}%`}
                                    />
                                  </TableCell>

                                  {/* Medio */}
                                  <TableCell className="text-center">{badge(it.medio_examen, 80)}</TableCell>
                                  <TableCell className="text-center">{badge(it.medio_cont, 20)}</TableCell>
                                  <TableCell className="text-center font-medium">{badge(it.medio_subtotal, 100)}</TableCell>

                                  {/* Final */}
                                  <TableCell className="text-center">{badge(it.final_examen, 60)}</TableCell>
                                  <TableCell className="text-center">{badge(it.final_cont, 20)}</TableCell>
                                  <TableCell className="text-center">{badge(it.final_tarea, 20)}</TableCell>
                                  <TableCell className="text-center font-medium">{badge(it.final_subtotal, 100)}</TableCell>

                                  {/* Promedio */}
                                  <TableCell className="text-center">
                                    <span className={`text-sm font-semibold px-3 h-7 inline-flex items-center rounded-full ${toneClasses(it.promedio)}`}>
                                      {it.promedio == null ? "—" : fmt(it.promedio)}
                                    </span>
                                  </TableCell>
                                </TableRow>

                                {/* Subfila de detalles */}
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={10} className="py-2 pl-4">
                                    <div className="border-l-2 border-primary/50 pl-3">
                                      <DetailsSubrow
                                        docente={it.docente_nombre || undefined}
                                        fechas={
                                          it.fecha_inicio && it.fecha_fin
                                            ? `(${formatDateRange(it.fecha_inicio, it.fecha_fin)})`
                                            : undefined
                                        }
                                        idioma={capFirst(cleanPrefixed(it.idioma, "Idioma"))}
                                        nivel={nivelFullLabel(cleanPrefixed(it.nivel, "Nivel"))}
                                        modalidad={capFirst(cleanPrefixed(it.modalidad, "Modalidad"))}
                                        turno={capFirst(cleanPrefixed(it.turno, "Turno"))}
                                        sesiones={{
                                          total: it.sesiones_total,
                                          presentes: it.presentes,
                                          ausentes: it.ausentes,
                                          retardos: it.retardos,
                                          justificados: it.justificados,
                                        }}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </TooltipProvider>
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
