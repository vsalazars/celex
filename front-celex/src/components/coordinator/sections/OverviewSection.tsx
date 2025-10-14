"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  GraduationCap,
  LayoutGrid,
  BarChart3,
  MessageSquareText,
  CircleDollarSign,
  Sparkles,
  Crown,
  Target,
  Award,
  Zap,
  Rocket,
 
} from "lucide-react";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

/* ===== API ===== */
import {
  getCoordKpis,
  getCoordCategoriasAgg,
  getCoordRanking,
  getCoordComentariosRecientes,
  getCoordPreguntasAgg,
  getDashCiclos,
  type CoordKpisOut as KpisOut,
  type CoordRankingOut as RankingOut,
  type CoordComentario as Comentario,
  type DashCicloLite,
  type CoordPreguntasAggOut,
  getCoordMontos,
  type CoordMontosOut,
} from "@/lib/api";

/* ===== Recharts ===== */
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  Cell,
  ComposedChart,   // ← aquí
  ReferenceLine,   // ← aquí
  LabelList,       // ← aquí
} from "recharts";

/* ===== Paletas ===== */
const PALETTE_LINE = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];
const PALETTE_BAR  = ["#34d399", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#6ee7b7"];

/* ===== Tooltips ===== */
const TOOLTIP_FONT_PX = 12;
const TOOLTIP_MAX_W_PX = 560;
const TOOLTIP_FIXED_W_PX = 220;
const TOOLTIP_MIN_H_PX = 52;

/* ===== Helpers ===== */
function Currency({
  value,
  locale = "es-MX",
  currency = "MXN",
}: { value: number; locale?: string; currency?: string }) {
  try {
    return (
      <>
        {new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(value)}
      </>
    );
  } catch {
    return <>{value.toFixed(2)}</>;
  }
}

/* ===================== COMPONENTES ===================== */

type PrismTone = "success" | "danger" | "warning" | "info" | "premium";
function toneStyles(t: PrismTone) {
  switch (t) {
    case "success":
      return {
        ring: "ring-emerald-400/60",
        pill: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60",
        bar: "bg-emerald-500",
        gradient: "from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20",
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      };
    case "danger":
      return {
        ring: "ring-red-400/60",
        pill: "bg-red-600/15 text-red-700 dark:text-red-300 border border-red-200/60",
        bar: "bg-red-500",
        gradient: "from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20",
        iconBg: "bg-red-500/10 text-red-600 dark:text-red-400"
      };
    case "warning":
      return {
        ring: "ring-amber-400/60",
        pill: "bg-amber-600/15 text-amber-700 dark:text-amber-300 border border-amber-200/60",
        bar: "bg-amber-500",
        gradient: "from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20",
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      };
    case "premium":
      return {
        ring: "ring-purple-400/60",
        pill: "bg-purple-600/15 text-purple-700 dark:text-purple-300 border border-purple-200/60",
        bar: "bg-purple-500",
        gradient: "from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20",
        iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400"
      };
    default:
      return {
        ring: "ring-sky-400/60",
        pill: "bg-sky-600/15 text-sky-700 dark:text-sky-300 border border-sky-200/60",
        bar: "bg-sky-500",
        gradient: "from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20",
        iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400"
      };
  }
}

function PrismTile({
  label,
  value,
  hint,
  icon,
  tone = "info",
  delta,
  deltaDir,
  progressPct,
  featured = false,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: PrismTone;
  delta?: string;
  deltaDir?: "up" | "down";
  progressPct?: number;
  featured?: boolean;
  className?: string;
}) {
  const s = toneStyles(tone);
  const pct = Math.max(0, Math.min(100, Number(progressPct ?? 0)));

  return (
    <div
      className={[
        "relative rounded-xl border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        "box-border",                 // padding/border no suma al alto
        "ring-1", s.ring,
        "transition-all duration-300 hover:-translate-y-0.5",
        featured
          ? "shadow-[0_6px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
          : "shadow-[0_3px_16px_-6px_rgba(0,0,0,0.22)] hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.28)]",
        "min-h-[96px] sm:min-h-[108px]", // compacto y consistente
        "xl:h-full",                     // solo en XL llenan su fila
        className,
      ].join(" ")}
    >
      {featured && (
        <div className="absolute -top-1.5 -right-1.5">
          <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
        </div>
      )}

      <div className="p-3 pb-4 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {icon && <span className="text-muted-foreground/60">{icon}</span>}
              {label}
            </div>
            <div className="mt-1 text-lg sm:text-xl font-bold leading-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {value}
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {hint}
              {delta ? (
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                  deltaDir === "down" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                }`}>
                  <TrendingUp className={`h-3 w-3 ${deltaDir === "down" ? "rotate-180" : ""}`} />
                  {delta}
                </span>
              ) : null}
            </div>
          </div>
          {icon ? (
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${s.iconBg} backdrop-blur-sm`}>
              {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4" })}
            </div>
          ) : null}
        </div>

        {typeof progressPct === "number" ? (
          <div className="mt-auto">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>Progreso</span>
              <span className="font-semibold">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/50 relative overflow-hidden">
              <div className={`absolute left-0 top-0 h-full ${s.bar} transition-all duration-700 ease-out rounded-full`} style={{ width: `${pct}%` }} />
              <div className={`absolute left-0 top-0 h-full ${s.bar} opacity-30 blur-[2px] transition-all duration-700 ease-out rounded-full`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  chips,
  right,
}: { title: string; chips?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur h-16">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <div className="relative z-10 flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1.5 bg-gradient-to-b from-primary to-secondary rounded-full" />
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            {title}
          </h1>
          {chips && <div className="flex flex-wrap items-center gap-2">{chips}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

function EnhancedBadge({
  children,
  variant = "default",
  className = "",
  ...props
}: { children: React.ReactNode; variant?: "default" | "secondary" | "outline" | "premium"; className?: string }) {
  const baseStyles = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border border-border bg-background/50 hover:bg-accent hover:text-accent-foreground",
    premium: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow hover:shadow-md"
  };
  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {variant === "premium" && <Sparkles className="h-3 w-3 mr-1" />}
      {children}
    </span>
  );
}

/* ===================== COMPONENTE PRINCIPAL ===================== */
export default function OverviewSectionConLinea({
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
  const [montos, setMontos] = React.useState<CoordMontosOut | null>(null);

  // Ciclos
  const [ciclos, setCiclos] = React.useState<DashCicloLite[]>([]);
  const [cicloSel, setCicloSel] = React.useState<string>("all");

  const cicloObj = React.useMemo(
    () => (cicloSel === "all" ? null : ciclos.find((c) => String(c.id) === String(cicloSel)) || null),
    [cicloSel, ciclos]
  );
  const cicloName  = cicloObj ? `${cicloObj.codigo}` : "Todos los cursos";
  const cicloTitle = cicloObj ? `Ciclo ${cicloObj.codigo}` : "Todos los cursos";

  // Preguntas (línea)
  type QPoint = { x: string; y: number; qid: string | number; preguntaFull: string };
  const [qLineSeries, setQLineSeries] = React.useState<{ id: string; data: QPoint[] }[]>([]);
  const qTextoRef = React.useRef<Record<string | number, string>>({});

  // ====== Tooltips Recharts (reponer) ======
function LineTooltip({
  active,
  payload,
  label,
}: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;

  // Intentamos leer la info extendida de la pregunta
  const d = payload[0]?.payload as any | undefined;
  const y = payload[0]?.value as number | undefined;
  const full =
    d?.preguntaFull ??
    (d?.qid !== undefined ? qTextoRef.current[d.qid] : undefined) ??
    label;

  return (
    <div
      className="rounded-lg border bg-background/95 backdrop-blur-xl shadow-2xl p-3 border-border/50"
      style={{ fontSize: TOOLTIP_FONT_PX, maxWidth: TOOLTIP_MAX_W_PX }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-2 w-2 rounded-full" style={{ background: PALETTE_LINE[0] }} />
        <div className="font-semibold text-foreground">{label}</div>
      </div>
      <div className="text-muted-foreground mb-1.5 text-sm leading-relaxed">{full}</div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Puntuación:</span>
        <span className="font-bold" style={{ color: PALETTE_LINE[0] }}>
          {Number(y ?? 0).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function BarTooltip({
  active,
  payload,
  label,
}: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value as number | undefined;
  const color = payload[0]?.color as string | undefined;

  return (
    <div
      className="rounded-lg border bg-background/95 backdrop-blur-xl shadow-2xl p-3 border-border/50"
      style={{ fontSize: TOOLTIP_FONT_PX, width: TOOLTIP_FIXED_W_PX, minHeight: TOOLTIP_MIN_H_PX }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-3 h-3 rounded-full shadow-sm" style={{ background: color }} />
        <span className="font-semibold text-foreground">{String(label)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Porcentaje</span>
        <span className="font-bold text-base" style={{ color }}>
          {Number(v ?? 0).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}


  // Categorías (barras)
  const [catAggRows, setCatAggRows] = React.useState<
    { categoria: string; pct: number; categoriaId: string | number; order: number }[]
  >([]);

  // ====== Cargas ======
  async function cargarSoloRankingYCiclos() {
    try {
      const [r, rows] = await Promise.all([
        getCoordRanking({ anio, idioma, limitTop: 8, limitBottom: 8 }),
        getDashCiclos({ anio, idioma }),
      ]);
      rows.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
      setRank(r);
      setCiclos(rows);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar ranking/ciclos");
    }
  }

  async function cargarKpisYComentarios() {
    setError(null);
    try {
      const cicloId = cicloSel !== "all" ? Number(cicloSel) : undefined;
      const [k, cm] = await Promise.all([
        getCoordKpis({ anio, idioma, cicloId }),
        getCoordComentariosRecientes({ anio, idioma, limit: 40, cicloId }),
      ]);
      setKpis(k);
      setComments(cm ?? []);

      if (cicloSel === "all") {
        const m = await getCoordMontos({ anio, idioma });
        setMontos(m);
      } else {
        setMontos(null);
      }
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar KPIs/comentarios");
      setKpis(null);
      setComments([]);
      setMontos(null);
    }
  }

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

    const puntos: QPoint[] = preguntas.slice(0, 18).map((q, idx) => ({
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

      const catRows = catsList.slice(0, 12).map((c) => ({
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

  React.useEffect(() => {
    setLoading(true);
    cargarSoloRankingYCiclos()
      .then(() => cargarKpisYComentarios())
      .then(() => cargarAgregados())
      .finally(() => setLoading(false));
  }, [anio, idioma]);

  React.useEffect(() => {
    cargarKpisYComentarios();
    cargarAgregados();
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
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <select
            className="h-9 rounded-lg border bg-background/80 backdrop-blur px-3 pr-9 text-sm font-medium shadow-sm transition-all hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20"
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
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg border bg-background/80 backdrop-blur shadow-sm transition-all hover:shadow-md hover:scale-[1.03]"
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

  const satisfaction = kpis?.promedio_global_pct ?? null;
  const toneGlobal: PrismTone = satisfaction == null ? "info" : satisfaction >= 80 ? "success" : "danger";

  /* ===================== RENDER ===================== */
  return (
    <div className="h-svh min-h-0 bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden flex flex-col gap-4 p-4">
      {/* HEADER */}
      <SectionHeader
        title="Dashboard de Coordinación"
        chips={
          <>
            {kpis?.promedio_global_pct != null && (
              <EnhancedBadge
                variant={toneGlobal === "success" ? "premium" : "outline"}
                className={toneGlobal === "danger" ? "border-red-300 bg-red-500/10 text-red-700 dark:text-red-300" : ""}
              >
                <Target className="h-3 w-3 mr-1" />
                {kpis.promedio_global_pct.toFixed(1)}%
              </EnhancedBadge>
            )}
            {anio && <EnhancedBadge variant="outline">📅 {anio}</EnhancedBadge>}
            {idioma && <EnhancedBadge variant="outline">🌐 {idioma}</EnhancedBadge>}
            <EnhancedBadge variant="secondary">
              <Rocket className="h-3 w-3 mr-1" />
              {cicloObj ? `Ciclo ${cicloObj.codigo}` : "Todos los cursos"}
            </EnhancedBadge>
          </>
        }
        right={<CicloSelectorInline />}
      />

      {/* CONTENIDO PRINCIPAL */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* ===== KPIs ===== */}
        <div className="col-span-12 xl:col-span-2 min-h-0">
          <div
            className={[
              "grid gap-3 min-h-0",
              // Móvil/MD: alto auto + scroll si hiciera falta
              "max-h-full overflow-y-auto overscroll-contain",
              // XL: ocupar todo el alto de la columna sin desbordar
              "xl:h-full xl:overflow-hidden xl:[grid-template-rows:repeat(5,minmax(0,1fr))]",
              "pb-1",
            ].join(" ")}
          >
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-3 bg-background/50 animate-pulse min-h-[96px] sm:min-h-[108px] xl:h-full" />
              ))
            ) : (
              <>
                <PrismTile
                  label="Grupos activos"
                  value={kpis ? String(kpis.grupos_activos) : "—"}
                  hint={<span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-200/60">Cursos de idiomas</span>}
                  icon={<LayoutGrid className="h-4 w-4" />}
                  tone="info"
                />
                <PrismTile
                  label="Docentes"
                  value={kpis ? String(kpis.docentes_asignados) : "—"}
                  hint={<span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-200/60">Asignados a grupos</span>}
                  icon={<Users className="h-4 w-4" />}
                  tone="info"
                />
                <PrismTile
                  label="Alumnos"
                  value={kpis ? String(kpis.alumnos_matriculados) : "—"}
                  hint={
                    kpis && (
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-600/10 text-purple-700 dark:text-purple-300 border border-purple-200/60">
                          IPN: {kpis.alumnos_ipn}
                        </span>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-600/10 text-purple-700 dark:text-purple-300 border border-purple-200/60">
                          Ext: {kpis.alumnos_externos}
                        </span>
                      </div>
                    )
                  }
                  icon={<GraduationCap className="h-4 w-4" />}
                  tone="premium"
                  featured
                />
                <PrismTile
                  label="Ingresos"
                  value={
                    <div className="flex flex-col gap-0.5">
                      <div className="leading-none">
                        <span className="font-semibold">Inscripciones: </span>
                        {kpis ? <Currency value={Number(kpis?.pagos_monto_total ?? 0)} currency={currency} /> : "—"}
                      </div>
                      {cicloSel === "all" && (
                        <div className="leading-none">
                          <span className="font-semibold">Exámenes: </span>
                          <Currency value={Number(montos?.placement_total_mxn ?? 0)} currency={currency} />
                        </div>
                      )}
                    </div>
                  }
                  hint={
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-600/10 text-amber-700 dark:text-amber-300 border border-amber-200/60">
                        Comprobantes validados
                      </span>
                      {cicloSel === "all" && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
                          Placement validados
                        </span>
                      )}
                    </div>
                  }
                  icon={<CircleDollarSign className="h-4 w-4" />}
                  tone="warning"
                />
                <PrismTile
                  label="Satisfacción global"
                  value={kpis ? `${kpis.promedio_global_pct.toFixed(1)}%` : "—"}
                  hint={<span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">Encuestas</span>}
                  icon={<TrendingUp className="h-4 w-4" />}
                  tone={toneGlobal}
                  delta={typeof satisfaction === "number" ? (satisfaction >= 80 ? "+Buen desempeño" : "Mejorar") : undefined}
                  deltaDir={typeof satisfaction === "number" && satisfaction < 80 ? "down" : "up"}
                  progressPct={typeof satisfaction === "number" ? satisfaction : undefined}
                  featured={typeof satisfaction === "number" && satisfaction >= 80}
                />
              </>
            )}
          </div>
        </div>

        {/* ===== GRÁFICAS ===== */}
        <div className="col-span-12 xl:col-span-7 h-full min-h-0 overflow-hidden">
          <div className="grid h-full min-h-0 grid-rows-2 gap-4">
            {/* Línea */}
            <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow">
              <div className="flex items-center justify-between px-4 pt-3 pb-1.5 bg-gradient-to-r from-background/80 to-background/40">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{`Promedio por pregunta`}</div>
                    <div className="text-[11px] text-muted-foreground">{cicloObj ? `Ciclo ${cicloObj.codigo}` : "Todos los cursos"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <EnhancedBadge variant="outline">{cicloName}</EnhancedBadge>
                  <span className="text-[11px] text-muted-foreground font-medium">0–100%</span>
                </div>
              </div>
              <CardContent className="pt-2 h-[calc(100%-56px)] px-2">
                <div className="h-full w-full min-h-[240px] sm:min-h-[280px]">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cargando…
                    </div>
                  ) : !qLineSeries.length || !qLineSeries[0]?.data?.length ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <MessageSquareText className="h-7 w-7 mb-2 opacity-70" />
                      <div className="text-sm">Sin datos disponibles</div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={qLineSeries[0].data} margin={{ top: 8, right: 16, bottom: 20, left: 16 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={PALETTE_LINE[0]} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={PALETTE_LINE[0]} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted))" opacity={0.5} vertical={false}/>
                        <XAxis dataKey="x" tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }} tickMargin={8} axisLine={false} tickLine={false}/>
                        <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }} ticks={[0,20,40,60,80,100]} width={40} axisLine={false} tickLine={false}/>
                        <RTooltip content={<LineTooltip />} />
                        <Area type="monotone" dataKey="y" name="Promedio (%)" stroke={PALETTE_LINE[0]} fill="url(#colorValue)" strokeWidth={2.0}
                              dot={{ r: 3.2, fill: PALETTE_LINE[0], strokeWidth: 1.8, stroke: '#fff' }}
                              activeDot={{ r: 4.6, fill: PALETTE_LINE[0], stroke: '#fff', strokeWidth: 2.2 }}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Barras */}
           <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow">
            <CardContent className="p-2 h-full">
              <div className="h-full w-full min-h-[220px] sm:min-h-[260px]">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando…
                  </div>
                ) : !catAggRows.length ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <MessageSquareText className="h-7 w-7 mb-2 opacity-70" />
                    <div className="text-sm">Sin datos disponibles</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      layout="vertical"
                      data={catAggRows}
                      margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="hsl(var(--muted))"
                        opacity={0.5}
                        vertical={false}
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 20, 40, 60, 80, 100]}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 10.5, fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="categoria"
                        width={Math.min(180, Math.max(110, (catAggRows?.reduce((m, c) => Math.max(m, (c.categoria?.length || 0)), 0) || 10) * 6))}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 10.5, fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={6}
                      />
                      <RTooltip content={<BarTooltip />} />

                      {/* Línea objetivo (ajusta x={80} a tu meta) */}
                      <ReferenceLine
                        x={80}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="6 4"
                        ifOverflow="extendDomain"
                      />

                      <Bar
                        dataKey="pct"
                        name="Porcentaje"
                        barSize={12}                 // grosor tipo “lollipop”
                        radius={[0, 8, 8, 0]}        // termina con píldora a la derecha
                        isAnimationActive
                        animationDuration={650}
                      >
                        {/* Colorear cada barra como antes */}
                        {catAggRows.map((row, i) => (
                          <Cell
                            key={`cell-${row.categoriaId}`}
                            fill={PALETTE_BAR[i % PALETTE_BAR.length]}
                            className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                            stroke="hsl(var(--background))"
                            strokeWidth={1}
                          />
                        ))}

                        {/* Valor al final de cada barra */}
                        <LabelList
                          dataKey="pct"
                          position="right"
                          formatter={(v: number) => `${Number(v ?? 0).toFixed(1)}%`}
                          className="text-[11px] font-semibold"
                          offset={8}
                        />
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          </div>
        </div>

        {/* ===== RANKING + COMENTARIOS ===== */}
        <div className="col-span-12 xl:col-span-3 h-full min-h-0 overflow-hidden">
          <div className="grid h-full min-h-0 grid-rows-2 gap-4">
            {/* Ranking */}
            <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-background/80 to-background/40">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Ranking de docentes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 h-[calc(100%-56px)] px-2 flex flex-col min-h-0 overflow-hidden">
                {loading || !rank ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando…
                      </div>
                    ) : (
                      <div className="text-sm">Sin datos disponibles</div>
                    )}
                  </div>
                ) : (
                  <Tabs defaultValue="mejores" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="px-1 pb-2">
                      <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-lg">
                        <TabsTrigger value="mejores" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                          <Award className="h-3.5 w-3.5 mr-1.5" />
                          Mejores
                        </TabsTrigger>
                        <TabsTrigger value="oportunidad" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                          <Zap className="h-3.5 w-3.5 mr-1.5" />
                          Oportunidad
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="mejores" className="flex-1 m-0 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full pr-2">
                        <div className="grid grid-cols-1 gap-2.5">
                          {rank.top.map((r, index) => (
                            <div key={`top-${r.docente_id}`} className="rounded-lg border p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/10 dark:to-green-950/10 border-emerald-200/50 dark:border-emerald-800/30 transition-all hover:shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    {index < 3 && (
                                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${
                                        index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-500' : 'bg-amber-700'
                                      }`}>
                                        {index + 1}
                                      </div>
                                    )}
                                    <div className="font-semibold text-sm truncate">{r.docente}</div>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">{r.grupos} grupos</div>
                                </div>
                                <Badge className="bg-emerald-500 text-white shadow-sm border-0 font-semibold">
                                  {r.promedio_pct.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="oportunidad" className="flex-1 m-0 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full pr-2">
                        <div className="grid grid-cols-1 gap-2.5">
                          {rank.bottom.map((r) => (
                            <div key={`bot-${r.docente_id}`} className="rounded-lg border p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/10 dark:to-orange-950/10 border-amber-200/50 dark:border-amber-800/30 transition-all hover:shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm truncate mb-0.5">{r.docente}</div>
                                  <div className="text-[11px] text-muted-foreground">{r.grupos} grupos</div>
                                </div>
                                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 font-semibold">
                                  {r.promedio_pct.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>

            {/* Comentarios */}
            <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-background/80 to-background/40">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5 text-blue-500" />
                  Comentarios recientes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 h-[calc(100%-56px)] px-2 min-h-0">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando…
                  </div>
                ) : comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <MessageSquareText className="h-7 w-7 mb-2 opacity-70" />
                    <div className="text-sm">No hay comentarios</div>
                  </div>
                ) : (
                  <ScrollArea className="h-full pr-2">
                    <ul className="grid grid-cols-1 gap-2.5">
                      {comments.map((c) => (
                        <li key={String(c.id)} className="rounded-lg border p-3 bg-background/50 backdrop-blur-sm transition-all hover:shadow-sm hover:bg-background/70">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {c.ciclo && (
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {c.ciclo}
                                </span>
                              )}
                              {c.docente && (
                                <span className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                                  {c.docente}
                                </span>
                              )}
                            </div>
                            {c.created_at && (
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {new Date(c.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {c.pregunta && (
                            <div className="mb-1.5">
                              <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">Pregunta:</div>
                              <div className="text-sm text-foreground/90 bg-muted/30 rounded px-2 py-1.5">
                                {c.pregunta}
                              </div>
                            </div>
                          )}

                          <div className="text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap break-words">
                            {c.texto}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-3 backdrop-blur">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <Zap className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      <Separator className="my-1 opacity-50" />

      <div className="text-center">
        <div className="text-[11px] text-muted-foreground/80 font-medium">
          Dashboard afinado para máxima densidad visual <Sparkles className="h-3 w-3 inline mx-1" />
        </div>
      </div>
    </div>
  );
}
