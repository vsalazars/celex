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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  GraduationCap,
  Building2,
  Info,
} from "lucide-react";

// NEW: para leer el token y detectar IPN
import { getToken } from "@/lib/sessions";

/* ===== Helpers de formato ===== */

// Fecha corta: 27/ago/25
const d = (s?: string | null) => {
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

/* ===== Validaciones de archivos/importe ===== */
const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = "application/pdf,image/*";

function validarComprobante(file: File | null) {
  if (!file) return "Adjunta un archivo.";
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
    .replace(/[,$]/g, ".") // , -> .
    .replace(/(\..*)\./g, "$1"); // deja solo el primer punto decimal
  const value = Number(normalized.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100);
  }
  return null;
}

// NEW: detectar si el usuario es IPN a partir del JWT
function getIsIPNFromToken(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = token.split(".")[1];
    const jsonStr = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const claims = JSON.parse(jsonStr);

    // soporta varios nombres/tipos
    const raw =
      claims.is_ipn ?? claims.isIPN ?? claims.ipn ?? claims["custom:is_ipn"];

    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw === 1;
    if (typeof raw === "string") {
      const v = raw.trim().toLowerCase();
      return v === "true" || v === "1";
    }
    return false;
  } catch {
    return false;
  }
}

export default function AlumnoInscripcionPage() {
  const router = useRouter();

  // NEW: flag IPN para mostrar input extra
  const [isIPN, setIsIPN] = useState(false);

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
    // reset de formulario de pago/exención cada vez que abrimos
    setPaymentMode("pago");
    setReferencia("");
    setImporte("");
    setFile(null);
    setErrReferencia("");
    setErrImporte("");
    setErrFile("");

    setFileExencion(null);
    setErrFileExencion("");

    setFileEstudios(null);
    setErrFileEstudios("");

    // NEW: limpiar fecha de pago y su error
    setFechaPago("");
    setErrFechaPago("");

    setOpenSheet(true);
  };

  // === Formulario (pago o exención) ===
  const [paymentMode, setPaymentMode] = useState<"pago" | "exencion">("pago");

  // Pago
  const [referencia, setReferencia] = useState("");
  const [importe, setImporte] = useState(""); // string amigable
  const [file, setFile] = useState<File | null>(null);
  const [errReferencia, setErrReferencia] = useState("");
  const [errImporte, setErrImporte] = useState("");
  const [errFile, setErrFile] = useState("");

  // NEW: Fecha de pago (solo para pago)
  const [fechaPago, setFechaPago] = useState(""); // "YYYY-MM-DD"
  const [errFechaPago, setErrFechaPago] = useState("");

  // Exención
  const [fileExencion, setFileExencion] = useState<File | null>(null);
  const [errFileExencion, setErrFileExencion] = useState("");

  // Comprobante de estudios (solo IPN en pago)
  const [fileEstudios, setFileEstudios] = useState<File | null>(null);
  const [errFileEstudios, setErrFileEstudios] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // NEW: detectar IPN al montar
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        console.log("JWT payload:", payload);
      } catch {}
    }
    setIsIPN(getIsIPNFromToken());
  }, []);

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

  const validarFormulario = () => {
    let ok = true;

    if (paymentMode === "pago") {
      const ref = referencia.trim();
      const impCent = parseImporteToCentavos(importe);
      const eFile = validarComprobante(file);

      if (!ref) {
        setErrReferencia("Captura la referencia.");
        ok = false;
      } else setErrReferencia("");

      if (impCent === null || impCent <= 0) {
        setErrImporte("Ingresa un importe válido.");
        ok = false;
      } else setErrImporte("");

      if (eFile) {
        setErrFile(eFile);
        ok = false;
      } else setErrFile("");

      // NEW: validar fecha de pago (requerida y no futura)
      if (!fechaPago) {
        setErrFechaPago("Captura la fecha de pago.");
        ok = false;
      } else {
        const dt = new Date(fechaPago + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (Number.isNaN(dt.getTime())) {
          setErrFechaPago("La fecha no es válida.");
          ok = false;
        } else if (dt > today) {
          setErrFechaPago("La fecha no puede ser futura.");
          ok = false;
        } else {
          setErrFechaPago("");
        }
      }

      // limpia exención
      setErrFileExencion("");
    } else {
      // Exención
      const eEx = validarComprobante(fileExencion);
      if (eEx) {
        setErrFileExencion(eEx);
        ok = false;
      } else setErrFileExencion("");

      // limpia pago
      setErrReferencia("");
      setErrImporte("");
      setErrFile("");
      setErrFechaPago("");
    }

    // ✅ Solo si es PAGO y es IPN: requiere estudios
    if (paymentMode === "pago" && isIPN) {
      const eEst = validarComprobante(fileEstudios);
      if (eEst) {
        setErrFileEstudios(eEst);
        ok = false;
      } else {
        setErrFileEstudios("");
      }
    } else {
      // En EXENCIÓN o si no es IPN, no se valida ni exige estudios
      setErrFileEstudios("");
    }

    return ok;
  };

  const onInscribirme = async (c: CicloDTO) => {
    if (!validarFormulario()) return;

    // armamos payload según modo
    const base: any = { ciclo_id: c.id };

    if (paymentMode === "pago") {
      base.referencia = referencia.trim();
      base.importe_centavos = parseImporteToCentavos(importe)!;
      base.comprobante = file!;
      // NEW: incluir fecha de pago (YYYY-MM-DD)
      base.fecha_pago = fechaPago;

      // ✅ Adjuntar estudios SOLO en pago y si es IPN
      if (isIPN && fileEstudios) {
        base.comprobante_estudios = fileEstudios;
      }
    } else {
      // modo exención
      base.tipo = "exencion";
      base.comprobante_exencion = fileExencion!;
      // ❌ No adjuntar estudios en exención (sea IPN o no)
    }

    try {
      setSubmitting(true);
      await createInscripcion(base);
    } catch (err: any) {
      console.error(err);
      const msg = (err?.message || "").toLowerCase();

      if (msg.includes("estudios")) {
        toast.error("Falta el comprobante de estudios (IPN).");
      } else if (msg.includes("exención") || msg.includes("exencion")) {
        toast.error("Falta o no es válido el comprobante de exención.");
      } else if (msg.includes("no hay lugares disponibles")) {
        toast.warning("No hay lugares disponibles en este grupo");
      } else if (msg.includes("periodo de inscripción")) {
        toast.warning("El periodo de inscripción no está vigente");
      } else if (msg.includes("ya estás inscrito")) {
        toast.info("Ya estabas inscrito en este ciclo");
      } else if (msg.includes("archivo")) {
        toast.error("El archivo no es válido o excede el tamaño permitido");
      } else if (msg.includes("fecha") && msg.includes("pago")) {
        toast.error("Revisa la fecha de pago.");
      } else {
        toast.error(err?.message || "No fue posible completar la inscripción");
      }
      setSubmitting(false);
      return;
    }

    toast.success(
      paymentMode === "pago"
        ? "¡Listo! Quedaste preinscrito. Validaremos tu pago en breve."
        : "¡Listo! Registramos tu solicitud de exención. La revisaremos en breve."
    );
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
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por código…"
                  className="pl-9 rounded-xl h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="hidden md:inline-flex gap-1">
                  <Filter className="h-3.5 w-3.5" /> Filtros
                </Badge>

                <Select
                  value={fIdioma}
                  onValueChange={(v) => {
                    setFIdioma(v);
                    setPage(1);
                  }}
                >
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

                <Select
                  value={fModalidad}
                  onValueChange={(v) => {
                    setFModalidad(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px] rounded-xl h-9">
                    <SelectValue placeholder="Modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intensivo">Intensivo</SelectItem>
                    <SelectItem value="sabatino">Sabatino</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={fTurno}
                  onValueChange={(v) => {
                    setFTurno(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px] rounded-xl h-9">
                    <SelectValue placeholder="Turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={fNivel}
                  onValueChange={(v) => {
                    setFNivel(v);
                    setPage(1);
                  }}
                >
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

                {fIdioma || fModalidad || fTurno || fNivel || q ? (
                  <Button
                    variant="outline"
                    className="rounded-xl h-9"
                    onClick={() => {
                      setQ("");
                      setFIdioma(undefined);
                      setFModalidad(undefined);
                      setFTurno(undefined);
                      setFNivel(undefined);
                      setPage(1);
                    }}
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
                      onClick={() =>
                        setPage((p) => (data ? Math.min(data.pages, p + 1) : p + 1))
                      }
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

          {/* Sheet de detalle + formulario (pago/exención) */}
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetContent className="w-full sm:max-w-6xl mx-4 sm:mx-auto px-4 sm:px-6">
              <SheetHeader className="pb-2">
                <SheetTitle>Detalle del ciclo</SheetTitle>
                <SheetDescription>
                  Elige el tipo de trámite y carga el documento correspondiente.
                </SheetDescription>
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
                      <Badge
                        className={`rounded-full border shrink-0 ${selTone.badgeClass}`}
                      >
                        <Users className="mr-1 h-3.5 w-3.5" />
                        {selDisp}/{selTotal}
                      </Badge>
                    </div>

                    {/* KPI barra compacta */}
                    <div className="mt-2">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`text-2xl font-bold leading-none ${selTone.textClass}`}
                        >
                          {selDisp}
                        </span>
                        <span className="text-xs text-neutral-500">
                          de {selTotal} lugares
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className={`h-1.5 ${selTone.barClass}`}
                          style={{
                            width: `${
                              selTotal
                                ? Math.round(
                                    Math.max(0, Math.min(1, selDisp / selTotal)) * 100
                                  )
                                : 0
                            }%`,
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
                      <div>
                        <b>Días:</b>{" "}
                        {(selected.dias ?? []).map(abreviarDia).join(" • ")}
                      </div>
                      <div>
                        <b>Horario:</b>{" "}
                        {selected.hora_inicio?.slice(0, 5)}–
                        {selected.hora_fin?.slice(0, 5)}
                      </div>
                      <div>
                        <b>Inscripción:</b> {d(selected.inscripcion?.from)} –{" "}
                        {d(selected.inscripcion?.to)}
                      </div>
                      <div>
                        <b>Curso:</b> {d(selected.curso?.from)} –{" "}
                        {d(selected.curso?.to)}
                      </div>
                      <div>
                        <b>Examen MT:</b> {d(selected.examenMT)}
                      </div>
                      <div>
                        <b>Examen final:</b> {d(selected.examenFinal)}
                      </div>
                    </div>

                    {selected.notas ? (
                      <p className="mt-2 text-[12px] text-neutral-700">
                        <Info className="inline-block mr-1 h-3.5 w-3.5" />
                        {selected.notas}
                      </p>
                    ) : null}
                  </div>

                  {/* === Columna derecha: Formulario (pago o exención) === */}
                  <div className="rounded-2xl border bg-white p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Trámite</h4>
                      <span className="text-[11px] text-neutral-500">
                        PDF/JPG/PNG/WEBP · máx. {MAX_MB} MB
                      </span>
                    </div>

                    {/* Tipo de trámite */}
                    <div className="mt-2">
                      <RadioGroup
                        value={paymentMode}
                        onValueChange={(v) => {
                          const mode = v as "pago" | "exencion";
                          setPaymentMode(mode);
                          // limpiar errores y datos al cambiar
                          setErrReferencia("");
                          setErrImporte("");
                          setErrFile("");
                          setErrFileExencion("");
                          setErrFileEstudios("");
                          if (mode === "exencion") {
                            // en exención no se usa estudios: limpiar
                            setFileEstudios(null);
                            // NEW: limpiar fecha de pago si se cambia a exención
                            setFechaPago("");
                            setErrFechaPago("");
                          }
                        }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                      >
                        <Label className="border rounded-xl p-2.5 flex items-center gap-2 cursor-pointer">
                          <RadioGroupItem value="pago" id="mode-pago" />
                          Pago con comprobante
                        </Label>
                        <Label className="border rounded-xl p-2.5 flex items-center gap-2 cursor-pointer">
                          <RadioGroupItem value="exencion" id="mode-exencion" />
                          Exención de pago
                        </Label>
                      </RadioGroup>
                    </div>

                    {/* Inputs según modo */}
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {paymentMode === "pago" ? (
                        <>
                          {/* Referencia + Importe + Fecha de pago */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* NEW: Fecha de pago */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Fecha de pago</Label>
                                {errFechaPago ? (
                                  <span className="text-[11px] text-red-600">
                                    {errFechaPago}
                                  </span>
                                ) : null}
                              </div>
                              <Input
                                type="date"
                                value={fechaPago}
                                onChange={(e) => setFechaPago(e.target.value)}
                                className="h-9"
                                max={new Date().toISOString().slice(0, 10)}
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Referencia</Label>
                                {errReferencia ? (
                                  <span className="text-[11px] text-red-600">
                                    {errReferencia}
                                  </span>
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
                                  <span className="text-[11px] text-red-600">
                                    {errImporte}
                                  </span>
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

                          {/* Comprobante de pago */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">
                                Comprobante de pago (PDF o imagen)
                              </Label>
                              {errFile ? (
                                <span className="text-[11px] text-red-600">
                                  {errFile}
                                </span>
                              ) : null}
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
                                <b>{file.name}</b> ·{" "}
                                {(file.size / 1024).toFixed(0)} KB
                              </p>
                            ) : null}
                          </div>

                          {/* Comprobante de estudios (solo en PAGO y solo si es IPN) */}
                          {isIPN && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">
                                  Comprobante de estudios (PDF o imagen)
                                </Label>
                                {errFileEstudios ? (
                                  <span className="text-[11px] text-red-600">
                                    {errFileEstudios}
                                  </span>
                                ) : null}
                              </div>
                              <Input
                                type="file"
                                accept={ACCEPT}
                                className="h-9"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  setFileEstudios(f);
                                  setErrFileEstudios(validarComprobante(f));
                                }}
                              />
                              {fileEstudios ? (
                                <p className="text-[11px] text-neutral-600">
                                  <b>{fileEstudios.name}</b> ·{" "}
                                  {(fileEstudios.size / 1024).toFixed(0)} KB
                                </p>
                              ) : null}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Comprobante de exención */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">
                                Comprobante de exención (PDF o imagen)
                              </Label>
                              {errFileExencion ? (
                                <span className="text-[11px] text-red-600">
                                  {errFileExencion}
                                </span>
                              ) : null}
                            </div>
                            <Input
                              type="file"
                              accept={ACCEPT}
                              className="h-9"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setFileExencion(f);
                                setErrFileExencion(validarComprobante(f));
                              }}
                            />
                            {fileExencion ? (
                              <p className="text-[11px] text-neutral-600">
                                <b>{fileExencion.name}</b> ·{" "}
                                {(fileExencion.size / 1024).toFixed(0)} KB
                              </p>
                            ) : null}
                          </div>
                          {/* ❌ No mostrar estudios en exención */}
                        </>
                      )}

                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[12px] text-amber-800">
                        {paymentMode === "pago" ? (
                          <>
                            Tu estatus quedará <b>preinscrita</b> hasta que
                            coordinación valide tu pago.
                          </>
                        ) : (
                          <>
                            Tu estatus quedará <b>en revisión de exención</b>{" "}
                            hasta que coordinación valide tu documento.
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <SheetFooter className="mt-3">
                <Button
                  variant="outline"
                  onClick={() => setOpenSheet(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => selected && onInscribirme(selected)}
                  disabled={selSinLugares || submitting}
                >
                  {selSinLugares
                    ? "Sin lugares"
                    : submitting
                    ? "Enviando…"
                    : paymentMode === "pago"
                    ? "Enviar comprobante y preinscribirme"
                    : "Enviar exención"}
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
        <div>
          <b>Inscripción:</b> {d(c.inscripcion?.from)} – {d(c.inscripcion?.to)}
        </div>
        <div>
          <b>Horario:</b> {h(c.hora_inicio)}-{h(c.hora_fin)}
        </div>
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
        <Button variant="outline" onClick={onDetalle}>
          Detalle
        </Button>
        <Button
          onClick={onInscribir}
          disabled={sinLugares}
          title={sinLugares ? "Sin lugares disponibles" : undefined}
        >
          {sinLugares ? "Sin lugares" : "Inscribirme"}
        </Button>
      </div>
    </div>
  );
}
