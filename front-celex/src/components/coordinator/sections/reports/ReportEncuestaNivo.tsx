"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Loader2,
  Printer,
  RefreshCw,
  CheckSquare,
  Square,
  MessageSquareText,
  RefreshCcw,
  Search,
  BarChart3,
  Table,
  Gauge,
  Users,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { ReportFiltersState } from "./useReportFilters";
import { downloadCSV, exportNodeToPDF } from "./utils/export";
import { getReporteEncuesta, getEncuestaComentarios } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
} from "recharts";

/* ================== Tipos ================== */
export type EncuestaOpcion = { opcion: string; conteo: number };
export type EncuestaCategoria = { id: number | string; name: string; order: number };
export type EncuestaPregunta = {
  id: string | number;
  texto: string;
  opciones: EncuestaOpcion[];
  total_respuestas?: number | null;
  promedio?: number | null; // 1..5
  promedio_pct?: number | null; // 0..100
  favorables_pct?: number | null; // >=4
  categoria?: EncuestaCategoria | null;
};
export type ReportReporteEncuesta = {
  ciclo: { id: number | string; codigo: string };
  preguntas: EncuestaPregunta[];
  total_participantes?: number;
};

/* ===== Comentarios ===== */
export type EncuestaComentario = {
  id: string;
  pregunta_id: string | number | null;
  pregunta_texto: string | null;
  texto: string;
  created_at?: string | null;
  alumno?: { id?: string | number; nombre?: string | null; email?: string | null } | null;
};

/* ===== Helper: nombre del docente (si existe) ===== */
function getDocenteNombreFromReporte(rep: any): string | null {
  if (!rep) return null;
  if (rep?.docente?.nombre) return String(rep.docente.nombre);
  if (rep?.docente_nombre) return String(rep.docente_nombre);
  if (rep?.grupo?.docente?.nombre) return String(rep.grupo.docente.nombre);
  if (Array.isArray(rep?.grupos) && rep.grupos[0]?.docente?.nombre) return String(rep.grupos[0].docente.nombre);
  if (rep?.curso?.docente?.nombre) return String(rep.curso.docente.nombre);
  return null;
}

/* =================== Constantes UI / Helpers =================== */
const PALETTE = ["#8596b3", "#ac9eb3", "#c4b0b3", "#d0d5d3"];
const PALETTE_BAR = ["#6B8BB4", "#A27EA9", "#C39AA2", "#A9B8AE", "#D7C8B6", "#8BA3C7"];
const DARK_TEXT = "#111827";
const THRESHOLD = 80;
const GREEN = "#059669"; // emerald-600
const RED = "#dc2626";   // red-600

function round1(n: number) { return Math.round(n * 10) / 10; }

function fmtPctOrDash(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return Number(v).toFixed(1) + "%";
}

type Status = "ok" | "bad" | "na";
function statusFromPct(v: number | null | undefined, threshold = THRESHOLD): Status {
  if (v == null || !Number.isFinite(Number(v))) return "na";
  return Number(v) >= threshold ? "ok" : "bad";
}

/* =================== Cálculo por categoría (SUMA 100%) =================== */
type CatStat = {
  id: string;
  name: string;
  color: string;
  checked: boolean;
  avgPct: number | null;  // promedio de la categoría (0..100)
  sharePct: number;       // participación normalizada (suma 100% ENTRE las categorías seleccionadas)
  totalResps: number;     // Σ respuestas de las preguntas de la categoría
};

/**
 * - avgPct: (Σ pct*total) / (Σ total)
 * - sharePct (suma 100% sobre seleccionadas): wSum = Σ(pct*total); share = wSum_i / Σ(wSum_checked)
 * - closeTo100: ajusta la última categoría seleccionada para cerrar a 100.0 (solo entre seleccionadas)
 */
function buildCategoryStats(
  categorias: Array<{ id: string; name: string }>,
  dataPct: Array<{ categoriaId: string; categoriaName: string; pct: number; total: number }>,
  categoriaColorMap: Map<string, string>,
  selectedCatIds: string[],
  closeTo100: boolean
): CatStat[] {
  const perCat: Record<string, { name: string; color: string; checked: boolean; wSum: number; tSum: number }> = {};
  for (const c of categorias) {
    perCat[String(c.id)] = {
      name: c.name,
      color: categoriaColorMap.get(String(c.id)) || "#bbb",
      checked: selectedCatIds.includes(String(c.id)),
      wSum: 0,
      tSum: 0,
    };
  }

  for (const row of dataPct) {
    const catId = String(row.categoriaId);
    if (!perCat[catId]) continue;
    const pct = Number(row.pct) || 0;
    const t = Number(row.total) || 0;
    perCat[catId].wSum += pct * t;
    perCat[catId].tSum += t;
  }

  const checkedCats = Object.values(perCat).filter((c) => c.checked);
  const denomScore = checkedCats.reduce((acc, it) => acc + it.wSum, 0);

  const stats: CatStat[] = Object.entries(perCat).map(([id, it]) => {
    const hasData = it.tSum > 0;
    const avg = hasData ? round1(it.wSum / it.tSum) : null;
    let share = 0;
    if (it.checked) {
      share = hasData && denomScore > 0 ? (it.wSum / denomScore) * 100 : 0;
    }
    return {
      id,
      name: it.name,
      color: it.color,
      checked: it.checked,
      avgPct: avg,
      sharePct: round1(Number.isFinite(share) ? share : 0),
      totalResps: it.tSum,
    };
  });

  // Ajuste de cierre a 100 SOLO entre seleccionadas
  if (closeTo100) {
    const visibles = stats.filter((s) => s.checked);
    if (visibles.length > 0) {
      const sum = round1(visibles.reduce((acc, s) => acc + s.sharePct, 0));
      const diff = round1(100 - sum);
      if (Math.abs(diff) > 0) {
        const idx = [...visibles].reverse().findIndex((s) => s.totalResps > 0);
        const target = idx >= 0 ? visibles[visibles.length - 1 - idx] : visibles[visibles.length - 1];
        if (target) target.sharePct = round1(Math.max(0, target.sharePct + diff));
      }
    }
  }

  // 👇 **NO** filtramos por `checked`: devolvemos TODAS las categorías
  return stats;
}

/* =================== Componente =================== */
export default function ReportEncuestaPorcentaje({
  filters,
  initialData = null,
}: {
  filters: ReportFiltersState;
  initialData?: ReportReporteEncuesta | null;
}) {
  const { anio, idioma, cicloId } = filters;
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<ReportReporteEncuesta | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  /* ====== Comentarios ====== */
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [comments, setComments] = useState<EncuestaComentario[]>([]);
  const [commentsQuery, setCommentsQuery] = useState("");

  const docenteNombre = useMemo(() => getDocenteNombreFromReporte(reporte), [reporte]);

  async function consultar() {
    if (!cicloId) {
      setError("Selecciona un ciclo");
      setReporte(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getReporteEncuesta({ cicloId });
      setReporte(data);
    } catch (e: any) {
      setError(e?.message || "No se pudo obtener el reporte de encuesta");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialData) {
      if (cicloId) consultar();
      else setReporte(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  async function cargarComentarios() {
    if (!cicloId) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const resp = await getEncuestaComentarios({
        cicloId,
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
            pregunta_texto: r?.pregunta_texto ?? null,
            texto,
            created_at: r?.created_at ?? null,
            alumno: { nombre: r?.alumno?.nombre ?? null, email: r?.alumno?.email ?? null },
          } as EncuestaComentario;
        })
        .filter(Boolean) as EncuestaComentario[];

      const seen = new Set<string>();
      const unique: EncuestaComentario[] = [];
      for (const it of norm) if (!seen.has(it.id)) { seen.add(it.id); unique.push(it); }
      unique.sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
      setComments(unique);
    } catch (e: any) {
      setComments([]);
      setCommentsError(e?.message || "No se pudieron cargar los comentarios");
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => { if (commentsOpen) cargarComentarios(); }, [commentsOpen, cicloId]);

  /* =================== Cálculos base =================== */
  function isNumericQuestion(p: EncuestaPregunta) {
    return (
      Array.isArray(p.opciones) &&
      p.opciones.length > 0 &&
      p.opciones.every((o) => !Number.isNaN(Number(o.opcion)))
    );
  }

  function computePct(p: EncuestaPregunta) {
    const total =
      (p.total_respuestas ?? undefined) !== undefined
        ? p.total_respuestas || 0
        : p.opciones.reduce((acc, o) => acc + (o.conteo || 0), 0);

    let promedio = p.promedio ?? null;
    if (promedio == null && total > 0) {
      let suma = 0;
      for (const o of p.opciones) {
        const val = Number(o.opcion);
        const n = o.conteo || 0;
        if (!Number.isNaN(val)) suma += val * n;
      }
      promedio = +(suma / total).toFixed(2);
    }
    const pct = p.promedio_pct ?? (promedio != null ? +((promedio / 5) * 100).toFixed(1) : 0);
    return { pct, promedio: promedio ?? 0, total };
  }

  const preguntasGraficables = (reporte?.preguntas || []).filter(isNumericQuestion);

  // selección P1..Pn y categorías
  const allIds = useMemo(() => preguntasGraficables.map((p) => String(p.id)), [preguntasGraficables]);
  const [selectedIds, setSelectedIds] = useState<string[]>(allIds);
  useEffect(() => setSelectedIds(allIds), [reporte?.ciclo?.id, allIds.length]);

  const categorias = useMemo(() => {
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

  const allCatIds = useMemo(() => categorias.map((c) => String(c.id)), [categorias]);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(allCatIds);
  useEffect(() => setSelectedCatIds(allCatIds), [reporte?.ciclo?.id, allCatIds.length]);

  const selectedQuestionsBase = useMemo(
    () => preguntasGraficables.filter((p) => selectedIds.includes(String(p.id))),
    [preguntasGraficables, selectedIds]
  );
  const selectedQuestions = useMemo(
    () => selectedQuestionsBase.filter((p) => selectedCatIds.includes(String(p.categoria?.id ?? "sin_categoria"))),
    [selectedQuestionsBase, selectedCatIds]
  );

  // data para barras + colores por categoría
  const dataPct = useMemo(() => {
    const categoriaColorMapTmp = new Map<string, string>();
    let i = 0;
    const rows = selectedQuestions
      .map((p, idx) => {
        const { pct, promedio, total } = computePct(p);
        const catId = String(p.categoria?.id ?? "sin_categoria");
        const catName = p.categoria?.name ?? "General";
        const catOrder = p.categoria?.order ?? 9999;
        if (!categoriaColorMapTmp.has(catId)) {
          categoriaColorMapTmp.set(catId, PALETTE[i % PALETTE.length]);
          i++;
        }
        return {
          pregunta: `P${idx + 1}`,
          pct,
          promedio,
          total,
          texto: p.texto,
          categoriaId: catId,
          categoriaName: catName,
          categoriaOrder: catOrder,
          color: categoriaColorMapTmp.get(catId) as string,
        };
      })
      .sort((a, b) => a.categoriaOrder - b.categoriaOrder || a.pregunta.localeCompare(b.pregunta));
    return rows;
  }, [selectedQuestions]);

  // mapa de color estable para pills
  const categoriaColorMap = useMemo(() => {
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

  // === KPIs global
  const kpiGlobalPct = useMemo(() => {
    if (selectedQuestions.length === 0) return null;
    let suma = 0, total = 0;
    for (const p of selectedQuestions) {
      for (const o of p.opciones) {
        const v = Number(o.opcion);
        const n = o.conteo || 0;
        if (!Number.isNaN(v)) { suma += v * n; total += n; }
      }
    }
    const prom = total ? +(suma / total).toFixed(2) : 0;
    const pct = total ? +((prom / 5) * 100).toFixed(1) : 0;
    return { pct, total, prom };
  }, [selectedQuestions]);

  // === Benchmark global (todos los docentes)
  const [globalTodosPct, setGlobalTodosPct] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@/lib/api").catch(() => null as any);
        const fn = mod?.getCoordKpis || mod?.getCoordinacionKpis;
        if (!fn) { if (!cancelled) setGlobalTodosPct(null); return; }
        const kpis = await fn({ anio: filters.anio ?? undefined, idioma: filters.idioma ?? undefined });
        const val = Number(kpis?.promedio_global_pct);
        if (!cancelled) setGlobalTodosPct(Number.isFinite(val) ? +val.toFixed(1) : null);
      } catch { if (!cancelled) setGlobalTodosPct(null); }
    })();
    return () => { cancelled = true; };
  }, [anio, idioma, filters.anio, filters.idioma]);

  // === CSV / PDF
  const csv = () => {
    if (!reporte?.preguntas?.length) return;
    const rows = dataPct.map((r) => ({
      ciclo: reporte?.ciclo?.codigo ?? "",
      docente: docenteNombre ?? "",
      pregunta: r.pregunta,
      texto: r.texto,
      categoria: r.categoriaName,
      promedio_pct: r.pct,
    }));
    downloadCSV(`encuesta_porcentajes_${reporte?.ciclo?.codigo || "ciclo"}.csv`, rows);
  };
  const pdf = () => exportNodeToPDF(ref.current, "Resultados de la encuesta (porcentaje)");

  // selección handlers
  const allSelected = selectedIds.length === allIds.length && allIds.length > 0;
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAll = () => setSelectedIds(allIds);
  const selectNone = () => setSelectedIds([]);

  const allCatIdsSelected = selectedCatIds.length === allCatIds.length && allCatIds.length > 0;
  const toggleCat = (id: string) =>
    setSelectedCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAllCats = () => setSelectedCatIds(allCatIds);
  const selectNoCats = () => setSelectedCatIds([]);

  /* =================== CATEGORÍAS (suma 100% entre seleccionadas) =================== */
  const catStats = useMemo(() => {
    return buildCategoryStats(
      categorias.map((c) => ({ id: c.id, name: c.name })),
      dataPct.map((it) => ({
        categoriaId: it.categoriaId,
        categoriaName: it.categoriaName,
        pct: it.pct,
        total: (it as any).total || 0,
      })),
      categoriaColorMap,
      selectedCatIds,
      true // closeTo100
    );
  }, [categorias, dataPct, categoriaColorMap, selectedCatIds]);

  const catShareSum = useMemo(
    () =>
      round1(
        catStats
          .filter((s) => s.checked)
          .reduce((a, b) => a + b.sharePct, 0)
      ),
    [catStats]
  );

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Resultados de la encuesta</h3>
            {reporte?.ciclo && <Badge variant="secondary">Curso: {reporte.ciclo.codigo}</Badge>}
            {docenteNombre && <Badge variant="secondary">Docente: {docenteNombre}</Badge>}
            {anio && <Badge variant="secondary">Año: {anio}</Badge>}
            {idioma && <Badge variant="secondary">Idioma: {idioma}</Badge>}
            {!!reporte?.total_participantes && (
              <Badge variant="outline">Participantes: {reporte.total_participantes}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={consultar} disabled={loading || !cicloId} title="Actualizar">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Actualizar
            </Button>
            <Button size="sm" variant="outline" onClick={csv} disabled={!dataPct.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" onClick={pdf} disabled={!dataPct.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        <div ref={ref}>
          {/* Selección de preguntas */}
          {preguntasGraficables.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={allSelected ? selectNone : selectAll}
                  title={allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                >
                  {allSelected ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                  {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length}/{allIds.length} preguntas
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {preguntasGraficables.map((p, idx) => {
                  const id = String(p.id);
                  const checked = selectedIds.includes(id);
                  return (
                    <button
                      key={`q-${id}`}
                      type="button"
                      className={`text-xs rounded-full border px-3 py-1 transition ${
                        checked ? "bg-primary text-primary-foreground border-primary"
                               : "bg-background text-foreground border-muted"
                      }`}
                      onClick={() => toggleOne(id)}
                      title={p.texto}
                    >
                      {checked ? "✓ " : ""}
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selección de categorías + PILLS (suma 100% entre seleccionadas) */}
          {categorias.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={allCatIdsSelected ? selectNoCats : selectAllCats}
                  title={allCatIdsSelected ? "Ocultar todas" : "Mostrar todas"}
                >
                  {allCatIdsSelected ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                  {allCatIdsSelected ? "Ocultar todas" : "Mostrar todas"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedCatIds.length}/{allCatIds.length} categorías
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {catStats.map((s) => {
                  // ✅ Mantener visibles SIEMPRE; estilizar según selección
                  const styleChecked: React.CSSProperties = {
                    background: s.color,
                    color: DARK_TEXT,
                    border: `1px solid ${s.color}`,
                  };
                  const styleUnchecked: React.CSSProperties = {
                    background: "transparent",
                    color: DARK_TEXT,
                    border: `1px solid ${s.color}`,
                    opacity: 0.75,
                  };
                  const style = s.checked ? styleChecked : styleUnchecked;

                  const st: Status = statusFromPct(s.avgPct, THRESHOLD);
                  const dotColor = st === "na" ? "#94a3b8" : st === "ok" ? GREEN : RED;

                  return (
                    <button
                      key={String(s.id)}
                      type="button"
                      onClick={() => toggleCat(String(s.id))}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm leading-none h-8 transition"
                      style={style}
                      title={
                        s.avgPct == null
                          ? `${s.name} — Sin respuestas · Participación: ${s.checked ? s.sharePct.toFixed(1) : "0.0"}%`
                          : `${s.name} — Promedio: ${fmtPctOrDash(s.avgPct)} · Participación: ${s.checked ? s.sharePct.toFixed(1) : "0.0"}%`
                      }
                      aria-label={`${s.name}, ${s.checked ? "seleccionada" : "no seleccionada"}, participación ${s.checked ? s.sharePct.toFixed(1) : "0.0"}%`}
                    >
                      {/* color base */}
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      {/* nombre */}
                      {s.name}
                      {/* pill con participación (0% si está deseleccionada) + estado por promedio */}
                      <span
                        className="ml-1 inline-flex items-center justify-center rounded-full px-2 h-5 text-[11px] font-semibold tabular-nums"
                        style={{ background: "#0f172a", color: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                      >
                        <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: dotColor }} />
                        {(s.checked ? s.sharePct : 0).toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* (opcional) Debug de suma visible */}
              {/* <div className="text-xs text-muted-foreground">Suma visible: {catShareSum}%</div> */}
            </div>
          )}

          {/* ======================= KPIs + Comentarios ======================= */}
          {kpiGlobalPct && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {/* Satisfacción global (todos) */}
              {globalTodosPct != null && (() => {
                const val = Number(globalTodosPct);
                const isOk = Number.isFinite(val) ? val >= 80 : null;
                const Icon = isOk ? ThumbsUp : ThumbsDown;
                const pillBase =
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm leading-none h-8 shadow-sm";
                const SOFT_OK_BG   = "bg-emerald-50";
                const SOFT_OK_TXT  = "text-emerald-700";
                const SOFT_OK_BR   = "border-emerald-300";
                const SOFT_BAD_BG  = "bg-rose-50";
                const SOFT_BAD_TXT = "text-rose-700";
                const SOFT_BAD_BR  = "border-rose-300";
                const SOFT_NEU_BG  = "bg-muted/50";
                const SOFT_NEU_TXT = "text-foreground/80";
                const SOFT_NEU_BR  = "border-muted";

                const cls = isOk == null
                  ? `${pillBase} ${SOFT_NEU_BG} ${SOFT_NEU_TXT} ${SOFT_NEU_BR}`
                  : isOk
                  ? `${pillBase} ${SOFT_OK_BG} ${SOFT_OK_TXT} ${SOFT_OK_BR}`
                  : `${pillBase} ${SOFT_BAD_BG} ${SOFT_BAD_TXT} ${SOFT_BAD_BR}`;

                return (
                  <span className={cls} title="Satisfacción global (todas las encuestas)">
                    <Icon className="h-4 w-4 opacity-80" />
                    <span className="whitespace-nowrap">Satisfacción global</span>
                    <span className="font-semibold tabular-nums">
                      {Number.isFinite(val) ? `${val}%` : "—"}
                    </span>
                  </span>
                );
              })()}

              {/* Promedio global del curso */}
              {(() => {
                const val = Number(kpiGlobalPct.pct);
                const isOk = Number.isFinite(val) ? val >= 80 : null;
                const pillBase =
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm leading-none h-8 shadow-sm";
                const SOFT_OK_BG   = "bg-emerald-50";
                const SOFT_OK_TXT  = "text-emerald-700";
                const SOFT_OK_BR   = "border-emerald-300";
                const SOFT_BAD_BG  = "bg-rose-50";
                const SOFT_BAD_TXT = "text-rose-700";
                const SOFT_BAD_BR  = "border-rose-300";
                const SOFT_NEU_BG  = "bg-muted/50";
                const SOFT_NEU_TXT = "text-foreground/80";
                const SOFT_NEU_BR  = "border-muted";

                const cls = isOk == null
                  ? `${pillBase} ${SOFT_NEU_BG} ${SOFT_NEU_TXT} ${SOFT_NEU_BR}`
                  : isOk
                  ? `${pillBase} ${SOFT_OK_BG} ${SOFT_OK_TXT} ${SOFT_OK_BR}`
                  : `${pillBase} ${SOFT_BAD_BG} ${SOFT_BAD_TXT} ${SOFT_BAD_BR}`;

                return (
                  <span className={cls} title="Promedio ponderado del curso (0–100%)">
                    <Gauge className="h-4 w-4 opacity-80" />
                    <span className="whitespace-nowrap">Promedio del curso</span>
                    <span className="font-semibold tabular-nums">
                      {Number.isFinite(val) ? `${val}%` : "—"}
                    </span>
                  </span>
                );
              })()}

              {/* N respuestas */}
              {(() => {
                const n = kpiGlobalPct.total ?? 0;
                return (
                  <span className="inline-flex items-center gap-2 rounded-full bg-muted/50 border border-muted px-3 py-1.5 text-sm h-8" title="Número de respuestas consideradas">
                    <Users className="h-4 w-4 opacity-80" />
                    <span className="whitespace-nowrap">N respuestas</span>
                    <span className="font-medium tabular-nums">{n}</span>
                  </span>
                );
              })()}

              {/* Botón comentarios */}
              <Button
                size="sm"
                className="h-8 text-white transition-colors"
                style={{
                  background: "#7c0022",
                  borderColor: "#7c0022",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#5a0019")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#7c0022")}
                onClick={() => setCommentsOpen(true)}
                disabled={!cicloId}
              >
                <MessageSquareText className="h-4 w-4 mr-2" />
                Comentarios
              </Button>


            </div>
          )}

          {/* ======================= TABS: Gráfica / Tabla ======================= */}
          <Tabs defaultValue="grafica" className="w-full">
            <TabsList className="mb-3 bg-muted/40 rounded-md p-1">
              <TabsTrigger value="grafica" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Gráfica
              </TabsTrigger>
              <TabsTrigger value="tabla" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1 flex items-center gap-2">
                <Table className="h-4 w-4" />
                Tabla
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grafica">
              <div className="h-[560px] md:h-[640px] w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Cargando resultados…
                  </div>
                ) : dataPct.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    {cicloId ? "Sin resultados." : "Selecciona un curso para ver la encuesta."}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dataPct}
                      layout="vertical"
                      margin={{ top: 36, right: 96, bottom: 32, left: 100 }}
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
                              <div className="text-muted-foreground">{val.toFixed(1)}%</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="pct" radius={[8, 8, 8, 8]} barSize={34}>
                        {dataPct.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
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

                      {/* Líneas de referencia del curso y global */}
                      {kpiGlobalPct?.pct != null && (
                        <ReferenceLine
                          x={kpiGlobalPct.pct}
                          stroke={kpiGlobalPct.pct >= 80 ? GREEN : RED}
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          ifOverflow="extendDomain"
                          isFront
                          label={{
                            content: (props: any) => {
                              const vb = props?.viewBox || { x: 0, y: 0, width: 0, height: 0 };
                              const lineX = typeof vb.x === "number" ? vb.x : 0;
                              const innerLeft = vb.x ?? 0;
                              const innerRight = (vb.x ?? 0) + (vb.width ?? 0);
                              const pad = 48;
                              const tx = Math.max(innerLeft + pad, Math.min(innerRight - pad, lineX));
                              const fontSize = 11;
                              const pillPadX = 8;
                              const pillPadY = 4;
                              const textY = (vb.y ?? 0) - 22;
                              const val = Number(kpiGlobalPct.pct);
                              const isOk = val >= 80;
                              const pillFill = isOk ? GREEN : RED;
                              const textStr = `Curso: ${val}%`;
                              const pillW = textStr.length * 7 + pillPadX * 2;
                              const pillH = fontSize + pillPadY * 2;
                              const pillX = tx - pillW / 2;
                              const pillY = textY - pillH / 2;
                              return (
                                <g pointerEvents="none">
                                  <rect x={pillX} y={pillY} rx={pillH / 2} ry={pillH / 2} width={pillW} height={pillH} fill={pillFill} opacity={0.95} style={{ paintOrder: "stroke" }} stroke="white" strokeWidth={1.5} />
                                  <text x={tx} y={textY + fontSize / 3} textAnchor="middle" fontSize={fontSize} fill="white" className="tabular-nums" fontWeight={600}>
                                    {textStr}
                                  </text>
                                </g>
                              );
                            },
                          }}
                        />
                      )}
                      {globalTodosPct != null && (
                        <ReferenceLine
                          x={globalTodosPct}
                          stroke={Number(globalTodosPct) >= 80 ? GREEN : RED}
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          ifOverflow="extendDomain"
                          isFront
                          label={{
                            content: (props: any) => {
                              const vb = props?.viewBox || { x: 0, y: 0, width: 0, height: 0 };
                              const lineX = typeof vb.x === "number" ? vb.x : 0;
                              const innerLeft = vb.x ?? 0;
                              const innerRight = (vb.x ?? 0) + (vb.width ?? 0);
                              const pad = 48;
                              const tx = Math.max(innerLeft + pad, Math.min(innerRight - pad, lineX));
                              const fontSize = 11;
                              const pillPadX = 8;
                              const pillPadY = 4;
                              const textY = (vb.y ?? 0) - 6;
                              const val = Number(globalTodosPct);
                              const isOk = val >= 80;
                              const pillFill = isOk ? GREEN : RED;
                              const textStr = `Global: ${val}%`;
                              const pillW = textStr.length * 7 + pillPadX * 2;
                              const pillH = fontSize + pillPadY * 2;
                              const pillX = tx - pillW / 2;
                              const pillY = textY - pillH / 2;
                              return (
                                <g pointerEvents="none">
                                  <rect x={pillX} y={pillY} rx={pillH / 2} ry={pillH / 2} width={pillW} height={pillH} fill={pillFill} opacity={0.95} style={{ paintOrder: "stroke" }} stroke="white" strokeWidth={1.5} />
                                  <text x={tx} y={textY + fontSize / 3} textAnchor="middle" fontSize={fontSize} fill="white" className="tabular-nums" fontWeight={600}>
                                    {textStr}
                                  </text>
                                </g>
                              );
                            },
                          }}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tabla">
              {dataPct.length > 0 ? (
                <div className="mt-1 overflow-x-auto rounded-md border">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium text-muted-foreground">Pregunta</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Categoría</th>
                        <th className="text-right p-2 font-medium text-muted-foreground w-[240px]">Promedio %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataPct.map((r: any, i: number) => (
                        <tr key={`${r.pregunta}-${i}`} className={i % 2 ? "bg-muted/30" : ""}>
                          <td className="p-2 align-top">
                            <div className="font-medium">{r.texto}</div>
                            <div className="text-xs text-muted-foreground">({r.pregunta})</div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="inline-flex items-center gap-2">
                              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                              <span>{r.categoriaName}</span>
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="flex items-center justify-end gap-3">
                              <span className={`tabular-nums ${r.pct < 80 ? "text-red-700" : ""}`}>
                                {r.pct}%
                              </span>
                              <div className="relative h-2.5 w-36 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="absolute left-0 top-0 h-full rounded-full"
                                  style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, background: r.color }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr className="border-t">
                        <td className="p-2 font-medium">Global del curso</td>
                        <td className="p-2" />
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {(() => {
                              const val = kpiGlobalPct ? Number(kpiGlobalPct.pct) : null;
                              const isOk = val != null && val >= 80;
                              return (
                                <>
                                  <span
                                    className={[
                                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
                                      val == null
                                        ? "bg-muted text-muted-foreground"
                                        : isOk
                                        ? "bg-emerald-600 text-white"
                                        : "bg-red-600 text-white",
                                    ].join(" ")}
                                  >
                                    {val != null ? `${val}%` : "—"}
                                  </span>
                                  {val != null && (
                                    <div className="relative h-2.5 w-40 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={[
                                          "absolute left-0 top-0 h-full rounded-full transition-all",
                                          isOk ? "bg-emerald-600" : "bg-red-600",
                                        ].join(" ")}
                                        style={{ width: `${Math.max(0, Math.min(100, val))}%` }}
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>

                      {globalTodosPct != null && (
                        <tr>
                          <td className="p-2 text-muted-foreground">Satisfacción global (todos)</td>
                          <td className="p-2" />
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {(() => {
                                const val = Number(globalTodosPct);
                                const isOk = val >= 80;
                                return (
                                  <>
                                    <span
                                      className={[
                                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
                                        isOk ? "bg-emerald-600 text-white" : "bg-red-600 text-white",
                                      ].join(" ")}
                                    >
                                      {val}%
                                    </span>
                                    <div className="relative h-2.5 w-40 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={[
                                          "absolute left-0 top-0 h-full rounded-full transition-all",
                                          isOk ? "bg-emerald-600" : "bg-red-600",
                                        ].join(" ")}
                                        style={{ width: `${Math.max(0, Math.min(100, val))}%` }}
                                      />
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No hay datos para mostrar.</div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>

      {/* ====== SHEET: COMENTARIOS ====== */}
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
                {reporte?.ciclo?.codigo && (
                  <Badge
                    variant="secondary"
                    className="whitespace-nowrap"
                    style={{ background: "#7c002220", color: "#7c0022", borderColor: "#7c0022" }}
                  >
                    {reporte.ciclo.codigo}
                  </Badge>
                )}
                {docenteNombre && (
                  <Badge
                    variant="secondary"
                    className="whitespace-nowrap hidden md:inline-flex"
                    style={{ background: "#7c002220", color: "#7c0022", borderColor: "#7c0022" }}
                  >
                    {docenteNombre}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cargarComentarios}
                  disabled={!cicloId || commentsLoading}
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
              <span>Solo se muestran los comentarios del curso seleccionado.</span>
              <span className="inline-flex items-center gap-1">
                <MessageSquareText className="h-3.5 w-3.5" style={{ color: "#7c0022" }} />
                {(() => {
                  const q = commentsQuery.trim().toLowerCase();
                  const n = (q
                    ? comments.filter(
                        (c) =>
                          (c.texto || "").toLowerCase().includes(q) ||
                          (c.pregunta_texto || "").toLowerCase().includes(q) ||
                          (c.alumno?.nombre || "").toLowerCase().includes(q) ||
                          (c.alumno?.email || "").toLowerCase().includes(q)
                      )
                    : comments
                  ).length;
                  return n.toLocaleString();
                })()}{" "}
                comentarios
              </span>
            </SheetDescription>

            {/* Buscador con focus ring guinda */}
            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 focus-visible:ring-2"
                  style={{
                    boxShadow:
                      "0 0 0 0 var(--tw-ring-offset-shadow), 0 0 0 2px #7c0022",
                  } as React.CSSProperties}
                  placeholder="Buscar por texto, nombre o email…"
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
            ) : (() => {
              const q = commentsQuery.trim().toLowerCase();
              const list = q
                ? comments.filter(
                    (c) =>
                      (c.texto || "").toLowerCase().includes(q) ||
                      (c.pregunta_texto || "").toLowerCase().includes(q) ||
                      (c.alumno?.nombre || "").toLowerCase().includes(q) ||
                      (c.alumno?.email || "").toLowerCase().includes(q)
                  )
                : comments;

              return list.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No hay comentarios para mostrar.
                </div>
              ) : (
                <ScrollArea className="h-[70vh] pr-4">
                  <ul className="space-y-3">
                    {list.map((c) => {
                      let nombreRaw = c.alumno?.nombre ?? "Anónimo";
                      let nombre = nombreRaw;
                      if (nombreRaw.includes(",")) {
                        const [ap, nom] = nombreRaw.split(",").map(s => s.trim());
                        nombre = `${nom} ${ap}`;
                      }

                      const email = c.alumno?.email ?? "";
                      const d = c.created_at ? new Date(c.created_at) : null;
                      const fecha = d ? d.toLocaleDateString("es-MX") : "";
                      const hora = d
                        ? d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                        : "";

                      return (
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
                            <div className="min-w-0">
                              <span className="font-medium text-slate-700">{nombre}</span>
                              {email && <span className="ml-1">· {email}</span>}
                            </div>
                            {(fecha || hora) && (
                              <span className="shrink-0">
                                {fecha} {hora}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>


    </Card>
  );
}
