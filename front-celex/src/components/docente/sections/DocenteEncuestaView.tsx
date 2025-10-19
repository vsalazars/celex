"use client";

import * as React from "react";
import {
  getDocenteCiclos,
  getDocenteReporteEncuesta,
  getDocenteEncuestaComentarios,
  getDocenteSerieEncuestaPorPregunta,
  getDocenteKpiGlobal,
  type DocCicloLite as CicloLite,
  type DocReporteEncuesta as ReporteEncuestaDocente,
  type DocComentariosResponse,
} from "@/lib/api";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  RefreshCw,
  MessageSquareText,
  RefreshCcw,
  Search,
  LineChart as LineChartIcon,
  BarChart3 as BarChartIcon,
  CheckSquare,
  Square,
  Target,
  Users,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ===== Recharts ===== */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
  LineChart,
  Line,
  Legend,
  Customized,
} from "recharts";

/* ===== Paletas / estilos ===== */
const PALETTE_BAR = ["#8596b3", "#ac9eb3", "#c4b0b3", "#d0d5d3"];
const DARK_TEXT = "#111827";
const PALETTE_LINE = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
];

const GREEN = "#059669"; // >= 80
const RED = "#dc2626";   // < 80
const THRESHOLD = 80;

type Props = { defaultAnio?: number; defaultIdioma?: string; };

type Comentario = {
  id: string;
  pregunta_id: string | number | null;
  pregunta_texto: string | null;
  texto: string;
  created_at?: string | null;
  alumno?: { nombre?: string | null; email?: string | null } | null;
};

type SeriePorPregunta = {
  docente: { id: string | number; nombre: string };
  series: {
    id: string; // pregunta_id
    label: string;
    data: { x: string; y: number }[]; // ciclo_codigo vs %
  }[];
};

/* =================== Helpers encuestas =================== */
function isNumericQuestion(p: any) {
  return (
    Array.isArray(p.opciones) &&
    p.opciones.length > 0 &&
    p.opciones.every((o: any) => !Number.isNaN(Number(o.opcion)))
  );
}
function inferScaleMax(p: any): number {
  const nums = (p.opciones || [])
    .map((o: any) => Number(o.opcion))
    .filter((v: number) => !Number.isNaN(v));
  if (!nums.length) return 5;
  const max = Math.max(...nums);
  if (max <= 5) return 5;
  if (max <= 10) return 10;
  return 5;
}
function computePct(p: any) {
  const total =
    (p.total_respuestas ?? undefined) !== undefined
      ? p.total_respuestas || 0
      : (p.opciones || []).reduce((acc: number, o: any) => acc + (o.conteo || 0), 0);

  let promedio = p.promedio ?? null;
  if (promedio == null && total > 0) {
    let suma = 0;
    for (const o of (p.opciones || [])) {
      const val = Number(o.opcion);
      const n = o.conteo || 0;
      if (!Number.isNaN(val)) suma += val * n;
    }
    promedio = +(suma / total).toFixed(2);
  }

  let pct: number;
  if (p.promedio_pct != null) pct = +p.promedio_pct;
  else if (promedio != null) pct = +(((promedio ?? 0) / inferScaleMax(p)) * 100).toFixed(1);
  else pct = 0;

  return { pct, promedio: promedio ?? 0, total };
}

// Chapita para ReferenceLine horizontal (y=...) pegada al borde derecho del plot
const RefBadgeRight: React.FC<{ text: string; color: string } & any> = (props) => {
  const { text, color, viewBox } = props;
  const vb = viewBox || {};
  const xRight = (vb.x ?? 0) + (vb.width ?? 0); // extremo derecho del área de plotting
  const y = vb.y ?? 0;

  const padX = 6;
  const padY = 3;
  const fontSize = 11;
  const approxChar = 6.2;
  const w = text.length * approxChar + padX * 2;
  const h = fontSize + padY * 2;
  const rx = 6;

  // La colocamos DENTRO del plot, pegada al borde derecho
  const tx = xRight - w - 6;
  const ty = y - h / 2;

  return (
    <g transform={`translate(${tx}, ${ty})`}>
      <rect width={w} height={h} rx={rx} fill="#fff" stroke={color} />
      <text x={padX} y={padY + fontSize * 0.82} fill={color} fontSize={fontSize} fontWeight={600}>
        {text}
      </text>
    </g>
  );
};


// === Helpers de etiqueta para ReferenceLine (X) con filas anti-colisión ===
const RefBadgeRightX: React.FC<{ text: string; color: string; row?: number } & any> = (props) => {
  const { text, color, viewBox, row = 0 } = props;
  const vb = viewBox || {};
  const x = vb.x ?? 0;               // x de la línea vertical
  const yTop = vb.y ?? 0;
  const height = vb.height ?? 0;

  const padX = 6;
  const padY = 3;
  const fontSize = 11;
  const approxChar = 6.2;
  const w = text.length * approxChar + padX * 2;
  const h = fontSize + padY * 2;
  const rx = 6;

  // Base: 15% del alto. Cada fila adicional baja ~16% del alto.
  const baseFrac = 0.15;
  const rowStepFrac = 0.16;
  const tyCenter = yTop + height * (baseFrac + row * rowStepFrac);
  const tx = x + 8;
  const ty = tyCenter - h / 2;

  return (
    <g transform={`translate(${tx}, ${Math.max(0, ty)})`}>
      <rect width={w} height={h} rx={rx} fill="#fff" stroke={color} />
      <text x={padX} y={padY + fontSize * 0.82} fill={color} fontSize={fontSize} fontWeight={600}>
        {text}
      </text>
    </g>
  );
};



/* === Helper: pills a la derecha, usando el scale del YAxis (para LineChart) === */
const RightRefPills: React.FC<
  {
    yValues: Array<{ value: number; text: string; color: string }>;
  } & any
> = (props) => {
  const { yValues, width, margin, yAxisMap } = props || {};
  const yAxisKey = yAxisMap ? Object.keys(yAxisMap)[0] : null;
  const yAxis = yAxisKey ? yAxisMap[yAxisKey] : null;
  const scale = yAxis?.scale;

  if (!scale || !width) return null;

  const rightX = width - (margin?.right ?? 0); // borde derecho del plot
  const padX = 6;
  const padY = 3;
  const fontSize = 11;
  const approxChar = 6.2;
  const rx = 6;

  return (
    <g>
      {yValues.map(({ value, text, color }, i) => {
        const y = scale(value); // coord. vertical exacta
        if (typeof y !== "number" || !Number.isFinite(y)) return null;

        const w = text.length * approxChar + padX * 2;
        const h = fontSize + padY * 2;

        // Pegado al borde derecho, DENTRO del plot
        const tx = rightX - w - 6;
        const ty = y - h / 2;

        return (
          <g key={i} transform={`translate(${tx}, ${ty})`}>
            <rect width={w} height={h} rx={rx} fill="#fff" stroke={color} />
            <text
              x={padX}
              y={padY + fontSize * 0.82}
              fill={color}
              fontSize={fontSize}
              fontWeight={600}
            >
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/* === NUEVO: Label personalizado (píldora) para ReferenceLine horizontal en LineChart === */
const RefPillLabel: React.FC<{ viewBox?: any; text: string; color: string }> = ({ viewBox, text, color }) => {
  const vb = viewBox || {};
  const innerLeft = vb.x ?? 0;
  const innerTop = vb.y ?? 0;         // y exacta de la línea
  const innerWidth = vb.width ?? 0;

  const padX = 8;
  const padY = 4;
  const fontSize = 11;
  const pillW = text.length * 7 + padX * 2;
  const pillH = fontSize + padY * 2;

  // ponemos la pill pegada al borde derecho interno
  const tx = innerLeft + innerWidth - pillW - 8;
  const ty = innerTop - pillH / 2;

  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} rx={pillH / 2} ry={pillH / 2} width={pillW} height={pillH} fill={color} opacity={0.95} stroke="white" strokeWidth={1.5} />
      <text
        x={tx + pillW / 2}
        y={ty + pillH / 2 + fontSize / 3 - 1}
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
};

/* === NUEVO: Píldora FUERA del plot (a la derecha del área interna) para líneas horizontales === */
const RefRightPillLabel: React.FC<{ viewBox?: any; text: string; color: string; row?: number }> = ({
  viewBox,
  text,
  color,
  row = 0,
}) => {
  const vb = viewBox || {};
  const innerLeft  = vb.x ?? 0;
  const innerTop   = vb.y ?? 0;       // y (top) de la línea horizontal
  const innerWidth = vb.width ?? 0;

  const OUT_GAP = 10;                 // separación del borde derecho del plot
  const padX = 8, padY = 4, fontSize = 11;
  const approxChar = 7;
  const pillW = text.length * approxChar + padX * 2;
  const pillH = fontSize + padY * 2;
  const rowStep = pillH + 4;

  // Anclamos justo FUERA del área interna (derecha)
  const x = innerLeft + innerWidth + OUT_GAP;
  // Centrado vertical sobre la línea; si hay "fila", desplazamos un poco
  const y = innerTop - pillH / 2 + row * rowStep;

  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        rx={pillH / 2}
        ry={pillH / 2}
        width={pillW}
        height={pillH}
        fill={color}
        opacity={0.95}
        stroke="white"
        strokeWidth={1.5}
      />
      <text
        x={x + pillW / 2}
        y={y + pillH / 2 + fontSize / 3 - 1}
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
};

export default function DocenteEncuestaView({ defaultAnio, defaultIdioma }: Props) {
  /* ====== Estado base ====== */
  const [loadingCiclos, setLoadingCiclos] = React.useState(false);
  const [ciclos, setCiclos] = React.useState<CicloLite[]>([]);
  const [selected, setSelected] = React.useState<string | number | "">("");

  const [loadingReporte, setLoadingReporte] = React.useState(false);
  const [reporte, setReporte] = React.useState<ReporteEncuestaDocente | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /* ===== Vista: barras (ciclo) / líneas (todos) ===== */
  const [showAll, setShowAll] = React.useState(false);

  /* ===== Serie (ver todos) ===== */
  const [loadingSerie, setLoadingSerie] = React.useState(false);
  const [serie, setSerie] = React.useState<SeriePorPregunta | null>(null);
  const [hiddenCycles, setHiddenCycles] = React.useState<Set<string>>(new Set());

  /* ===== Comentarios ===== */
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [commentsError, setCommentsError] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<Comentario[]>([]);
  const [commentsQuery, setCommentsQuery] = React.useState("");

  /* ===== Benchmarks ===== */
  const [globalAllPct, setGlobalAllPct] = React.useState<number | null>(null);     // GRAN TOTAL
  const [globalCicloPct, setGlobalCicloPct] = React.useState<number | null>(null); // Ciclo (todos los cursos)

// === Píldora PARA ENCIMA del plot (alineada al borde superior del área interna)
const RefPillTopX: React.FC<{ viewBox?: any; text: string; color: string; row?: number }> = ({
  viewBox,
  text,
  color,
  row = 0,
}) => {
  const vb = viewBox || {};
  const lineX     = typeof vb.x === "number" ? vb.x : 0;   // x exacta de la línea
  const innerLeft = vb.x ?? 0;                             // borde izq. del plot
  const innerTop  = vb.y ?? 0;                             // borde sup. del plot
  const innerRight= (vb.x ?? 0) + (vb.width ?? 0);         // borde der. del plot

  const padX = 8, padY = 4, fontSize = 11, approxChar = 7;
  const pillW = text.length * approxChar + padX * 2;
  const pillH = fontSize + padY * 2;
  const guard = 10;          // separación lateral mínima
  const TOP_GAP = 6;         // distancia al borde superior del plot
  const rowStep = pillH + 4; // separación entre filas

  // centra sobre la línea y "clampa" dentro del ancho del plot
  const cx = Math.max(
    innerLeft + guard + pillW / 2,
    Math.min(innerRight - guard - pillW / 2, lineX)
  );

  // y justo POR ENCIMA del plot, sin invadirlo
  const ty = innerTop - pillH - TOP_GAP - row * rowStep;

  return (
    <g pointerEvents="none">
      <rect
        x={cx - pillW / 2}
        y={ty}
        rx={pillH / 2}
        ry={pillH / 2}
        width={pillW}
        height={pillH}
        fill={color}
        opacity={0.95}
        stroke="white"
        strokeWidth={1.5}
      />
      <text
        x={cx}
        y={ty + pillH / 2 + fontSize / 3 - 1}
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
};

  

  /* ===== Cargar ciclos ===== */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingCiclos(true);
        const data = await getDocenteCiclos({ anio: defaultAnio, idioma: defaultIdioma });
        if (!alive) return;
        setCiclos(data);
        if (data.length > 0) setSelected(data[0].id);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Error al cargar ciclos");
      } finally {
        if (alive) setLoadingCiclos(false);
      }
    })();
    return () => { alive = false; };
  }, [defaultAnio, defaultIdioma]);

  /* ===== Reporte de ciclo (barras) ===== */
  const consultar = React.useCallback(async () => {
    if (showAll) return;
    if (!selected) { setReporte(null); return; }
    setLoadingReporte(true);
    setError(null);
    try {
      const rep = await getDocenteReporteEncuesta(selected);
      setReporte(rep);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar reporte");
      setReporte(null);
    } finally {
      setLoadingReporte(false);
    }
  }, [selected, showAll]);

  React.useEffect(() => {
    if (!showAll) {
      if (selected) consultar();
      else setReporte(null);
    }
  }, [selected, showAll, consultar]);

  /* ===== Serie (línea) ===== */
  const consultarSerie = React.useCallback(async () => {
    setLoadingSerie(true);
    try {
      const s = (await getDocenteSerieEncuestaPorPregunta()) as unknown as SeriePorPregunta;
      setSerie(s || null);
      setHiddenCycles(new Set());
    } finally {
      setLoadingSerie(false);
    }
  }, []);
  React.useEffect(() => { if (showAll) consultarSerie(); }, [showAll, consultarSerie]);

  /* ===== Benchmarks: Global total & Global del ciclo ===== */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const kAll = await getDocenteKpiGlobal({ scope: "institucion" });
        if (!cancelled) {
          const v = Number(kAll?.promedio_global_pct);
          setGlobalAllPct(Number.isFinite(v) ? +v.toFixed(1) : null);
        }
      } catch { if (!cancelled) setGlobalAllPct(null); }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selected) { setGlobalCicloPct(null); return; }
      try {
        const kC = await getDocenteKpiGlobal({ scope: "institucion", cicloId: Number(selected) });
        if (!cancelled) {
          const v = Number(kC?.promedio_global_pct);
          setGlobalCicloPct(Number.isFinite(v) ? +v.toFixed(1) : null);
        }
      } catch { if (!cancelled) setGlobalCicloPct(null); }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  /* =================== Preparación de BARRAS =================== */
  const preguntasGraficables = (reporte?.preguntas || []).filter(isNumericQuestion);

  const allIds = React.useMemo(
    () => preguntasGraficables.map((p: any) => String(p.id)),
    [preguntasGraficables]
  );
  const [selectedIds, setSelectedIds] = React.useState<string[]>(allIds);
  React.useEffect(() => setSelectedIds(allIds), [reporte?.ciclo?.id, allIds.length]);

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAll = () => setSelectedIds(allIds);
  const selectNone = () => setSelectedIds([]);

  const categorias = React.useMemo(() => {
    const m = new Map<string, { id: string; name: string; order: number }>();
    for (const p of preguntasGraficables) {
      const id = String(p.categoria?.id ?? "sin_categoria");
      const name = p.categoria?.name ?? "General";
      const order = p.categoria?.order ?? 9999;
      if (!m.has(id)) m.set(id, { id, name, order });
    }
    return Array.from(m.values()).sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  }, [preguntasGraficables]);

  const allCatIds = React.useMemo(() => categorias.map((c) => String(c.id)), [categorias]);
  const [selectedCatIds, setSelectedCatIds] = React.useState<string[]>(allCatIds);
  React.useEffect(() => setSelectedCatIds(allCatIds), [reporte?.ciclo?.id, allCatIds.length]);

  const toggleCat = (id: string) =>
    setSelectedCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAllCats = () => setSelectedCatIds(allCatIds);
  const selectNoCats = () => setSelectedCatIds([]);

  const categoriaColorMap = React.useMemo(() => {
    const seen = new Map<string, string>();
    let i = 0;
    for (const p of preguntasGraficables) {
      const id = String(p.categoria?.id ?? "sin_categoria");
      if (!seen.has(id)) {
        seen.set(id, PALETTE_BAR[i % PALETTE_BAR.length]);
        i++;
      }
    }
    return seen;
  }, [preguntasGraficables]);

  const dataPct = React.useMemo(() => {
    const base = preguntasGraficables.filter(
      (p) =>
        selectedIds.includes(String(p.id)) &&
        selectedCatIds.includes(String(p.categoria?.id ?? "sin_categoria"))
    );
    const items = base.map((p, idx) => {
      const { pct, promedio, total } = computePct(p);
      const catId = p.categoria?.id ?? "sin_categoria";
      const catOrder = p.categoria?.order ?? 9999;
      return {
        pregunta: `P${idx + 1}`,
        pct,
        promedio,
        total,
        texto: p.texto,
        categoriaId: String(catId),
        categoriaOrder: catOrder,
      };
    });
    return items.sort(
      (a, b) => a.categoriaOrder - b.categoriaOrder || a.pregunta.localeCompare(b.pregunta)
    );
  }, [preguntasGraficables, selectedIds, selectedCatIds]);

  // Promedio ponderado del curso
  const cursoAvgPct = React.useMemo(() => {
    if (!dataPct.length) return null;
    let sum = 0;
    let n = 0;
    for (const it of dataPct) {
      const w = Number((it as any).total || 0);
      const p = Number((it as any).pct || 0);
      if (w > 0) { sum += p * w; n += w; }
    }
    return n > 0 ? +(sum / n).toFixed(1) : null;
  }, [dataPct]);


  // ¿Están cerca (en el eje %) las líneas Global y Curso?
const refLinesClose = React.useMemo(() => {
  if (typeof globalAllPct !== "number" || typeof cursoAvgPct !== "number") return false;
  return Math.abs(globalAllPct - cursoAvgPct) < 5; // umbral: 6 puntos porcentuales
}, [globalAllPct, cursoAvgPct]);


  /* =================== Preparación de LÍNEAS =================== */
  const preguntasOrden = React.useMemo(() => {
    const ids = (serie?.series || []).map((s) => s.id);
    return Array.from(new Set(ids)).sort((a, b) =>
      String(a).localeCompare(String(b), "es", { numeric: true })
    );
  }, [serie]);

  const pidToShort = React.useMemo(() => {
    const m = new Map<string, string>();
    preguntasOrden.forEach((pid, i) => m.set(pid, `P${i + 1}`));
    return m;
  }, [preguntasOrden]);

  const shortToFull = React.useMemo(() => {
    const m = new Map<string, string>();
    (serie?.series || []).forEach((s) => {
      const short = pidToShort.get(s.id) || s.id;
      if (!m.has(short)) m.set(short, s.label || short);
    });
    return m;
  }, [serie, pidToShort]);

  const ciclosOrden = React.useMemo(() => {
    const set = new Set<string>();
    (serie?.series || []).forEach((s) => s.data.forEach((p) => set.add(String(p.x))));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [serie]);

  const cicloColor = React.useMemo(() => {
    const m = new Map<string, string>();
    ciclosOrden.forEach((c, idx) => m.set(c, PALETTE_LINE[idx % PALETTE_LINE.length]));
    return m;
  }, [ciclosOrden]);

  const lineMatrix = React.useMemo(() => {
    if (!serie?.series?.length) return [] as any[];
    const rows: Record<string, any> = {};
    for (const pid of preguntasOrden) {
      const short = pidToShort.get(pid) || String(pid);
      rows[short] = { x: short, full: "" };
    }
    for (const s of (serie?.series || [])) {
      const pid = s.id;
      const short = pidToShort.get(pid) || String(pid);
      const full = shortToFull.get(short) || short;
      rows[short].full ||= full;
      for (const p of s.data) {
        const ciclo = String(p.x);
        const y = Number.isFinite(p.y) ? Math.max(0, Math.min(100, p.y)) : undefined;
        rows[short][ciclo] = y;
      }
    }
    return preguntasOrden.map((pid) => rows[pidToShort.get(pid) || String(pid)]);
  }, [serie, preguntasOrden, pidToShort, shortToFull]);

  const docenteAvgSerie = React.useMemo(() => {
    if (!lineMatrix.length) return null;
    let sum = 0; let n = 0;
    for (const row of lineMatrix) {
      for (const ciclo of ciclosOrden) {
        const v = row[ciclo];
        if (typeof v === "number" && Number.isFinite(v)) { sum += v; n += 1; }
      }
    }
    return n > 0 ? +(sum / n).toFixed(1) : null;
  }, [lineMatrix, ciclosOrden]);

  const toggleCycle = (c: string) => {
    setHiddenCycles((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };
  const showAllCycles = () => setHiddenCycles(new Set());
  const hideAllCycles = () => setHiddenCycles(new Set(ciclosOrden));

  /* ====== Comentarios ====== */
  const cargarComentarios = React.useCallback(async () => {
    if (!selected) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const resp: DocComentariosResponse = await getDocenteEncuestaComentarios({
        cicloId: selected,
        includeGeneral: true,
        onlyCommentLike: false,
      });
      const raw = Array.isArray(resp?.items) ? resp.items : [];
      const norm = raw
        .map((r, idx) => {
          const texto = String(r?.texto ?? "").trim();
          if (!texto) return null;
          const base = `ans|${r?.id ?? idx}|${r?.pregunta_id ?? "x"}|${texto}`;
          let h = 0;
          for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
          const uid = `cm-${r?.id ?? idx}-${r?.pregunta_id ?? "q"}-${Math.abs(h).toString(36)}`;
          return {
            id: uid,
            pregunta_id: r?.pregunta_id ?? null,
            pregunta_texto: (r as any)?.pregunta_texto ?? null,
            texto,
            created_at: (r as any)?.created_at ?? null,
            alumno: null,
          } as Comentario;
        })
        .filter(Boolean) as Comentario[];
      const seen = new Set<string>();
      const unique: Comentario[] = [];
      for (const it of norm) if (!seen.has(it.id)) { seen.add(it.id); unique.push(it); }
      unique.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setComments(unique);
    } catch (e: any) {
      setComments([]);
      setCommentsError(e?.message || "No se pudieron cargar los comentarios");
    } finally {
      setCommentsLoading(false);
    }
  }, [selected]);

  React.useEffect(() => { if (commentsOpen) cargarComentarios(); }, [commentsOpen, cargarComentarios]);

  const commentsFiltered = React.useMemo(() => {
    let list = comments;
    if (commentsQuery.trim()) {
      const q = commentsQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.texto || "").toLowerCase().includes(q) ||
          (c.pregunta_texto || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [comments, commentsQuery]);

  /* ===== Badge KPI helper (encabezado) ===== */
  const kpiPill = (label: string, value: number | null) => {
    const ok = typeof value === "number" ? value >= THRESHOLD : null;
    return (
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm h-8",
          ok === null
            ? "bg-muted/50 text-foreground/80 border-muted"
            : ok
            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
            : "bg-rose-50 text-rose-700 border-rose-300",
        ].join(" ")}
      >
        <Target className="h-4 w-4 opacity-80" />
        <span className="whitespace-nowrap">{label}</span>
        <span className="font-semibold tabular-nums">
          {typeof value === "number" ? `${value}%` : "—"}
        </span>
      </span>
    );
  };


  /* =================== RENDER =================== */
  const participantes = reporte?.total_participantes ?? null;

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        {/* ===== Encabezado compacto ===== */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">
              {showAll ? "Desempeño Docente" : "Resultados de la encuesta de satisfacción"}
            </h3>
            {!showAll && reporte?.ciclo && (
              <Badge variant="secondary">Curso: {reporte.ciclo.codigo}</Badge>
            )}
            {!showAll && !!participantes && (
              <Badge variant="outline">Participantes: {participantes}</Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant={showAll ? "outline" : "default"} onClick={() => setShowAll(false)}>
              <BarChartIcon className="h-4 w-4 mr-2" />
              Ver por curso
            </Button>
            <Button size="sm" variant={showAll ? "default" : "outline"} onClick={() => setShowAll(true)}>
              <LineChartIcon className="h-4 w-4 mr-2" />
              Ver todos
            </Button>

            {!showAll ? (
              <Button size="sm" variant="outline" onClick={consultar} disabled={loadingReporte || !selected}>
                {loadingReporte ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Actualizar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={consultarSerie} disabled={loadingSerie}>
                {loadingSerie ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Actualizar
              </Button>
            )}

            <Button
              size="sm"
              className="h-8"
              style={{ background: DARK_TEXT, color: "white", border: `1px solid ${DARK_TEXT}` }}
              onClick={() => setCommentsOpen(true)}
              disabled={!selected || showAll}
              title={showAll ? "Disponible solo por ciclo" : "Ver comentarios del ciclo"}
            >
              <MessageSquareText className="h-4 w-4 mr-2" />
              Comentarios
            </Button>
          </div>
        </div>

        {/* ===== Subcontroles del ciclo (solo barras) ===== */}
        {!showAll && (
          <>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-sm font-medium">Ciclo</label>
              <select
                className="border rounded-md px-3 py-2 text-sm"
                disabled={loadingCiclos || ciclos.length === 0}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {loadingCiclos ? (
                  <option>Cargando…</option>
                ) : ciclos.length === 0 ? (
                  <option value="">Sin ciclos</option>
                ) : (
                  ciclos.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.codigo}{c.idioma ? ` · ${c.idioma}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <Separator className="my-3" />

            {/* ===== KPIs claves ===== */}
            <div className="flex flex-wrap items-center gap-2 my-1">
              {kpiPill("Promedio Global", globalAllPct)}
              {kpiPill("Promedio del curso", typeof cursoAvgPct === "number" ? cursoAvgPct : null)}
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-300 px-3 py-1.5 text-sm h-8">
                <Users className="h-4 w-4 text-slate-600 shrink-0" />
                <span className="text-xs text-muted-foreground">Respuestas usadas:</span>
                <span className="font-semibold text-slate-800">
                  {dataPct.reduce((a, b) => a + Number((b as any).total || 0), 0)}
                </span>
              </span>
            </div>
          </>
        )}

        {/* ====== Chips P1..Pn / categorías (solo barras) ====== */}
        <TooltipProvider>
          {!showAll && (
            <>
              <div className="mt-2 mb-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectedIds.length === allIds.length ? selectNone : selectAll}
                  >
                    {selectedIds.length === allIds.length ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                    {selectedIds.length === allIds.length ? "Deseleccionar todo" : "Seleccionar todo"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.length}/{allIds.length} preguntas
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {preguntasGraficables.map((p: any, idx: number) => {
                    const id = String(p.id);
                    const checked = selectedIds.includes(id);
                    const short = `P${idx + 1}`;
                    return (
                      <UiTooltip key={id} delayDuration={200}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => toggleOne(id)}
                            className={`text-xs rounded-full border px-3 py-1 transition ${
                              checked ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-foreground border-muted"
                            }`}
                            title={p.texto}
                          >
                            {checked ? "✓ " : ""}
                            {short}
                          </button>
                        </TooltipTrigger>
                       <UiTooltipContent
                          side="top"
                          align="start"
                          sideOffset={8}
                          className={[
                            "max-w-[640px] rounded-md border shadow-xl",
                            "bg-white text-slate-800",              // modo claro
                            "dark:bg-slate-900 dark:text-slate-100" // modo oscuro
                          ].join(" ")}
                          style={{
                            borderColor: "rgba(124, 0, 34, 0.25)"   // acento guinda MUY sutil (25% opacidad)
                          }}
                        >
                          <p className="text-sm leading-snug">
                            {p.texto}
                          </p>
                        </UiTooltipContent>


                      </UiTooltip>
                    );
                  })}
                </div>
              </div>
            {categorias.length > 0 && (
              <div className="mb-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectedCatIds.length === allCatIds.length ? selectNoCats : selectAllCats}
                  >
                    {selectedCatIds.length === allCatIds.length ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                    {selectedCatIds.length === allCatIds.length ? "Ocultar todas" : "Mostrar todas"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedCatIds.length}/{allCatIds.length} categorías
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const grandWeighted = dataPct.reduce((acc, it) => {
                      const pct = Number(it.pct) || 0;
                      const w   = Number((it as any).total) || 0;
                      return acc + pct * w;
                    }, 0);

                    return categorias.map((c, i) => {
                      const color = PALETTE_BAR[i % PALETTE_BAR.length];
                      const checked = selectedCatIds.includes(String(c.id));
                      const style: React.CSSProperties = checked
                        ? { background: color, color: DARK_TEXT, border: `1px solid ${color}` }
                        : { background: "hsl(var(--muted))", color: DARK_TEXT, border: `1px solid ${color}` };

                      const catItems = dataPct.filter((it) => it.categoriaId === String(c.id));

                      let catAvgPct = 0;
                      let catW = 0;
                      for (const it of catItems) {
                        const pct = Number(it.pct) || 0;
                        const w   = Number((it as any).total) || 0;
                        catAvgPct += pct * w;
                        catW += w;
                      }
                      catAvgPct = catW > 0 ? +(catAvgPct / catW).toFixed(1) : 0;

                      const catWeighted = catItems.reduce((acc, it) => {
                        const pct = Number(it.pct) || 0;
                        const w   = Number((it as any).total) || 0;
                        return acc + pct * w;
                      }, 0);
                      const catShare = grandWeighted > 0 ? +((catWeighted / grandWeighted) * 100).toFixed(1) : 0;

                      const pctColor = catAvgPct >= THRESHOLD ? GREEN : RED;

                      return (
                        <button
                          key={String(c.id)}
                          type="button"
                          onClick={() => toggleCat(String(c.id))}
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm leading-none h-8 transition"
                          style={style}
                          title={`${c.name} — Promedio: ${catAvgPct}% · Participación: ${catShare}%`}
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ background: color }}
                          />
                          {c.name}
                          <span
                            className="ml-1 inline-flex items-center justify-center rounded-full px-2 h-5 text-[11px] font-semibold"
                            style={{
                              background: "#0f172a",
                              color: "#fff",
                              border: "1px solid rgba(0,0,0,0.05)",
                            }}
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full mr-1"
                              style={{ background: pctColor }}
                              aria-label={catAvgPct >= THRESHOLD ? "≥80%" : "<80%"}
                            />
                            {catAvgPct}%
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            </>
          )}
        </TooltipProvider>

        {/* ======================= GRÁFICAS ======================= */}
        <div className="mt-2 h-[560px] md:h-[640px] w-full">
          {!showAll ? (
            /* ----------------- BARRAS (por ciclo) ----------------- */
            loadingReporte ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Cargando resultados…
              </div>
            ) : dataPct.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {selected ? "Sin resultados." : "Selecciona un curso para ver la encuesta."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataPct}
                  layout="vertical"
                  margin={{ top: 92, right: 200, bottom: 28, left: 96 }}
                  barCategoryGap={18}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="4 4" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    label={{ value: "Promedio (%)", position: "insideBottom", offset: -18, fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="pregunta"
                    width={76}
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                  />
                  <RTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row: any = payload[0].payload;
                      const val = payload[0].value as number;
                      return (
                        <div className="rounded-md border bg-background px-2 py-1 text-sm shadow-sm max-w-[28rem]">
                          <div className="font-medium break-words whitespace-normal">{row.texto}</div>
                          <div className="text-muted-foreground">{Number(val).toFixed(1)}%</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="pct" radius={[8, 8, 8, 8]} barSize={34}>
                    {dataPct.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={categoriaColorMap.get(entry.categoriaId) || PALETTE_BAR[0]} />
                    ))}
                    <LabelList
                      dataKey="pct"
                      content={(props: any) => {
                        const { x = 0, y = 0, width = 0, height = 0, value } = props;
                        const v = Number(value ?? 0);
                        const text = `${Math.round(v)}%`;
                        const inside = v >= 98;
                        const tx = inside ? x + width - 6 : x + width + 8;
                        const ty = y + height / 2 + 4;
                        return (
                          <text x={tx} y={ty} textAnchor={inside ? "end" : "start"} fontSize={12} className="tabular-nums" fill="hsl(var(--foreground))">
                            {text}
                          </text>
                        );
                      }}
                    />
                  </Bar>

                  {/* Referencias (bar) con chapita interna al lado derecho */}
                  {/* Global (arriba, centrado sobre la línea) */}
                {typeof globalAllPct === "number" && (
                  <ReferenceLine
                    x={globalAllPct}
                    stroke={globalAllPct >= THRESHOLD ? GREEN : RED}  // o IPN
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                    isFront
                    label={{
                      content: (props: any) => (
                        <RefPillTopX
                          viewBox={props?.viewBox}
                          text={`Global: ${globalAllPct.toFixed(1)}%`}
                          color={globalAllPct >= THRESHOLD ? GREEN : RED} // o IPN
                          row={refLinesClose && globalAllPct <= (cursoAvgPct ?? -1) ? 1 : 0}
                        />
                      ),
                    }}
                  />
                )}

                {/* Curso (arriba, centrado sobre la línea) */}
                {typeof cursoAvgPct === "number" && (
                  <ReferenceLine
                    x={cursoAvgPct}
                    stroke={cursoAvgPct >= THRESHOLD ? GREEN : RED}      // o IPN
                    strokeDasharray="2 2"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                    isFront
                    label={{
                      content: (props: any) => (
                        <RefPillTopX
                          viewBox={props?.viewBox}
                          text={`Curso: ${cursoAvgPct.toFixed(1)}%`}
                          color={cursoAvgPct >= THRESHOLD ? GREEN : RED} // o IPN
                          row={refLinesClose && cursoAvgPct < (globalAllPct ?? -1) ? 1 : 0}
                        />
                      ),
                    }}
                  />
                )}

                </BarChart>
              </ResponsiveContainer>
            )
          ) : (
            /* ----------------- LÍNEAS (ver todos) ----------------- */
            loadingSerie ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Cargando serie por ciclos…
              </div>
            ) : !lineMatrix.length ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No hay datos de ciclos para graficar.
              </div>
            ) : (
              <>
                {/* Controles de ciclos (toggle + promedio + botones globales) */}
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <span className="text-xs text-muted-foreground mr-2">Ciclos:</span>

                  {ciclosOrden.map((ciclo) => {
                    const color = cicloColor.get(ciclo) || "#999";
                    const vals = lineMatrix
                      .map((r: any) => r[ciclo])
                      .filter((v: any): v is number => typeof v === "number" && Number.isFinite(v));
                    const avg = vals.length
                      ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1)
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

                  <div className="ml-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={showAllCycles}
                      className="border-sky-300 text-sky-700 hover:bg-sky-50"
                      title="Mostrar todas las series"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Mostrar todo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={hideAllCycles}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      title="Ocultar todas las series"
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Ocultar todo
                    </Button>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  {/* margen derecho ↑ para alojar las píldoras externas */}
                  <LineChart data={lineMatrix} margin={{ top: 56, right: 260, bottom: 48, left: 64 }}>
                    <CartesianGrid strokeDasharray="4 4" />
                    <XAxis
                      dataKey="x"
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      label={{ value: "Preguntas (P1..Pn)", position: "insideBottom", offset: -18, fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      label={{ value: "Promedio (%)", angle: -90, position: "insideLeft", offset: 10, fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <RTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const row: any = payload[0]?.payload || {};
                        const full = row.full || label;
                        return (
                          <div className="rounded-md border bg-background px-2 py-1 text-sm shadow-sm max-w-[28rem]">
                            <div className="text-muted-foreground mb-1">
                              <strong>{label}</strong> — {full}
                            </div>
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
                                <span className="font-medium">{p.name}</span>
                                <span className="text-muted-foreground">
                                  {typeof p.value === "number" ? `${p.value.toFixed(1)}%` : `${p.value}%`}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ top: 6, right: 8, fontSize: 12 }} />

                    {ciclosOrden.filter((c) => !hiddenCycles.has(c)).map((c) => (
                      <Line
                        key={c}
                        type="monotone"
                        dataKey={c}
                        name={c}
                        stroke={cicloColor.get(c) || "#999"}
                        strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}

                    {/* ===== Líneas de referencia con PÍLDORAS FUERA del plot ===== */}
                    {typeof globalAllPct === "number" && (
                      <ReferenceLine
                        y={globalAllPct}
                        stroke={globalAllPct >= THRESHOLD ? GREEN : RED}
                        strokeDasharray="6 4"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                        isFront
                        label={{
                          content: (props: any) => (
                            <RefRightPillLabel
                              viewBox={props?.viewBox}
                              text={`Global: ${globalAllPct}%`}
                              color={globalAllPct >= THRESHOLD ? GREEN : RED}
                              row={0}
                            />
                          ),
                        }}
                      />
                    )}
                    {typeof docenteAvgSerie === "number" && (
                      <ReferenceLine
                        y={docenteAvgSerie}
                        stroke={docenteAvgSerie >= THRESHOLD ? GREEN : RED}
                        strokeDasharray="2 2"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                        isFront
                        label={{
                          content: (props: any) => (
                            <RefRightPillLabel
                              viewBox={props?.viewBox}
                              text={`Docente: ${docenteAvgSerie}%`}
                              color={docenteAvgSerie >= THRESHOLD ? GREEN : RED}
                              /* si algún día quisieras anti-colisión vertical con más líneas, usa row=1 */
                              row={0}
                            />
                          ),
                        }}
                      />
                    )}

                    {/* (Opcional) Chapitas calculadas por scale — si prefieres solo las de fuera, puedes quitar este bloque.
                        Lo dejo intacto por si lo sigues usando en otro contexto. */}
                    {/* <Customized
                      component={
                        <RightRefPills
                          yValues={[
                            ...(typeof globalAllPct === "number"
                              ? [{ value: globalAllPct, text: `Global: ${globalAllPct}%`, color: globalAllPct >= THRESHOLD ? GREEN : RED }]
                              : []),
                            ...(typeof docenteAvgSerie === "number"
                              ? [{ value: docenteAvgSerie, text: `Docente: ${docenteAvgSerie}%`, color: docenteAvgSerie >= THRESHOLD ? GREEN : RED }]
                              : []),
                          ]}
                        />
                      }
                    /> */}
                  </LineChart>
                </ResponsiveContainer>
              </>
            )
          )}
        </div>

      </CardContent>

    <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
      <SheetContent
        side="right"
        className="!max-w-none !w-[42vw] md:!w-[620px] lg:!w-[740px] !px-6 !py-6"
        style={{ width: "min(740px, 92vw)" }}
      >
        {/* Header sticky con acento guinda */}
        <SheetHeader
          className="sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-3"
          style={{ borderColor: "#7c0022" }}
        >
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" style={{ color: "#7c0022" }} />
              <span className="tracking-tight">Comentarios del curso</span>
            </span>

            <div className="flex items-center gap-2">
              {reporte?.ciclo?.codigo && !showAll && (
                <Badge
                  variant="secondary"
                  className="whitespace-nowrap"
                  style={{ background: "#7c002220", color: "#7c0022", borderColor: "#7c0022" }}
                >
                  {reporte.ciclo.codigo}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={cargarComentarios}
                disabled={!selected || commentsLoading}
                title="Recargar comentarios"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                {commentsLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4 mr-2" />
                )}
                Recargar
              </Button>
            </div>
          </SheetTitle>

          <SheetDescription className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Los comentarios se muestran de forma anónima para proteger la confidencialidad.</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquareText className="h-3.5 w-3.5" style={{ color: "#7c0022" }} />
              {commentsFiltered.length.toLocaleString()} comentarios
            </span>
          </SheetDescription>

          {/* Buscador con focus ring guinda */}
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9 focus-visible:ring-2"
                style={
                  {
                    boxShadow:
                      "0 0 0 0 var(--tw-ring-offset-shadow), 0 0 0 2px #7c0022",
                  } as React.CSSProperties
                }
                placeholder="Buscar por texto o por pregunta…"
                value={commentsQuery}
                onChange={(e) => setCommentsQuery(e.target.value)}
              />
            </div>
          </div>
        </SheetHeader>

        {/* Contenido scrollable */}
        <div className="pt-3">
          {commentsError && (
            <div className="text-sm text-amber-600">{commentsError}</div>
          )}

          {commentsLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Cargando comentarios…
            </div>
          ) : commentsFiltered.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay comentarios para mostrar.
            </div>
          ) : (
            <ScrollArea className="h-[70vh] pr-4">
              <ul className="space-y-3">
                {commentsFiltered.map((c) => (
                  <li
                    key={c.id}
                    className="group rounded-lg border p-4 hover:bg-slate-50/70 transition-colors relative"
                    style={{ borderColor: "#e2e8f0" }}
                  >
                    <span
                      className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "#7c0022" }}
                    />

                    {c.pregunta_texto && (
                      <div className="text-[11px] text-muted-foreground mb-1">
                        {c.pregunta_texto}
                      </div>
                    )}

                    <div
                      className="relative mt-1 rounded-md border px-3 py-2"
                      style={{ background: "#7c002210", borderColor: "#f1f5f9" }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5 absolute -top-2 -left-2 drop-shadow-sm"
                        style={{ color: "#7c0022" }}
                      >
                        <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17v6.66A2.17 2.17 0 0 0 4.17 20h3.66A2.17 2.17 0 0 0 10 17.83v-6.66A5.17 5.17 0 0 0 4.83 6h2.34zm10 0A5.17 5.17 0 0 0 12 11.17v6.66A2.17 2.17 0 0 0 14.17 20h3.66A2.17 2.17 0 0 0 20 17.83v-6.66A5.17 5.17 0 0 0 14.83 6h2.34z" />
                      </svg>

                      <blockquote className="whitespace-pre-wrap break-words pl-4 text-sm leading-relaxed text-slate-800">
                        {c.texto}
                      </blockquote>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {c.created_at && (
                        <span>
                          {new Date(c.created_at).toLocaleDateString("es-MX")}{" "}
                          {new Date(c.created_at).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>


    </Card>
  );
}
