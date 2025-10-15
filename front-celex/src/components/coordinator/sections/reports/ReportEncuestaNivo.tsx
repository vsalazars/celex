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
} from "lucide-react";
import { ResponsiveBar } from "@nivo/bar";
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

export type EncuestaOpcion = { opcion: string; conteo: number };
export type EncuestaCategoria = { id: number | string; name: string; order: number };
export type EncuestaPregunta = {
  id: string | number;
  texto: string;
  opciones: EncuestaOpcion[]; // si es open_text llega vacío
  total_respuestas?: number | null;
  promedio?: number | null; // 1..5 (si back ya lo calcula)
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
        includeGeneral: true,    // incluye SurveyResponse.comments si existe
        onlyCommentLike: false,  // NO restringe por “coment/sugerenc/observaci”
        // q: commentsQuery,     // opcional si deseas filtrar en el servidor
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

  // ---- Selección por pregunta ----
  const allIds = useMemo(() => preguntasGraficables.map((p) => String(p.id)), [preguntasGraficables]);
  const [selectedIds, setSelectedIds] = useState<string[]>(allIds);
  useEffect(() => setSelectedIds(allIds), [reporte?.ciclo?.id, allIds.length]);

  const selectedQuestionsBase = useMemo(
    () => preguntasGraficables.filter((p) => selectedIds.includes(String(p.id))),
    [preguntasGraficables, selectedIds]
  );

  // ---- Categorías (agrupación) ----
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

  const selectedQuestions = useMemo(() => {
    return selectedQuestionsBase.filter((p) =>
      selectedCatIds.includes(String(p.categoria?.id ?? "sin_categoria"))
    );
  }, [selectedQuestionsBase, selectedCatIds]);

  // ---- Data para gráfica (porcentaje 0–100) ----
  const dataPct = useMemo(() => {
    return selectedQuestions
      .map((p, idx) => {
        const { pct, promedio } = computePct(p);
        const catId = p.categoria?.id ?? "sin_categoria";
        const catName = p.categoria?.name ?? "General";
        const catOrder = p.categoria?.order ?? 9999;
        return {
          pregunta: `P${idx + 1}`,
          pct,
          promedio,
          texto: p.texto,
          categoriaId: String(catId),
          categoriaName: catName,
          categoriaOrder: catOrder,
        };
      })
      .sort((a, b) => a.categoriaOrder - b.categoriaOrder || a.pregunta.localeCompare(b.pregunta));
  }, [selectedQuestions]);

  // ---- Colores sobrios por categoría ----
  const PALETTE = ["#8596b3", "#ac9eb3", "#c4b0b3", "#d0d5d3"];
  const DARK_TEXT = "#111827";

  const categoriaColorMap = useMemo(() => {
    const seen = new Map<string, string>();
    let i = 0;
    for (const row of dataPct) {
      if (!seen.has(row.categoriaId)) {
        seen.set(row.categoriaId, PALETTE[i % PALETTE.length]);
        i++;
      }
    }
    return seen;
  }, [dataPct]);

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

    return rows.map((r, i) => ({
      ...r,
      color: categoriaColorMap.get(r.id) || PALETTE[i % PALETTE.length],
    }));
  }, [selectedQuestions, categoriaColorMap]);

  // ---- Exportaciones ----
  const csv = () => {
    if (!reporte?.preguntas?.length) return;
    const rows = dataPct.map((r) => ({
      ciclo: reporte.ciclo?.codigo ?? "",
      docente: docenteNombre ?? "", // ← nuevo
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
          <div className="meta mb-3">
            {reporte?.ciclo ? `Curso: ${reporte.ciclo.codigo}` : "Sin ciclo seleccionado"}
            {docenteNombre ? ` — Docente: ${docenteNombre}` : ""}
          </div>

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
                {categorias.map((c, i) => {
                  const color = PALETTE[i % PALETTE.length];
                  const checked = selectedCatIds.includes(String(c.id));
                  const pct = kpisPorCategoria.find((k) => String(k.id) === String(c.id))?.pct ?? 0;

                  const style: React.CSSProperties = checked
                    ? { background: color, color: DARK_TEXT, border: `1px solid ${color}` }
                    : { background: "hsl(var(--muted))", color: DARK_TEXT, border: `1px solid ${color}` };

                  return (
                    <button
                      key={`cat-${String(c.id)}`}
                      type="button"
                      onClick={() => toggleCat(String(c.id))}
                      className={chipBase}
                      style={style}
                      title={`${c.name}: ${pct}%`}
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                      {c.name}: <b>{pct}%</b>
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
                  <span
                    className={chipBase}
                    style={{ background: "#111827", color: "white", border: "1px solid #111827" }}
                  >
                    Promedio global: <b className="ml-1">{kpiGlobalPct.pct}%</b>
                  </span>
                  <span
                    className={chipBase}
                    style={{ background: "#111827", color: "white", border: "1px solid #111827" }}
                  >
                    N respuestas: <b className="ml-1">{kpiGlobalPct.total}</b>
                  </span>

                  <Button
                    size="sm"
                    className="h-8"
                    style={{ background: "#111827", color: "white", border: "1px solid #111827" }}
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

          {/* Gráfica */}
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
              <ResponsiveBar
                data={dataPct}
                keys={["pct"]}
                indexBy="pregunta"
                layout="horizontal"
                margin={{ top: 10, right: 20, bottom: 40, left: 80 }}
                padding={0.35}
                valueScale={{ type: "linear", min: 0, max: 100 }}
                indexScale={{ type: "band", round: true }}
                enableGridX
                enableGridY={false}
                valueFormat={(v) => `${Number(v).toFixed(0)}%`}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  legend: "Promedio (%)",
                  legendOffset: 32,
                  legendPosition: "middle",
                  tickValues: [0, 20, 40, 60, 80, 100],
                  format: (v) => `${v}%`,
                }}
                axisLeft={{ legend: "", legendOffset: 0, legendPosition: "middle" }}
                tooltip={({ data, value }) => (
                  <div className="rounded-md border bg-background px-2 py-1 text-sm shadow-sm max-w-none w-[28rem]">
                    <div className="font-medium break-words whitespace-normal">{(data as any).texto}</div>
                    <div className="text-muted-foreground">
                      {typeof value === "number" ? `${value.toFixed(1)}%` : `${value}%`}
                    </div>
                  </div>
                )}
                labelSkipWidth={24}
                labelSkipHeight={12}
                labelTextColor={{ from: "color", modifiers: [["darker", 3]] }}
                colors={({ data }) => {
                  const catId = (data as any).categoriaId as string;
                  return categoriaColorMap.get(catId) || PALETTE[0];
                }}
                theme={{
                  text: { fontSize: 12 },
                  axis: {
                    ticks: { text: { fill: "hsl(var(--foreground))" } },
                    legend: { text: { fill: "hsl(var(--muted-foreground))" } },
                  },
                  grid: { line: { stroke: "hsl(var(--muted))", strokeDasharray: "4 4" } },
                  tooltip: {
                    container: {
                      background: "hsl(var(--background))",
                      color: "hsl(var(--foreground))",
                      border: "1px solid " + "hsl(var(--border))",
                      maxWidth: "28rem",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    },
                  },
                }}
                role="application"
                ariaLabel="Gráfica de porcentaje de promedio por pregunta"
              />
            )}
          </div>

          {/* Tabla auxiliar */}
          {dataPct.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2">Pregunta</th>
                    <th className="text-left p-2">Categoría</th>
                    <th className="text-right p-2">Promedio %</th>
                  </tr>
                </thead>
                <tbody>
                  {dataPct.map((r: any, i: number) => (
                    <tr key={`${r.pregunta}-${i}`}>
                      <td className="p-2">{r.texto}</td>
                      <td className="p-2">{r.categoriaName}</td>
                      <td
                        className={`p-2 text-right ${r.pct < 80 ? "text-red-700" : ""}`}
                        title={r.pct < 80 ? "Porcentaje por debajo de 80%" : undefined}
                      >
                        {r.pct < 80 && (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1 align-middle"
                            aria-hidden="true"
                          />
                        )}
                        {r.pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td className="p-2 font-semibold text-base md:text-lg">Global</td>
                    <td className="p-2" />
                    <td
                      className={`p-2 text-right font-semibold text-base md:text-lg ${
                        kpiGlobalPct && kpiGlobalPct.pct < 80 ? "text-red-700" : ""
                      }`}
                      title={
                        kpiGlobalPct && kpiGlobalPct.pct < 80
                          ? "Porcentaje global por debajo de 80%"
                          : undefined
                      }
                    >
                      {kpiGlobalPct && kpiGlobalPct.pct < 80 && (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 mr-1 align-middle" />
                      )}
                      {kpiGlobalPct ? `${kpiGlobalPct.pct}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>

      {/* ====== SHEET DERECHA: COMENTARIOS (solo lista) ====== */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent
          side="right"
          className="!max-w-none !w-[60vw] md:!w-[900px] lg:!w-[1100px] !px-8 !py-6"
          style={{ width: "min(1100px, 95vw)" }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" />
                Comentarios del ciclo
              </span>
              <div className="flex items-center gap-2">
                {reporte?.ciclo?.codigo && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    Ciclo: {reporte.ciclo.codigo}
                  </Badge>
                )}
                {docenteNombre && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    Docente: {docenteNombre}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cargarComentarios}
                  disabled={!cicloId || commentsLoading}
                  title="Recargar comentarios"
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
            <SheetDescription>
              Se muestran únicamente los comentarios (texto abierto) registrados en este ciclo.
            </SheetDescription>
          </SheetHeader>

          {/* Buscador dentro del sheet */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por texto, alumno o email…"
                value={commentsQuery}
                onChange={(e) => setCommentsQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Listado */}
          <div className="mt-3">
            {commentsError && <div className="text-sm text-amber-600">{commentsError}</div>}
            {commentsLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Cargando comentarios…
              </div>
            ) : commentsFiltered.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay comentarios para mostrar.</div>
            ) : (
              <ScrollArea className="h-[70vh] pr-4">
                <ul className="space-y-3">
                  {commentsFiltered.map((c) => (
                    <li key={c.id} className="rounded-md border p-3">
                      {/* Encabezado opcional, pequeño */}
                      {c.pregunta_texto && (
                        <div className="text-[11px] text-muted-foreground mb-1">{c.pregunta_texto}</div>
                      )}
                      <div className="whitespace-pre-wrap break-words text-sm">{c.texto}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {c.alumno?.nombre && <span>• {c.alumno.nombre}</span>}
                        {c.alumno?.email && <span>• {c.alumno.email}</span>}
                        {c.created_at && <span>• {new Date(c.created_at).toLocaleString()}</span>}
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
