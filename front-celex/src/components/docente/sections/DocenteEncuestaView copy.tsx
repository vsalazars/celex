// src/components/docente/sections/DocenteEncuestaView.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  getDocenteCiclos,
  getDocenteReporteEncuesta,
  getDocenteEncuestaComentarios,
  // ✅ endpoint DOCENTE para serie por pregunta/ciclo
  getDocenteSerieEncuestaPorPregunta,
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

// Nivo dinámico (cliente)
const ResponsiveBar = dynamic(
  () => import("@nivo/bar").then((m) => m.ResponsiveBar),
  { ssr: false }
);
const ResponsiveLine = dynamic(
  () => import("@nivo/line").then((m) => m.ResponsiveLine),
  { ssr: false }
);

// Paletas
const PALETTE_BAR = ["#8596b3", "#ac9eb3", "#c4b0b3", "#d0d5d3"];
const DARK_TEXT = "#111827";
// d3-category10 para ciclos en la línea
const PALETTE_LINE = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
];

// Tooltip (línea)
const TOOLTIP_FONT_PX = 14;
const TOOLTIP_PADDING_PX = 12;
const TOOLTIP_MAX_W_PX = 620;
const POINT_SIZE = 10;
const POINT_BORDER = 2;

type Props = {
  defaultAnio?: number;
  defaultIdioma?: string;
};

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
    id: string;                // pregunta_id
    label: string;             // enunciado
    data: { x: string; y: number }[]; // ciclo_codigo vs %
  }[];
};

export default function DocenteEncuestaView({ defaultAnio, defaultIdioma }: Props) {
  const [loadingCiclos, setLoadingCiclos] = React.useState(false);
  const [ciclos, setCiclos] = React.useState<CicloLite[]>([]);
  const [selected, setSelected] = React.useState<string | number | "">("");

  const [loadingReporte, setLoadingReporte] = React.useState(false);
  const [reporte, setReporte] = React.useState<ReporteEncuestaDocente | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // ===== Vista "Ver todos" (línea) =====
  const [showAll, setShowAll] = React.useState(false);
  const [loadingSerie, setLoadingSerie] = React.useState(false);
  const [serie, setSerie] = React.useState<SeriePorPregunta | null>(null);
  const [serieError, setSerieError] = React.useState<string | null>(null);
  const [hiddenCycles, setHiddenCycles] = React.useState<Set<string>>(new Set());

  // ===== Comentarios (sheet) =====
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [commentsError, setCommentsError] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<Comentario[]>([]);
  const [commentsQuery, setCommentsQuery] = React.useState("");

  // Cargar ciclos
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

  // Cargar reporte de un ciclo
  const consultar = React.useCallback(async () => {
    if (showAll) return;
    if (!selected) {
      setReporte(null);
      return;
    }
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

  // Serie (línea) — DOCENTE
  const consultarSerie = React.useCallback(async () => {
    setLoadingSerie(true);
    setSerieError(null);
    try {
      const s = (await getDocenteSerieEncuestaPorPregunta()) as unknown as SeriePorPregunta;
      setSerie(s || null);
      setHiddenCycles(new Set());
    } catch (e: any) {
      setSerie(null);
      setSerieError(e?.message || "No se pudo cargar la serie por ciclos/preguntas");
    } finally {
      setLoadingSerie(false);
    }
  }, []);

  React.useEffect(() => {
    if (showAll) consultarSerie();
  }, [showAll, consultarSerie]);

  // ===== helpers % (barras) =====
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
      for (const o of p.opciones || []) {
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

  const preguntasGraficables = (reporte?.preguntas || []).filter(isNumericQuestion);

  // ===== Selección por pregunta (BARRAS) =====
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

  // ===== Categorías (BARRAS) =====
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

  // Mapa color por categoría (barras)
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

  // Data P1..Pn (barras) — respeta filtros
  const dataPct = React.useMemo(() => {
    const base = preguntasGraficables.filter(
      (p) =>
        selectedIds.includes(String(p.id)) &&
        selectedCatIds.includes(String(p.categoria?.id ?? "sin_categoria"))
    );
    const items = base.map((p, idx) => {
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
    });
    return items.sort(
      (a, b) => a.categoriaOrder - b.categoriaOrder || a.pregunta.localeCompare(b.pregunta)
    );
  }, [preguntasGraficables, selectedIds, selectedCatIds]);

  // ======= SERIE (línea) =======
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

  const lineDataAll = React.useMemo(() => {
    if (!serie?.series?.length) return [];
    const byCycle: Record<string, Record<string, number | null>> = {};
    ciclosOrden.forEach((c) => (byCycle[c] = {}));
    (serie.series || []).forEach((s) => {
      const pid = s.id;
      const valMap: Record<string, number | null> = {};
      ciclosOrden.forEach((c) => (valMap[c] = null));
      s.data.forEach((p) => {
        const y = Number.isFinite(p.y) ? Math.max(0, Math.min(100, p.y)) : null;
        valMap[String(p.x)] = y;
      });
      Object.entries(valMap).forEach(([ciclo, y]) => {
        byCycle[ciclo][pid] = y;
      });
    });
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
  }, [serie, ciclosOrden, preguntasOrden, pidToShort, shortToFull]);

  const lineData = React.useMemo(
    () => lineDataAll.filter((s) => !hiddenCycles.has(String(s.id))),
    [lineDataAll, hiddenCycles]
  );

  const cicloAvg = React.useMemo(() => {
    const m = new Map<string, number>();
    lineDataAll.forEach((serie) => {
      const vals = serie.data.map((d: any) => d.y).filter((v: any) => typeof v === "number") as number[];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      m.set(String(serie.id), Number(avg.toFixed(1)));
    });
    return m;
  }, [lineDataAll]);

  // ===== Comentarios =====
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
            alumno: null, // anonimizado
          } as Comentario;
        })
        .filter(Boolean) as Comentario[];
      const seen = new Set<string>();
      const unique: Comentario[] = [];
      for (const it of norm) if (!seen.has(it.id)) { seen.add(it.id); unique.push(it); }
      unique.sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
      setComments(unique);
    } catch (e: any) {
      setComments([]);
      setCommentsError(e?.message || "No se pudieron cargar los comentarios");
    } finally {
      setCommentsLoading(false);
    }
  }, [selected]);

  React.useEffect(() => {
    if (commentsOpen) cargarComentarios();
  }, [commentsOpen, cargarComentarios]);

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

  // Helpers toggle ciclos
  const toggleCycle = (c: string) => {
    setHiddenCycles((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };
  const showAllCycles = () => setHiddenCycles(new Set());
  const hideAllCycles = () => setHiddenCycles(new Set(ciclosOrden));

  // Clase base chips
  const chipBase =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm leading-none h-8 transition";

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">
              {showAll ? "Desempeño Docente — Línea (ciclos vs preguntas)" : "Resultados de la encuesta — % Promedio"}
            </h3>
            {!showAll && reporte?.ciclo && <Badge variant="secondary">Ciclo: {reporte.ciclo.codigo}</Badge>}
            {!showAll && !!reporte?.total_participantes && (
              <Badge variant="outline">Participantes: {reporte.total_participantes}</Badge>
            )}
            {showAll && serie?.docente?.nombre && (
              <Badge variant="secondary">Docente: {serie.docente.nombre}</Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showAll ? "outline" : "default"}
              onClick={() => setShowAll(false)}
              title="Ver el ciclo seleccionado"
            >
              <BarChartIcon className="h-4 w-4 mr-2" />
              Ver ciclo
            </Button>
            <Button
              size="sm"
              variant={showAll ? "default" : "outline"}
              onClick={() => setShowAll(true)}
              title="Ver todos los ciclos (serie)"
            >
              <LineChartIcon className="h-4 w-4 mr-2" />
              Ver todos
            </Button>

            {!showAll ? (
              <Button size="sm" variant="outline" onClick={consultar} disabled={loadingReporte || !selected} title="Actualizar">
                {loadingReporte ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Actualizar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={consultarSerie} disabled={loadingSerie} title="Actualizar">
                {loadingSerie ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Actualizar
              </Button>
            )}

            {/* Comentarios solo en barras (por ciclo) */}
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

        {/* Selector de ciclo */}
        {!showAll && (
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
                    {c.codigo} {c.idioma ? `· ${c.idioma}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        <Separator className="my-3" />

        {/* ====== Chips P1..Pn con tooltip — EN AMBAS VISTAS ====== */}
        <TooltipProvider>
          {!showAll ? (
            // ——— Barras: chips con toggle por pregunta
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectedIds.length === allIds.length ? selectNone : selectAll}
                  title={selectedIds.length === allIds.length ? "Deseleccionar todo" : "Seleccionar todo"}
                >
                  {selectedIds.length === allIds.length ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
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
                            checked
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-foreground border-muted"
                          }`}
                          title={p.texto}
                        >
                          {checked ? "✓ " : ""}
                          {short}
                        </button>
                      </TooltipTrigger>
                      <UiTooltipContent className="max-w-[640px]">
                        <p className="text-sm leading-snug">{p.texto}</p>
                      </UiTooltipContent>
                    </UiTooltip>
                  );
                })}
              </div>
            </div>
          ) : (
            // ——— Línea: chips SOLO referencia (tooltip del enunciado)
            !!preguntasOrden.length && (
              <div className="flex flex-wrap gap-2 mb-2">
                {preguntasOrden.map((pid, i) => {
                  const short = pidToShort.get(pid) || `P${i + 1}`;
                  const full = (serie?.series || []).find((s) => s.id === pid)?.label || short;
                  return (
                    <UiTooltip key={pid} delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="cursor-help">{short}</Badge>
                      </TooltipTrigger>
                      <UiTooltipContent className="max-w-[640px]">
                        <p className="text-sm leading-snug">{full}</p>
                      </UiTooltipContent>
                    </UiTooltip>
                  );
                })}
              </div>
            )
          )}
        </TooltipProvider>

        {/* ====== Chips por categoría (solo barras) ====== */}
        {!showAll && categorias.length > 0 && (
          <div className="mb-2 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={selectedCatIds.length === allCatIds.length ? selectNoCats : selectAllCats}
                title={selectedCatIds.length === allCatIds.length ? "Ocultar todas" : "Mostrar todas"}
              >
                {selectedCatIds.length === allCatIds.length ? (
                  <CheckSquare className="h-4 w-4 mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                {selectedCatIds.length === allCatIds.length ? "Ocultar todas" : "Mostrar todas"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedCatIds.length}/{allCatIds.length} categorías
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {categorias.map((c, i) => {
                const color = PALETTE_BAR[i % PALETTE_BAR.length];
                const checked = selectedCatIds.includes(String(c.id));
                const style: React.CSSProperties = checked
                  ? { background: color, color: DARK_TEXT, border: `1px solid ${color}` }
                  : { background: "hsl(var(--muted))", color: DARK_TEXT, border: `1px solid ${color}` };

                return (
                  <button
                    key={String(c.id)}
                    type="button"
                    onClick={() => toggleCat(String(c.id))}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm leading-none h-8 transition"
                    style={style}
                    title={c.name}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mensajes */}
        {!showAll && error && <div className="mt-2 text-sm text-amber-600">{error}</div>}
        {showAll && serieError && <div className="mt-2 text-sm text-amber-600">{serieError}</div>}

        {/* ====== Gráfica ====== */}
        <div className="mt-2 h-[560px] md:h-[640px] w-full">
          {!showAll ? (
            // ---- Barras
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
                    <div className="font-medium break-words whitespace-normal">
                      {(data as any).pregunta}: {(data as any).texto}
                    </div>
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
                  return categoriaColorMap.get(catId) || PALETTE_BAR[0];
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
                ariaLabel="Gráfica de porcentaje de promedio por pregunta (docente)"
              />
            )
          ) : (
            // ---- Línea
            loadingSerie ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Cargando serie por ciclos…
              </div>
            ) : !lineData.length ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No hay datos de ciclos para graficar.
              </div>
            ) : (
              // @ts-expect-error nivo dynamic
              <ResponsiveLine
                data={lineData}
                margin={{ top: 20, right: 28, bottom: 80, left: 56 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: 100, stacked: false }}
                curve="monotoneX"
                enablePoints
                pointSize={POINT_SIZE}
                pointBorderWidth={POINT_BORDER}
                useMesh
                enableGridX={false}
                enableGridY
                gridYValues={[0, 20, 40, 60, 80, 100]}
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
                pointTooltip={({ point }) => {
                  const d: any = point.data;
                  const emb = (d?.data as any) || {};
                  const full = emb.preguntaFull ?? shortToFull.get(String(d.x)) ?? String(d.x);
                  const ciclo = emb.cicloLabel ?? (point as any).serieId ?? (point as any).serie?.id ?? "";
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
                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
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
                  grid: {
                    line: {
                      stroke: "hsl(var(--muted))",
                      strokeDasharray: "4 4",
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
            )
          )}
        </div>
      </CardContent>

      {/* ====== SHEET DERECHA: COMENTARIOS (anónimo) ====== */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent
          side="right"
          className="!max-w-none !w-[40vw] md:!w-[600px] lg:!w-[700px] !px-6 !py-6"
          style={{ width: "min(700px, 90vw)" }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" />
                Comentarios del ciclo
              </span>
              <div className="flex items-center gap-2">
                {reporte?.ciclo?.codigo && !showAll && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    Ciclo: {reporte.ciclo.codigo}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cargarComentarios}
                  disabled={!selected || commentsLoading}
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
              Los comentarios se muestran de forma anónima para proteger la confidencialidad.
            </SheetDescription>
          </SheetHeader>

          {/* Buscador */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por texto o por pregunta…"
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
                      {c.pregunta_texto && (
                        <div className="text-[11px] text-muted-foreground mb-1">{c.pregunta_texto}</div>
                      )}
                      <div className="whitespace-pre-wrap break-words text-sm">{c.texto}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>• Comentario anónimo</span>
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
