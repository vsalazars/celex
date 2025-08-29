"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import { toast } from "sonner";
import {
  listCiclosAlumno,   // 👈 usa el endpoint de alumno (evita 403)
  createInscripcion,  // 👈 ya lo tenías
} from "@/lib/api";
import type { CicloDTO, CicloListResponse, ListCiclosParams } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import {
  Search, Filter, ChevronLeft, ChevronRight, CalendarDays, Clock3, Users, GraduationCap, Building2, Info
} from "lucide-react";

// util de formateo corto: 27/ago/25
const d = (s?: string) => {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  const day = dt.toLocaleString("es-MX", { day: "2-digit" });
  const month = dt.toLocaleString("es-MX", { month: "short" }).replace(".", "");
  const year = dt.toLocaleString("es-MX", { year: "2-digit" });
  return `${day}/${month}/${year}`;
};
const abreviarDia = (key: string) =>
  ({ lunes:"Lun", martes:"Mar", miercoles:"Mié", jueves:"Jue", viernes:"Vie", sabado:"Sáb", domingo:"Dom" } as Record<string,string>)[key] ?? key;

export default function AlumnoInscripcionPage() {
  const router = useRouter();

  // Filtros / lista
  const PAGE_SIZE = 8;
  const [q, setQ] = useState("");
  const [fIdioma, setFIdioma] = useState<string | undefined>();
  const [fModalidad, setFModalidad] = useState<string | undefined>();
  const [fTurno, setFTurno] = useState<string | undefined>();
  const [fNivel, setFNivel] = useState<string | undefined>();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<CicloListResponse | null>(null);
  const items = data?.items ?? [];
  const canPrev = (data?.page ?? 1) > 1;
  const canNext = !!data && data.page < data.pages;

  // Ficha lateral (detalle + inscribir)
  const [openSheet, setOpenSheet] = useState(false);
  const [selected, setSelected] = useState<CicloDTO | null>(null);
  const openDetalle = (c: CicloDTO) => { setSelected(c); setOpenSheet(true); };

  async function fetchList(params: ListCiclosParams) {
    // 👇 alumno: usa listCiclosAlumno, por defecto solo_abiertos=true
    const resp = await listCiclosAlumno({
      ...params,
      solo_abiertos: true,
    } as any);
    setData(resp);
  }

  useEffect(() => {
    const p: ListCiclosParams = {
      page,
      page_size: PAGE_SIZE,
      q: q || undefined,
      idioma: fIdioma as any,
      modalidad: fModalidad as any,
      turno: fTurno as any,
      nivel: fNivel as any,
    };
    fetchList(p).catch((e) => {
      console.error(e);
      toast.error(e?.message || "No se pudo cargar el catálogo de ciclos");
    });
  }, [page, q, fIdioma, fModalidad, fTurno, fNivel]);

  const refreshFirst = async () => {
    await fetchList({
      page: 1,
      page_size: PAGE_SIZE,
      q: q || undefined,
      idioma: fIdioma as any,
      modalidad: fModalidad as any,
      turno: fTurno as any,
      nivel: fNivel as any,
    });
    setPage(1);
  };

  const onInscribirme = async (c: CicloDTO) => {
    try {
      await createInscripcion({ ciclo_id: c.id });
      toast.success("Inscripción registrada 🎉");
      setOpenSheet(false);
      setSelected(null);
      await refreshFirst();
      router.push("/alumno/cursos");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "No fue posible completar la inscripción");
    }
  };

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Inscripción">
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  placeholder="Buscar por código…"
                  className="pl-9 rounded-xl h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="hidden md:inline-flex gap-1">
                  <Filter className="h-3.5 w-3.5" /> Filtros
                </Badge>

                <Select value={fIdioma} onValueChange={(v) => { setFIdioma(v); setPage(1); }}>
                  <SelectTrigger className="w-[140px] rounded-xl h-9">
                    <SelectValue placeholder="Idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingles">Inglés</SelectItem>
                    <SelectItem value="frances">Francés</SelectItem>
                    <SelectItem value="aleman">Alemán</SelectItem>
                    <SelectItem value="italiano">Italiano</SelectItem>
                    <SelectItem value="portugues">Portugués</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={fModalidad} onValueChange={(v) => { setFModalidad(v); setPage(1); }}>
                  <SelectTrigger className="w-[140px] rounded-xl h-9">
                    <SelectValue placeholder="Modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intensivo">Intensivo</SelectItem>
                    <SelectItem value="sabatino">Sabatino</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={fTurno} onValueChange={(v) => { setFTurno(v); setPage(1); }}>
                  <SelectTrigger className="w-[140px] rounded-xl h-9">
                    <SelectValue placeholder="Turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={fNivel} onValueChange={(v) => { setFNivel(v); setPage(1); }}>
                  <SelectTrigger className="w-[120px] rounded-xl h-9">
                    <SelectValue placeholder="Nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="A2">A2</SelectItem>
                    <SelectItem value="B1">B1</SelectItem>
                    <SelectItem value="B2">B2</SelectItem>
                    <SelectItem value="C1">C1</SelectItem>
                    <SelectItem value="C2">C2</SelectItem>
                  </SelectContent>
                </Select>

                {(fIdioma || fModalidad || fTurno || fNivel || q) ? (
                  <Button
                    variant="outline"
                    className="rounded-xl h-9"
                    onClick={() => { setQ(""); setFIdioma(undefined); setFModalidad(undefined); setFTurno(undefined); setFNivel(undefined); setPage(1); }}
                  >
                    Limpiar
                  </Button>
                ) : null}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Lista */}
            {items.length ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((c) => (
                    <CardCiclo key={c.id} c={c} onDetalle={() => openDetalle(c)} onInscribir={() => onInscribirme(c)} />
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    Página {data?.page} de {data?.pages} · {data?.total} resultados
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" disabled={!canNext}
                      onClick={() => setPage((p) => (data ? Math.min(data.pages, p + 1) : p + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border bg-white/70 p-6 text-sm text-neutral-600">
                {q || fIdioma || fModalidad || fTurno || fNivel ? "No hay grupos que coincidan con los filtros." : "Por el momento no hay grupos disponibles."}
              </div>
            )}
          </div>

          {/* Sheet de detalle */}
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Detalle del ciclo</SheetTitle>
                <SheetDescription>Revisa la información antes de confirmar tu inscripción.</SheetDescription>
              </SheetHeader>

              {selected && (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-xl border bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{selected.codigo}</div>
                      <Badge variant="secondary" className="rounded-full">{selected.idioma}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="rounded-full">{selected.modalidad}</Badge>
                      <Badge variant="outline" className="rounded-full">{selected.turno}</Badge>
                      {selected.nivel ? (
                        <span className="ml-1 inline-flex items-center gap-1 text-xs text-neutral-700">
                          <GraduationCap className="h-3.5 w-3.5" /> {(selected as any).nivel}
                        </span>
                      ) : null}
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-700">
                        <Users className="h-3.5 w-3.5" /> {(selected as any).cupo_total ?? 0} lugares
                      </span>
                      {(selected as any).modalidad_asistencia ? (
                        <Badge variant="secondary" className="rounded-full capitalize">
                          {(selected as any).modalidad_asistencia}
                        </Badge>
                      ) : null}
                      {(selected as any).aula ? (
                        <span className="ml-1 inline-flex items-center gap-1 text-xs text-neutral-700">
                          <Building2 className="h-3.5 w-3.5" /> {(selected as any).aula}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-y-1 text-xs text-neutral-700">
                      <div className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <b>Días:</b>&nbsp;{(((selected as any).dias ?? []) as string[]).map((x) => abreviarDia(x)).join(" • ") || "—"}
                      </div>
                      <div className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        <b>Horario:</b>&nbsp;{(selected as any).hora_inicio && (selected as any).hora_fin ? `${(selected as any).hora_inicio}–${(selected as any).hora_fin}` : "—"}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-600">
                      <div><b>Curso:</b> {d(selected.curso.from)} – {d(selected.curso.to)}</div>
                      <div><b>Colocación:</b> {d(selected.colocacion.from)} – {d(selected.colocacion.to)}</div>
                      <div><b>Inscripción:</b> {d(selected.inscripcion.from)} – {d(selected.inscripcion.to)}</div>
                      <div><b>Reinscripción:</b> {d(selected.reinscripcion.from)} – {d(selected.reinscripcion.to)}</div>
                      <div><b>Examen MT:</b> {d(selected.examenMT)}</div>
                      <div><b>Examen final:</b> {d(selected.examenFinal)}</div>
                    </div>

                    {(selected as any).notas ? (
                      <p className="mt-2 text-xs text-neutral-700">
                        <Info className="inline-block mr-1 h-3.5 w-3.5" />
                        {(selected as any).notas}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-xs text-neutral-500">
                    Al confirmar, se registrará tu inscripción para este ciclo. Si el grupo requiere validación adicional (p. ej. cupo o requisitos), se te notificará.
                  </div>
                </div>
              )}

              <SheetFooter className="mt-4">
                <Button variant="outline" onClick={() => setOpenSheet(false)}>Cancelar</Button>
                <Button onClick={() => selected && onInscribirme(selected)}>Confirmar inscripción</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}

/* ======= CardCiclo (igual que antes, se asume que lo tienes importado o en el mismo archivo) ======= */
function CardCiclo({
  c,
  onDetalle,
  onInscribir,
}: {
  c: any;
  onDetalle: () => void;
  onInscribir: () => void;
}) {
  return (
    <div className="rounded-xl border bg-white/60 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="w-full">
          <h3 className="font-medium">{c.codigo}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5 items-center">
            <Badge variant="secondary" className="rounded-full">{c.idioma}</Badge>
            <Badge variant="secondary" className="rounded-full">{c.modalidad}</Badge>
            <Badge variant="outline" className="rounded-full">{c.turno}</Badge>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-xs text-neutral-700">
            <div className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              <b>Inscripción:</b>&nbsp;{d(c.inscripcion?.from)} – {d(c.inscripcion?.to)}
            </div>
            <div className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              <b>Horario:</b>&nbsp;{c.hora_inicio && c.hora_fin ? `${c.hora_inicio}–${c.hora_fin}` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" onClick={onDetalle}>Detalle</Button>
        <Button onClick={onInscribir}>Inscribirme</Button>
      </div>
    </div>
  );
}
