"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  listCiclosPublic,
  listPlacementExamsPublic,
  type PlacementExamLite,
} from "@/lib/api";
import type { CicloDTO, ListCiclosParams } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  CalendarDays,
  Clock3,
  Users,
  GraduationCap,
  Building2,
  Info,
  ChevronLeft,
  ChevronRight,
  Languages,
  Layers,
  XCircle,
  FilterX,
  ClipboardList,
  FileCheck2,
} from "lucide-react";

import InfoDialog from "@/components/landing/InfoDialog";

/* ===== Helpers ===== */
const d = (s?: string | null) => {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "—";
  const day = dt.getDate();
  const month = dt.toLocaleString("es-MX", { month: "short" });
  const year = dt.getFullYear();
  return `${day}/${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`;
};
const h = (t?: string | null) => (t ? t.slice(0, 5) : "—");
const abreviarDia = (key: string) =>
  (
    {
      lunes: "Lun",
      martes: "Mar",
      miercoles: "Mié",
      jueves: "Jue",
      viernes: "Vie",
      sabado: "Sáb",
      domingo: "Dom",
    } as Record<string, string>
  )[key] ?? key;

function isTodayBetween(from?: string | null, to?: string | null) {
  if (!from || !to) return false;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59`);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return now >= start && now <= end;
}

function capTone(disp: number) {
  if (disp <= 0) {
    return { label: "Sin lugares", badgeClass: "bg-red-100 text-red-800 border-red-200", barClass: "bg-red-500" };
  }
  if (disp <= 5) {
    return { label: "Últimos lugares", badgeClass: "bg-amber-100 text-amber-800 border-amber-200", barClass: "bg-amber-500" };
  }
  return { label: "Disponible", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200", barClass: "bg-emerald-500" };
}
function capPercent(disp: number, total: number) {
  const pct = total > 0 ? Math.max(0, Math.min(1, disp / total)) : 0;
  return Math.round(pct * 100);
}

/** ========= NUMERIC UTILS ========= */
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const firstNum = (xs: any[]) => {
  for (const x of xs) {
    const n = num(x);
    if (n !== undefined) return n;
  }
  return undefined;
};

/** ========= NORMALIZADOR DE CAPACIDAD ========= */
function normalizeExamCapacity(e: any) {
  const total =
    firstNum([
      e?.capacity?.cupo_total,
      e?.capacity?.capacidad_total,
      e?.capacidad_total,
      e?.capacidad,
      e?.cupo_total,
      e?.cupo,
      e?.aforo_total,
      e?.aforo,
      e?.cupoMax,
      e?.cupo_max,
      e?.capacidadMax,
      e?.capacidad_max,
      e?.capacidad_maxima,
    ]) ?? 0;

  const confirmados = firstNum([
    e?.capacity?.inscritos_count,
    e?.inscritos_count,
    e?.inscritos_confirmados,
    e?.inscritos,
  ]) ?? 0;

  const holds = firstNum([
    e?.capacity?.holds_activos,
    e?.holds_activos,
    e?.holds,
  ]) ?? 0;

  let restante = firstNum([
    e?.capacity?.cupo_restante,
    e?.capacity?.disponibles,
    e?.cupo_restante,
    e?.cupo_disponible,
    e?.cupos_disponibles,
    e?.disponibles,
    e?.vacantes,
    e?.aforo_disponible,
    e?.lugares_disponibles,
  ]);

  if (restante === undefined) {
    restante = Math.max(0, total - confirmados - holds);
  }

  const t = Math.max(0, total);
  const r = Math.max(0, Math.min(t, restante ?? 0));

  return {
    ...e,
    cupo_total: t,
    cupo_restante: r,
    capacity: {
      cupo_total: t,
      cupo_restante: r,
      inscritos_count: confirmados,
      holds_activos: holds,
    },
  };
}

/** ========= deriveDisponibles ========= */
function deriveDisponibles(c: any) {
  const totalCap =
    c?.capacity?.cupo_total ??
    c?.capacity?.capacidad_total ??
    c?.capacity?.cupo ??
    undefined;

  const restCap =
    c?.capacity?.cupo_restante ??
    (Number.isFinite(Number(c?.capacity?.inscritos_count)) || Number.isFinite(Number(c?.capacity?.holds_activos)))
      ? (Number(c?.capacity?.cupo_total) ?? Number(c?.capacity?.capacidad_total) ?? 0) -
        (Number(c?.capacity?.inscritos_count) ?? 0) -
        (Number(c?.capacity?.holds_activos) ?? 0)
      : undefined;

  if (Number.isFinite(Number(totalCap)) && Number.isFinite(Number(restCap))) {
    const total = Number(totalCap);
    const disp = Math.max(0, Math.min(total, Number(restCap)));
    return { disp, total };
  }

  const totalRaw =
    c?.cupo_total ?? c?.cupo ?? c?.capacidad ?? c?.capacidad_total ?? 0;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : 0;

  const explicitRest =
    c?.cupo_restante ??
    c?.vacantes ??
    c?.disponibles ??
    c?.cupo_disponible ??
    c?.cupos_disponibles ??
    c?.cupos_restantes;

  if (Number.isFinite(Number(explicitRest))) {
    const disp = Math.max(0, Math.min(total, Number(explicitRest)));
    return { disp, total };
  }

  const usadosRaw =
    c?.ocupados ??
    c?.usados ??
    c?.inscritos ??
    c?.inscritos_actuales ??
    c?.inscritos_count ??
    c?.preinscritos_count ??
    0;

  const usados = Number.isFinite(Number(usadosRaw)) ? Number(usadosRaw) : 0;
  let disp = total - usados;

  if (!Number.isFinite(disp) && Number.isFinite(Number(c?.lugares_disponibles))) {
    disp = Number(c.lugares_disponibles);
  }

  if (!Number.isFinite(disp)) disp = 0;
  disp = Math.max(0, Math.min(total, disp));
  return { disp, total };
}

/* ===== Options ===== */
const idiomas = ["ingles", "frances", "aleman", "italiano", "portugues"];
const modalidades = ["intensivo", "sabatino", "semestral"];
const turnos = ["matutino", "vespertino", "mixto"];
const niveles = ["A1", "A2", "B1", "B2", "C1", "C2"];

function IconDropdown({
  icon: Icon,
  label,
  items,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  items: string[];
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant={value ? "default" : "outline"} size="icon" className="h-9 w-9 rounded-xl">
                <Icon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          
          {/* 👇 Forzamos el tooltip debajo */}
          <TooltipContent side="bottom" sideOffset={8}>
            {label}{value ? `: ${value}` : ""}
          </TooltipContent>

          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(undefined)}>Todos</DropdownMenuItem>
            {items.map((opt) => (
              <DropdownMenuItem key={opt} onClick={() => onChange(opt)} className="capitalize">
                {opt}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </TooltipProvider>
  );
}

type TabKey = "cursos" | "examenes";

export default function HeroFeatures() {
  const [tab, setTab] = useState<TabKey>("cursos");

  const [idioma, setIdioma] = useState<string | undefined>();
  const [modalidad, setModalidad] = useState<string | undefined>();
  const [turno, setTurno] = useState<string | undefined>();
  const [nivel, setNivel] = useState<string | undefined>();

  // Tamaños de página
  const PAGE_SIZE_CURSOS = 2;
  const PAGE_SIZE_EXAMS = 2;

  // Paginación
  const [pageCursos, setPageCursos] = useState(1);
  const [pageExams, setPageExams] = useState(1);

  const [loading, setLoading] = useState(true);

  // Cursos (server-side)
  const [cursos, setCursos] = useState<CicloDTO[]>([]);
  const [pagesCursos, setPagesCursos] = useState(1);
  const [totalCursos, setTotalCursos] = useState(0);

  // Exámenes (client-side)
  const [examsAll, setExamsAll] = useState<PlacementExamLite[]>([]);
  const [examsPage, setExamsPage] = useState<PlacementExamLite[]>([]);
  const [pagesExams, setPagesExams] = useState(1);
  const [totalExams, setTotalExams] = useState(0);

  const [openInfo, setOpenInfo] = useState(false);

  const hasAnyFilterCursos = !!(idioma || modalidad || turno || nivel);
  const hasAnyFilterExams = !!idioma; // solo idioma aplica a exámenes
  const activeFilters = tab === "cursos" ? hasAnyFilterCursos : hasAnyFilterExams;

  function clearAll() {
    setIdioma(undefined);
    setModalidad(undefined);
    setTurno(undefined);
    setNivel(undefined);
    setPageCursos(1);
    setPageExams(1);
  }

  // ==== Fetchers ====
  async function fetchCursos(p: number) {
    setLoading(true);
    try {
      const params: Partial<ListCiclosParams> & {
        idioma?: string;
        modalidad?: string;
        turno?: string;
        nivel?: string;
      } = {
        page: p,
        page_size: PAGE_SIZE_CURSOS,
      };
      if (idioma) params.idioma = idioma as any;
      if (modalidad) params.modalidad = modalidad as any;
      if (turno) params.turno = turno as any;
      if (nivel) params.nivel = nivel as any;

      const resp = await listCiclosPublic(params);
      setCursos(resp?.items ?? []);
      setPagesCursos(resp?.pages ?? 1);
      setTotalCursos(resp?.total ?? 0);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la lista de cursos.");
    } finally {
      setLoading(false);
    }
  }

  function pickInscripcionWindowExam(e: any) {
    const ins = e?.inscripcion || e?.registro || undefined;
    const from =
      ins?.from ??
      e?.inscripcion_from ??
      e?.insc_inicio ??
      e?.registro_inicio ??
      e?.inscripcion_inicio ??
      null;
    const to =
      ins?.to ??
      e?.inscripcion_to ??
      e?.insc_fin ??
      e?.registro_fin ??
      e?.inscripcion_fin ??
      null;
    return { from, to };
  }

  async function fetchExams(p: number) {
    setLoading(true);
    try {
      const resp = await listPlacementExamsPublic({
        idioma: idioma || undefined,
        vigente: true,
        include_capacity: true,
        page: 1,
        page_size: 100,
      });

      const rawItems = Array.isArray(resp) ? resp : resp?.items ?? [];
      const items = rawItems.map(normalizeExamCapacity);

      const todayVigentes = items.filter((e: any) => {
        const { from, to } = pickInscripcionWindowExam(e);
        if (from && to) return isTodayBetween(from, to);
        const f = (e as any)?.fecha;
        if (!f) return false;
        const dt = new Date(`${f}T00:00:00`);
        return !Number.isNaN(dt.getTime()) && dt >= new Date();
      });

      // Orden por fecha asc, luego código
      todayVigentes.sort((a: any, b: any) => {
        const da = new Date(`${a.fecha ?? ""}T00:00:00`).getTime() || 0;
        const db = new Date(`${b.fecha ?? ""}T00:00:00`).getTime() || 0;
        if (da !== db) return da - db;
        const ca = String(a.codigo || "").toLowerCase();
        const cb = String(b.codigo || "").toLowerCase();
        return ca.localeCompare(cb, "es");
      });

      const total = todayVigentes.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE_EXAMS));
      const start = (p - 1) * PAGE_SIZE_EXAMS;
      const slice = todayVigentes.slice(start, start + PAGE_SIZE_EXAMS);

      setExamsAll(todayVigentes);
      setPagesExams(pages);
      setTotalExams(total);
      setExamsPage(slice);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la lista de exámenes.");
      setExamsAll([]);
      setPagesExams(1);
      setTotalExams(0);
      setExamsPage([]);
    } finally {
      setLoading(false);
    }
  }

  // ==== Effects ====
  useEffect(() => {
    if (tab === "cursos") fetchCursos(pageCursos);
    else fetchExams(pageExams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "cursos") fetchCursos(pageCursos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCursos]);

  useEffect(() => {
    if (tab === "examenes") {
      const total = examsAll.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE_EXAMS));
      const start = (pageExams - 1) * PAGE_SIZE_EXAMS;
      setExamsPage(examsAll.slice(start, start + PAGE_SIZE_EXAMS));
      setPagesExams(pages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageExams, examsAll]);

  useEffect(() => {
    setPageCursos(1);
    setPageExams(1);
    if (tab === "cursos") fetchCursos(1);
    else fetchExams(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idioma, modalidad, turno, nivel]);

  /* ========= UI helpers ========= */
  const tabSwitch = (
    <div className="flex gap-2">
      <Button
        variant={tab === "cursos" ? "default" : "outline"}
        className="h-9 rounded-xl"
        onClick={() => setTab("cursos")}
      >
        <ClipboardList className="h-4 w-4 mr-2" /> Cursos de idiomas
      </Button>
      <Button
        variant={tab === "examenes" ? "default" : "outline"}
        className="h-9 rounded-xl"
        onClick={() => setTab("examenes")}
      >
        <FileCheck2 className="h-4 w-4 mr-2" /> Examen de colocación
      </Button>
    </div>
  );

  const leftControls = (
    <div className="flex flex-wrap items-center gap-2">
      {tabSwitch}
      <Button
        variant="outline"
        className="h-9 rounded-xl"
        onClick={() => setOpenInfo(true)}
      >
        <Info className="h-4 w-4 mr-2" /> Información y cuotas
      </Button>
    </div>
  );

  const limpiarBtn = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeFilters ? "default" : "outline"}
            className="h-9 rounded-xl"
            onClick={clearAll}
          >
            {activeFilters ? <XCircle className="h-4 w-4 mr-2" /> : <FilterX className="h-4 w-4 mr-2" />}
            {activeFilters ? "Limpiar filtros" : "Sin filtros"}
          </Button>
        </TooltipTrigger>
        {/* 👇 Abajo también */}
        <TooltipContent side="bottom" sideOffset={8}>
          {activeFilters ? "Quitar todos los filtros" : "No hay filtros activos"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const filtrosCursos = (
    <div className="flex items-center gap-2 flex-wrap">
      <IconDropdown icon={Languages} label="Idioma" items={idiomas} value={idioma} onChange={setIdioma} />
      <IconDropdown icon={Layers} label="Modalidad" items={modalidades} value={modalidad} onChange={setModalidad} />
      <IconDropdown icon={Clock3} label="Turno" items={turnos} value={turno} onChange={setTurno} />
      <IconDropdown icon={GraduationCap} label="Nivel" items={niveles} value={nivel} onChange={setNivel} />
    </div>
  );

  const filtrosExamenes = (
    <div className="flex items-center gap-2 flex-wrap">
      <IconDropdown icon={Languages} label="Idioma" items={idiomas} value={idioma} onChange={setIdioma} />
    </div>
  );

  const headerTitleNode = useMemo(() => {
    if (tab === "cursos") {
      return (
        <>
          Cursos con inscripción vigente{" "}
          <span className="ml-2 text-sm text-neutral-500">
            {totalCursos} resultado{totalCursos === 1 ? "" : "s"}
          </span>
        </>
      );
    }
    return (
      <>
        Exámenes de colocación vigentes{" "}
        <span className="ml-2 text-sm text-neutral-500">
          {totalExams} resultado{totalExams === 1 ? "" : "s"}
        </span>
      </>
    );
  }, [tab, totalCursos, totalExams]);

  return (
    <div className="h-full flex flex-col">
      {/* Modal de información */}
      <InfoDialog open={openInfo} onOpenChange={setOpenInfo} />

      {/* Toolbar */}
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          {leftControls}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          {tab === "cursos" ? filtrosCursos : filtrosExamenes}
          {limpiarBtn}
        </div>
      </div>

      <Card className="shadow-sm mt-4 flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>{headerTitleNode}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl border bg-neutral-50 animate-pulse" />
              ))}
            </div>
          ) : tab === "cursos" ? (
            (cursos.length === 0 ? (
              <div className="rounded-2xl border bg-white/70 p-6 text-sm text-neutral-600">
                <Info className="mr-2 inline h-4 w-4" /> No hay convocatorias abiertas con los filtros seleccionados.
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cursos.map((c) => {
                    const { disp, total } = deriveDisponibles(c);
                    const tone = capTone(disp);
                    const pct = capPercent(disp, total);
                    return (
                      <div key={c.id} className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="mb-2">
                          <h3 className="font-semibold text-base">{c.codigo}</h3>
                          <div className="mt-1">
                           {/* Cursos */}
                          <Badge
                            className={`rounded-full border px-2 py-0.5 text-xs md:text-sm font-medium ${tone.badgeClass}`}
                          >
                            <Users className="mr-1 h-3 w-3 md:h-3.5 md:w-3.5" /> {disp}/{total} · {tone.label}
                          </Badge>
                          </div>
                        </div>

                       <div className="mt-2 flex flex-nowrap items-center gap-2 text-[13px] leading-tight">
                          {/* idioma */}
                          <Badge
                            variant="secondary"
                            className="capitalize px-2.5 py-1 whitespace-nowrap min-w-0 shrink truncate"
                          >
                            <span className="block max-w-[10ch] truncate">{c.idioma}</span>
                          </Badge>

                          {/* modalidad */}
                          <Badge
                            variant="secondary"
                            className="capitalize px-2.5 py-1 whitespace-nowrap min-w-0 shrink truncate"
                          >
                            <span className="block max-w-[12ch] truncate">{c.modalidad}</span>
                          </Badge>

                          {/* turno */}
                          <Badge
                            variant="outline"
                            className="capitalize px-2.5 py-1 whitespace-nowrap min-w-0 shrink truncate"
                          >
                            <span className="block max-w-[10ch] truncate">{c.turno}</span>
                          </Badge>

                          {/* nivel */}
                          <Badge
                            variant="outline"
                            className="inline-flex items-center gap-1 px-2.5 py-1 font-medium whitespace-nowrap min-w-0 shrink"
                          >
                            <GraduationCap className="h-4 w-4 shrink-0" />
                            <span className="block truncate">{c.nivel}</span>
                          </Badge>

                          {/* aula */}
                          {c.aula ? (
                            <span className="inline-flex items-center gap-1 text-xs text-neutral-700 whitespace-nowrap shrink-0">
                              Aula: {c.aula}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-3 text-sm text-neutral-700 border-t pt-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarDays className="h-4 w-4" /> <b>Periodo del curso</b>
                            </div>
                            <div className="ml-6">{d(c.curso?.from)} – {d(c.curso?.to)}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarDays className="h-4 w-4" /> <b>Inscripción</b>
                            </div>
                            <div className="ml-6">{d(c.inscripcion?.from)} – {d(c.inscripcion?.to)}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Clock3 className="h-4 w-4" /> <b>Horario</b>
                            </div>
                            <div className="ml-6">{h(c.hora_inicio)} – {h(c.hora_fin)}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-semibold">Días</div>
                            <div className="ml-6">{(c.dias ?? []).map(abreviarDia).join(" • ")}</div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                          <div className={`h-2 ${tone.barClass}`} style={{ width: `${pct}%` }} aria-label={`Capacidad ${pct}%`} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Página {pageCursos} de {pagesCursos}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={pageCursos <= 1} onClick={() => setPageCursos((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={pageCursos >= pagesCursos} onClick={() => setPageCursos((p) => Math.min(pagesCursos, p + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ))
          ) : (
            (examsPage.length === 0 ? (
              <div className="rounded-2xl border bg-white/70 p-6 text-sm text-neutral-600">
                <Info className="mr-2 inline h-4 w-4" /> No hay exámenes vigentes con los filtros seleccionados.
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {examsPage.map((e: PlacementExamLite) => {
                    const keyId = String((e as any).id ?? (e as any).codigo ?? Math.random());
                    const { from, to } = pickInscripcionWindowExam(e);

                    const { disp, total } = deriveDisponibles(e as any);
                    const tone = capTone(disp);
                    const pct = capPercent(disp, total);

                    const aula = (e as any).salon ?? (e as any).aula ?? (e as any).sala ?? undefined;

                    return (
                      <div key={keyId} className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="mb-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-base">
                              {(e as any).codigo || "Examen"}
                            </h3>
                          </div>
                          <div className="mt-2">
                            <Badge
                              className={`rounded-full border px-2 py-0.5 text-xs md:text-sm font-medium ${tone.badgeClass}`}
                            >
                              <Users className="mr-1 h-3 w-3 md:h-3.5 md:w-3.5" /> {disp}/{total} · {tone.label}
                            </Badge>

                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                          <Badge variant="secondary" className="capitalize text-sm px-3 py-1">{(e as any).idioma || idioma || "idioma"}</Badge>
                          {(e as any).sede ? (
                            <Badge variant="outline" className="capitalize">{(e as any).sede}</Badge>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-3 text-sm text-neutral-700 border-t pt-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarDays className="h-4 w-4" /> <b>Fecha del examen</b>
                            </div>
                            <div className="ml-6">{d((e as any).fecha)}</div>
                          </div>

                          {/* ✅ HORA con icono, soporta 'hora' o rango 'hora_inicio – hora_fin', y muestra duración si existe */}
                          {(e as any).hora_inicio || (e as any).hora_fin || (e as any).hora ? (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Clock3 className="h-4 w-4" /> <b>Hora</b>
                              </div>
                              <div className="ml-6">
                                {((e as any).hora_inicio || (e as any).hora_fin)
                                  ? `${h((e as any).hora_inicio)} – ${h((e as any).hora_fin)}`
                                  : h((e as any).hora)}
                                {Number.isFinite(Number((e as any).duracion_min)) ? (
                                  <span className="text-xs text-neutral-500 ml-2">
                                    · {(e as any).duracion_min} min
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          {/* ✅ SALÓN con icono */}
                          {aula ? (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Building2 className="h-4 w-4" /> <b>Salón</b>
                              </div>
                              <div className="ml-6">{aula}</div>
                            </div>
                          ) : null}

                          <div>
                            <div className="mb-1 font-semibold">Inscripción</div>
                            <div className="ml-6">{d(from)} – {d(to)}</div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 w-full rounded-full bg-neutral-100 overflow-hidden" aria-hidden>
                          <div className={`h-2 ${tone.barClass}`} style={{ width: `${pct}%` }} aria-label={`Capacidad ${pct}%`} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Página {pageExams} de {pagesExams}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={pageExams <= 1} onClick={() => setPageExams((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={pageExams >= pagesExams} onClick={() => setPageExams((p) => Math.min(pagesExams, p + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
