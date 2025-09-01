"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import { toast } from "sonner";
import { listCiclosAlumno, createInscripcion } from "@/lib/api";
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

/* ===== Helpers de formato ===== */

// Fecha corta: 27/ago/25
const d = (s?: string) => {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  const day = dt.toLocaleString("es-MX", { day: "2-digit" });
  const month = dt.toLocaleString("es-MX", { month: "short" }).replace(".", "");
  const year = dt.toLocaleString("es-MX", { year: "2-digit" });
  return `${day}/${month}/${year}`;
};

// Hora: "HH:MM:SS" -> "HH:MM"
const h = (t?: string | null) => (t ? t.slice(0, 5) : "—");

// Abreviar día
const abreviarDia = (key: string) =>
  ({ lunes:"Lun", martes:"Mar", miercoles:"Mié", jueves:"Jue", viernes:"Vie", sabado:"Sáb", domingo:"Dom" } as Record<string,string>)[key] ?? key;

/* ===== Enfatizar capacidad ===== */

function capTone(disp: number) {
  if (disp <= 0) {
    return {
      label: "Sin lugares",
      badgeClass: "bg-red-100 text-red-800 border-red-200",
      barClass: "bg-red-500",
      textClass: "text-red-700",
    };
  }
  if (disp <= 5) {
    return {
      label: "Últimos lugares",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
      barClass: "bg-amber-500",
      textClass: "text-amber-700",
    };
  }
  return {
    label: "Disponible",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    barClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  };
}

function capPercent(disp: number, total: number) {
  const pct = total > 0 ? Math.max(0, Math.min(1, disp / total)) : 0;
  return Math.round(pct * 100);
}

/* ===== Validaciones del pago ===== */
const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = "application/pdf,image/*";

function validarComprobante(file: File | null) {
  if (!file) return "Adjunta tu comprobante.";
  if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
    return "Solo PDF o imágenes.";
  }
  if (file.size > MAX_BYTES) {
    return `El archivo no debe exceder ${MAX_MB} MB.`;
  }
  return "";
}

function parseImporteToCentavos(importeStr: string): number | null {
  // Acepta "1,234.56" o "1234,56" o "1234.56" o "1234"
  const normalized = importeStr
    .replace(/\s/g, "")
    .replace(/[,$]/g, ".")               // , -> .
    .replace(/(\..*)\./g, "$1");         // deja solo el primer punto decimal
  const value = Number(normalized.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100);
  }
  return null;
}

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
  const openDetalle = (c: CicloDTO) => { 
    setSelected(c); 
    // reset de formulario de pago cada vez que abrimos
    setReferencia("");
    setImporte("");
    setFile(null);
    setErrReferencia("");
    setErrImporte("");
    setErrFile("");
    setOpenSheet(true); 
  };

  // Formulario de pago
  const [referencia, setReferencia] = useState("");
  const [importe, setImporte] = useState(""); // string amigable, lo convertimos a centavos
  const [file, setFile] = useState<File | null>(null);
  const [errReferencia, setErrReferencia] = useState("");
  const [errImporte, setErrImporte] = useState("");
  const [errFile, setErrFile] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchList(params: ListCiclosParams) {
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

  const validarFormularioPago = () => {
    let ok = true;

    const ref = referencia.trim();
    const impCent = parseImporteToCentavos(importe);
    const eFile = validarComprobante(file);

    if (!ref) { setErrReferencia("Captura la referencia."); ok = false; } else { setErrReferencia(""); }
    if (impCent === null || impCent <= 0) { setErrImporte("Ingresa un importe válido."); ok = false; } else { setErrImporte(""); }
    if (eFile) { setErrFile(eFile); ok = false; } else { setErrFile(""); }

    return ok;
  };

  const onInscribirme = async (c: CicloDTO) => {
    if (!validarFormularioPago()) return;

    const importe_centavos = parseImporteToCentavos(importe)!;

    try {
      setSubmitting(true);
      await createInscripcion({
        ciclo_id: c.id,
        referencia: referencia.trim(),
        importe_centavos,
        comprobante: file!, // validado arriba
      });
    } catch (err: any) {
      console.error(err);
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("no hay lugares disponibles")) {
        toast.warning("No hay lugares disponibles en este grupo");
      } else if (msg.includes("periodo de inscripción")) {
        toast.warning("El periodo de inscripción no está vigente");
      } else if (msg.includes("ya estás inscrito")) {
        toast.info("Ya estabas inscrito en este ciclo");
      } else if (msg.includes("archivo")) {
        toast.error("El archivo no es válido o excede el tamaño permitido");
      } else {
        toast.error(err?.message || "No fue posible completar la inscripción");
      }
      setSubmitting(false);
      return;
    }

    toast.success("¡Listo! Quedaste preinscrito. Validaremos tu pago en breve.");
    setOpenSheet(false);
    setSelected(null);
    setSubmitting(false);
    await refreshFirst();
    router.push("/alumno/cursos");
  };

  const selDisp = selected?.lugares_disponibles ?? 0;
  const selTotal = selected?.cupo_total ?? 0;
  const selTone = capTone(selDisp);
  const selSinLugares = selDisp <= 0;

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
                    <CardCiclo
                      key={c.id}
                      c={c as CicloDTO}
                      onDetalle={() => openDetalle(c as CicloDTO)}
                      onInscribir={() => openDetalle(c as CicloDTO)} // abre detalle (con formulario)
                    />
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    Página {data?.page} de {data?.pages} · {data?.total} resultados
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      disabled={!canPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      disabled={!canNext}
                      onClick={() => setPage((p) => (data ? Math.min(data.pages, p + 1) : p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border bg-white/70 p-6 text-sm text-neutral-600">
                {q || fIdioma || fModalidad || fTurno || fNivel
                  ? "No hay grupos que coincidan con los filtros."
                  : "Por el momento no hay grupos disponibles."}
              </div>
            )}
          </div>

         {/* Sheet de detalle + pago (compacto, 2 columnas en sm+) */}
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetContent className="w-full sm:max-w-6xl mx-4 sm:mx-auto px-4 sm:px-6">
              <SheetHeader className="pb-2">
                <SheetTitle>Detalle del ciclo</SheetTitle>
                <SheetDescription>Revisa la información y carga tu comprobante de pago.</SheetDescription>
              </SheetHeader>

              {selected && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {/* === Columna izquierda: Detalle === */}
                  <div className="rounded-2xl border bg-white p-3">
                    {/* Encabezado + KPI en la misma franja */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{selected.codigo}</div>
                        <div className="mt-0.5 text-[12px] text-neutral-600">
                          {selected.idioma} · {selected.modalidad} · {selected.turno}
                        </div>
                      </div>
                      <Badge className={`rounded-full border shrink-0 ${selTone.badgeClass}`}>
                        <Users className="mr-1 h-3.5 w-3.5" />
                        {selDisp}/{selTotal}
                      </Badge>
                    </div>

                    {/* KPI barra compacta */}
                    <div className="mt-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-2xl font-bold leading-none ${selTone.textClass}`}>{selDisp}</span>
                        <span className="text-xs text-neutral-500">de {selTotal} lugares</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className={`h-1.5 ${selTone.barClass}`}
                          style={{
                            width: `${Math.round(
                              (selTotal ? Math.max(0, Math.min(1, selDisp / selTotal)) : 0) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Chips */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{selected.modalidad}</Badge>
                      <Badge variant="outline">{selected.turno}</Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                        <GraduationCap className="h-3.5 w-3.5" /> {selected.nivel}
                      </span>
                      {selected.modalidad_asistencia ? (
                        <Badge variant="secondary" className="rounded-full capitalize">
                          {selected.modalidad_asistencia}
                        </Badge>
                      ) : null}
                      {selected.aula ? (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                          <Building2 className="h-3.5 w-3.5" /> {selected.aula}
                        </span>
                      ) : null}
                    </div>

                    {/* Fechas y horarios en grid compacto */}
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-neutral-700">
                      <div><b>Días:</b> {(selected.dias ?? []).map(abreviarDia).join(" • ")}</div>
                      <div><b>Horario:</b> {selected.hora_inicio?.slice(0, 5)}–{selected.hora_fin?.slice(0, 5)}</div>
                      <div><b>Inscripción:</b> {d(selected.inscripcion.from)} – {d(selected.inscripcion.to)}</div>
                      <div><b>Curso:</b> {d(selected.curso.from)} – {d(selected.curso.to)}</div>
                      <div><b>Examen MT:</b> {d(selected.examenMT)}</div>
                      <div><b>Examen final:</b> {d(selected.examenFinal)}</div>
                    </div>

                    {selected.notas ? (
                      <p className="mt-2 text-[12px] text-neutral-700">
                        <Info className="inline-block mr-1 h-3.5 w-3.5" />
                        {selected.notas}
                      </p>
                    ) : null}
                  </div>

                  {/* === Columna derecha: Formulario pago === */}
                  <div className="rounded-2xl border bg-white p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Comprobante de pago</h4>
                      <span className="text-[11px] text-neutral-500">PDF/JPG/PNG/WEBP · máx. {MAX_MB} MB</span>
                    </div>

                    {/* Inputs en grid para ahorrar espacio */}
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {/* Referencia + Importe en 2 col en sm+ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Referencia</Label>
                            {errReferencia ? (
                              <span className="text-[11px] text-red-600">{errReferencia}</span>
                            ) : null}
                          </div>
                          <Input
                            placeholder="Ej. 123456/ABC"
                            value={referencia}
                            onChange={(e) => setReferencia(e.target.value)}
                            className="h-9"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Importe pagado</Label>
                            {errImporte ? (
                              <span className="text-[11px] text-red-600">{errImporte}</span>
                            ) : null}
                          </div>
                          <Input
                            placeholder="Ej. 1,250.00"
                            inputMode="decimal"
                            value={importe}
                            onChange={(e) => setImporte(e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Comprobante (PDF o imagen)</Label>
                          {errFile ? <span className="text-[11px] text-red-600">{errFile}</span> : null}
                        </div>
                        <Input
                          type="file"
                          accept={ACCEPT}
                          className="h-9"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setFile(f);
                            setErrFile(validarComprobante(f));
                          }}
                        />
                        {file ? (
                          <p className="text-[11px] text-neutral-600">
                            <b>{file.name}</b> · {(file.size / 1024).toFixed(0)} KB
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[12px] text-amber-800">
                        Tu estatus quedará <b>preinscrita</b> hasta que coordinación valide tu pago.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <SheetFooter className="mt-3">
                <Button variant="outline" onClick={() => setOpenSheet(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => selected && onInscribirme(selected)}
                  disabled={selSinLugares || submitting}
                >
                  {selSinLugares ? "Sin lugares" : (submitting ? "Enviando…" : "Enviar comprobante y preinscribirme")}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}

/* ======= CardCiclo ======= */
function CardCiclo({
  c,
  onDetalle,
  onInscribir,
}: {
  c: CicloDTO;
  onDetalle: () => void;
  onInscribir: () => void;
}) {
  const disp = c.lugares_disponibles ?? 0;
  const total = c.cupo_total ?? 0;
  const tone = capTone(disp);
  const sinLugares = disp <= 0;
  const pct = capPercent(disp, total);

  return (
    <div className="rounded-xl border bg-white/60 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{c.codigo}</h3>
        <Badge className={`rounded-full border ${tone.badgeClass}`}>
          <Users className="mr-1 h-3.5 w-3.5" />
          {disp} / {total} · {tone.label}
        </Badge>
      </div>

      <div className="mt-1 flex flex-wrap gap-1.5 items-center">
        <Badge variant="secondary">{c.idioma}</Badge>
        <Badge variant="secondary">{c.modalidad}</Badge>
        <Badge variant="outline">{c.turno}</Badge>
      </div>

      <div className="mt-2 text-xs text-neutral-700 space-y-1">
        <div><b>Inscripción:</b> {d(c.inscripcion?.from)} – {d(c.inscripcion?.to)}</div>
        <div><b>Horario:</b> {h(c.hora_inicio)}-{h(c.hora_fin)}</div>
      </div>

      {/* Barrita de capacidad */}
      <div className="mt-2 h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-2 ${tone.barClass}`}
          style={{ width: `${pct}%` }}
          aria-label={`Capacidad ${pct}%`}
        />
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" onClick={onDetalle}>Detalle</Button>
        <Button onClick={onInscribir} disabled={sinLugares} title={sinLugares ? "Sin lugares disponibles" : undefined}>
          {sinLugares ? "Sin lugares" : "Inscribirme"}
        </Button>
      </div>
    </div>
  );
}
