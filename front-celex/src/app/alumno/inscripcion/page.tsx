"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import { toast } from "sonner";
import {
  listCiclosAlumno,
  createInscripcion,
  listMisInscripciones,
} from "@/lib/api";
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
  Users,
  Info,
} from "lucide-react";


// NEW: para leer el token y detectar IPN
import { getToken } from "@/lib/sessions";

/* ===== Constantes ===== */
const CLEAR = "__CLEAR__"; // 👈 sentinela para “Todos” en los SelectItem (Radix no permite "")

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
  const normalized = importeStr
    .replace(/\s/g, "")
    .replace(/[,$]/g, ".")
    .replace(/(\..*)\./g, "$1");
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

/* ===== Helpers responsive & debounce ===== */
type Filters = {
  idioma: string; // "" = sin filtro
  modalidad: string;
  turno: string;
  nivel: string;
};

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(max-width:${breakpoint - 1}px)`);
    const handler = () => setIsMobile(m.matches);
    handler();
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, [breakpoint]);
  return isMobile;
}

const ACTIVE = new Set(["registrada", "preinscrita", "confirmada"]);
type SheetMode = "detalle" | "tramite";

export default function AlumnoInscripcionPage() {
  const router = useRouter();

  const [isIPN, setIsIPN] = useState(false);

  // Filtros / lista
  const PAGE_SIZE = 8;
  const [q, setQ] = useState("");
  const qDebounced = useDebounced(q, 400);

  // Objeto de filtros (siempre controlado)
  const [filters, setFilters] = useState<Filters>({
    idioma: "",
    modalidad: "",
    turno: "",
    nivel: "",
  });

  // Borrador + sheet para móvil
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<Filters>(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [data, setData] = useState<CicloListResponse | null>(null);
  const items = data?.items ?? [];
  const canPrev = (data?.page ?? 1) > 1;
  const canNext = !!data && data.page < data.pages;

  // Mis inscripciones activas
  const [misInscripciones, setMisInscripciones] = useState<any[]>([]);
  const ciclosActivos = useMemo(() => {
    return new Set(
      (misInscripciones || [])
        .filter((i) => ACTIVE.has(i.status))
        .map((i) => i.ciclo_id)
    );
  }, [misInscripciones]);

  // Sheet control (detalle/trámite)
  const [openSheet, setOpenSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("detalle");
  const [selected, setSelected] = useState<CicloDTO | null>(null);

  const openDetalle = (c: CicloDTO) => {
    setSelected(c);
    setSheetMode("detalle");
    setOpenSheet(true);
  };

  const openTramite = (c: CicloDTO) => {
    setSelected(c);
    setSheetMode("tramite");
    // reset form
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

    setFechaPago("");
    setErrFechaPago("");

    setOpenSheet(true);
  };

  // Formulario
  const [paymentMode, setPaymentMode] = useState<"pago" | "exencion">("pago");
  const [referencia, setReferencia] = useState("");
  const [importe, setImporte] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errReferencia, setErrReferencia] = useState("");
  const [errImporte, setErrImporte] = useState("");
  const [errFile, setErrFile] = useState("");

  const [fechaPago, setFechaPago] = useState("");
  const [errFechaPago, setErrFechaPago] = useState("");

  const [fileExencion, setFileExencion] = useState<File | null>(null);
  const [errFileExencion, setErrFileExencion] = useState("");

  const [fileEstudios, setFileEstudios] = useState<File | null>(null);
  const [errFileEstudios, setErrFileEstudios] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // load
  useEffect(() => {
    setIsIPN(getIsIPNFromToken());
    listMisInscripciones()
      .then(setMisInscripciones)
      .catch(() => {});
  }, []);

  async function fetchList(params: ListCiclosParams) {
    const resp = await listCiclosAlumno({
      ...params,
      solo_abiertos: true,
    } as any);
    setData(resp);
  }

  // Efecto de carga con debounce y objeto de filtros
  useEffect(() => {
    const p: ListCiclosParams = {
      page,
      page_size: PAGE_SIZE,
      q: qDebounced || undefined,
      idioma: filters.idioma || undefined,
      modalidad: filters.modalidad || undefined,
      turno: filters.turno || undefined,
      nivel: filters.nivel || undefined,
    };
    fetchList(p).catch((e) => {
      console.error(e);
      toast.error(e?.message || "No se pudo cargar el catálogo de ciclos");
    });
  }, [page, qDebounced, filters]);

  const refreshFirst = async () => {
    await fetchList({
      page: 1,
      page_size: PAGE_SIZE,
      q: qDebounced || undefined,
      idioma: filters.idioma || undefined,
      modalidad: filters.modalidad || undefined,
      turno: filters.turno || undefined,
      nivel: filters.nivel || undefined,
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

      setErrFileExencion("");
    } else {
      const eEx = validarComprobante(fileExencion);
      if (eEx) {
        setErrFileExencion(eEx);
        ok = false;
      } else setErrFileExencion("");

      setErrReferencia("");
      setErrImporte("");
      setErrFile("");
      setErrFechaPago("");
    }

    if (paymentMode === "pago" && isIPN) {
      const eEst = validarComprobante(fileEstudios);
      if (eEst) {
        setErrFileEstudios(eEst);
        ok = false;
      } else {
        setErrFileEstudios("");
      }
    } else {
      setErrFileEstudios("");
    }

    return ok;
  };

  const onInscribirme = async (c: CicloDTO) => {
    if (!validarFormulario()) return;

    if (ciclosActivos.has(c.id)) {
      toast.info("Ya tienes una inscripción activa en este grupo.");
      setOpenSheet(false);
      setSelected(null);
      router.push("/alumno/cursos");
      return;
    }

    const base: any = { ciclo_id: c.id };

    if (paymentMode === "pago") {
      base.referencia = referencia.trim();
      base.importe_centavos = parseImporteToCentavos(importe)!;
      base.comprobante = file!;
      base.fecha_pago = fechaPago;

      if (isIPN && fileEstudios) {
        base.comprobante_estudios = fileEstudios;
      }
    } else {
      base.tipo = "exencion";
      base.comprobante_exencion = fileExencion!;
    }

    try {
      setSubmitting(true);
      const res = await createInscripcion(base);

      if ((res as any)?.already_exists) {
        toast.info("Ya tienes una inscripción activa en este grupo.");
        try {
          const mine = await listMisInscripciones();
          setMisInscripciones(mine || []);
        } catch {}
        setOpenSheet(false);
        setSelected(null);
        setSubmitting(false);
        router.push("/alumno/cursos");
        return;
      }
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

    try {
      const mine = await listMisInscripciones();
      setMisInscripciones(mine || []);
    } catch {}

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
  const selYaActiva = selected ? ciclosActivos.has(selected.id) : false;

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Inscripción">
        <div className="space-y-4 px-3 sm:px-4 md:px-6">
          {/* Toolbar responsive */}
          <div className="rounded-2xl border bg-white p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2">
              {/* Buscar */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por código…"
                  className="pl-9 rounded-xl h-9 w-full"
                />
              </div>

              {/* Desktop: filtros inline */}
              <div className="hidden sm:flex items-center gap-2">
                <Badge variant="secondary" className="inline-flex items-center gap-1 shrink-0">
                  <Filter className="h-3.5 w-3.5" /> Filtros
                </Badge>

                <Select
                  value={filters.idioma || ""}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, idioma: v === CLEAR ? "" : v }))
                  }
                >
                  <SelectTrigger className="w-[120px] h-9 rounded-xl shrink-0">
                    <SelectValue placeholder="Idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR}>Todos</SelectItem>
                    <SelectItem value="ingles">Inglés</SelectItem>
                    <SelectItem value="frances">Francés</SelectItem>
                    <SelectItem value="aleman">Alemán</SelectItem>
                    <SelectItem value="italiano">Italiano</SelectItem>
                    <SelectItem value="portugues">Portugués</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.modalidad || ""}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, modalidad: v === CLEAR ? "" : v }))
                  }
                >
                  <SelectTrigger className="w-[120px] h-9 rounded-xl shrink-0">
                    <SelectValue placeholder="Modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR}>Todas</SelectItem>
                    <SelectItem value="intensivo">Intensivo</SelectItem>
                    <SelectItem value="sabatino">Sabatino</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.turno || ""}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, turno: v === CLEAR ? "" : v }))
                  }
                >
                  <SelectTrigger className="w-[110px] h-9 rounded-xl shrink-0">
                    <SelectValue placeholder="Turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR}>Todos</SelectItem>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                  </SelectContent>
                </Select>

                {/* Nivel — valores EXACTOS del backend */}
                <Select
                  value={filters.nivel || ""}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, nivel: v === CLEAR ? "" : v }))
                  }
                >
                  <SelectTrigger className="w-[140px] h-9 rounded-xl shrink-0">
                    <SelectValue placeholder="Nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR}>Todos</SelectItem>
                    <SelectItem value="Introductorio">Introductorio</SelectItem>
                    <SelectItem value="Básico 1">Básico 1</SelectItem>
                    <SelectItem value="Básico 2">Básico 2</SelectItem>
                    <SelectItem value="Básico 3">Básico 3</SelectItem>
                    <SelectItem value="Básico 4">Básico 4</SelectItem>
                    <SelectItem value="Básico 5">Básico 5</SelectItem>
                    <SelectItem value="Intermedio 1">Intermedio 1</SelectItem>
                    <SelectItem value="Intermedio 2">Intermedio 2</SelectItem>
                    <SelectItem value="Intermedio 3">Intermedio 3</SelectItem>
                    <SelectItem value="Intermedio 4">Intermedio 4</SelectItem>
                    <SelectItem value="Intermedio 5">Intermedio 5</SelectItem>
                    <SelectItem value="Avanzado 1">Avanzado 1</SelectItem>
                    <SelectItem value="Avanzado 2">Avanzado 2</SelectItem>
                    <SelectItem value="Avanzado 3">Avanzado 3</SelectItem>
                    <SelectItem value="Avanzado 4">Avanzado 4</SelectItem>
                    <SelectItem value="Avanzado 5">Avanzado 5</SelectItem>
                    <SelectItem value="Avanzado 6">Avanzado 6</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile: botón Filtros */}
              <Button
                variant="outline"
                className="sm:hidden h-9 rounded-xl shrink-0"
                onClick={() => {
                  setDraft(filters); // inicia borrador desde filtros actuales
                  setFiltersOpen(true);
                }}
              >
                <Filter className="h-4 w-4 mr-1" /> Filtros
              </Button>

              {/* Limpiar (si hay algo aplicado) */}
              {(filters.idioma || filters.modalidad || filters.turno || filters.nivel || q) && (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl shrink-0"
                  onClick={() => {
                    setQ("");
                    setFilters({ idioma: "", modalidad: "", turno: "", nivel: "" });
                    setPage(1);
                  }}
                >
                  Limpiar
                </Button>
              )}
            </div>

            {/* Chips resumen (si hay filtros) */}
            {(filters.idioma || filters.modalidad || filters.turno || filters.nivel) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {filters.idioma && (
                  <Badge variant="secondary" className="rounded-full">
                    Idioma: {filters.idioma}
                  </Badge>
                )}
                {filters.modalidad && (
                  <Badge variant="secondary" className="rounded-full">
                    Modalidad: {filters.modalidad}
                  </Badge>
                )}
                {filters.turno && (
                  <Badge variant="secondary" className="rounded-full">
                    Turno: {filters.turno}
                  </Badge>
                )}
                {filters.nivel && (
                  <Badge variant="secondary" className="rounded-full">
                    Nivel: {filters.nivel}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Separator className="my-3 sm:my-4" />

          {/* Lista */}
          {items.length ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((c) => (
                  <CardCiclo
                    key={c.id}
                    c={c as CicloDTO}
                    onDetalle={() => openDetalle(c as CicloDTO)}
                    onInscribir={() => openTramite(c as CicloDTO)}
                    yaActiva={ciclosActivos.has(c.id)}
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
                    className="group h-9 w-9 rounded-xl hover:bg-[#7c0040]/5 focus-visible:ring-[#7c0040]"
                    disabled={!canPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4 text-[#7c0040] group-disabled:text-neutral-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="group h-9 w-9 rounded-xl hover:bg-[#7c0040]/5 focus-visible:ring-[#7c0040]"
                    disabled={!canNext}
                    onClick={() =>
                      setPage((p) => (data ? Math.min(data.pages, p + 1) : p + 1))
                    }
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4 text-[#7c0040] group-disabled:text-neutral-300" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border bg-white/70 p-6 text-sm text-neutral-600">
              {q || filters.idioma || filters.modalidad || filters.turno || filters.nivel
                ? "No hay grupos que coincidan con los filtros."
                : "Por el momento no hay grupos disponibles."}
            </div>
          )}

          {/* Sheet — SOLO Detalle o SOLO Trámite */}
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetContent
              className="w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto p-0 flex flex-col max-h-[100dvh] overscroll-contain"
            >
              {/* HEADER sticky */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-3 sm:px-5 py-3">
                <SheetHeader className="pb-0">
                  <SheetTitle>
                    {sheetMode === "detalle" ? "Detalle del ciclo" : "Trámite de inscripción"}
                  </SheetTitle>
                  <SheetDescription>
                    {sheetMode === "detalle"
                      ? "Información del grupo seleccionado."
                      : "Elige el tipo de trámite y carga el documento correspondiente."}
                  </SheetDescription>
                </SheetHeader>
              </div>

              {/* BODY scrollable */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4">
                {selected && (
                  <div className="space-y-3">
                    {/* === SOLO DETALLE === */}
                    {sheetMode === "detalle" && (
                      <div className="rounded-2xl border bg-white p-3 sm:p-4">
                        {/* Encabezado + KPI */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{selected.codigo}</div>
                            <div className="mt-0.5 text-[12px] text-neutral-600">
                              Grupo abierto · capacidad
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
                            <span className={`text-2xl font-bold leading-none ${selTone.textClass}`}>
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
                          {selected.idioma ? (
                            <Badge className="rounded-full px-3 py-1 bg-[#7c0040] text-white border-[#7c0040] capitalize">
                              {selected.idioma}
                            </Badge>
                          ) : null}
                          {selected.nivel ? (
                            <Badge className="rounded-full px-3 py-1 bg-[#7c0040] text-white border-[#7c0040] capitalize">
                              {selected.nivel}
                            </Badge>
                          ) : null}
                          {selected.modalidad ? (
                            <Badge className="rounded-full px-3 py-1 bg-[#7c0040] text-white border-[#7c0040] capitalize">
                              {selected.modalidad}
                            </Badge>
                          ) : null}
                          {selected.turno ? (
                            <Badge className="rounded-full px-3 py-1 bg-[#7c0040] text-white border-[#7c0040] capitalize">
                              {selected.turno}
                            </Badge>
                          ) : null}
                          {selected.modalidad_asistencia ? (
                            <Badge variant="secondary" className="rounded-full capitalize">
                              {selected.modalidad_asistencia}
                            </Badge>
                          ) : null}
                          {selected.aula ? (
                            <span className="inline-flex items-center gap-1 text-xs text-neutral-700">
                              {selected.aula}
                            </span>
                          ) : null}
                        </div>

                        {/* Fechas y horarios */}
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-neutral-700">
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
                    )}

                    {/* === SOLO TRÁMITE === */}
                    {sheetMode === "tramite" && (
                      <div className="rounded-2xl border bg-white p-3 sm:p-4">
                        {/* Header mini del ciclo (contexto) */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{selected.codigo}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {selected.idioma ? (
                                <Badge className="rounded-full px-2.5 py-0.5 bg-[#7c0040] text-white border-[#7c0040] capitalize">
                                  {selected.idioma}
                                </Badge>
                              ) : null}
                              {selected.nivel ? (
                                <Badge className="rounded-full px-2.5 py-0.5 bg-[#7c0040] text-white border-[#7c0040] capitalize">
                                  {selected.nivel}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <Badge className={`rounded-full border shrink-0 ${selTone.badgeClass}`}>
                            <Users className="mr-1 h-3.5 w-3.5" />
                            {selDisp}/{selTotal}
                          </Badge>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
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
                              setErrReferencia("");
                              setErrImporte("");
                              setErrFile("");
                              setErrFileExencion("");
                              setErrFileEstudios("");
                              if (mode === "exencion") {
                                setFileEstudios(null);
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
                                    <b>{file.name}</b> · {(file.size / 1024).toFixed(0)} KB
                                  </p>
                                ) : null}
                              </div>

                              {/* Comprobante de estudios (solo en PAGO y si es IPN) */}
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
                    )}
                  </div>
                )}
              </div>

              {/* FOOTER sticky (botones siempre visibles) */}
              <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t px-3 sm:px-5 py-3">
                <SheetFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setOpenSheet(false)}
                    disabled={submitting}
                  >
                    {sheetMode === "detalle" ? "Cerrar" : "Cancelar"}
                  </Button>

                  {sheetMode === "tramite" && (
                    <Button
                      onClick={() => selected && onInscribirme(selected)}
                      disabled={selSinLugares || selYaActiva || submitting}
                      title={
                        selYaActiva
                          ? "Ya tienes una inscripción activa en este grupo"
                          : selSinLugares
                          ? "Sin lugares disponibles"
                          : undefined
                      }
                    >
                      {selYaActiva
                        ? "Ya inscrita"
                        : selSinLugares
                        ? "Sin lugares"
                        : submitting
                        ? "Enviando…"
                        : paymentMode === "pago"
                        ? "Enviar comprobante y preinscribirme"
                        : "Enviar exención"}
                    </Button>
                  )}
                </SheetFooter>
              </div>
            </SheetContent>
          </Sheet>


          {/* Mobile Filters Sheet (separado del de detalle/trámite) */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-auto px-3">
              <SheetHeader className="pb-2">
                <SheetTitle>Filtrar grupos</SheetTitle>
                <SheetDescription>Elige uno o más criterios y aplica.</SheetDescription>
              </SheetHeader>

              <div className="mt-3 space-y-3">
                {/* Idioma */}
                <div className="space-y-1">
                  <Label className="text-xs">Idioma</Label>
                  <Select
                    value={draft.idioma || ""}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, idioma: v === CLEAR ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CLEAR}>Todos</SelectItem>
                      <SelectItem value="ingles">Inglés</SelectItem>
                      <SelectItem value="frances">Francés</SelectItem>
                      <SelectItem value="aleman">Alemán</SelectItem>
                      <SelectItem value="italiano">Italiano</SelectItem>
                      <SelectItem value="portugues">Portugués</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nivel */}
                <div className="space-y-1">
                  <Label className="text-xs">Nivel</Label>
                  <Select
                    value={draft.nivel || ""}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, nivel: v === CLEAR ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-auto">
                      <SelectItem value={CLEAR}>Todos</SelectItem>
                      <SelectItem value="Introductorio">Introductorio</SelectItem>
                      <SelectItem value="Básico 1">Básico 1</SelectItem>
                      <SelectItem value="Básico 2">Básico 2</SelectItem>
                      <SelectItem value="Básico 3">Básico 3</SelectItem>
                      <SelectItem value="Básico 4">Básico 4</SelectItem>
                      <SelectItem value="Básico 5">Básico 5</SelectItem>
                      <SelectItem value="Intermedio 1">Intermedio 1</SelectItem>
                      <SelectItem value="Intermedio 2">Intermedio 2</SelectItem>
                      <SelectItem value="Intermedio 3">Intermedio 3</SelectItem>
                      <SelectItem value="Intermedio 4">Intermedio 4</SelectItem>
                      <SelectItem value="Intermedio 5">Intermedio 5</SelectItem>
                      <SelectItem value="Avanzado 1">Avanzado 1</SelectItem>
                      <SelectItem value="Avanzado 2">Avanzado 2</SelectItem>
                      <SelectItem value="Avanzado 3">Avanzado 3</SelectItem>
                      <SelectItem value="Avanzado 4">Avanzado 4</SelectItem>
                      <SelectItem value="Avanzado 5">Avanzado 5</SelectItem>
                      <SelectItem value="Avanzado 6">Avanzado 6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                 {/* Turno */}
                <div className="space-y-1">
                  <Label className="text-xs">Turno</Label>
                  <Select
                    value={draft.turno || ""}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, turno: v === CLEAR ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CLEAR}>Todos</SelectItem>
                      <SelectItem value="matutino">Matutino</SelectItem>
                      <SelectItem value="vespertino">Vespertino</SelectItem>
                      <SelectItem value="mixto">Mixto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Modalidad */}
                <div className="space-y-1">
                  <Label className="text-xs">Modalidad</Label>
                  <Select
                    value={draft.modalidad || ""}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, modalidad: v === CLEAR ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CLEAR}>Todas</SelectItem>
                      <SelectItem value="intensivo">Intensivo</SelectItem>
                      <SelectItem value="sabatino">Sabatino</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

               
                
                {/* Acciones */}
                <div className="pt-2 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setDraft({ idioma: "", modalidad: "", turno: "", nivel: "" })}
                  >
                    Limpiar
                  </Button>
                  <Button
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      setFilters(draft);   // aplica borrador
                      setPage(1);
                      setFiltersOpen(false);
                    }}
                  >
                    Aplicar filtros
                  </Button>
                </div>
              </div>
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
  yaActiva = false,
}: {
  c: CicloDTO;
  onDetalle: () => void;
  onInscribir: () => void;
  yaActiva?: boolean;
}) {
  const disp = c.lugares_disponibles ?? 0;
  const total = c.cupo_total ?? 0;
  const tone = capTone(disp);
  const sinLugares = disp <= 0;
  const pct = capPercent(disp, total);

  return (
    <div className="rounded-xl border bg-white/60 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm sm:text-base">{c.codigo}</h3>
        <Badge className={`rounded-full border ${tone.badgeClass}`}>
          <Users className="mr-1 h-3.5 w-3.5" />
          {disp} / {total} · {tone.label}
        </Badge>
      </div>

      {/* Badges en color primario */}
      <div className="mt-1 flex flex-wrap gap-1.5 items-center text-[12px] sm:text-xs">
        {c.idioma ? (
          <Badge className="rounded-full px-2.5 py-0.5 bg-[#7c0040] text-white border-[#7c0040] capitalize">
            {c.idioma}
          </Badge>
        ) : null}
        {c.nivel ? (
          <Badge className="rounded-full px-2.5 py-0.5 bg-[#7c0040] text-white border-[#7c0040] capitalize">
            {c.nivel}
          </Badge>
        ) : null}
        {c.modalidad ? (
          <Badge className="rounded-full px-2.5 py-0.5 bg-[#6A6A6A] text-white border-[#6A6A6A] capitalize">
            {c.modalidad}
          </Badge>
        ) : null}
        {c.turno ? (
          <Badge className="rounded-full px-2.5 py-0.5 bg-[#6A6A6A] text-white border-[#6A6A6A] capitalize">
            {c.turno}
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 text-sm text-neutral-700 space-y-1">
        <div>
          <b>Inscripción:</b> {d(c.inscripcion?.from)} – {d(c.inscripcion?.to)}
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

      {/* Acciones */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onDetalle} className="h-9 rounded-xl">
          Detalle
        </Button>
        <Button
          onClick={onInscribir}
          className="h-9 rounded-xl"
          disabled={sinLugares || yaActiva}
          title={
            yaActiva
              ? "Ya tienes una inscripción activa en este grupo"
              : sinLugares
              ? "Sin lugares disponibles"
              : undefined
          }
        >
          {yaActiva ? "Ya inscrita" : sinLugares ? "Sin lugares" : "Inscribirme"}
        </Button>
      </div>
    </div>
  );
}
