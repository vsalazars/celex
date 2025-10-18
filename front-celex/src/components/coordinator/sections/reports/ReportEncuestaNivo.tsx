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

/* ===== Comentarios (open text) ===== */
export type EncuestaComentario = {
  id: string;
  pregunta_id: string | number | null;
  pregunta_texto: string | null;
  texto: string;
  created_at?: string | null;
  alumno?: { id?: string | number; nombre?: string | null; email?: string | null } | null;
};

/* ===== Helper: intenta leer el nombre del docente desde varias formas comunes del payload ===== */
function getDocenteNombreFromReporte(rep: any): string | null {
  if (!rep) return null;
  if (rep?.docente?.nombre) return String(rep.docente.nombre);
  if (rep?.docente_nombre) return String(rep.docente_nombre);
  if (rep?.grupo?.docente?.nombre) return String(rep.grupo.docente.nombre);
  if (Array.isArray(rep?.grupos) && rep.grupos[0]?.docente?.nombre) return String(rep.grupos[0].docente.nombre);
  if (rep?.curso?.docente?.nombre) return String(rep.curso.docente.nombre);
  return null;
}

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

  /* ====== Estado: Sheet de Comentarios ====== */
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

  /* ===== Cargar comentarios del ciclo cuando se abre el sheet ===== */
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

      // de-dup + orden descendente por fecha
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

  useEffect(() => {
    if (commentsOpen) cargarComentarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsOpen, cicloId]);

  // ---- Helpers de cálculo ----
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

  // ---- Selección por pregunta y categoría (UNA SOLA VEZ) ----
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

  // ---- Data para gráfica (0–100) + colores por categoría ----
  const PALETTE = ["#8596b3", "#ac9eb3", "#c4b0b3", "#d0d5d3"];
  const DARK_TEXT = "#111827";
  const dataPct = useMemo(() => {
    const categoriaColorMap = new Map<string, string>();
    let i = 0;
    const rows = selectedQuestions
      .map((p, idx) => {
        const { pct, promedio } = computePct(p);
        const catId = String(p.categoria?.id ?? "sin_categoria");
        const catName = p.categoria?.name ?? "General";
        const catOrder = p.categoria?.order ?? 9999;
        if (!categoriaColorMap.has(catId)) {
          categoriaColorMap.set(catId, PALETTE[i % PALETTE.length]);
          i++;
        }
        return {
          pregunta: `P${idx + 1}`,
          pct,
          promedio,
          texto: p.texto,
          categoriaId: catId,
          categoriaName: catName,
          categoriaOrder: catOrder,
          color: categoriaColorMap.get(catId) as string,
        };
      })
      .sort((a, b) => a.categoriaOrder - b.categoriaOrder || a.pregunta.localeCompare(b.pregunta));

    return rows;
  }, [selectedQuestions]);

  // ---- KPIs global y por categoría ----
  const kpiGlobalPct = useMemo(() => {
    if (selectedQuestions.length === 0) return null;
    let suma = 0,
      total = 0;
    for (const p of selectedQuestions) {
      for (const o of p.opciones) {
        const v = Number(o.opcion);
        const n = o.conteo || 0;
        if (!Number.isNaN(v)) {
          suma += v * n;
          total += n;
        }
      }
    }
    const prom = total ? +(suma / total).toFixed(2) : 0;
    const pct = total ? +((prom / 5) * 100).toFixed(1) : 0;
    return { pct, total, prom };
  }, [selectedQuestions]);

  const kpisPorCategoria = useMemo(() => {
    const categoriaColorMap = new Map<string, string>();
    let i = 0;
    for (const row of dataPct) {
      if (!categoriaColorMap.has(row.categoriaId)) {
        categoriaColorMap.set(row.categoriaId, PALETTE[i % PALETTE.length]);
        i++;
      }
    }
    const acc = new Map<string, { name: string; order: number; suma: number; total: number }>();
    for (const p of selectedQuestions) {
      const id = String(p.categoria?.id ?? "sin_categoria");
      const name = p.categoria?.name ?? "General";
      const order = p.categoria?.order ?? 9999;
      let suma = 0,
        total = 0;
      for (const o of p.opciones) {
        const v = Number(o.opcion);
        const n = o.conteo || 0;
        if (!Number.isNaN(v)) {
          suma += v * n;
          total += n;
        }
      }
      const prev = acc.get(id) || { name, order, suma: 0, total: 0 };
      acc.set(id, { name, order, suma: prev.suma + suma, total: prev.total + total });
    }
    const rows = Array.from(acc.entries())
      .map(([id, { name, order, suma, total }]) => ({
        id,
        name,
        order,
        pct: total ? +(((suma / total) / 5) * 100).toFixed(1) : 0,
        total,
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    return rows.map((r, i2) => ({
      ...r,
      color: categoriaColorMap.get(r.id) || PALETTE[i2 % PALETTE.length],
    }));
  }, [selectedQuestions, dataPct]);

  /* ========= Benchmark global (TODOS los docentes) ========= */
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
      } catch {
        if (!cancelled) setGlobalTodosPct(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, idioma]);

  // ---- Exportaciones ----
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

  // ---- Handlers selección ----
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

  // ---- Chips base ----
  const chipBase =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm leading-none h-8 transition";


  // Pills modernas, suaves (no saturadas)
  const SOFT_OK_BG   = "bg-emerald-50";
  const SOFT_OK_TXT  = "text-emerald-700";
  const SOFT_OK_BR   = "border-emerald-300";

  const SOFT_BAD_BG  = "bg-rose-50";
  const SOFT_BAD_TXT = "text-rose-700";
  const SOFT_BAD_BR  = "border-rose-300";

  const SOFT_NEU_BG  = "bg-muted/50";
  const SOFT_NEU_TXT = "text-foreground/80";
  const SOFT_NEU_BR  = "border-muted";

  const pillBase =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm leading-none h-8 shadow-sm";

  const kpiPillClasses = (ok: boolean | null) => {
    if (ok === null) return `${pillBase} ${SOFT_NEU_BG} ${SOFT_NEU_TXT} ${SOFT_NEU_BR}`;
    return ok ? `${pillBase} ${SOFT_OK_BG} ${SOFT_OK_TXT} ${SOFT_OK_BR}`
              : `${pillBase} ${SOFT_BAD_BG} ${SOFT_BAD_TXT} ${SOFT_BAD_BR}`;
  };


  // ---- Filtros para comentarios (cliente): SOLO búsqueda libre ----
  const commentsFiltered = useMemo(() => {
    let list = comments;
    if (commentsQuery.trim()) {
      const q = commentsQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.texto || "").toLowerCase().includes(q) ||
          (c.pregunta_texto || "").toLowerCase().includes(q) ||
          (c.alumno?.nombre || "").toLowerCase().includes(q) ||
          (c.alumno?.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [comments, commentsQuery]);


  // ==== Helpers de formato para comentarios ====
  function formatNombreCompleto(raw?: string | null) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    // "Apellidos, Nombres" -> "Nombres Apellidos"
    const [apellidos, nombres] = s.split(",").map((t) => t?.trim()).filter(Boolean) as string[];
    if (apellidos && nombres) return `${nombres} ${apellidos}`.replace(/\s+/g, " ");
    return s;
  }

  function formatFechaHoraMX(iso?: string | null) {
    if (!iso) return { fecha: "", hora: "" };
    const d = new Date(iso);
    const fecha = d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    // Normaliza "a. m." / "p. m." -> "a.m." / "p.m."
    const horaRaw = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
    const hora = horaRaw.replace(/\s*a\.\s*m\.\s*/i, " a.m.").replace(/\s*p\.\s*m\.\s*/i, " p.m.");
    return { fecha, hora };
  }


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
                        checked
                          ? "bg-primary text-primary-foreground border-primary"
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

          {/* Selección de categorías */}
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
                {kpisPorCategoria.map((c) => {
                  const checked = selectedCatIds.includes(String(c.id));
                  const style: React.CSSProperties = checked
                    ? { background: c.color, color: DARK_TEXT, border: `1px solid ${c.color}` }
                    : { background: "hsl(var(--muted))", color: DARK_TEXT, border: `1px solid ${c.color}` };
                  return (
                    <button
                      key={`cat-${String(c.id)}`}
                      type="button"
                      onClick={() => toggleCat(String(c.id))}
                      className={chipBase}
                      style={style}
                      title={`${c.name}: ${c.pct}%`}
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                      {c.name}: <b>{c.pct}%</b>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPIs + Botón Comentarios */}
          {(kpiGlobalPct || kpisPorCategoria.length) && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {kpiGlobalPct && (
                <>
                  
                  {/* Satisfacción global (todos) (verde/rojo) */}
                  {globalTodosPct != null && (() => {
                    const val = Number(globalTodosPct);
                    const isOk = Number.isFinite(val) ? val >= 80 : null;
                    const Icon = isOk ? ThumbsUp : ThumbsDown;
                    return (
                      <span className={kpiPillClasses(isOk)} title="Satisfacción global (todas las encuestas)">
                        <Icon className="h-4 w-4 opacity-80" />
                        <span className="whitespace-nowrap">Satisfacción global</span>
                        <span className="font-semibold tabular-nums">{Number.isFinite(val) ? `${val}%` : "—"}</span>
                      </span>
                    );
                  })()}
                  
                  {/* Promedio global del curso (verde/rojo) */}
                  {(() => {
                    const val = Number(kpiGlobalPct.pct);
                    const isOk = Number.isFinite(val) ? val >= 80 : null;
                    return (
                      <span className={kpiPillClasses(isOk)} title="Promedio ponderado del curso (0–100%)">
                        <Gauge className="h-4 w-4 opacity-80" />
                        <span className="whitespace-nowrap">Promedio del curso</span>
                        <span className="font-semibold tabular-nums">{Number.isFinite(val) ? `${val}%` : "—"}</span>
                      </span>
                    );
                  })()}

                  {/* N respuestas (neutral) */}
                  {(() => {
                    const n = kpiGlobalPct.total ?? 0;
                    return (
                      <span className={`${pillBase} ${SOFT_NEU_BG} ${SOFT_NEU_TXT} ${SOFT_NEU_BR}`} title="Número de respuestas consideradas">
                        <Users className="h-4 w-4 opacity-80" />
                        <span className="whitespace-nowrap">N respuestas</span>
                        <span className="font-medium tabular-nums">{n}</span>
                      </span>
                    );
                  })()}

                  
                  {/* Botón comentarios (ya con icono) */}
                  <Button
                    size="sm"
                    className="h-8"
                    variant="outline"
                    onClick={() => setCommentsOpen(true)}
                    disabled={!cicloId}
                    title="Ver comentarios del ciclo"
                  >
                    <MessageSquareText className="h-4 w-4 mr-2" />
                    Comentarios
                  </Button>
                </>
              )}
            </div>
          )}


          {/* ======================= TABS: Gráfica / Tabla ======================= */}
          <Tabs defaultValue="grafica" className="w-full">
           <TabsList className="mb-3 bg-muted/40 rounded-md p-1">
            <TabsTrigger
              value="grafica"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1 flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Gráfica
            </TabsTrigger>
            <TabsTrigger
              value="tabla"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1 flex items-center gap-2"
            >
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
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dataPct}
                        layout="vertical"
                        margin={{ top: 36, right: 80, bottom: 32, left: 100 }}
                        barCategoryGap={18}
                        barGap={6}
                      >
                        <CartesianGrid strokeDasharray="4 4" />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                          label={{
                            value: "Promedio (%)",
                            position: "insideBottom",
                            offset: -18,
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 12,
                          }}
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
                                <text
                                  x={tx}
                                  y={ty}
                                  textAnchor={inside ? "end" : "start"}
                                  fontSize={12}
                                  className="tabular-nums"
                                  fill="hsl(var(--foreground))"
                                >
                                  {text}
                                </text>
                              );
                            }}
                          />
                        </Bar>

                        {globalTodosPct != null && (
                          <ReferenceLine
                            x={globalTodosPct}
                            // === Color dinámico de la línea según umbral 80 ===
                            stroke={Number(globalTodosPct) >= 80 ? "#059669" : "#dc2626"} // emerald-600 / red-600
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

                                // Centro horizontal sobre la línea pero con clamp a bordes
                                const pad = 48;
                                const tx = Math.max(innerLeft + pad, Math.min(innerRight - pad, lineX));

                                // Pill en el MARGEN superior (fuera del área de barras)
                                const fontSize = 11;
                                const pillPadX = 8;
                                const pillPadY = 4;
                                const textY = (vb.y ?? 0) - 6;

                                const val = Number(globalTodosPct);
                                const isOk = val >= 80;
                                const pillFill = isOk ? "#059669" : "#dc2626"; // emerald-600 / red-600
                                const textStr = `Global: ${val}%`;

                                // Estimar ancho del pill
                                const pillW = textStr.length * 7 + pillPadX * 2;
                                const pillH = fontSize + pillPadY * 2;
                                const pillX = tx - pillW / 2;
                                const pillY = textY - pillH / 2;

                                return (
                                  <g pointerEvents="none">
                                    <rect
                                      x={pillX}
                                      y={pillY}
                                      rx={pillH / 2}
                                      ry={pillH / 2}
                                      width={pillW}
                                      height={pillH}
                                      fill={pillFill}
                                      opacity={0.95}
                                      style={{ paintOrder: "stroke" }}
                                      stroke="white"
                                      strokeWidth={1.5}
                                    />
                                    <text
                                      x={tx}
                                      y={textY + fontSize / 3}
                                      textAnchor="middle"
                                      fontSize={fontSize}
                                      fill="white"
                                      className="tabular-nums"
                                      fontWeight={600}
                                    >
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
                  </>
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
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-sm"
                                style={{ background: r.color }}
                              />
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
                                  style={{
                                    width: `${Math.max(0, Math.min(100, r.pct))}%`,
                                    background: r.color,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* ======= TOTALES con verde/rojo ======= */}
                    <tfoot>
                      {/* Global del curso */}
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

                      {/* Satisfacción global (todos) */}
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
          {/* ===================== /TABS ===================== */}



        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>

      {/* ====== SHEET DERECHA: COMENTARIOS Y SUGERENCIAS (IPN guinda #7c0022) ====== */}
    <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
      <SheetContent
        side="right"
        className="!w-[600px] md:!w-[668px] lg:!w-[734px] !max-w-none !px-6 !py-5"
        style={{ width: "min(734px, 96vw)" }}
      >
        {/* Header sticky con acento IPN */}
        <SheetHeader className="sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-3"
          style={{ borderColor: "#7c0022" }}
        >
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" style={{ color: "#7c0022" }} />
              <span className="tracking-tight">Comentarios y sugerencias</span>
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
                  style={{ background: "#f1f5f9", color: "#0f172a", borderColor: "#e2e8f0" }} // gris shadcn
                >
                  {formatNombreCompleto(docenteNombre)}
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
              {commentsFiltered.length.toLocaleString()} comentarios
            </span>
          </SheetDescription>

          {/* Buscador con focus ring IPN */}
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9 focus-visible:ring-2"
                style={{ boxShadow: "0 0 0 0 var(--tw-ring-offset-shadow), 0 0 0 2px #7c0022" } as React.CSSProperties}
                placeholder="Buscar por texto, nombre o email…"
                value={commentsQuery}
                onChange={(e) => setCommentsQuery(e.target.value)}
              />
            </div>
          </div>
        </SheetHeader>

        {/* Contenido scrollable */}
        <div className="pt-3">
          {commentsError && <div className="text-sm text-amber-600">{commentsError}</div>}

          {commentsLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Cargando comentarios…
            </div>
          ) : commentsFiltered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay comentarios para mostrar.</div>
          ) : (
            <ScrollArea className="h-[70vh] pr-3">
              <ul className="space-y-3">
                {commentsFiltered.map((c) => {
                  const nombre = formatNombreCompleto(c.alumno?.nombre) ?? "Anónimo";
                  const email = c.alumno?.email ?? "";
                  const { fecha, hora } = formatFechaHoraMX(c.created_at);

                  return (
                    <li
                      key={c.id}
                      className="group rounded-lg border p-4 hover:bg-slate-50/70 transition-colors relative"
                      style={{ borderColor: "#e2e8f0" }}
                    >
                      {/* Acento lateral IPN al hover */}
                      <span
                        className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "#7c0022" }}
                      />

                      {/* Header por comentario */}
                      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        {/* Nombre + email */}
                        <div className="min-w-0">
                          <div className="font-medium leading-tight truncate text-slate-900">
                            {nombre}
                          </div>
                          {email && (
                            <div className="text-xs text-slate-500 truncate">
                              {email}
                            </div>
                          )}
                        </div>

                        {/* Fecha y hora */}
                        {(fecha || hora) && (
                          <div className="shrink-0 text-right">
                            {fecha && <div className="text-xs text-slate-500">{fecha}</div>}
                            {hora && <div className="text-xs text-slate-500">{hora}</div>}
                          </div>
                        )}
                      </div>

                      {/* === Comentario estilo testimonial (1A: fondo suave IPN + comillas IPN) === */}
                      <div
                        className="relative mt-1 rounded-md border px-3 py-2"
                        style={{ background: "#7c002210" }}
                      >
                        {/* Ícono de comillas (SVG) en IPN */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 absolute -top-2 -left-2 drop-shadow-sm"
                          style={{ color: "#7c0022" }}
                        >
                          <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17v6.66A2.17 2.17 0 0 0 4.17 20h3.66A2.17 2.17 0 0 0 10 17.83v-6.66A5.17 5.17 0 0 0 4.83 6h2.34zm10 0A5.17 5.17 0 0 0 12 11.17v6.66A2.17 2.17 0 0 0 14.17 20h3.66A2.17 2.17 0 0 0 20 17.83v-6.66A5.17 5.17 0 0 0 14.83 6h2.34z"/>
                        </svg>

                        <blockquote className="whitespace-pre-wrap break-words pl-4 text-sm leading-relaxed text-slate-800">
                          {c.texto}
                        </blockquote>
                      </div>

                      {/* Pregunta origen (meta) */}
                      {c.pregunta_texto && (
                        <div className="mt-2 text-[11px] text-slate-500">
                          {c.pregunta_texto}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>

    </Card>
  );
}
