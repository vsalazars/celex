"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Printer, RefreshCw } from "lucide-react";
import { exportNodeToPDF, downloadCSV } from "./utils/export";
import { getSerieEncuestaDocentePorPregunta } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ✅ Carga dinámica del gráfico para evitar SSR issues
const ResponsiveLine = dynamic(
  async () => (await import("@nivo/line")).ResponsiveLine,
  { ssr: false }
);

/* ===== Ajustes visuales (modifica aquí) ===== */
const TOOLTIP_FONT_PX = 14;     // tamaño de fuente del tooltip
const TOOLTIP_PADDING_PX = 12;  // padding del tooltip
const TOOLTIP_MAX_W_PX = 620;   // ancho máx del tooltip
const POINT_SIZE = 10;          // tamaño del punto
const POINT_BORDER = 2;         // grosor del borde del punto

/* ===== Tipos ===== */
type SerieLinea = {
  id: string;               // pregunta_id
  label: string;            // texto pregunta
  data: { x: string; y: number }[]; // ciclo vs % (0..100)
};

type RespPorPregunta = {
  docente: { id: string | number; nombre: string };
  series: SerieLinea[];
};

// Paleta (d3-category10) para mapear ciclo→color estable
const PALETTE = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
];

export default function ReportDesempenoDocente({ docenteId }: { docenteId: string }) {
  const [resp, setResp] = useState<RespPorPregunta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Ciclos ocultos (toggle)
  const [hiddenCycles, setHiddenCycles] = useState<Set<string>>(new Set());

  async function consultar() {
    if (!docenteId) { setResp(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await getSerieEncuestaDocentePorPregunta({ docenteId, soloProfesor: false });
      setResp((data as RespPorPregunta) || null);
    } catch (e: any) {
      setError(e?.message || "No se pudo obtener la serie por pregunta");
      setResp(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { consultar(); /* eslint-disable-next-line */ }, [docenteId]);

  /* ===== Preparación: preguntas (P1..Pn) y ciclos ===== */
  const preguntasOrden = useMemo(() => {
    const ids = (resp?.series || []).map((s) => s.id);
    return Array.from(new Set(ids)).sort((a, b) =>
      String(a).localeCompare(String(b), "es", { numeric: true })
    );
  }, [resp]);

  const pidToShort = useMemo(() => {
    const m = new Map<string, string>();
    preguntasOrden.forEach((pid, i) => m.set(pid, `P${i + 1}`));
    return m;
  }, [preguntasOrden]);

  const shortToFull = useMemo(() => {
    const m = new Map<string, string>();
    (resp?.series || []).forEach((s) => {
      const short = pidToShort.get(s.id) || s.id;
      if (!m.has(short)) m.set(short, s.label || short);
    });
    return m;
  }, [resp, pidToShort]);

  const ciclosOrden = useMemo(() => {
    const set = new Set<string>();
    (resp?.series || []).forEach((s) => s.data.forEach((p) => set.add(String(p.x))));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [resp]);

  // Mapa ciclo→color estable
  const cicloColor = useMemo(() => {
    const m = new Map<string, string>();
    ciclosOrden.forEach((c, idx) => m.set(c, PALETTE[idx % PALETTE.length]));
    return m;
  }, [ciclosOrden]);

  /* ===== Pivot: líneas por ciclo ===== */
  const lineDataAll = useMemo(() => {
    if (!resp?.series?.length) return [];

    // ciclo -> (pid -> y)
    const byCycle: Record<string, Record<string, number | null>> = {};
    ciclosOrden.forEach((c) => (byCycle[c] = {}));

    (resp.series || []).forEach((s) => {
      const pid = s.id;
      const full = s.label?.trim() || `Pregunta ${pid}`;
      const valMap: Record<string, number | null> = {};
      ciclosOrden.forEach((c) => (valMap[c] = null));
      s.data.forEach((p) => {
        const y = Number.isFinite(p.y) ? Math.max(0, Math.min(100, p.y)) : null;
        valMap[String(p.x)] = y;
      });
      Object.entries(valMap).forEach(([ciclo, y]) => {
        byCycle[ciclo][pid] = y;
      });
      const short = pidToShort.get(pid) || pid;
      if (!shortToFull.has(short)) shortToFull.set(short, full);
    });

    // Construye series con puntos enriquecidos
    return ciclosOrden.map((ciclo) => {
      const points = preguntasOrden.map((pid) => {
        const short = pidToShort.get(pid) || pid;
        const full = shortToFull.get(short) || short;
        const y = byCycle[ciclo]?.[pid] ?? null;
        return {
          x: short,
          y: y === null ? undefined : y,
          preguntaFull: full,
          preguntaId: pid,
          cicloLabel: ciclo,
        };
      });
      return { id: ciclo, data: points };
    });
  }, [resp, ciclosOrden, preguntasOrden, pidToShort, shortToFull]);

  // Filtradas según toggles
  const lineData = useMemo(
    () => lineDataAll.filter((s) => !hiddenCycles.has(String(s.id))),
    [lineDataAll, hiddenCycles]
  );

  // Promedios por ciclo (para chips)
  const cicloAvg = useMemo(() => {
    const m = new Map<string, number>();
    lineDataAll.forEach((serie) => {
      const vals = serie.data.map((d: any) => d.y).filter((v: any) => typeof v === "number") as number[];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      m.set(String(serie.id), Number(avg.toFixed(1)));
    });
    return m;
  }, [lineDataAll]);

  /* ===== Exportaciones ===== */
  const csv = () => {
    if (!resp?.series?.length) return;
    const out: any[] = [];
    resp.series.forEach((s) =>
      s.data.forEach((p) =>
        out.push({
          docente_id: resp.docente.id,
          docente: resp.docente.nombre,
          pregunta_id: s.id,
          pregunta: s.label,
          ciclo: p.x,
          promedio_pct: p.y,
        })
      )
    );
    downloadCSV(
      `desempeno_docente_line_${(resp.docente.nombre || "docente").replace(/\s+/g, "_")}.csv`,
      out
    );
  };

  const pdf = () => exportNodeToPDF(ref.current, "Desempeño Docente — Línea (ciclos vs preguntas)");

  // Helpers toggles
  const toggleCycle = (c: string) => {
    setHiddenCycles((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };
  const showAll = () => setHiddenCycles(new Set()); // none hidden
  const hideAll = () => setHiddenCycles(new Set(ciclosOrden)); // all hidden

  /* ===== Render ===== */
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Desempeño Docente</h3>
            {resp?.docente?.nombre && <Badge variant="secondary"> {resp.docente.nombre}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={consultar} disabled={loading || !docenteId} title="Actualizar">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Actualizar
            </Button>
            <Button size="sm" variant="outline" onClick={csv} disabled={!lineDataAll.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" onClick={pdf} disabled={!lineDataAll.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Chips P1..Pn con tooltip del enunciado completo */}
        {!!preguntasOrden.length && (
          <TooltipProvider>
            <div className="flex flex-wrap gap-2 mb-3">
              {preguntasOrden.map((pid, i) => {
                const short = pidToShort.get(pid) || `P${i + 1}`;
                const full = resp?.series.find((s) => s.id === pid)?.label || short;
                return (
                  <Tooltip key={pid} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-help">{short}</Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[640px]">
                      <p className="text-sm leading-snug">{full}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Chips por ciclo: color + promedio + toggle */}
        {!!ciclosOrden.length && (
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className="text-xs text-muted-foreground mr-2">Ciclos:</span>
            {ciclosOrden.map((ciclo) => {
              const color = cicloColor.get(ciclo) || "#999";
              const avg = cicloAvg.get(ciclo) ?? 0;
              const hidden = hiddenCycles.has(ciclo);
              return (
                <button
                  key={ciclo}
                  onClick={() => toggleCycle(ciclo)}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition ${
                    hidden ? "opacity-50" : "opacity-100"
                  }`}
                  title={hidden ? "Mostrar ciclo" : "Ocultar ciclo"}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="font-medium">{ciclo}</span>
                  <span className="text-muted-foreground">{avg}%</span>
                </button>
              );
            })}
            <div className="ml-2 flex gap-2">
              <Button size="xs" variant="outline" onClick={showAll}>Mostrar todo</Button>
              <Button size="xs" variant="outline" onClick={hideAll}>Ocultar todo</Button>
            </div>
          </div>
        )}

        <div ref={ref}>
          

          <div className="h-[560px] md:h-[640px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Cargando…
              </div>
            ) : !docenteId ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Selecciona un docente en los filtros.
              </div>
            ) : !lineDataAll.length ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sin resultados.
              </div>
            ) : (
              // @ts-expect-error: ResponsiveLine es dinámico (no SSR)
              <ResponsiveLine
                data={lineData}
                margin={{ top: 20, right: 28, bottom: 80, left: 56 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: 100, stacked: false }}
                curve="monotoneX"
                enablePoints={true}
                pointSize={POINT_SIZE}
                pointBorderWidth={POINT_BORDER}
                useMesh={true}

                /* ====== GRILLA ====== */
                enableGridX={false}                    // oculta grilla vertical (cámbialo a true si la quieres)
                enableGridY={true}                     // muestra grilla horizontal
                gridYValues={[0, 20, 40, 60, 80, 100]} // líneas horizontales específicas

                enableSlices="x"
                axisBottom={{
                  tickRotation: 0,
                  legend: "Preguntas (P1..Pn)",
                  legendPosition: "middle",
                  legendOffset: 40,
                }}
                axisLeft={{
                  tickValues: [0, 20, 40, 60, 80, 100],
                  legend: "Promedio (%)",
                  legendPosition: "middle",
                  legendOffset: -44,
                }}
                lineWidth={2}
                colors={(serie) => cicloColor.get(String(serie.id)) || "#999"}
                legends={[]}
                // Tooltip por punto (usa estilos inline para asegurar tamaño)
                pointTooltip={({ point }) => {
                  const d: any = point.data;
                  const emb = (d?.data as any) || {};
                  const full = emb.preguntaFull ?? shortToFull.get(String(d.x)) ?? String(d.x);
                  const ciclo =
                    emb.cicloLabel ??
                    (point as any).serieId ??
                    (point as any).serie?.id ??
                    "";
                  const y = Number(d.y ?? 0).toFixed(1);
                  const short = String(d.x);

                  return (
                    <div
                      className="rounded-md border bg-background shadow-sm"
                      style={{
                        fontSize: TOOLTIP_FONT_PX,
                        padding: TOOLTIP_PADDING_PX,
                        maxWidth: TOOLTIP_MAX_W_PX,
                        borderColor: "hsl(var(--border))",
                      }}
                    >
                      <div className="font-medium">{ciclo}</div>
                      <div className="text-muted-foreground mb-1">
                        <strong>{short}</strong> — {full}
                      </div>
                      <div className="text-muted-foreground">{y}%</div>
                    </div>
                  );
                }}
                // Tooltip por slice (misma pregunta: todos los ciclos visibles)
                sliceTooltip={({ slice }) => {
                  const d0: any = slice.points[0]?.data;
                  const short = String(d0?.x ?? "");
                  const full =
                    (d0?.data && (d0.data as any).preguntaFull) ??
                    shortToFull.get(short) ??
                    short;
                  return (
                    <div
                      className="rounded-md border bg-background shadow-sm"
                      style={{
                        fontSize: TOOLTIP_FONT_PX,
                        padding: TOOLTIP_PADDING_PX,
                        maxWidth: TOOLTIP_MAX_W_PX,
                        borderColor: "hsl(var(--border))",
                      }}
                    >
                      <div className="text-muted-foreground mb-1">
                        <strong>{short}</strong> — {full}
                      </div>
                      {slice.points.map((p) => {
                        const pd: any = p.data;
                        const emb = (pd?.data as any) || {};
                        const ciclo =
                          emb.cicloLabel ??
                          (p as any).serieId ??
                          (p as any).serie?.id ??
                          "";
                        const y = Number(pd?.y ?? 0).toFixed(1);
                        return (
                          <div key={p.id} className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ background: p.color }}
                            />
                            <span className="font-medium">{ciclo}</span>
                            <span className="text-muted-foreground">{y}%</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
                theme={{
                  text: { fontSize: 12 },
                  axis: {
                    ticks: { text: { fill: "hsl(var(--foreground))" } },
                    legend: { text: { fill: "hsl(var(--muted-foreground))" } },
                  },
                  // estilo de la grilla
                  grid: {
                    line: {
                      stroke: "hsl(var(--muted))",
                      strokeDasharray: "4 4", // punteado; elimina si la quieres sólida
                      strokeWidth: 1,
                    },
                  },
                  tooltip: {
                    container: {
                      background: "hsl(var(--background))",
                      color: "hsl(var(--foreground))",
                      border: "1px solid hsl(var(--border))",
                    },
                  },
                }}
                role="application"
                ariaLabel="Líneas por ciclo: promedio por pregunta"
              />
            )}
          </div>
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
