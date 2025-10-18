"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  Loader2,
  Printer,
  RefreshCw,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { exportNodeToPDF, downloadCSV } from "./utils/export";
import { getSerieEncuestaDocentePorPregunta } from "@/lib/api";
import {
  Tooltip as STooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ===== Recharts ===== */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ReferenceLine,
  Label,
} from "recharts";

/* ===== Constantes visuales ===== */
const TOOLTIP_FONT_PX = 14;
const TOOLTIP_PADDING_PX = 12;
const TOOLTIP_MAX_W_PX = 680;
const THRESHOLD = 80;

/* ===== Tipos ===== */
type SerieLinea = {
  id: string; // pregunta_id
  label: string; // texto de la pregunta
  data: { x: string; y: number }[]; // ciclo vs % (0..100)
};

type RespPorPregunta = {
  docente: { id: string | number; nombre: string };
  series: SerieLinea[];
};

/* Paleta estable (ciclo → color) */
const PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

/* Helpers de color por umbral */
const GREEN = "#059669"; // emerald-600
const RED = "#dc2626";   // red-600
const OK = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v >= THRESHOLD : null;

/* Pills compactas para KPIs (en header) */
function KpiPill({ label, value }: { label: string; value: number | null }) {
  const ok = OK(value);
  const clsOk =
    "border-emerald-300 bg-emerald-50 text-emerald-700";
  const clsBad =
    "border-red-300 bg-rose-50 text-rose-700";
  const clsNeu = "border-muted text-muted-foreground";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border",
        value == null ? clsNeu : ok ? clsOk : clsBad,
      ].join(" ")}
    >
      <span className="font-medium">{label}:</span>
      <span className="font-semibold tabular-nums">{value ?? "—"}%</span>
    </span>
  );
}

export default function ReportDesempenoDocente({
  docenteId,
}: {
  docenteId: string;
}) {
  const [resp, setResp] = useState<RespPorPregunta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Ciclos ocultos (toggle)
  const [hiddenCycles, setHiddenCycles] = useState<Set<string>>(new Set());

  // Benchmark: satisfacción global (todos)
  const [globalTodosPct, setGlobalTodosPct] = useState<number | null>(null);

  async function consultar() {
    if (!docenteId) {
      setResp(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSerieEncuestaDocentePorPregunta({
        docenteId,
        soloProfesor: false,
      });
      setResp((data as RespPorPregunta) || null);
    } catch (e: any) {
      setError(e?.message || "No se pudo obtener la serie por pregunta");
      setResp(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docenteId]);

  /* ===== Satisfacción global (benchmark de todos) ===== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@/lib/api").catch(() => null as any);
        const fn = mod?.getCoordKpis || mod?.getCoordinacionKpis;
        if (!fn) return;
        const kpis = await fn({});
        const val = Number(kpis?.promedio_global_pct);
        if (!cancelled) {
          setGlobalTodosPct(Number.isFinite(val) ? +val.toFixed(1) : null);
        }
      } catch {
        if (!cancelled) setGlobalTodosPct(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true })
    );
  }, [resp]);

  // Mapa ciclo→color estable
  const cicloColor = useMemo(() => {
    const m = new Map<string, string>();
    ciclosOrden.forEach((c, idx) => m.set(c, PALETTE[idx % PALETTE.length]));
    return m;
  }, [ciclosOrden]);

  /* ===== Pivot para Recharts: rows con {x:'P1', '2025-1': 87, '2025-2': 82, ...} ===== */
  type Row = {
    x: string;   // P1..Pn
    __pid: string;
    __full: string;
    [key: string]: string | number | undefined;
  };

  const rows: Row[] = useMemo(() => {
    if (!resp?.series?.length) return [];
    // Inicializa una fila por pregunta
    const baseMap = new Map<string, Row>();
    for (const pid of preguntasOrden) {
      const short = pidToShort.get(pid) || pid;
      const full =
        resp?.series.find((s) => s.id === pid)?.label?.trim() ||
        `Pregunta ${short}`;
      baseMap.set(short, { x: short, __pid: pid, __full: full });
    }
    // Rellena valores ciclo→% por pregunta
    for (const serie of resp.series) {
      const pid = serie.id;
      const short = pidToShort.get(pid) || pid;
      const row = baseMap.get(short);
      if (!row) continue;
      const map: Record<string, number | null> = {};
      ciclosOrden.forEach((c) => (map[c] = null));
      for (const p of serie.data) {
        const y = Number.isFinite(p.y) ? Math.max(0, Math.min(100, p.y)) : null;
        map[String(p.x)] = y;
      }
      for (const c of ciclosOrden) {
        const v = map[c];
        if (typeof v === "number") row[c] = v;
      }
    }
    return Array.from(baseMap.values());
  }, [resp, preguntasOrden, ciclosOrden, pidToShort]);

  // Series visibles según toggles
  const visibleCycles = useMemo(
    () => ciclosOrden.filter((c) => !hiddenCycles.has(c)),
    [ciclosOrden, hiddenCycles]
  );

  // Promedio del docente (sobre ciclos VISIBLES y preguntas con dato)
  const docenteAvgPct = useMemo(() => {
    if (!rows.length || !visibleCycles.length) return null;
    let suma = 0;
    let n = 0;
    for (const r of rows) {
      for (const c of visibleCycles) {
        const v = r[c];
        if (typeof v === "number" && Number.isFinite(v)) {
          suma += v;
          n++;
        }
      }
    }
    if (!n) return null;
    return +(suma / n).toFixed(1);
  }, [rows, visibleCycles]);

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
      `desempeno_docente_line_${(resp?.docente?.nombre || "docente")
        .replace(/\s+/g, "_")
        .toLowerCase()}.csv`,
      out
    );
  };

  const pdf = () =>
    exportNodeToPDF(ref.current, "Desempeño Docente — Líneas (ciclos vs preguntas)");

  // Toggles
  const toggleCycle = (c: string) => {
    setHiddenCycles((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };
  const showAll = () => setHiddenCycles(new Set());
  const hideAll = () => setHiddenCycles(new Set(ciclosOrden));

  /* ===== Tooltip Recharts (personalizado) ===== */
  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || payload.length === 0) return null;
    const row = rows.find((r) => r.x === label);
    const full = row?.__full || label;
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
          <strong>{label}</strong> — {full}
        </div>
        {payload
          .filter((p: any) => typeof p?.value === "number")
          .map((p: any) => (
            <div key={p.dataKey} className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: p.color }}
              />
              <span className="font-medium">{p.dataKey}</span>
              <span className="text-muted-foreground">
                {Number(p.value).toFixed(1)}%
              </span>
            </div>
          ))}
      </div>
    );
  }

  /* ===== Label personalizado para ReferenceLine (píldora que no se corta) ===== */
  function RefPillLabel({
    viewBox,
    text,
    color,
  }: {
    viewBox?: any;
    text: string;
    color: string;
  }) {
    // viewBox trae {x, y, width, height}; para ReferenceLine horizontal,
    // y = coordenada de la línea; usamos lado derecho con clamp para que no se corte.
    const vb = viewBox || {};
    const innerLeft = vb.x ?? 0;
    const innerTop = vb.y ?? 0;
    const innerWidth = vb.width ?? 0;
    const innerHeight = vb.height ?? 0;

    const centerY = innerTop; // Recharts nos da y en top de la línea
    const padX = 8;
    const padY = 4;
    const fontSize = 11;

    // Posicionamos en el borde derecho interno
    const tx = innerLeft + innerWidth - 8; // 8px de separación del borde derecho
    const ty = centerY - 14; // desplazar ligeramente hacia arriba para no tocar la línea

    // Medida estimada del texto (monoespaciada aprox.)
    const pillW = text.length * 7 + padX * 2;
    const pillH = fontSize + padY * 2;
    const pillX = tx - pillW; // anclar al lado derecho
    const pillY = ty - pillH / 2;

    // Clamp horizontal por si acaso
    const minX = innerLeft + 8;
    const maxX = innerLeft + innerWidth - pillW - 8;
    const clampedX = Math.max(minX, Math.min(maxX, pillX));

    return (
      <g pointerEvents="none">
        <rect
          x={clampedX}
          y={pillY}
          rx={pillH / 2}
          ry={pillH / 2}
          width={pillW}
          height={pillH}
          fill={color}
          opacity={0.95}
          style={{ paintOrder: "stroke" }}
          stroke="white"
          strokeWidth={1.5}
        />
        <text
          x={clampedX + pillW / 2}
          y={pillY + pillH / 2 + fontSize / 3 - 1}
          textAnchor="middle"
          fontSize={fontSize}
          fill="white"
          className="tabular-nums"
          fontWeight={600}
        >
          {text}
        </text>
      </g>
    );
  }

  /* ===== Render ===== */
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-foreground/80" />
              Desempeño Docente
            </h3>
            {resp?.docente?.nombre && (
              <Badge variant="secondary">{resp.docente.nombre}</Badge>
            )}

            {/* KPIs con color por umbral */}
            {typeof globalTodosPct === "number" && (
              <KpiPill label="Global" value={globalTodosPct} />
            )}
            {typeof docenteAvgPct === "number" && (
              <KpiPill label="Docente" value={docenteAvgPct} />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={consultar}
              disabled={loading || !docenteId}
              title="Actualizar"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Actualizar
            </Button>
            <Button size="sm" variant="outline" onClick={csv} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" onClick={pdf} disabled={!rows.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Chips P1..Pn con tooltip (enunciado) */}
        {!!preguntasOrden.length && (
          <TooltipProvider>
            <div className="flex flex-wrap gap-2 mb-3">
              {preguntasOrden.map((pid, i) => {
                const short = pidToShort.get(pid) || `P${i + 1}`;
                const full =
                  resp?.series.find((s) => s.id === pid)?.label || short;
                return (
                  <STooltip key={pid} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-help">
                        {short}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[680px]">
                      <p className="text-sm leading-snug">{full}</p>
                    </TooltipContent>
                  </STooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Chips por ciclo + promedio + toggle (sin confundir con umbral) */}
        {!!ciclosOrden.length && (
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className="text-xs text-muted-foreground mr-2">Ciclos:</span>
            {ciclosOrden.map((ciclo) => {
              const color = cicloColor.get(ciclo) || "#999";
              const vals = rows
                .map((r) => r[ciclo])
                .filter((v): v is number => typeof v === "number");
              const avg = vals.length
                ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
                : 0;
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
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="font-medium">{ciclo}</span>
                  <span className="text-muted-foreground">{avg}%</span>
                </button>
              );
            })}

            {/* Botones mejorados (colores no-conflictivos con umbral) */}
            <div className="ml-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={showAll}
                className="border-sky-300 text-sky-700 hover:bg-sky-50"
                title="Mostrar todas las series"
              >
                <Eye className="h-4 w-4 mr-2" />
                Mostrar todo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={hideAll}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                title="Ocultar todas las series"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Ocultar todo
              </Button>
            </div>
          </div>
        )}

        {/* ====== GRÁFICA (Recharts) ====== */}
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
            ) : !rows.length ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sin resultados.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rows}
                  margin={{ top: 24, right: 96, bottom: 72, left: 56 }} // ➜ margen derecho ↑ para que nunca se corten
                >
                  <CartesianGrid strokeDasharray="4 4" />
                  <XAxis
                    dataKey="x"
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    interval={0}
                  >
                    <Label
                      value="Preguntas (P1..Pn)"
                      offset={48}
                      position="insideBottom"
                      fill="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                  </XAxis>

                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                  >
                    <Label
                      angle={-90}
                      position="insideLeft"
                      style={{ textAnchor: "middle" }}
                      value="Promedio (%)"
                      fill="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                  </YAxis>

                  {/* Benchmark: Satisfacción global (todos) con pill custom */}
                  {typeof globalTodosPct === "number" && (
                    <ReferenceLine
                      y={globalTodosPct}
                      stroke={OK(globalTodosPct) ? GREEN : RED}
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      ifOverflow="extendDomain"
                      label={{
                        content: (props: any) => (
                          <RefPillLabel
                            viewBox={props?.viewBox}
                            text={`Global ${globalTodosPct}%`}
                            color={OK(globalTodosPct) ? GREEN : RED}
                          />
                        ),
                      }}
                    />
                  )}

                  {/* Promedio docente (visible) con pill custom */}
                  {typeof docenteAvgPct === "number" && (
                    <ReferenceLine
                      y={docenteAvgPct}
                      stroke={OK(docenteAvgPct) ? GREEN : RED}
                      strokeWidth={2.5}
                      ifOverflow="extendDomain"
                      label={{
                        content: (props: any) => (
                          <RefPillLabel
                            viewBox={props?.viewBox}
                            text={`Docente ${docenteAvgPct}%`}
                            color={OK(docenteAvgPct) ? GREEN : RED}
                          />
                        ),
                      }}
                    />
                  )}

                  <RTooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 12 }}
                  />

                  {/* Líneas por ciclo (solo visibles) */}
                  {visibleCycles.map((ciclo) => (
                    <Line
                      key={ciclo}
                      type="monotone"
                      dataKey={ciclo}
                      stroke={cicloColor.get(ciclo) || "#999"}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
