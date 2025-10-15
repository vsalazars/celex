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
// ❗ Solo ranking y comentarios tendrán scroll interno
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
  CheckCircle, 
  XCircle,
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
  Bar,
  Cell,
  ComposedChart,
  ReferenceLine,
  LabelList,
} from "recharts";

/* ===== Paletas ===== */
const PALETTE_LINE = ["#10b981"];
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
        "relative rounded-xl w-full min-w-0",
        "border border-border/60 ring-1 ring-inset", s.ring,
        "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        "bg-clip-padding isolate",
        "box-border transition-all duration-200",
        "shadow-[0_3px_16px_-6px_rgba(0,0,0,0.22)] hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.25)]",
        "h-full",
        "z-0 will-change-transform hover:-translate-y-[1px]",
        featured && "shadow-[0_6px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.22)]",
        className,
      ].filter(Boolean).join(" ")}
    >
      {featured && (
        <div className="absolute -top-1.5 -right-1.5">
          <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
        </div>
      )}

      <div className="p-3 pb-3 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {icon && <span className="text-muted-foreground/60">{icon}</span>}
              {label}
            </div>
            <div className="mt-0.5 text-lg font-bold leading-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {value}
            </div>
            <div className="mt-0.5 flex flex-col gap-1">
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
            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${s.iconBg} backdrop-blur-sm flex-shrink-0`}>
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

function cleanIdiomaLabel(raw?: string) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/^idioma[.\s:_-]*/i, "") // quita "Idioma." / "idioma:" / etc.
    .replace(/^lang[.\s:_-]*/i, "")   // por si viniera como "lang.es" etc.
    .replace(/_/g, " ")               // convierte underscores a espacios
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s; // Mayúscula inicial
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

  // Preguntas (línea)
  type QPoint = { x: string; y: number; qid: string | number; preguntaFull: string };
  const [qLineSeries, setQLineSeries] = React.useState<{ id: string; data: QPoint[] }[]>([]);
  const qTextoRef = React.useRef<Record<string | number, string>>({});

  // ====== Tooltips Recharts ======
  function LineTooltip({
    active,
    payload,
    label,
  }: { active?: boolean; payload?: any[]; label?: string }) {
    if (!active || !payload?.length) return null;

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

  function BarTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
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

  // ==== Helper “lollipop” ====
  const StemShape: React.FC<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
  }> = ({ x = 0, y = 0, width = 0, height = 0, fill = "#999" }) => {
    const cy = y + height / 2;
    const x1 = x;
    const x2 = x + width;
    const r = Math.max(4, Math.min(7, height * 0.75));
    return (
      <g>
        <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={fill} strokeWidth={12} strokeLinecap="round" />
        <circle cx={x2} cy={cy} r={r} fill={fill} stroke="#fff" strokeWidth={2.5} />
      </g>
    );
  };

  // Categorías (barras)
  const [catAggRows, setCatAggRows] = React.useState<
    { categoria: string; pct: number; categoriaId: string | number; order: number }[]
  >([]);

  // ====== Cargas ======
 async function cargarSoloRankingYCiclos() {
  try {
    const cicloId = cicloSel !== "all" ? Number(cicloSel) : undefined;
    const [r, rows] = await Promise.all([
      getCoordRanking({ anio, idioma, cicloId, limitTop: 8, limitBottom: 8 }), // ← cicloId
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
          className={[
            // tamaño / espaciado
            "h-9 min-w-[220px] rounded-lg px-3 pr-10",
            // estilado
            "border bg-background/80 backdrop-blur text-sm font-medium shadow-sm",
            // interacciones
            "transition-all hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20",
            // 👇 Oculta la flecha nativa y cualquier bg de sistema
            "appearance-none [appearance:none] [-moz-appearance:none] [background-image:none]",
            // accesibilidad
            "focus:outline-none",
          ].join(" ")}
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

        {/* Icono de flecha custom (ya no se monta con nada) */}
        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
          {/* Usa ChevronDown mejor que LayoutGrid aquí */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
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
    <div className="h-svh overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 flex flex-col p-4">
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
              {cicloObj ? `Curso ${cicloObj.codigo}` : "Todos los cursos"}
            </EnhancedBadge>
          </>
        }
        right={<CicloSelectorInline />}
      />

      {/* ===== LAYOUT PRINCIPAL (llena viewport sin scroll global) ===== */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 mt-4">
        {/* ===== KPIs: 5 filas fraccionadas ===== */}
        <div className="col-span-12 xl:col-span-2 min-h-0">
          <div className="grid grid-rows-5 gap-3 h-full">
            {(loading ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card/70 backdrop-blur shadow-sm h-full animate-pulse" />
            )) : [
              
              <PrismTile
                key="k5"
                label="Satisfacción global"
                value={kpis ? `${kpis.promedio_global_pct.toFixed(1)}%` : "—"}
                hint={
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-200/60">
                    Encuestas de satisfacción
                  </span>
                }
                icon={<TrendingUp />}
                tone={toneGlobal}
                delta={
                  typeof satisfaction === "number"
                    ? satisfaction >= 80
                      ? "+Buen desempeño"
                      : "Mejorar"
                    : undefined
                }
                deltaDir={typeof satisfaction === "number" && satisfaction < 80 ? "down" : "up"}
                progressPct={typeof satisfaction === "number" ? satisfaction : undefined}
                featured={typeof satisfaction === "number" && satisfaction >= 80}
                className="h-full"
              />,

              <PrismTile
                key="k1"
                label="Grupos activos"
                value={kpis ? String(kpis.grupos_activos) : "—"}
                hint={
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-200/60">
                      Cursos de idiomas
                    </span>

                    {/* 👇 Solo si el backend manda top_idioma */}
                    { kpis?.top_idioma && (
                      <span
                        title="Idioma con más grupos"
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60"
                      >
                        <span className="mr-1.5">🌎 {cleanIdiomaLabel(kpis.top_idioma)}</span>
                        <span className="font-semibold">{kpis.top_idioma_grupos ?? 0} grupos</span>
                      </span>
                    )}

                  </div>
                }
                icon={<LayoutGrid />}
                tone="info"
                className="h-full"
              />,

              <PrismTile
                key="k3"
                label="Alumnos"
                value={kpis ? String(kpis.alumnos_matriculados) : "—"}
                hint={
                  kpis && (
                    <div className="flex flex-col gap-1.5 pb-0.5">
                      {/* Línea 1: IPN / Externos */}
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-600/10 text-purple-700 dark:text-purple-300 border border-purple-200/60">
                          IPN: {kpis.alumnos_ipn}
                        </span>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-600/10 text-purple-700 dark:text-purple-300 border border-purple-200/60">
                          Externos: {kpis.alumnos_externos}
                        </span>
                      </div>

                      {/* Línea 2: título en pequeño */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0">
                        Aprobados y reprobados
                      </div>

                      {/* Línea 3: Aprobados / Reprobados (compacto con iconos y ligero padding abajo) */}
                      <div className="flex flex-wrap items-center gap-1 pb-[2px]">
                        <span
                          title="Alumnos con promedio_final ≥ 80"
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          {kpis.aprobados_80_count}
                        </span>

                        <span
                          title="Alumnos con promedio_final < 80"
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border border-red-200/60 bg-red-50/60 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          {kpis.reprobados_count}
                        </span>
                      </div>
                    </div>
                  )
                }

                icon={<GraduationCap />}
                tone="premium"
                //featured
                className="h-full"
              />,
              
              <PrismTile
                key="k2"
                label="Docentes"
                value={kpis ? String(kpis.docentes_asignados) : "—"}
                hint={
                  <div className="flex flex-col gap-1.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-200/60">
                      Asignados a grupos
                    </span>

                    {/* Mejor docente (global o por curso) */}
                    {(() => {
                      const enTodos = cicloSel === "all";

                      // Preferir KPIs; si no hay, usar 1er lugar del ranking actual
                      const kBest = kpis?.docente_mejor_nombre
                        ? {
                            name: kpis.docente_mejor_nombre,
                            pct: typeof kpis.docente_mejor_pct === "number" ? kpis.docente_mejor_pct : null,
                            grupos: typeof kpis.docente_mejor_grupos === "number" ? kpis.docente_mejor_grupos : null,
                          }
                        : null;

                      const rTop = rank?.top?.[0]
                        ? {
                            name: rank.top[0].docente,
                            pct: typeof rank.top[0].promedio_pct === "number" ? rank.top[0].promedio_pct : null,
                            grupos: typeof rank.top[0].grupos === "number" ? rank.top[0].grupos : null,
                          }
                        : null;

                      const best = kBest ?? rTop;
                      if (!best?.name) return null;

                      const ok = typeof best.pct === "number" && best.pct >= 80;
                      const tone = ok ? "emerald" : "red";

                      return (
                        <div className="flex flex-col gap-1.5">
                          {/* Nombre — medalla solo si es vista global */}
                          <div className="flex items-center gap-1.5 leading-tight">
                            {enTodos && (
                              <span role="img" aria-label="Mejor docente" className="text-[12px]">
                                🏅
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-foreground/90 truncate">
                              {best.name}
                            </span>
                          </div>

                          {/* Desempeño y grupos (solo muestra grupos en global) */}
                          <div className="flex items-center gap-1.5">
                            {typeof best.pct === "number" && (
                              <span
                                className={[
                                  "inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold border",
                                  ok
                                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-300/60"
                                    : "bg-red-50/60 dark:bg-red-950/20 text-red-700 dark:text-red-300 border-red-300/60",
                                ].join(" ")}
                              >
                                {best.pct.toFixed(1)}%
                              </span>
                            )}

                            {/* 👇 Solo mostrar número de grupos cuando está en 'Todos los cursos' */}
                            {enTodos && typeof best.grupos === "number" && best.grupos > 0 && (
                              <span className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium border border-border/60 text-muted-foreground">
                                {best.grupos} grupo{best.grupos === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                }
                icon={<Users />}
                tone="info"
                className="h-full"
              />,
             
              <PrismTile
                key="k4"
                label="Ingresos"
                icon={<CircleDollarSign />}
                tone="warning"
                className="h-full"
                value={
                  (() => {
                    const ins = Number(kpis?.pagos_monto_total ?? 0);
                    const exm = cicloSel === "all" ? Number(montos?.placement_total_mxn ?? 0) : 0;
                    const total = ins + exm;
                    return (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col items-start">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                            Total validado
                          </span>
                          <span className="text-[18px] font-extrabold leading-none tabular-nums">
                            <Currency value={total} currency={currency} />
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center rounded-full border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-[2px] text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            <span className="mr-1.5">Inscripciones</span>
                            <span className="font-semibold tabular-nums">
                              <Currency value={ins} currency={currency} />
                            </span>
                          </span>
                          {cicloSel === "all" && (
                            <span className="inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-[2px] text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                              <span className="mr-1.5">Exámenes</span>
                              <span className="font-semibold tabular-nums">
                                <Currency value={exm} currency={currency} />
                              </span>
                            </span>
                          )}
                        </div>
                        
                      </div>
                    );
                  })()
                }
              />,
              
            ]).map((n) => n)}
          </div>
        </div>

        {/* ===== GRÁFICAS: 2 filas fraccionadas ===== */}
        <div className="col-span-12 xl:col-span-7 min-h-0">
          <div className="grid grid-rows-2 gap-4 h-full">
            {/* Línea */}
            <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow h-full">
              <div className="flex items-center justify-between px-4 pt-3 pb-1.5 bg-gradient-to-r from-background/80 to-background/40">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Promedio por pregunta</div>
                    <div className="text-[11px] text-muted-foreground">{cicloObj ? `Curso ${cicloObj.codigo}` : "Todos los cursos"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <EnhancedBadge variant="outline">{cicloName}</EnhancedBadge>
                  <span className="text-[11px] text-muted-foreground font-medium">0–100%</span>
                </div>
              </div>
              <CardContent className="pt-2 px-2 h-[calc(100%-44px)]">
                <div className="h-full w-full">
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
                      <AreaChart data={qLineSeries[0].data} margin={{ top: 6, right: 12, bottom: 12, left: 12 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={PALETTE_LINE[0]} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={PALETTE_LINE[0]} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted))" opacity={0.5} vertical={false}/>
                        <XAxis dataKey="x" tick={{ fill: "hsl(var(--foreground))", fontSize: 10.5, fontWeight: 500 }} tickMargin={6} axisLine={false} tickLine={false}/>
                        <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--foreground))", fontSize: 10.5, fontWeight: 500 }} ticks={[0,20,40,60,80,100]} width={36} axisLine={false} tickLine={false}/>
                        <RTooltip content={<LineTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="y"
                          name="Promedio (%)"
                          stroke={PALETTE_LINE[0]}
                          fill="url(#colorValue)"
                          strokeWidth={2}
                          dot={{ r: 2.8, fill: PALETTE_LINE[0], strokeWidth: 1.6, stroke: "#fff" }}
                          activeDot={{ r: 4, fill: PALETTE_LINE[0], stroke: "#fff", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lollipop */}
            <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow h-full">
              <CardContent className="p-2 h-[calc(100%-0px)]">
                <div className="h-full w-full">
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
                      <ComposedChart layout="vertical" data={catAggRows} margin={{ top: 6, right: 12, bottom: 6, left: 6 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted))" opacity={0.5} vertical={false} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          ticks={[0,20,40,60,80,100]}
                          tick={{ fill: "hsl(var(--foreground))", fontSize: 10.5, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="categoria"
                          width={Math.min(160, Math.max(100, (catAggRows?.reduce((m, c) => Math.max(m, (c.categoria?.length || 0)), 0) || 10) * 5.5))}
                          tick={{ fill: "hsl(var(--foreground))", fontSize: 10.5, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={6}
                        />
                        <RTooltip content={<BarTooltip />} />
                        <ReferenceLine x={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" ifOverflow="extendDomain" />
                        <Bar
                          dataKey="pct"
                          name="Porcentaje"
                          isAnimationActive
                          animationDuration={600}
                          barSize={14}
                          shape={StemShape}
                        >
                          {catAggRows.map((row, i) => (
                            <Cell
                              key={`bar-${row.categoriaId}`}
                              fill={PALETTE_BAR[i % PALETTE_BAR.length]}
                              className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                            />
                          ))}
                          <LabelList
                            dataKey="pct"
                            position="right"
                            formatter={(v: number) => `${Number(v ?? 0).toFixed(1)}%`}
                            className="text-[10.5px] font-semibold"
                            offset={6}
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

        {/* ===== RANKING + COMENTARIOS: 2 filas fraccionadas (solo estos con scroll interno) ===== */}
        <div className="col-span-12 xl:col-span-3 min-h-0">
          <div className="grid grid-rows-2 gap-4 h-full">
            {/* Ranking (scroll interno) */}
            <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow h-full">
              <CardHeader className="px-4 py-1 space-y-0 bg-gradient-to-r from-background/80 to-background/40">
                <CardTitle className="text-base font-bold leading-none flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Ranking de docentes
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-0 px-2 h-[calc(100%-32px)]">

                {loading || !rank ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
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
                  <Tabs defaultValue="mejores" className="h-full flex flex-col">
                    <div className="px-1 pb-2">
                      <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-lg -mt-1">

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

                    <TabsContent value="mejores" className="mt-0 h-[calc(100%-32px)]">

                      <div className="h-full overflow-auto pr-1 space-y-2">
                        {rank.top.map((r, index) => (
                          <div
                            key={`top-${r.docente_id}`}
                            className="rounded-lg border p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/10 dark:to-green-950/10 border-emerald-200/50 dark:border-emerald-800/30"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  {index < 3 && (
                                    <div
                                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${
                                        index === 0 ? "bg-amber-500" : index === 1 ? "bg-slate-500" : "bg-amber-700"
                                      }`}
                                    >
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
                    </TabsContent>

                    <TabsContent value="oportunidad" className="mt-0 h-[calc(100%-32px)]">

                      <div className="h-full overflow-auto pr-1 space-y-2">
                        {rank.bottom.map((r) => (
                          <div
                            key={`bot-${r.docente_id}`}
                            className="rounded-lg border p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/10 dark:to-orange-950/10 border-amber-200/50 dark:border-amber-800/30"
                          >
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
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>

            {/* Comentarios (scroll interno) */}
            <Card className="rounded-xl overflow-hidden border bg-background/60 backdrop-blur shadow h-full">
              <CardHeader className="px-4 py-1 space-y-0 bg-gradient-to-r from-background/80 to-background/40">
                <CardTitle className="text-base font-bold leading-none flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5 text-blue-500" />
                  Comentarios recientes
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-0 px-2 h-[calc(100%-32px)]">

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
                  <ul className="h-full overflow-auto pr-1 space-y-1.5">
                    {comments.map((c) => (
                      <li
                        key={String(c.id)}
                        className="rounded-lg border p-2.5 bg-background/50 backdrop-blur-sm"
                      >
                        <div className="flex items-start justify-between mb-1">
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
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap leading-none">
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] leading-snug text-foreground/95 line-clamp-3">
                          {c.texto}
                        </div>
                      </li>
                    ))}
                  </ul>

                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ===== ERROR (fuera del footer) ===== */}
      {error && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-3 backdrop-blur">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <Zap className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      {/* ===== FOOTER pegado abajo ===== */}
      <div className="mt-3">
        <Separator className="my-3 opacity-50" />
        <div className="py-1.5 text-center">
          <div className="text-[11px] text-muted-foreground/80 font-medium">
            Cursos Extracurriculares de Lenguas Extranjeras (CELEX) - CECyT 15 Diódoro Antúnez Echegaray<Sparkles className="h-3 w-3 inline mx-1" />
          </div>
        </div>
      </div>

    {/* ⬇️ PÉGALO AQUÍ MISMO — ANTES DEL </div> FINAL DEL WRAPPER */}
<style jsx global>{`
  .h-svh { height: 100svh; }
  .text-\\[10\\.5px\\] { font-size: 10.5px; line-height: 1.2; }
  .text-\\[11px\\]    { font-size: 11px;    line-height: 1.25; }
  .text-\\[13px\\]    { font-size: 13px;    line-height: 1.3;  }
  .blur-\\[2px\\] { filter: blur(2px); }
  .shadow-\\[0_3px_16px_-6px_rgba\\(0,0,0,0\\.22\\)\\] { box-shadow: 0 3px 16px -6px rgba(0,0,0,0.22); }
  .hover\\:shadow-\\[0_10px_24px_-10px_rgba\\(0,0,0,0\\.25\\)\\]:hover { box-shadow: 0 10px 24px -10px rgba(0,0,0,0.25); }
  .shadow-\\[0_6px_24px_rgba\\(0,0,0,0\\.18\\)\\] { box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
  .hover\\:shadow-\\[0_16px_40px_rgba\\(0,0,0,0\\.22\\)\\]:hover { box-shadow: 0 16px 40px rgba(0,0,0,0.22); }
  .supports-\\[backdrop-filter\\]\\:bg-background\\/70 {
    backdrop-filter: saturate(120%) blur(6px);
    background-color: rgba(0,0,0,0.04);
  }
  .min-h-\\[220px\\] { min-height: 220px; }
`}</style>

    </div>

  );
}
