"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { listCiclosPublic } from "@/lib/api";
import type { CicloDTO, ListCiclosParams } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  X,
  XCircle,
  FilterX,
} from "lucide-react";

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

function deriveDisponibles(c: any) {
  const totalRaw =
    c?.cupo_total ?? c?.cupo ?? c?.capacidad ?? c?.capacidad_total ?? 0;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : 0;

  const explicitRest =
    c?.cupo_restante ??
    c?.vacantes ??
    c?.disponibles ??
    c?.cupos_disponibles ??
    c?.cupos_restantes;

  if (Number.isFinite(Number(explicitRest))) {
    const disp = Math.max(0, Math.min(total, Number(explicitRest)));
    return { disp, total };
  }

  if (Number.isFinite(Number(c?.lugares_disponibles))) {
    const disp0 = Number(c.lugares_disponibles);
    if (!(disp0 < 0 || (total > 0 && disp0 > total))) {
      return { disp: Math.max(0, Math.min(total, disp0)), total };
    }
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
          <TooltipContent>{label}{value ? `: ${value}` : ""}</TooltipContent>
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

export default function HeroFeatures() {
  const [idioma, setIdioma] = useState<string | undefined>();
  const [modalidad, setModalidad] = useState<string | undefined>();
  const [turno, setTurno] = useState<string | undefined>();
  const [nivel, setNivel] = useState<string | undefined>();

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 2;

  const [loading, setLoading] = useState(true);
  const [cursos, setCursos] = useState<CicloDTO[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const hasAnyFilter = !!(idioma || modalidad || turno || nivel);

  async function fetchList(p: number) {
    setLoading(true);
    try {
      const params: Partial<ListCiclosParams> & {
        idioma?: string;
        modalidad?: string;
        turno?: string;
        nivel?: string;
      } = {
        page: p,
        page_size: PAGE_SIZE,
      };
      if (idioma) params.idioma = idioma as any;
      if (modalidad) params.modalidad = modalidad as any;
      if (turno) params.turno = turno as any;
      if (nivel) params.nivel = nivel as any;

      const resp = await listCiclosPublic(params);
      setCursos(resp?.items ?? []);
      setPages(resp?.pages ?? 1);
      setTotal(resp?.total ?? 0);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la lista de cursos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    setPage(1);
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idioma, modalidad, turno, nivel]);

  function clearAll() {
    setIdioma(undefined);
    setModalidad(undefined);
    setTurno(undefined);
    setNivel(undefined);
  }

  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div>
      <p className="max-w-prose text-sm text-neutral-600">
        Los <b>Cursos Extracurriculares</b> de <b>Lenguas Extranjeras (CELEX)</b> del 
        <b> CECyT 15 “Diódoro Antúnez Echegaray”</b> ofrecen formación en <b> Inglés</b>  para impulsar <b>habilidades comunicativas</b>, apoyar la <b>titulación</b> y 
        mejorar la <b>empleabilidad</b>.
      </p>


      <Separator className="my-6" />

      {/* Toolbar */}
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <IconDropdown icon={Languages} label="Idioma" items={idiomas} value={idioma} onChange={setIdioma} />
            <IconDropdown icon={Layers} label="Modalidad" items={modalidades} value={modalidad} onChange={setModalidad} />
            <IconDropdown icon={Clock3} label="Turno" items={turnos} value={turno} onChange={setTurno} />
            <IconDropdown icon={GraduationCap} label="Nivel" items={niveles} value={nivel} onChange={setNivel} />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={hasAnyFilter ? "default" : "outline"} className="h-9 rounded-xl" onClick={clearAll}>
                  {hasAnyFilter ? <XCircle className="h-4 w-4 mr-2" /> : <FilterX className="h-4 w-4 mr-2" />}
                  {hasAnyFilter ? "Limpiar filtros" : "Sin filtros"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hasAnyFilter ? "Quitar todos los filtros" : "No hay filtros activos"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Card className="shadow-sm mt-4">
        <CardHeader>
          <CardTitle>
            Cursos con inscripción vigente
            <span className="ml-2 text-sm text-neutral-500">{total} resultado{total === 1 ? "" : "s"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl border bg-neutral-50 animate-pulse" />
              ))}
            </div>
          ) : cursos.length === 0 ? (
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
                      {/* Encabezado */}
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-base">{c.codigo}</h3>
                        <Badge className={`rounded-full border ${tone.badgeClass}`}>
                          <Users className="mr-1 h-3.5 w-3.5" /> {disp}/{total} · {tone.label}
                        </Badge>
                      </div>

                      {/* Etiquetas */}
                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        <Badge variant="secondary" className="capitalize text-sm px-3 py-1">{c.idioma}</Badge>
                        <Badge variant="secondary" className="capitalize text-sm px-3 py-1">{c.modalidad}</Badge>
                        <Badge variant="outline" className="capitalize">{c.turno}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                          <GraduationCap className="h-3.5 w-3.5" /> {c.nivel}
                        </span>
                        {c.aula ? (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                            <Building2 className="h-3.5 w-3.5" /> {c.aula}
                          </span>
                        ) : null}
                      </div>

                      {/* Detalles debajo en bloque */}
                      <div className="mt-4 space-y-3 text-sm text-neutral-700 border-t pt-3">
                        {/* Periodo del curso / ciclo-grupo */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CalendarDays className="h-4 w-4" /> <b>Periodo del curso</b>
                          </div>
                          <div className="ml-6">{d(c.curso?.from)} – {d(c.curso?.to)}</div>
                        </div>
                        {/* Inscripción */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CalendarDays className="h-4 w-4" /> <b>Inscripción</b>
                          </div>
                          <div className="ml-6">{d(c.inscripcion?.from)} – {d(c.inscripcion?.to)}</div>
                        </div>
                        {/* Horario */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Clock3 className="h-4 w-4" /> <b>Horario</b>
                          </div>
                          <div className="ml-6">{h(c.hora_inicio)} – {h(c.hora_fin)}</div>
                        </div>
                        {/* Días */}
                        <div>
                          <div className="mb-1 font-semibold">Días</div>
                          <div className="ml-6">{(c.dias ?? []).map(abreviarDia).join(" • ")}</div>
                        </div>
                      </div>

                      {/* Barra de capacidad */}
                      <div className="mt-3 h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                        <div className={`h-2 ${tone.barClass}`} style={{ width: `${pct}%` }} aria-label={`Capacidad ${pct}%`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginación */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-neutral-500">Página {page} de {pages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canNext} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
