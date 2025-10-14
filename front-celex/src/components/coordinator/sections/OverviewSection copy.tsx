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

/* NEW: Tabs shadcn */
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

/* ===== API (tus endpoints originales) ===== */
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

/* ===== Recharts (estilo shadcn) ===== */
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
} from "recharts";

/* ===== Paletas mejoradas ===== */
const PALETTE_LINE = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];
const PALETTE_BAR  = ["#34d399", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#6ee7b7"];
const PALETTE_GRADIENT = {
  emerald: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  amber: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  blue: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  purple: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
};

/* ===== Tooltips ===== */
const TOOLTIP_FONT_PX = 12;
const TOOLTIP_PADDING_PX = 8;
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

/* ===================== COMPONENTES MEJORADOS ===================== */

/** PrismTile: métrica moderna mejorada */
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
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: PrismTone;
  delta?: string;
  deltaDir?: "up" | "down";
  progressPct?: number;
  featured?: boolean;
}) {
  const s = toneStyles(tone);
  const pct = Math.max(0, Math.min(100, Number(progressPct ?? 0)));
  
  return (
    <div
      className={[
        "relative rounded-2xl border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
        "ring-1", s.ring, 
        featured ? "shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.2)]" : "shadow-[0_4px_24px_-6px_rgba(0,0,0,0.2)] hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]",
        "transition-all duration-300 hover:-translate-y-1",
        featured && `bg-gradient-to-br ${s.gradient}`
      ].join(" ")}
    >
      {featured && (
        <div className="absolute -top-2 -right-2">
          <div className="relative">
            <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500 animate-pulse" />
          </div>
        </div>
      )}
      
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              {icon && <span className="text-muted-foreground/60">{icon}</span>}
              {label}
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight leading-none bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {value}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {hint ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.pill}`}>
                  {hint}
                </span>
              ) : null}
              {delta ? (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  deltaDir === "down" 
                    ? "text-red-600 dark:text-red-400" 
                    : "text-emerald-700 dark:text-emerald-400"
                }`}>
                  {deltaDir === "down" ? (
                    <TrendingUp className="h-3 w-3 rotate-180" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {delta}
                </span>
              ) : null}
            </div>
          </div>
          {icon ? (
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${s.iconBg} backdrop-blur-sm`}>
              {React.cloneElement(icon as React.ReactElement, { 
                className: "h-5 w-5" 
              })}
            </div>
          ) : null}
        </div>

        {typeof progressPct === "number" ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progreso</span>
              <span className="font-semibold">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/50 relative overflow-hidden">
              <div 
                className={`absolute left-0 top-0 h-full ${s.bar} transition-all duration-1000 ease-out rounded-full`} 
                style={{ width: `${pct}%` }} 
              />
              <div 
                className={`absolute left-0 top-0 h-full ${s.bar} opacity-30 blur-sm transition-all duration-1000 ease-out rounded-full`} 
                style={{ width: `${pct}%` }} 
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** SectionHeader mejorado con efecto glassmorphism */
function SectionHeader({
  title,
  chips,
  right,
}: { title: string; chips?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur-xl h-20">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -translate-y-16 translate-x-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-secondary/10 to-transparent rounded-full translate-y-12 -translate-x-12" />
      
      <div className="relative z-10 flex h-full items-center justify-between px-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-gradient-to-b from-primary to-secondary rounded-full" />
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {title}
            </h1>
          </div>
          {chips && (
            <div className="flex flex-wrap items-center gap-2">
              {chips}
            </div>
          )}
        </div>
        {right}
      </div>
    </div>
  );
}

/** Badge mejorado */
function EnhancedBadge({ 
  children, 
  variant = "default",
  className = "",
  ...props 
}: { children: React.ReactNode; variant?: "default" | "secondary" | "outline" | "premium"; className?: string }) {
  const baseStyles = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors";
  
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border border-border bg-background/50 hover:bg-accent hover:text-accent-foreground",
    premium: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl transition-shadow"
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
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            className="h-10 rounded-xl border bg-background/80 backdrop-blur px-4 pr-10 text-sm font-medium shadow-sm transition-all hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20"
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
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl border bg-background/80 backdrop-blur shadow-sm transition-all hover:shadow-md hover:scale-105"
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

  const montoIns = Number(kpis?.pagos_monto_total ?? 0);
  const montoPlac = Number(montos?.placement_total_mxn ?? 0);

  /* ====== Tooltips Recharts (custom mejorados) ====== */
  function LineTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as QPoint | undefined;
    const y = payload[0]?.value as number | undefined;
    const full =
      d?.preguntaFull ??
      (d?.qid !== undefined ? qTextoRef.current[d.qid] : undefined) ??
      label;

    return (
      <div
        className="rounded-xl border bg-background/95 backdrop-blur-xl shadow-2xl p-4 border-border/50"
        style={{ fontSize: TOOLTIP_FONT_PX, maxWidth: TOOLTIP_MAX_W_PX }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <div className="font-semibold text-foreground">{label}</div>
        </div>
        <div className="text-muted-foreground mb-2 text-sm leading-relaxed">{full}</div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Puntuación:</span>
          <span className="font-bold text-emerald-600">{Number(y ?? 0).toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  function BarTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
    if (!active || !payload?.length) return null;
    const v = payload[0]?.value as number | undefined;
    const color = payload[0]?.color as string | undefined;
    return (
      <div
        className="rounded-xl border bg-background/95 backdrop-blur-xl shadow-2xl p-4 border-border/50"
        style={{ fontSize: TOOLTIP_FONT_PX, width: TOOLTIP_FIXED_W_PX, minHeight: TOOLTIP_MIN_H_PX }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-block w-3 h-3 rounded-full shadow-sm" style={{ background: color }} />
          <span className="font-semibold text-foreground">{String(label)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Porcentaje</span>
          <span className="font-bold text-lg" style={{ color }}>{Number(v ?? 0).toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  const catColorById = React.useMemo(() => {
    const map = new Map<string | number, string>();
    catAggRows.forEach((c, i) => map.set(c.categoriaId, PALETTE_BAR[i % PALETTE_BAR.length]));
    return map;
  }, [catAggRows]);

  /* ===================== RENDER ===================== */
  return (
    <div className="h-svh bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden flex flex-col gap-6 p-6">
      {/* HEADER MEJORADO (altura fija) */}
      <SectionHeader
        title="Dashboard de Coordinación"
        chips={
          <>
            {kpis?.promedio_global_pct != null && (
              <EnhancedBadge
                variant={toneGlobal === "success" ? "premium" : "outline"}
                className={
                  toneGlobal === "success"
                    ? "shadow-lg"
                    : toneGlobal === "danger"
                    ? "border-red-300 bg-red-500/10 text-red-700 dark:text-red-300"
                    : ""
                }
              >
                <Target className="h-3 w-3 mr-1" />
                Satisfacción: {kpis.promedio_global_pct.toFixed(1)}%
              </EnhancedBadge>
            )}
            {anio && <EnhancedBadge variant="outline">📅 Año: {anio}</EnhancedBadge>}
            {idioma && <EnhancedBadge variant="outline">🌐 Idioma: {idioma}</EnhancedBadge>}
            <EnhancedBadge variant="secondary">
              <Rocket className="h-3 w-3 mr-1" />
              {cicloName}
            </EnhancedBadge>
          </>
        }
        right={<CicloSelectorInline />}
      />

      {/* CONTENIDO PRINCIPAL (ocupa TODO el alto restante) */}
      <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
        {/* ===== 1/4 RESUMEN (columna izquierda con scroll propio) ===== */}
        <div className="col-span-12 xl:col-span-3 h-full overflow-hidden">
          <div className="h-full">
            <ScrollArea className="h-full pr-2">
              <div className="grid grid-cols-1 gap-4">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border p-5 bg-background/50 animate-pulse">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="h-4 w-20 rounded bg-muted" />
                          <div className="h-7 w-24 rounded bg-muted" />
                          <div className="h-3 w-16 rounded bg-muted" />
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-muted" />
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <PrismTile
                      label="Grupos activos"
                      value={kpis ? String(kpis.grupos_activos) : "—"}
                      hint="Cursos de idiomas"
                      icon={<LayoutGrid className="h-4 w-4" />}
                      tone="info"
                    />
                    <PrismTile
                      label="Docentes"
                      value={kpis ? String(kpis.docentes_asignados) : "—"}
                      hint="Asignados a grupos"
                      icon={<Users className="h-4 w-4" />}
                      tone="info"
                    />
                    <PrismTile
                      label="Alumnos"
                      value={kpis ? String(kpis.alumnos_matriculados) : "—"}
                      hint={kpis ? `IPN: ${kpis.alumnos_ipn} · Ext: ${kpis.alumnos_externos}` : undefined}
                      icon={<GraduationCap className="h-4 w-4" />}
                      tone="premium"
                      featured={true}
                    />
                    <PrismTile
                      label="Monto inscripciones"
                      value={kpis ? <Currency value={montoIns} currency={currency} /> : "—"}
                      hint="Comprobantes validados"
                      icon={<CircleDollarSign className="h-4 w-4" />}
                      tone="warning"
                    />
                    <PrismTile
                      label="Satisfacción global"
                      value={kpis ? `${kpis.promedio_global_pct.toFixed(1)}%` : "—"}
                      hint="Encuestas"
                      icon={<TrendingUp className="h-4 w-4" />}
                      tone={toneGlobal}
                      delta={satisfaction != null ? (satisfaction >= 80 ? "+Buen desempeño" : "Mejorar") : undefined}
                      deltaDir={satisfaction != null && satisfaction < 80 ? "down" : "up"}
                      progressPct={typeof satisfaction === "number" ? satisfaction : undefined}
                      featured={satisfaction != null && satisfaction >= 80}
                    />
                    {cicloSel === "all" ? (
                      <PrismTile
                        label="Monto exámenes"
                        value={<Currency value={montoPlac} currency={currency} />}
                        hint="Placement validados"
                        icon={<CircleDollarSign className="h-4 w-4" />}
                        tone="info"
                      />
                    ) : null}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* ===== 2/4 GRÁFICAS (columna central en dos filas iguales) ===== */}
        <div className="col-span-12 xl:col-span-6 h-full overflow-hidden">
          <div className="grid h-full grid-rows-2 gap-6">
            {/* Línea (AreaChart mejorado) */}
            <Card className="rounded-2xl overflow-hidden border bg-background/60 backdrop-blur shadow-2xl">
              <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-gradient-to-r from-background/80 to-background/40">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">{`Promedio por pregunta`}</div>
                    <div className="text-xs text-muted-foreground">{cicloTitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <EnhancedBadge variant="outline">{cicloName}</EnhancedBadge>
                  <span className="text-xs text-muted-foreground font-medium">0–100%</span>
                </div>
              </div>
              <CardContent className="pt-4 h-[calc(100%-76px)]">
                <div className="h-full w-full">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Cargando…
                    </div>
                  ) : !qLineSeries.length || !qLineSeries[0]?.data?.length ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <MessageSquareText className="h-8 w-8 mb-3 opacity-70" />
                      <div className="text-sm">Sin datos disponibles</div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={qLineSeries[0].data}
                        margin={{ top: 16, right: 24, bottom: 24, left: 20 }}
                      >
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={PALETTE_LINE[0]} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={PALETTE_LINE[0]} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          strokeDasharray="4 4" 
                          stroke="hsl(var(--muted))" 
                          opacity={0.5}
                          vertical={false}
                        />
                        <XAxis 
                          dataKey="x" 
                          tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }} 
                          tickMargin={10}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }} 
                          ticks={[0,20,40,60,80,100]} 
                          width={45}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RTooltip content={<LineTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="y"
                          name="Promedio (%)"
                          stroke={PALETTE_LINE[0]}
                          fill="url(#colorValue)"
                          strokeWidth={3}
                          dot={{ r: 4, fill: PALETTE_LINE[0], strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, fill: PALETTE_LINE[0], stroke: '#fff', strokeWidth: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Barras (BarChart mejorado) */}
            <Card className="rounded-2xl overflow-hidden border bg-background/60 backdrop-blur shadow-2xl">
              <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-gradient-to-r from-background/80 to-background/40">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">{`Promedio por categoría`}</div>
                    <div className="text-xs text-muted-foreground">{cicloTitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <EnhancedBadge variant="outline">{cicloName}</EnhancedBadge>
                  <span className="text-xs text-muted-foreground font-medium">0–100%</span>
                </div>
              </div>
              <CardContent className="pt-4 h-[calc(100%-76px)]">
                <div className="h-full w-full">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Cargando…
                    </div>
                  ) : !catAggRows.length ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <MessageSquareText className="h-8 w-8 mb-3 opacity-70" />
                      <div className="text-sm">Sin datos disponibles</div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={catAggRows} 
                        margin={{ top: 10, right: 18, bottom: 50, left: 24 }}
                        barSize={32}
                      >
                        <CartesianGrid 
                          strokeDasharray="4 4" 
                          stroke="hsl(var(--muted))" 
                          opacity={0.5}
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="categoria"
                          tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }}
                          tickMargin={12}
                          angle={-12}
                          textAnchor="end"
                          height={50}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          ticks={[0,20,40,60,80,100]} 
                          tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }} 
                          width={45}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RTooltip content={<BarTooltip />} />
                        <Bar 
                          dataKey="pct" 
                          name="Porcentaje" 
                          radius={[8, 8, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={800}
                        >
                          {catAggRows.map((row, index) => (
                            <Cell
                              key={`cell-${row.categoriaId}`}
                              fill={catColorById.get(row.categoriaId) ?? PALETTE_BAR[0]}
                              className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                              stroke="hsl(var(--background))"
                              strokeWidth={1}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ===== 1/4 RANKING + COMENTARIOS (columna derecha en dos filas iguales) ===== */}
        <div className="col-span-12 xl:col-span-3 h-full overflow-hidden">
          <div className="grid h-full grid-rows-2 gap-6">
            {/* Ranking con Tabs mejorado */}
            <Card className="rounded-2xl overflow-hidden border bg-background/60 backdrop-blur shadow-2xl">
              <CardHeader className="py-4 bg-gradient-to-r from-background/80 to-background/40">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    Ranking de docentes
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 h-[calc(100%-72px)] flex flex-col">
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
                  <Tabs defaultValue="mejores" className="flex-1 flex flex-col">
                    <div className="px-1 pb-3">
                      <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
                        <TabsTrigger 
                          value="mejores" 
                          className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                          <Award className="h-3.5 w-3.5 mr-2" />
                          Mejores
                        </TabsTrigger>
                        <TabsTrigger 
                          value="oportunidad" 
                          className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                          <Zap className="h-3.5 w-3.5 mr-2" />
                          Oportunidad
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="mejores" className="flex-1 m-0">
                      <ScrollArea className="h-full pr-3">
                        <div className="grid grid-cols-1 gap-3">
                          {rank.top.map((r, index) => (
                            <div 
                              key={`top-${r.docente_id}`} 
                              className="rounded-xl border p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/10 dark:to-green-950/10 border-emerald-200/50 dark:border-emerald-800/30 transition-all hover:shadow-md hover:scale-[1.02]"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {index < 3 && (
                                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                        index === 0 ? 'bg-amber-500' : 
                                        index === 1 ? 'bg-slate-500' : 
                                        'bg-amber-700'
                                      }`}>
                                        {index + 1}
                                      </div>
                                    )}
                                    <div className="font-semibold text-sm truncate">{r.docente}</div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">{r.grupos} grupos</div>
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

                    <TabsContent value="oportunidad" className="flex-1 m-0">
                      <ScrollArea className="h-full pr-3">
                        <div className="grid grid-cols-1 gap-3">
                          {rank.bottom.map((r, index) => (
                            <div 
                              key={`bot-${r.docente_id}`} 
                              className="rounded-xl border p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/10 dark:to-orange-950/10 border-amber-200/50 dark:border-amber-800/30 transition-all hover:shadow-md hover:scale-[1.02]"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm truncate mb-1">{r.docente}</div>
                                  <div className="text-xs text-muted-foreground">{r.grupos} grupos</div>
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

            {/* Comentarios mejorados */}
            <Card className="rounded-2xl overflow-hidden border bg-background/60 backdrop-blur shadow-2xl">
              <CardHeader className="py-4 bg-gradient-to-r from-background/80 to-background/40">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5 text-blue-500" />
                  Comentarios recientes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 h-[calc(100%-72px)]">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando…
                  </div>
                ) : comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <MessageSquareText className="h-8 w-8 mb-3 opacity-70" />
                    <div className="text-sm">No hay comentarios</div>
                  </div>
                ) : (
                  <ScrollArea className="h-full pr-3">
                    <ul className="grid grid-cols-1 gap-3">
                      {comments.map((c) => (
                        <li 
                          key={String(c.id)} 
                          className="rounded-xl border p-4 bg-background/50 backdrop-blur-sm transition-all hover:shadow-md hover:bg-background/70"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c.ciclo && (
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                                  {c.ciclo}
                                </span>
                              )}
                              {c.docente && (
                                <span className="inline-flex items-center rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                                  {c.docente}
                                </span>
                              )}
                            </div>
                            {c.created_at && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(c.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          
                          {c.pregunta && (
                            <div className="mb-2">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">Pregunta:</div>
                              <div className="text-sm text-foreground/90 bg-muted/30 rounded-lg px-3 py-2">
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

      {/* FOOTER MEJORADO */}
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <Zap className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}
      
      <Separator className="my-2 opacity-50" />
      
      <div className="text-center">
        <div className="text-xs text-muted-foreground/80 font-medium">
          Dashboard mejorado con <Sparkles className="h-3 w-3 inline mx-1" /> 
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent font-semibold">
            diseño profesional super plus top
          </span>
          {" "}• Todas las funcionalidades preservadas • Impacto visual máximo
        </div>
      </div>
    </div>
  );
}
