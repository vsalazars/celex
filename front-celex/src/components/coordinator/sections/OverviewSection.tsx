"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  GraduationCap,
  LayoutGrid,
  BarChart3,
  Landmark,
  MessageSquareText,
  Banknote,           // ⬅️ nuevo
  CircleDollarSign,   // ⬅️ nuevo
} from "lucide-react";

// ===== API real =====
import {
  getCoordKpis,
  getCoordCategoriasAgg,
  getCoordRanking,
  getCoordComentariosRecientes,
  getCoordPreguntasAgg,
  getDashCiclos,
  // Tipos
  type CoordKpisOut as KpisOut,
  type CoordRankingOut as RankingOut,
  type CoordComentario as Comentario,
  type DashCicloLite,
  type CoordPreguntasAggOut,
  // ⬇️ NUEVO: montos combinados (inscripciones + placement)
  getCoordMontos,
  type CoordMontosOut,
} from "@/lib/api";

/* ========= Charts (Nivo) ========= */
const ResponsiveLine = dynamic(
  () => import("@nivo/line").then((m) => m.ResponsiveLine),
  { ssr: false }
);
const ResponsiveBar = dynamic(
  () => import("@nivo/bar").then((m) => m.ResponsiveBar),
  { ssr: false }
);

/* ========= Paletas ========= */
const PALETTE_LINE = [
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
const PALETTE_BAR = ["#8596b3", "#ac9eb3", "#c4b0b3", "#d0d5d3"];

/* ========= Tooltip styles ========= */
const TOOLTIP_FONT_PX = 13;
const TOOLTIP_PADDING_PX = 10;
const TOOLTIP_MAX_W_PX = 640;

/* ========= Helpers ========= */
function Currency({
  value,
  locale = "es-MX",
  currency = "MXN",
}: {
  value: number;
  locale?: string;
  currency?: string;
}) {
  try {
    return (
      <>{
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(value)
      }</>
    );
  } catch {
    return <>{value.toFixed(2)}</>;
  }
}

/* ========= KPI card pro ========= */
type StatTone = "default" | "success" | "warning" | "danger";


// 2) Agrega la variante "danger" (rojo) en las clases de tono
function toneClasses(tone: StatTone) {
  if (tone === "success") {
    return {
      ring: "ring-1 ring-emerald-300/60",
      iconWrap: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      badge: "bg-emerald-100 text-emerald-700",
      gradient: "bg-gradient-to-b from-emerald-50/60 to-transparent dark:from-emerald-950/20",
    } as const;
  }
  if (tone === "warning") {
    return {
      ring: "ring-1 ring-amber-300/60",
      iconWrap: "bg-amber-50 text-amber-700 border-amber-200 border",
      badge: "bg-amber-100 text-amber-700",
      gradient: "bg-gradient-to-b from-amber-50/60 to-transparent dark:from-amber-950/20",
    } as const;
  }
  if (tone === "danger") {
    return {
      ring: "ring-1 ring-red-300/60",
      iconWrap: "bg-red-50 text-red-700 border border-red-200",
      badge: "bg-red-100 text-red-700",
      gradient: "bg-gradient-to-b from-red-50/60 to-transparent dark:from-red-950/20",
    } as const;
  }
  return {
    ring: "ring-1 ring-border/60",
    iconWrap: "bg-muted text-muted-foreground border border-border/60",
    badge: "bg-secondary text-secondary-foreground",
    gradient: "bg-gradient-to-b from-muted/40 to-transparent",
  } as const;
}


function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  delta,
  deltaDir,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  delta?: string;
  deltaDir?: "up" | "down";
}) {
  const cls = toneClasses(tone);
  return (
    <Card
      className={`rounded-2xl ${cls.ring} relative overflow-hidden supports-[backdrop-filter]:bg-background/80`}
    >
      <div className={`absolute inset-0 pointer-events-none ${cls.gradient}`} />
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
            {/* ⬇️ Sin 'truncate' para no cortar montos */}
            <div className="mt-1 text-2xl font-semibold tracking-tight leading-none">{value}</div>
            <div className="mt-1 flex items-center gap-2">
              {hint ? (
                <Badge variant="secondary" className={cls.badge + " border-0 text-[10px] font-medium"}>
                  {hint}
                </Badge>
              ) : null}
              {delta ? (
                <span
                  className={`text-[11px] font-medium ${
                    deltaDir === "down" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {deltaDir === "down" ? "▼" : "▲"} {delta}
                </span>
              ) : null}
            </div>
          </div>
          {icon ? (
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${cls.iconWrap}`} aria-hidden>
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ========= Componente ========= */
export default function OverviewSection({
  anio,
  idioma,
  currency = "MXN",
}: {
  anio?: number;
  idioma?: string;
  currency?: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [kpis, setKpis] = React.useState<KpisOut | null>(null);
  const [rank, setRank] = React.useState<RankingOut | null>(null);
  const [comments, setComments] = React.useState<Comentario[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Montos (inscripciones + placement)
  const [montos, setMontos] = React.useState<CoordMontosOut | null>(null);

  // ===== Selector de ciclo (compartido) =====
  const [ciclos, setCiclos] = React.useState<DashCicloLite[]>([]);
  const [cicloSel, setCicloSel] = React.useState<string>("all"); // "all" o id

  // 🔎 Helpers de nombre de ciclo
  const cicloObj = React.useMemo(
    () => (cicloSel === "all" ? null : ciclos.find((c) => String(c.id) === String(cicloSel)) || null),
    [cicloSel, ciclos]
  );
  const cicloName = cicloObj ? `${cicloObj.codigo}` : "Todos los cursos"; // SOLO el nombre
  const cicloTitle = cicloObj ? `Ciclo ${cicloObj.codigo}` : "Todos los cursos"; // para títulos

  // ===== Preguntas (línea) =====
  type QPoint = {
    x: string; // P1..Pn
    y: number; // porcentaje
    qid: string | number; // id de pregunta
    preguntaFull: string; // texto completo
  };
  const [qLineSeries, setQLineSeries] = React.useState<{ id: string; data: QPoint[] }[]>([]);
  const qTextoRef = React.useRef<Record<string | number, string>>({}); // qid → texto

  // ===== Categorías (barras) =====
  const [catAggRows, setCatAggRows] = React.useState<
    { categoria: string; pct: number; categoriaId: string | number; order: number }[]
  >([]);

  // ====== Base: ranking (global) + ciclos ======
  async function cargarSoloRankingYCiclos() {
    try {
      const [r, rows] = await Promise.all([
        getCoordRanking({ anio, idioma, limitTop: 5, limitBottom: 5 }),
        getDashCiclos({ anio, idioma }),
      ]);
      rows.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
      setRank(r);
      setCiclos(rows);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar ranking/ciclos");
    }
  }

  // ====== KPIs + Comentarios + Montos (dependen de cicloSel) ======
  async function cargarKpisYComentarios() {
    setError(null);
    try {
      const cicloId = cicloSel !== "all" ? Number(cicloSel) : undefined;
      const [k, cm] = await Promise.all([
        getCoordKpis({ anio, idioma, cicloId }),
        getCoordComentariosRecientes({ anio, idioma, limit: 20, cicloId }),
      ]);
      setKpis(k);
      setComments(cm);

      // ⬇️ si es "Todos los ciclos", traemos montos (placement se agrega aquí)
      if (cicloSel === "all") {
        const m = await getCoordMontos({ anio, idioma });
        setMontos(m);
      } else {
        setMontos(null); // ocultar al elegir un ciclo específico
      }
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar KPIs/comentarios");
      setKpis(null);
      setComments([]);
      setMontos(null);
    }
  }

  // ====== Agregados (Preguntas + Categorías) ======
  function prepararSeriePreguntas(pregRes: CoordPreguntasAggOut) {
    const preguntas = (pregRes?.preguntas ?? [])
      .slice()
      .sort((a, b) => {
        if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
        return String(a.texto).localeCompare(String(b.texto));
      });

    const txtMap: Record<string | number, string> = {};
    preguntas.forEach((q) => (txtMap[q.id] = q.texto || `Pregunta ${q.id}`));
    qTextoRef.current = txtMap;

    const puntos: QPoint[] = preguntas.map((q, idx) => ({
      x: `P${idx + 1}`,
      y: Number((q.promedio_pct ?? 0).toFixed(1)),
      qid: q.id,
      preguntaFull: txtMap[q.id],
    }));

    setQLineSeries([{ id: "Promedio (%)", data: puntos }]);
  }

  async function cargarAgregados() {
    try {
      const pregRes =
        cicloSel === "all"
          ? await getCoordPreguntasAgg({ anio, idioma, allCiclos: true })
          : await getCoordPreguntasAgg({ cicloId: Number(cicloSel) });
      prepararSeriePreguntas(pregRes);

      const catRes =
        cicloSel === "all"
          ? await getCoordCategoriasAgg({ anio, idioma, allCiclos: true })
          : await getCoordCategoriasAgg({ cicloId: Number(cicloSel) });

      const catsList = (catRes?.categorias ?? [])
        .slice()
        .sort((a, b) => {
          if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
          return String(a.name).localeCompare(String(b.name));
        });

      const catRows = catsList.map((c) => ({
        categoria: c.name,
        pct: Number((c.promedio_pct ?? 0).toFixed(1)),
        categoriaId: c.id,
        order: c.order ?? 0,
      }));

      setCatAggRows(catRows);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setQLineSeries([]);
      setCatAggRows([]);
      setError(e?.message ?? "No se pudieron cargar agregados");
    }
  }

  // ===== efectos =====
  React.useEffect(() => {
    setLoading(true);
    cargarSoloRankingYCiclos()
      .then(() => cargarKpisYComentarios())
      .then(() => cargarAgregados())
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, idioma]);

  React.useEffect(() => {
    cargarKpisYComentarios();
    cargarAgregados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloSel]);

  async function recargar() {
    setRefreshing(true);
    try {
      await Promise.all([cargarSoloRankingYCiclos(), cargarKpisYComentarios(), cargarAgregados()]);
    } finally {
      setRefreshing(false);
    }
  }

  function CicloSelectorInline() {
    return (
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={cicloSel}
          onChange={(e) => setCicloSel(e.target.value)}
          title="Filtrar: todos los ciclos o un ciclo específico"
          aria-label="Seleccionar ciclo"
        >
          <option value="all">Todos los cursos</option>
          {ciclos.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.codigo}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={recargar}
          disabled={refreshing}
          title="Actualizar"
          aria-label="Actualizar datos"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  // tono dinámico para la satisfacción global
const satisfaction = kpis?.promedio_global_pct ?? null;
const statTone: StatTone =
satisfaction == null ? "default" : satisfaction >= 80 ? "success" : "danger";

  // ====== UI ======
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">Resumen de Coordinación</h1>
            {kpis?.promedio_global_pct != null && (
              <Badge variant="secondary">Satisfacción global: {kpis.promedio_global_pct.toFixed(1)}%</Badge>
            )}
            {anio ? <Badge variant="outline">Año: {anio}</Badge> : null}
            {idioma ? <Badge variant="outline">Idioma: {idioma}</Badge> : null}
            {/* ⬇️ Badge con el ciclo seleccionado en el ENCABEZADO */}
            <Badge variant="outline">{cicloName}</Badge>
          </div>
          <CicloSelectorInline />
        </div>

        {/* KPIs — ahora auto-fit y usan toda la fila; centrado responsivo */}
        <section
          aria-label="Indicadores clave"
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <Card key={i} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                  </div>
                  <Skeleton className="mt-3 h-7 w-28" />
                  <Skeleton className="mt-2 h-5 w-24" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      label="Grupos activos"
                      value={kpis ? String(kpis.grupos_activos) : "—"}
                      hint="Cursos de idiomas"
                      icon={<LayoutGrid className="h-4 w-4" />}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Grupos con actividad en el universo seleccionado.</TooltipContent>
              </Tooltip>

              <StatCard
                label="Docentes"
                value={kpis ? String(kpis.docentes_asignados) : "—"}
                hint="Asignados a grupos"
                icon={<Users className="h-4 w-4" />}
              />

              {/* ✅ Card unificada de alumnos con desglose */}
              <StatCard
                label="Alumnos"
                value={kpis ? String(kpis.alumnos_matriculados) : "—"}
                hint={kpis ? `IPN: ${kpis.alumnos_ipn} · Externos: ${kpis.alumnos_externos}` : undefined}
                icon={<GraduationCap className="h-4 w-4" />}
              />

              {/* Monto verificado (inscripciones) — sin truncar */}
              <StatCard
                label="Monto de inscripciones"
                value={kpis ? <Currency value={kpis.pagos_monto_total} currency={currency} /> : "—"}
                hint="Comprobantes validados"
                icon={<CircleDollarSign className="h-4 w-4" />}
                tone="warning"
              />

              {/* ⬇️ Mover “Monto placement” justo DESPUÉS de “Monto verificado” */}
              {cicloSel === "all" && (
                <StatCard
                  label="Monto de exámenes"
                  value={montos ? <Currency value={montos.placement_total_mxn ?? 0} currency={currency} /> : "—"}
                  hint="Comprobantes validados"
                  icon={<CircleDollarSign className="h-4 w-4" />}
                />
              )}

              <StatCard
                label="Satisfacción global"
                value={kpis ? `${kpis.promedio_global_pct.toFixed(1)}%` : "—"}
                hint="Encuestas de satisfacción"
                icon={<TrendingUp className="h-4 w-4" />}
                tone={statTone}
              />
            </>
          )}
        </section>

        {/* Fila 1: Preguntas (LÍNEA) y Categorías (BARRAS) */}
        <section className="grid gap-3 md:grid-cols-2">
          {/* Preguntas P1..Pn (LINE CHART) */}
          <Card className="rounded-2xl">
            <div className="flex items-center justify-between px-6 pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">
                  {`Promedio por pregunta (${cicloTitle})`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{cicloName}</Badge>
                <span className="text-xs text-muted-foreground">0–100%</span>
              </div>
            </div>
            <CardContent className="pt-2">
              <div className="h-[320px] w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando…
                  </div>
                ) : !qLineSeries.length || !qLineSeries[0]?.data?.length ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <MessageSquareText className="h-6 w-6 mb-2 opacity-70" />
                    Sin datos.
                  </div>
                ) : (
                  // @ts-expect-error: dynamic import
                  <ResponsiveLine
                    data={qLineSeries}
                    margin={{ top: 16, right: 24, bottom: 42, left: 48 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: 0, max: 100, stacked: false }}
                    curve="monotoneX"
                    enablePoints
                    pointSize={9}
                    pointBorderWidth={2}
                    enableGridX={false}
                    enableGridY
                    gridYValues={[0, 20, 40, 60, 80, 100]}
                    axisBottom={{ legend: "", legendOffset: 30, legendPosition: "middle" }}
                    axisLeft={{ tickValues: [0, 20, 40, 60, 80, 100], legend: "Promedio (%)", legendOffset: -42, legendPosition: "middle" }}
                    colors={PALETTE_LINE}
                    useMesh
                    enableSlices="x"
                    // 🔽🔽🔽 Tooltips restaurados
                    pointTooltip={({ point }) => {
                      const d: any = point.data;
                      const emb = (d?.data as any) || d || {};
                      const qid = emb.qid;
                      const full =
                        emb.preguntaFull ??
                        (qid !== undefined ? qTextoRef.current[qid] : undefined) ??
                        String(d.x);
                      const short = String(d.x);
                      const y = Number(d.y ?? 0).toFixed(1);
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
                          <div className="text-muted-foreground">{y}%</div>
                        </div>
                      );
                    }}
                    sliceTooltip={({ slice }) => {
                      const d0: any = slice.points[0]?.data;
                      const emb0 = (d0?.data as any) || d0 || {};
                      const short = String(d0?.x ?? "");
                      const qid0 = emb0.qid;
                      const full =
                        emb0.preguntaFull ??
                        (qid0 !== undefined ? qTextoRef.current[qid0] : undefined) ??
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
                            const y = Number(pd?.y ?? 0).toFixed(1);
                            return (
                              <div key={p.id} className="flex items-center gap-2">
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ background: p.color }}
                                />
                                <span className="text-muted-foreground">{y}%</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                    legends={[]}
                    theme={{
                      text: { fontSize: 12 },
                      axis: {
                        ticks: { text: { fill: "hsl(var(--foreground))" } },
                        legend: { text: { fill: "hsl(var(--muted-foreground))" } },
                      },
                      grid: { line: { stroke: "hsl(var(--muted))", strokeDasharray: "4 4", strokeWidth: 1 } },
                      tooltip: {
                        container: {
                          background: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                          border: "1px solid " + "hsl(var(--border))",
                        },
                      },
                    }}
                    role="application"
                    ariaLabel="Promedio por pregunta"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Categorías (BARRAS) */}
          <Card className="rounded-2xl">
            <div className="flex items-center justify-between px-6 pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">
                  {`Promedio por categoría (${cicloTitle})`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{cicloName}</Badge>
                <span className="text-xs text-muted-foreground">0–100%</span>
              </div>
            </div>
            <CardContent className="pt-2">
              <div className="h-[320px] w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando…
                  </div>
                ) : !catAggRows.length ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <MessageSquareText className="h-6 w-6 mb-2 opacity-70" />
                    Sin datos.
                  </div>
                ) : (
                  // @ts-expect-error: dynamic import
                  <ResponsiveBar
                    data={catAggRows}
                    keys={["pct"]}
                    indexBy="categoria"
                    margin={{ top: 6, right: 12, bottom: 40, left: 44 }}
                    padding={0.3}
                    valueScale={{ type: "linear", min: 0, max: 100 }}
                    indexScale={{ type: "band", round: true }}
                    enableGridY
                    enableGridX={false}
                    valueFormat={(v) => `${Number(v).toFixed(1)}%`}
                    axisBottom={{ legend: "", legendOffset: 32, legendPosition: "middle" }}
                    axisLeft={{ tickValues: [0, 20, 40, 60, 80, 100], legend: "", legendOffset: -38, legendPosition: "middle" }}
                    labelSkipWidth={24}
                    labelSkipHeight={12}
                    labelTextColor={{ from: "color", modifiers: [["darker", 3]] }}
                    colors={({ data }) =>
                      new Map(catAggRows.map((c, i) => [c.categoriaId, PALETTE_BAR[i % PALETTE_BAR.length]])).get(
                        (data as any).categoriaId
                      ) || PALETTE_BAR[0]
                    }
                    legends={[]}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Fila 2: Comentarios (izquierda) + Ranking (derecha) */}
        <section className="grid gap-3 md:grid-cols-2">
          {/* Comentarios primero */}
          <Card className="rounded-2xl md:order-1">
            <div className="px-6 pt-4 text-sm font-medium">Comentarios recientes</div>
            <CardContent className="pt-2">
              {loading ? (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cargando…
                </div>
              ) : comments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay comentarios.</div>
              ) : (
                <ScrollArea className="h-[240px] pr-3">
                  <ul className="space-y-2">
                    {comments.map((c) => (
                      <li key={String(c.id)} className="rounded-lg border p-2">
                        <div className="text-[11px] text-muted-foreground mb-1">
                          <span className="font-medium">{c.ciclo}</span>
                          {c.docente ? <> · Docente: {c.docente}</> : null}
                          {c.created_at ? <> · {new Date(c.created_at).toLocaleString()}</> : null}
                        </div>
                        {c.pregunta && <div className="text-[11px] text-muted-foreground mb-1">{c.pregunta}</div>}
                        <div className="whitespace-pre-wrap break-words text-sm">{c.texto}</div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Ranking a la derecha */}
          <Card className="rounded-2xl md:order-2">
            <div className="px-6 pt-4 text-sm font-medium">Ranking de docentes</div>
            <CardContent className="pt-2">
              {loading ? (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cargando…
                </div>
              ) : !rank ? (
                <div className="text-sm text-muted-foreground">Sin datos.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Top */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Mejores</div>
                    {rank.top.map((r) => (
                      <div
                        key={`top-${r.docente_id}`}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{r.docente}</div>
                          <div className="text-[11px] text-muted-foreground">{r.grupos} grupos</div>
                        </div>
                        <Badge variant="secondary">{r.promedio_pct.toFixed(1)}%</Badge>
                      </div>
                    ))}
                  </div>
                  {/* Bottom */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Oportunidad</div>
                    {rank.bottom.map((r) => (
                      <div
                        key={`bot-${r.docente_id}`}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{r.docente}</div>
                          <div className="text-[11px] text-muted-foreground">{r.grupos} grupos</div>
                        </div>
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                          {r.promedio_pct.toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {error && <div className="text-xs text-amber-600">{error}</div>}
        {!loading && <Separator className="my-1" />}
        <div className="text-[11px] text-muted-foreground">
          En la gráfica de <b>preguntas</b> pasa el cursor por un punto para ver <i>P# — enunciado</i> y el porcentaje.
        </div>
      </div>
    </TooltipProvider>
  );
}
