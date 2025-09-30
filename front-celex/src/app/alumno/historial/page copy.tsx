// app/alumno/historial/page.tsx
"use client";

import { useEffect, useState } from "react";
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
  CalendarCheck,     // Asist.
  FileText,          // Examen
  ClipboardList,     // Continua
  Calculator,        // Subtotal
  CheckCheck,        // Tarea (o "aplicada")
  Gauge,             // Promedio
} from "lucide-react";

/* ===== Helpers ===== */
function fmt(n?: number | null, digits = 1) {
  if (n === null || n === undefined) return "—";
  return Number.isInteger(n) ? `${n}` : Number(n).toFixed(digits);
}
function badge(n?: number | null, max?: number) {
  if (n === null || n === undefined) return "—";
  if (typeof max === "number") return `${fmt(n)}/${max}`;
  return fmt(n);
}

/* Pequeño componente para encabezado con icono + tooltip */
function ColHead({
  icon,
  label,
  hint,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string; // se muestra en tooltip
  className?: string;
}) {
  return (
    <TableHead className={`text-center ${className ?? ""}`}>
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div className="inline-flex flex-col items-center gap-1 cursor-help select-none">
              <div className="h-5 w-5">{icon}</div>
              <span className="text-[11px] leading-none text-muted-foreground">
                {label}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </TableHead>
  );
}

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

  const filtered = data.filter((it) => {
    const hay = `${it.ciclo_codigo} ${it.idioma} ${it.nivel} ${it.modalidad} ${it.turno} ${it.docente_nombre ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Historial / Boleta">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Historial / Boleta</CardTitle>
              <div className="w-72">
                <Input
                  placeholder="Filtrar por código, idioma, nivel, docente…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando historial…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay registros.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px] text-left">Curso</TableHead>

                        <ColHead
                          icon={<CalendarCheck className="h-5 w-5" />}
                          label="Asist."
                          hint="Porcentaje de asistencia del curso (Presente/Ausente/Retardo/Justificación)."
                        />

                        <ColHead
                          icon={<FileText className="h-5 w-5" />}
                          label="Medio · Examen"
                          hint="Examen de medio curso. Rango 0–80."
                        />
                        <ColHead
                          icon={<ClipboardList className="h-5 w-5" />}
                          label="Medio · Cont."
                          hint="Evaluación continua de medio curso. Rango 0–20."
                        />
                        <ColHead
                          icon={<Calculator className="h-5 w-5" />}
                          label="Subtotal Medio"
                          hint="Suma de Examen (0–80) + Cont. (0–20). Máximo 100."
                        />

                        <ColHead
                          icon={<FileText className="h-5 w-5" />}
                          label="Final · Examen"
                          hint="Examen final. Rango 0–60."
                        />
                        <ColHead
                          icon={<ClipboardList className="h-5 w-5" />}
                          label="Final · Cont."
                          hint="Evaluación continua final. Rango 0–20."
                        />
                        <ColHead
                          icon={<CheckCheck className="h-5 w-5" />}
                          label="Final · Tarea"
                          hint="Tareas o proyecto final. Rango 0–20."
                        />
                        <ColHead
                          icon={<Calculator className="h-5 w-5" />}
                          label="Subtotal Final"
                          hint="Suma de Examen (0–60) + Cont. (0–20) + Tarea (0–20). Máximo 100."
                        />

                        <ColHead
                          icon={<Gauge className="h-5 w-5" />}
                          label="Promedio"
                          hint="Promedio del curso. Por defecto: (Subtotal Medio + Subtotal Final) / 2."
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((it) => {
                        const curso = `${it.ciclo_codigo} • ${it.idioma} ${it.nivel} • ${it.modalidad}/${it.turno}`;
                        const docente = it.docente_nombre ? `Docente: ${it.docente_nombre}` : "";
                        const fechas =
                          it.fecha_inicio && it.fecha_fin
                            ? `(${new Date(it.fecha_inicio).toLocaleDateString()} – ${new Date(it.fecha_fin).toLocaleDateString()})`
                            : "";
                        return (
                          <TableRow key={it.inscripcion_id} className="align-top">
                            <TableCell className="text-left">
                              <div className="font-medium">{curso}</div>
                              <div className="text-xs text-muted-foreground">{docente}</div>
                              <div className="text-xs text-muted-foreground">{fechas}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Sesiones: {it.sesiones_total} • P:{it.presentes} A:{it.ausentes} R:{it.retardos} J:{it.justificados}
                              </div>
                            </TableCell>

                            {/* Asistencia % */}
                            <TableCell className="text-center font-medium">
                              {fmt(it.asistencia_pct)}%
                            </TableCell>

                            {/* Medio */}
                            <TableCell className="text-center">
                              {badge(it.medio_examen, 80)}
                            </TableCell>
                            <TableCell className="text-center">
                              {badge(it.medio_cont, 20)}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {badge(it.medio_subtotal, 100)}
                            </TableCell>

                            {/* Final */}
                            <TableCell className="text-center">
                              {badge(it.final_examen, 60)}
                            </TableCell>
                            <TableCell className="text-center">
                              {badge(it.final_cont, 20)}
                            </TableCell>
                            <TableCell className="text-center">
                              {badge(it.final_tarea, 20)}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {badge(it.final_subtotal, 100)}
                            </TableCell>

                            {/* Promedio */}
                            <TableCell className="text-center text-base font-semibold">
                              {fmt(it.promedio)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}
