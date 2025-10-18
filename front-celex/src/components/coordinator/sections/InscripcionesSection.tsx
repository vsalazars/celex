"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  listCiclos,
  listInscripcionesCoord,
  validateInscripcionCoord,
} from "@/lib/api";
import { getToken } from "@/lib/sessions";
import type { CicloDTO, InscripcionDTO } from "@/lib/api";
import { getHistorialAlumno } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  Loader2, RotateCcw as IconReload, FileDown, Eye,
  Maximize2, Minimize2, ZoomIn, ZoomOut, ExternalLink,
  RotateCw, RotateCcw, X, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

/* ====== TanStack React Table ====== */
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

type StatusFiltro =
  | "todas"
  | "registrada"
  | "preinscrita"
  | "confirmada"
  | "rechazada"
  | "cancelada";

type TipoArchivo = "comprobante" | "estudios" | "exencion";
type FitMode = "contain" | "width" | "height" | "actual";

type PreviewState = {
  open: boolean;
  ins: InscripcionDTO | null;
  tipo: TipoArchivo | null;
  url?: string | null;
  mime?: string | null;
  loading?: boolean;
  isPdf?: boolean;
};

type HistItem = {
  inscripcion_id: number;
  ciclo_id: number;
  ciclo_codigo: string;
  idioma?: string | null;
  nivel?: string | null;
  modalidad?: string | null;
  turno?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  docente_nombre?: string | null;
  calificacion?: number | null;
};

/** Icono de orden */
function SortIcon({ column }: { column: any }) {
  const s = column.getIsSorted();
  if (s === "asc") return <ChevronUp className="w-3 h-3 ml-1" />;
  if (s === "desc") return <ChevronDown className="w-3 h-3 ml-1" />;
  return null;
}

/** Chip/píldora reutilizable */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] bg-slate-50 text-slate-700">
      {children}
    </span>
  );
}

/** Quita prefijos tipo "Idioma." / "Nivel." y se queda con el último segmento */
function normalizeTaxonomy(value?: string | null): string {
  if (!value) return "";
  const t = String(value).trim();
  const last = t.includes(".") ? t.split(".").pop()! : t;
  return last;
}

function titleCaseEs(s?: string | null): string {
  if (!s) return "";
  const t = String(s).replaceAll("_", " ").toLowerCase();
  const mapAcentos: Record<string, string> = {
    ingles: "Inglés",
    frances: "Francés",
    aleman: "Alemán",
    japones: "Japonés",
    chino: "Chino",
    portugues: "Portugués",
    italiano: "Italiano",
  };
  if (mapAcentos[t]) return mapAcentos[t];
  return t.replace(/\b\w/g, (m) => m.toUpperCase());
}

function labelIdioma(idioma?: string | null): string {
  const raw = normalizeTaxonomy(idioma);
  return titleCaseEs(raw || "");
}

function labelNivel(nivel?: string | null): string {
  if (!nivel) return "";
  const raw = normalizeTaxonomy(nivel);
  const n = String(raw).trim().toUpperCase();
  const letra = n[0];
  const num = n.slice(1);
  const nivelMap: Record<string, string> = { B: "Básico", I: "Intermedio", A: "Avanzado" };
  if (nivelMap[letra] && /^\d+$/.test(num)) return `${nivelMap[letra]} ${Number(num)}`;
  const lower = n.toLowerCase();
  if (lower.includes("basico") || lower.includes("básico")) return "Básico";
  if (lower.includes("intermedio")) return "Intermedio";
  if (lower.includes("avanzado")) return "Avanzado";
  return titleCaseEs(n);
}

function labelModalidad(modalidad?: string | null): string {
  if (!modalidad) return "";
  const t = String(modalidad).toLowerCase();
  if (t.includes("intens")) return "Intensivo";
  if (t.includes("regular")) return "Regular";
  if (t.includes("sab")) return "Sabatino";
  if (t.includes("linea") || t.includes("en linea") || t.includes("en_línea")) return "En línea";
  return titleCaseEs(modalidad);
}

function labelTurno(turno?: string | null): string {
  if (!turno) return "";
  const t = String(turno).toLowerCase();
  if (t.includes("mat")) return "Matutino";
  if (t.includes("ves")) return "Vespertino";
  if (t.includes("noc") || t.includes("noct")) return "Nocturno";
  return titleCaseEs(turno);
}

export default function InscripcionesSection() {
  const [ciclos, setCiclos] = useState<CicloDTO[]>([]);
  const [cicloId, setCicloId] = useState<number | null>(null);
  const [year, setYear] = useState<number | "todos">("todos");

  const [status, setStatus] = useState<StatusFiltro>("todas");
  const [q, setQ] = useState<string>("");

  const [rows, setRows] = useState<InscripcionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState<number | null>(null);

  const [histLoading, setHistLoading] = useState(false);
  const [histItems, setHistItems] = useState<HistItem[]>([]);
  const [histOpen, setHistOpen]   = useState(false);

  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    ins: null,
    tipo: null,
    url: null,
    mime: null,
    loading: false,
    isPdf: false,
  });

  // ====== visor ======
  const [isFull, setIsFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fit, setFit] = useState<FitMode>("contain");

  // ====== rechazo en el mismo modal ======
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNombre, setRejectNombre] = useState<string>("");
  const [rejectMotivo, setRejectMotivo] = useState<string>("");

  // ====== edición de pago ======
  const [editReferencia, setEditReferencia] = useState<string>("");
  const [editImporteStr, setEditImporteStr] = useState<string>("");
  const [editFecha, setEditFecha] = useState<string>("");
  const [savingPago, setSavingPago] = useState<boolean>(false);

  const hoyIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /* =========================================================
     PENDIENTES: SOLO "preinscrita" con backend robusto
  ========================================================= */
  const [pendingByCiclo, setPendingByCiclo] = useState<Record<number, number>>({});
  const [pendingLoading, setPendingLoading] = useState(false);

  // Normaliza posibles formatos de respuesta
  function normalizeResp(resp: any): { items: any[]; count: number | null } {
    if (!resp) return { items: [], count: null };
    // casos con contador explícito
    const count =
      typeof resp.total === "number" ? resp.total :
      typeof resp.count === "number" ? resp.count :
      typeof resp.total_count === "number" ? resp.total_count :
      null;

    // posibles llaves de items
    const items =
      Array.isArray(resp) ? resp :
      Array.isArray(resp.items) ? resp.items :
      Array.isArray(resp.results) ? resp.results :
      Array.isArray(resp.data) ? resp.data :
      [];

    return { items, count };
  }

  // Cuenta cuántas "preinscrita" hay en una respuesta (si ignoran el status, filtro aquí)
 function isPendingForValidation(it: any): boolean {
  const s = String(it?.status ?? it?.estado ?? "").toLowerCase();
  const tipo = String(it?.tipo ?? "").toLowerCase();
  // Pendiente si:
  // - está preinscrita (pago o lo que sea), o
  // - es exención y sigue registrada
  return s === "preinscrita" || (tipo === "exencion" && s === "registrada");
}

function countPendientes(items: any[]): number {
  return items.reduce((acc, it) => acc + (isPendingForValidation(it) ? 1 : 0), 0);
}


  // Intenta obtener el count real con page_size=1; si no hay count, cae a pedir más items
async function getPreinscritasCount(ciclo: CicloDTO): Promise<number> {
  const LIMIT = 200;

  async function fetchBatch(skip: number) {
    // ⚠️ Usa skip/limit correctos
    const resp = await listInscripcionesCoord({
      ciclo_id: ciclo.id,
      skip,
      limit: LIMIT,
    } as any);
    const { items } = normalizeResp(resp);
    return Array.isArray(items) ? items : (Array.isArray(resp) ? resp : []);
  }

  let skip = 0;
  let total = 0;

  // Paginamos todo el ciclo y contamos localmente:
  // pendiente = preinscrita  OR  (tipo exencion && status registrada)
  // (igual que tu helper isPendingForValidation)
  // Nota: usamos tu countPendientes(items)
  // y detenemos cuando el batch < LIMIT
  // para no depender de un count del backend.
  // ——
  while (true) {
    const batch = await fetchBatch(skip);
    if (!batch.length) break;
    total += countPendientes(batch);
    if (batch.length < LIMIT) break;
    skip += LIMIT;
  }

  return total;
}



  async function fetchPendientesPorCiclo(ciclosInput: CicloDTO[]) {
    if (!ciclosInput?.length) {
      setPendingByCiclo({});
      return;
    }
    setPendingLoading(true);
    const tmp: Record<number, number> = {};
    try {
      for (const c of ciclosInput) {
        const n = await getPreinscritasCount(c);
        tmp[c.id] = n;
      }
      setPendingByCiclo(tmp);
    } finally {
      setPendingLoading(false);
    }
  }

  /* ================== filtros/memos ================== */
  const ciclosFiltrados = useMemo(() => {
    if (year === "todos") return ciclos;
    return ciclos.filter((c) => {
      const from = c.curso?.from;
      if (!from) return false;
      return new Date(from).getFullYear() === year;
    });
  }, [ciclos, year]);

  const ciclosConPendientes = useMemo(() => {
    const source = year === "todos" ? ciclos : ciclosFiltrados;
    return source.filter((c) => (pendingByCiclo[c.id] ?? 0) > 0);
  }, [year, ciclos, ciclosFiltrados, pendingByCiclo]);

  function openReject(ins: InscripcionDTO) {
    const nombre = `${ins.alumno?.first_name ?? ""} ${ins.alumno?.last_name ?? ""}`.trim();
    setRejectOpen(true);
    setRejectId(ins.id);
    setRejectNombre(nombre);
    setRejectMotivo("");
  }

  // ====== helpers ======
  function centsToMoney(cents?: number | null): string {
    if (cents == null) return "";
    const n = Number(cents) / 100;
    try {
      return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
    } catch {
      return `$${n.toFixed(2)}`;
    }
  }
  function moneyStrToCents(v: string): number | null {
    if (!v.trim()) return null;
    const cleaned = v.replace(/[^\d.,-]/g, "").replace(",", ".");
    const num = Number(cleaned);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100);
  }
  function ymdFromISO(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  // ====== API local: PATCH pago ======
  async function updatePagoInscripcionCoord(
    id: number,
    data: { referencia: string; importe_centavos: number; fecha_pago: string }
  ) {
    const token = getToken();
    const url = `${process.env.NEXT_PUBLIC_API_URL}/coordinacion/inscripciones/${id}/pago`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try { const j = await res.json(); msg = j?.detail || msg; } catch {}
      throw new Error(msg);
    }
    return (await res.json()) as InscripcionDTO;
  }

  // ====== datos ======
  async function fetchCiclos() {
    try {
      const resp = await listCiclos({ page: 1, page_size: 100 });
      const items = resp?.items ?? [];
      setCiclos(items || []);
      if (!cicloId && items?.length) setCicloId(items[0].id);
      if (items?.length) {
        void fetchPendientesPorCiclo(items);
      } else {
        setPendingByCiclo({});
      }
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Error al cargar ciclos");
    }
  }

 async function fetchInscripciones() {
  if (!cicloId) return;
  setLoading(true);
  try {
    // ✅ usa skip/limit, no page/page_size
    const baseParams: any = { ciclo_id: cicloId, skip: 0, limit: 200 };

    // 1) Trae las que pidió el usuario (tal cual)
    const params = { ...baseParams };
    if (status !== "todas") params.status = status;

    const dataRaw = await listInscripcionesCoord(params);
    const { items } = normalizeResp(dataRaw);
    let data: InscripcionDTO[] = items.length
      ? items
      : (Array.isArray(dataRaw) ? (dataRaw as InscripcionDTO[]) : []);

    // 2) Si el usuario pidió "preinscrita", agrega exenciones que sigan "registrada"
    if (status === "preinscrita") {
      const respExtra = await listInscripcionesCoord({ ...baseParams, status: "registrada" });
      const { items: extraItems } = normalizeResp(respExtra);
      const exencionesRegistradas = extraItems.filter((it: any) =>
        String(it?.tipo ?? "").toLowerCase() === "exencion" &&
        String(it?.status ?? "").toLowerCase() === "registrada"
      );
      const seen = new Set(data.map((d) => d.id));
      for (const x of exencionesRegistradas) if (!seen.has(x.id)) data.push(x);
    }

    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRows(data);
  } catch (err: any) {
    toast.error(typeof err?.message === "string" ? err.message : "Error al cargar inscripciones");
  } finally {
    setLoading(false);
  }
}



  // ====== validar ======
  async function handleValidate(
    id: number,
    action: "APPROVE" | "REJECT",
    motivo?: string
  ) {
    setValidating(id);
    try {
      await validateInscripcionCoord(
        id,
        action,
        action === "REJECT" ? motivo : undefined
      );
      toast.success(`Inscripción ${action === "APPROVE" ? "aprobada" : "rechazada"} correctamente`);
      setPreview((p) => (p.ins?.id === id ? { ...p, open: false } : p));
      setRows((prev) => prev.filter((r) => r.id !== id));

      // refrescar contador del ciclo afectado (preinscritas)
      const ciclo = (preview.ins?.ciclo?.id ?? cicloId) as number | null;
      if (ciclo) {
        const found = ciclos.find((c) => c.id === ciclo);
        if (found) void fetchPendientesPorCiclo([found]);
      }
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Error al validar");
    } finally {
      setValidating(null);
    }
  }

  async function fetchHistorialAlumno(alumnoId: number) {
    setHistLoading(true);
    try {
      const res = await getHistorialAlumno(alumnoId, {});
      setHistItems(res?.items ?? []);
    } catch (e: any) {
      toast.error(typeof e?.message === "string" ? e.message : "No se pudo cargar el historial");
      setHistItems([]);
    } finally {
      setHistLoading(false);
    }
  }

  // ====== abrir/cerrar visor ======
  async function openPreview(ins: InscripcionDTO, tipo: TipoArchivo) {
    const hasMeta =
      (tipo === "comprobante" && !!ins.comprobante) ||
      (tipo === "estudios" && !!ins.comprobante_estudios) ||
      (tipo === "exencion" && !!ins.comprobante_exencion);
    if (!hasMeta) {
      toast.info("Esta inscripción no tiene ese archivo.");
      return;
    }

    // Reset de visor
    setPreview({ open: true, ins, tipo, loading: true, url: null, mime: null, isPdf: false });
    setIsFull(false);
    setZoom(1);
    setRotation(0);
    setFit("contain");
    setRejectOpen(false);

    // Reset de edición de pago
    if (ins.tipo === "pago") {
      setEditReferencia(ins.referencia ?? "");
      setEditImporteStr(
        ins.importe_centavos != null ? (Number(ins.importe_centavos) / 100).toFixed(2) : ""
      );
      setEditFecha(ymdFromISO(ins.fecha_pago));
    } else {
      setEditReferencia("");
      setEditImporteStr("");
      setEditFecha("");
    }

    // ======= HISTORIAL DEL ALUMNO =======
    setHistItems([]);
    setHistLoading(false);
    if ((ins as any).alumno_id) {
      void fetchHistorialAlumno((ins as any).alumno_id);
    }

    // ======= CARGA DEL ARCHIVO =======
    try {
      const token = getToken();
      const url = new URL(
        `${process.env.NEXT_PUBLIC_API_URL}/coordinacion/inscripciones/${ins.id}/archivo`
      );
      url.searchParams.set("tipo", tipo);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = j?.detail || msg; } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const isPdf = (blob.type === "application/pdf") || objUrl.endsWith(".pdf");

      setPreview((p) => ({
        ...p,
        url: objUrl,
        mime: blob.type || null,
        loading: false,
        isPdf,
      }));
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "No se pudo abrir el archivo");
      setPreview((p) => ({ ...p, loading: false }));
    }
  }

  function closePreview() {
    if (preview.url) {
      try { URL.revokeObjectURL(preview.url); } catch {}
    }
    setPreview({ open: false, ins: null, tipo: null, url: null, mime: null, loading: false, isPdf: false });
    setIsFull(false);
    setZoom(1);
    setRotation(0);
    setFit("contain");
    setEditReferencia("");
    setEditImporteStr("");
    setEditFecha("");
    setSavingPago(false);
    setRejectOpen(false);
    setHistOpen(false);
    setHistItems([]);
    setHistLoading(false);
  }

  // ====== guardar pago ======
  async function onSavePago() {
    if (!preview.ins || preview.ins.tipo !== "pago") return;

    const referencia = editReferencia.trim();
    const importe_centavos = moneyStrToCents(editImporteStr);
    const fecha_pago = editFecha;

    if (!referencia) return toast.error("La referencia es requerida");
    if (importe_centavos == null || importe_centavos <= 0) return toast.error("El importe debe ser válido y > 0");
    if (!fecha_pago) return toast.error("La fecha de pago es requerida");
    if (fecha_pago > hoyIso) return toast.error("La fecha de pago no puede ser futura");

    try {
      setSavingPago(true);
      const updated = await updatePagoInscripcionCoord(preview.ins.id, {
        referencia, importe_centavos, fecha_pago,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setPreview((p) => (p.ins ? { ...p, ins: { ...p.ins!, ...updated } } : p));
      toast.success("Datos de pago actualizados");
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "No se pudo actualizar el pago");
    } finally {
      setSavingPago(false);
    }
  }

  /* ================== effects ================== */
  useEffect(() => { fetchCiclos(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (cicloId) fetchInscripciones(); /* eslint-disable-next-line */ }, [cicloId, status]);

  // Recalcular preinscritas visibles si cambia el año o el set de ciclos
  useEffect(() => {
    const target = year === "todos" ? ciclos : ciclosFiltrados;
    if (target.length) void fetchPendientesPorCiclo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, ciclos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!preview.open) return;
      const key = e.key.toLowerCase();
      if (key === "f") { e.preventDefault(); setIsFull((v) => !v); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault(); setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2)))) ;
      }
      if ((e.ctrlKey || e.metaKey) && key === "0") {
        e.preventDefault(); setZoom(1);
      }
      if (!preview.isPdf && (e.ctrlKey || e.metaKey) && key === "r") {
        e.preventDefault(); setRotation((deg) => (deg + 90) % 360);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview.open, preview.isPdf]);

  /* ================== memos ================== */
  const years = useMemo(() => {
    const set = new Set<number>();
    ciclos.forEach((c) => {
      const from = c.curso?.from;
      if (from) set.add(new Date(from).getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [ciclos]);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const nombre = `${r.alumno?.first_name ?? ""} ${r.alumno?.last_name ?? ""}`.toLowerCase();
      const email = (r.alumno?.email ?? "").toLowerCase();
      const codigo = (r.ciclo?.codigo ?? "").toLowerCase();
      return nombre.includes(term) || email.includes(term) || codigo.includes(term);
    });
  }, [rows, q]);

  const headers = useMemo(
    () => ["Alumno", "Tipo", "Estado", "Trámite", "Comprobantes"],
    []
  );

  function fitClasses(): string {
    switch (fit) {
      case "width": return "w-full h-auto";
      case "height": return "h-full w-auto";
      case "actual": return "max-w-none";
      default: return "max-w-full max-h-full";
    }
  }

  const STATUS_STYLES: Record<
    Exclude<StatusFiltro, "todas">,
    { label: string; className: string }
  > = {
    registrada: {
      label: "Registrada",
      className:
        "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-200",
    },
    preinscrita: {
      label: "Preinscrita",
      className:
        "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
    },
    confirmada: {
      label: "Confirmada",
      className:
        "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
    },
    rechazada: {
      label: "Rechazada",
      className:
        "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-200",
    },
    cancelada: {
      label: "Cancelada",
      className:
        "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200",
    },
  };

  function renderTipoAlumno(r: InscripcionDTO) {
    const boleta =
      (r as any)?.alumno?.boleta ??
      (r as any)?.alumno?.boleta_ipn ??
      (r as any)?.alumno?.codigo_ipn ??
      null;

    const esIPN = !!boleta || !!r.comprobante_estudios;

    if (esIPN) {
      return (
        <div className="text-sm">
          <span className="font-medium">IPN</span>
          {boleta ? <span className="text-xs text-muted-foreground ml-1">({String(boleta)})</span> : null}
        </div>
      );
    }
    return <span className="text-sm">Externo</span>;
  }

  const canValidate =
    !!preview.ins && (preview.tipo === "comprobante" || preview.tipo === "exencion");

  // 1) Agrega este helper arriba de la definición de columnas
type StatusKey = Exclude<StatusFiltro, "todas">;

function getDisplayStatus(r: InscripcionDTO): StatusKey {
  const s = String((r as any).status ?? "registrada").toLowerCase();
  const tipo = String((r as any).tipo ?? "").toLowerCase();

  // Homologación SOLO visual: exención en "registrada" se muestra como "preinscrita".
  if (s === "registrada" && tipo === "exencion") return "preinscrita";

  // Asegura retorno válido
  const allowed: StatusKey[] = ["registrada", "preinscrita", "confirmada", "rechazada", "cancelada"];
  return (allowed.includes(s as StatusKey) ? s : "registrada") as StatusKey;
}


  /* =========================
     TanStack: ColumnDef & table
  ==========================*/
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<InscripcionDTO>[]>(() => {
    const statusOrder: Record<string, number> = {
      confirmada: 1,
      preinscrita: 2,
      registrada: 3,
      rechazada: 4,
      cancelada: 5,
    };

    return [
      {
        id: "alumno",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 cursor-pointer select-none"
          >
            Alumno <SortIcon column={column} />
          </button>
        ),
        accessorFn: (r) =>
          `${r.alumno?.first_name ?? ""} ${r.alumno?.last_name ?? ""}`.trim().toLowerCase(),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="leading-tight">
              <div>{r.alumno?.first_name} {r.alumno?.last_name}</div>
              <div className="text-xs text-muted-foreground">{r.alumno?.email}</div>
            </div>
          );
        },
        sortingFn: "alphanumeric",
      },
      {
        id: "tipo",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 cursor-pointer select-none"
          >
            Tipo <SortIcon column={column} />
          </button>
        ),
        accessorFn: (r) => {
          const boleta =
            (r as any)?.alumno?.boleta ??
            (r as any)?.alumno?.boleta_ipn ??
            (r as any)?.alumno?.codigo_ipn ??
            null;
          const esIPN = !!boleta || !!r.comprobante_estudios;
          return esIPN ? "ipn" : "externo";
        },
        cell: ({ row }) => renderTipoAlumno(row.original),
        sortingFn: "alphanumeric",
      },
       {
        id: "estado",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 cursor-pointer select-none"
          >
            Estado <SortIcon column={column} />
          </button>
        ),
        // ⬇️ usar el status "visual" para ordenar también
        accessorFn: (r) => statusOrder[getDisplayStatus(r)] ?? 99,
        cell: ({ row }) => {
          const r = row.original;
          const display = getDisplayStatus(r);                      // ← status visual
          const cfg = STATUS_STYLES[display] ?? STATUS_STYLES.registrada;

          // Tip extra: si fue homologado, añade un title explicativo
          const homologado = display === "preinscrita"
            && String((r as any).status ?? "").toLowerCase() === "registrada"
            && String((r as any).tipo ?? "").toLowerCase() === "exencion";

          return (
            <Badge
              variant="outline"
              className={`capitalize px-2 py-0.5 text-[12px] font-medium ${cfg.className}`}
              title={homologado ? "Preinscrita (exención homologada desde 'registrada')" : cfg.label}
            >
              {cfg.label}
            </Badge>
          );
        },
        sortingFn: "basic",
      },
    
      {
        id: "tramite",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 cursor-pointer select-none"
          >
            Trámite <SortIcon column={column} />
          </button>
        ),
        accessorFn: (r) => (r.tipo ?? "").toString().toLowerCase(),
        cell: ({ row }) => <span className="capitalize">{row.original.tipo}</span>,
        sortingFn: "alphanumeric",
      },
      {
        id: "comprobantes",
        header: () => <div>Comprobantes</div>,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-wrap gap-2">
              {r.comprobante && (
                <Button variant="secondary" size="sm" title="Ver comprobante de pago" onClick={() => openPreview(r, "comprobante")}>
                  <Eye className="w-4 h-4 mr-1" /> Ver pago
                </Button>
              )}
              {r.comprobante_estudios && (
                <Button variant="secondary" size="sm" title="Ver comprobante de estudios (IPN)" onClick={() => openPreview(r, "estudios")}>
                  <Eye className="w-4 h-4 mr-1" /> Ver estudios
                </Button>
              )}
              {r.comprobante_exencion && (
                <Button variant="secondary" size="sm" title="Ver comprobante de exención" onClick={() => openPreview(r, "exencion")}>
                  <Eye className="w-4 h-4 mr-1" /> Ver exención
                </Button>
              )}
              {!r.comprobante && !r.comprobante_estudios && !r.comprobante_exencion && (
                <span className="text-xs text-muted-foreground">Sin archivos</span>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
    ];
  }, []);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 },
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="space-y-1">
            <CardTitle>Validar inscripciones</CardTitle>
            <p className="text-sm text-muted-foreground">
              Filtra por año y ciclo; revisa los comprobantes en el visor y aprueba/rechaza desde la parte superior.
            </p>
          </div>

          {/* Fila arriba de filtros → “Validaciones pendientes:” SOLO ciclos con preinscritas */}
          <div className="w-full">
            <div className="text-[11px] uppercase text-muted-foreground mb-1">Validaciones pendientes:</div>
            <div className="flex items-center gap-2 overflow-x-auto py-1 pr-1" style={{ scrollbarGutter: "stable" as any }}>
              {pendingLoading && (
                <span className="inline-flex items-center text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Cargando…
                </span>
              )}
              {!pendingLoading && ciclosConPendientes.length === 0 ? (
                <span className="text-xs text-muted-foreground">Sin pendientes</span>
              ) : (
                ciclosConPendientes.map((c) => {
                  const count = pendingByCiclo[c.id] ?? 0;
                  return (
                    <Badge
                      key={c.id}
                      variant="outline"
                      onClick={() => setCicloId(c.id)}
                      className={`cursor-pointer select-none rounded-full px-3 py-1 text-[11px] tabular-nums ${
                        count > 0
                          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                      title={`${c.codigo}: ${count} preinscritas (clic para ver)`}
                    >
                      {c.codigo}
                      <span className={`ml-2 inline-flex items-center justify-center rounded-full min-w-[1.5rem] h-6 px-2 ${
                        count > 0
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {count}
                      </span>
                    </Badge>
                  );
                })
              )}
              <Button
                variant="outline"
                size="sm"
                className="ml-1 h-7"
                onClick={() => {
                  const target = year === "todos" ? ciclos : ciclosFiltrados;
                  void fetchPendientesPorCiclo(target);
                }}
                title="Recalcular"
              >
                <IconReload className="w-3.5 h-3.5 mr-1" />
                Actualizar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
            {/* Año */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Año</label>
              <Select value={String(year)} onValueChange={(v) => setYear(v === "todos" ? "todos" : Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ciclo */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Ciclo</label>
              <Select value={cicloId ? String(cicloId) : ""} onValueChange={(v) => setCicloId(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un curso" />
                </SelectTrigger>
                <SelectContent>
                  {ciclosFiltrados.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.codigo} — {c.idioma.toUpperCase()} {c.nivel} ({c.modalidad})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Estado</label>
              <Select value={status} onValueChange={(v: StatusFiltro) => setStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="registrada">Registradas</SelectItem>
                  <SelectItem value="preinscrita">Preinscritas</SelectItem>
                  <SelectItem value="confirmada">Confirmadas</SelectItem>
                  <SelectItem value="rechazada">Rechazadas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buscar */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Buscar</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. Nombre / correo / código" />
            </div>

            {/* Recargar */}
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={() => fetchInscripciones()} disabled={loading}>
                {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <IconReload className="w-4 h-4 mr-2" />}
                Recargar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin w-6 h-6 mr-2" />
              Cargando inscripciones...
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {cicloId ? "No hay inscripciones para este curso y filtros." : "Selecciona un curso para comenzar."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>

                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginación */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <div className="text-xs text-muted-foreground">
                  Mostrando{" "}
                  <span className="tabular-nums">
                    {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                    {"–"}
                    {Math.min(
                      (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                      filteredRows.length
                    )}
                  </span>{" "}
                  de <span className="tabular-nums">{filteredRows.length}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={String(table.getState().pagination.pageSize)}
                    onValueChange={(v) => table.setPageSize(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue placeholder="Filas por página" />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.firstPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      «
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      Anterior
                    </Button>
                    <div className="px-2 text-sm tabular-nums">
                      {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      Siguiente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                    >
                      »
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ====== VISOR ====== */}
      <Dialog open={preview.open} onOpenChange={(o) => (o ? null : closePreview())}>
        <DialogContent
          className="p-0 overflow-hidden sm:max-w-none max-w-none w-[98vw] xl:w-[1800px] h-[90vh] [&>button.absolute.right-4.top-4]:hidden"
          style={{ scrollbarGutter: "stable both-edges" as any }}
        >
          <div className="flex h-full flex-col">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 px-3 py-2 border-b bg-white/80 backdrop-blur shrink-0">
              <DialogHeader className="p-0">
                <DialogTitle className="text-sm md:text-base">
                  {preview.tipo === "comprobante" && "Comprobante de pago"}
                  {preview.tipo === "estudios" && "Comprobante de estudios"}
                  {preview.tipo === "exencion" && "Comprobante de exención"}
                  {preview.ins ? ` · ${preview.ins.alumno?.first_name || ""} ${preview.ins.alumno?.last_name || ""}` : ""}
                </DialogTitle>

                {/* Editor de pago inline */}
                {preview.ins?.tipo === "pago" && preview.tipo === "comprobante" && (
                  <div className="flex flex-wrap items-center gap-2 mr-2 mt-1">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-muted-foreground min-w-[66px]">Ref.</label>
                      <Input
                        value={editReferencia}
                        onChange={(e) => setEditReferencia(e.target.value)}
                        placeholder="BAN-012345"
                        className="h-8 w-[160px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-muted-foreground min-w-[54px]">Importe</label>
                      <Input
                        value={editImporteStr}
                        onChange={(e) => setEditImporteStr(e.target.value)}
                        placeholder="4100.75"
                        className="h-8 w-[120px]"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {centsToMoney(moneyStrToCents(editImporteStr) ?? undefined)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-muted-foreground min-w-[42px]">Fecha</label>
                      <Input
                        type="date"
                        value={editFecha}
                        onChange={(e) => setEditFecha(e.target.value)}
                        className="h-8 w-[150px]"
                        max={hoyIso}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={onSavePago}
                      disabled={savingPago}
                      title="Guardar corrección de pago"
                      className="ml-1"
                    >
                      {savingPago ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Actualizar datos
                    </Button>
                  </div>
                )}
              </DialogHeader>

              {/* Acciones + Controles */}
              <div className="flex flex-wrap items-center gap-2">
                {canValidate && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setHistOpen((v) => !v)}
                      title="Ver historial académico del alumno"
                      variant="default"
                      className={`bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800
                                  focus-visible:ring-emerald-600
                                  ${histOpen ? "bg-emerald-700 hover:bg-emerald-800" : ""}`}
                    >
                      Historial
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleValidate(preview.ins!.id, "APPROVE")}
                      disabled={validating === preview.ins!.id}
                      title="Aprobar inscripción"
                    >
                      {validating === preview.ins!.id ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : null}
                      Aprobar
                    </Button>

                    <Button
                      size="sm"
                      variant={rejectOpen ? "secondary" : "destructive"}
                      onClick={() => {
                        if (!preview.ins) return;
                        setRejectOpen((v) => !v);
                        if (!rejectOpen) {
                          setRejectId(preview.ins.id);
                          const nombre = `${preview.ins.alumno?.first_name ?? ""} ${preview.ins.alumno?.last_name ?? ""}`.trim();
                          setRejectNombre(nombre);
                          setRejectMotivo("");
                        }
                      }}
                      disabled={validating === preview.ins!.id}
                      title="Rechazar inscripción"
                    >
                      Rechazar
                    </Button>

                    <div className="h-6 w-px bg-border mx-1" />
                  </>
                )}

                {!preview.isPdf && (
                  <>
                    <Button variant="outline" size="icon" title="Rotar 90° izq" onClick={() => setRotation((d) => (d + 270) % 360)}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" title="Rotar 90° der" onClick={() => setRotation((d) => (d + 90) % 360)}>
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  </>
                )}

                <Button variant="outline" size="icon" title="Alejar" onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="icon" title="Acercar" onClick={() => setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" title="Restablecer zoom" onClick={() => setZoom(1)}>
                  Reset
                </Button>

                {preview.url && (
                  <>
                    <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="icon" title="Abrir en nueva pestaña">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                    <a href={preview.url} download className="inline-flex">
                      <Button variant="outline" size="icon" title="Descargar">
                        <FileDown className="w-4 h-4" />
                      </Button>
                    </a>
                  </>
                )}

                <Button
                  variant="default"
                  size="icon"
                  title={isFull ? "Salir pantalla completa (F/Esc)" : "Pantalla completa (F)"}
                  onClick={() => setIsFull((v) => !v)}
                >
                  {isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>

                <DialogClose asChild>
                  <Button variant="ghost" size="icon" title="Cerrar visor">
                    <X className="w-4 h-4" />
                  </Button>
                </DialogClose>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 min-h-0 bg-neutral-50 flex overflow-hidden">
              {/* Preview */}
              <div
                className="flex-1 min-w-0 flex items-center justify-center overflow-hidden"
                style={{ scrollbarGutter: "stable both-edges" as any }}
              >
                {preview.loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin w-5 h-5" />
                    Cargando archivo...
                  </div>
                ) : preview.url ? (
                  preview.isPdf ? (
                    <iframe
                      title="PDF"
                      src={`${preview.url}#zoom=${Math.round(zoom * 100)}`}
                      className="w-full h-full"
                    />
                  ) : preview.mime?.startsWith("image/") ? (
                    <div className="w-full h-full overflow-auto flex items-center justify-center"
                        style={{ scrollbarGutter: "stable both-edges" as any }}>
                      <img
                        src={preview.url}
                        alt="Comprobante"
                        className={`object-contain ${fitClasses()}`}
                        style={{
                          transform: `rotate(${rotation}deg) scale(${zoom})`,
                          transformOrigin: "center center",
                          willChange: "transform",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-center text-muted-foreground">
                      No se puede previsualizar este tipo de archivo.
                      <div className="mt-3">
                        <a href={preview.url} download className="inline-flex items-center gap-2 text-primary underline">
                          <FileDown className="w-4 h-4" />
                          Descargar archivo
                        </a>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">No hay archivo.</div>
                )}
              </div>

              {/* Panel de rechazo */}
              {canValidate && rejectOpen && preview.ins && (
                <div
                  className="w-full md:w-[420px] min-w-[320px] border-t md:border-t-0 md:border-l bg-white shrink-0 overflow-y-scroll"
                  style={{ scrollbarGutter: "stable both-edges" as any }}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm">
                        Motivo de rechazo{rejectNombre ? ` · ${rejectNombre}` : ""}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRejectOpen(false)}
                        title="Cerrar panel"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Escribe brevemente el motivo. El alumno lo recibirá como notificación.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {[
                        "Documentación incompleta",
                        "Archivo ilegible",
                        "Comprobante no corresponde al pago",
                        "Datos personales no coinciden",
                      ].map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRejectMotivo((prev) => (prev ? `${prev}; ${t}` : t))
                          }
                        >
                          {t}
                        </Button>
                      ))}
                    </div>

                    <Textarea
                      value={rejectMotivo}
                      onChange={(e) => setRejectMotivo(e.target.value)}
                      placeholder="Ej. El comprobante es ilegible y falta la constancia de estudios..."
                      rows={8}
                    />

                    <div className="text-[11px] text-muted-foreground text-right">
                      {rejectMotivo.length}/300
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button variant="outline" onClick={() => setRejectOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={
                          !rejectId ||
                          rejectMotivo.trim().length < 6 ||
                          rejectMotivo.length > 300 ||
                          validating === rejectId
                        }
                        onClick={async () => {
                          if (!rejectId) return;
                          const motivo = rejectMotivo.trim().slice(0, 300);
                          await handleValidate(rejectId, "REJECT", motivo);
                          setRejectOpen(false);
                          setRejectId(null);
                          setRejectNombre("");
                          setRejectMotivo("");
                        }}
                      >
                        {rejectId !== null && validating === rejectId ? (
                          <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        ) : null}
                        Enviar rechazo
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Panel de HISTORIAL */}
              {histOpen && (
                <div
                  className="w/full md:w-[380px] min-w-[300px] border-t md:border-t-0 md:border-l bg-white shrink-0 overflow-y-auto mt-4 max-h-[80vh]"
                  style={{ scrollbarGutter: "stable both-edges" as any }}
                >
                  <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
                    <div className="text-sm font-medium">
                      Historial del alumno
                      {preview.ins?.alumno?.first_name ? (
                        <span className="text-muted-foreground font-normal">
                          {" · "}
                          {preview.ins.alumno.first_name} {preview.ins.alumno.last_name}
                        </span>
                      ) : null}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setHistOpen(false)} title="Ocultar historial">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="p-4 space-y-3">
                    {histLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cargando historial...
                      </div>
                    ) : histItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin registros previos.</p>
                    ) : (
                      <div className="space-y-3">
                        {histItems.map((h) => (
                          <div key={`${h.inscripcion_id}`} className="rounded-xl border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-medium">{h.ciclo_codigo}</div>
                              <div className="flex flex-wrap gap-1">
                                {h.idioma ? <Pill>{labelIdioma(h.idioma)}</Pill> : null}
                                {h.nivel  ? <Pill>{labelNivel(h.nivel)}</Pill> : null}
                              </div>
                            </div>

                            {h.docente_nombre ? (
                              <div className="text-xs text-muted-foreground mt-1">
                                Docente: {h.docente_nombre}
                              </div>
                            ) : null}

                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md bg-slate-50 p-2">
                                <div className="text-[10px] uppercase text-muted-foreground">Inicio</div>
                                <div className="tabular-nums">{h.fecha_inicio || "-"}</div>
                              </div>
                              <div className="rounded-md bg-slate-50 p-2">
                                <div className="text-[10px] uppercase text-muted-foreground">Fin</div>
                                <div className="tabular-nums">{h.fecha_fin || "-"}</div>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {/* {h.modalidad ? <Pill>{labelModalidad(h.modalidad)}</Pill> : null}
                                {h.turno     ? <Pill>{labelTurno(h.turno)}</Pill>     : null} */}
                              </div>
                              <div className="text-sm">
                                {typeof h.calificacion === "number" ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      h.calificacion >= 80
                                        ? "border-emerald-300 text-emerald-800 bg-emerald-50"
                                        : "border-red-300 text-red-800 bg-red-50"
                                    }
                                    title={h.calificacion >= 80 ? "Aprobado" : "Debajo de 80"}
                                  >
                                    Calificación:
                                    <span className="tabular-nums ml-1">{h.calificacion.toFixed(1)}</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">Sin calificación</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t bg-white/80 shrink-0">
              <div className="text-xs text-muted-foreground">
                {preview.mime ? `Tipo: ${preview.mime}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {preview.tipo ? "Acciones arriba en la barra." : ""}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
