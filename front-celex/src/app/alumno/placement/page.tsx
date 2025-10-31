"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { apiFetch, downloadPlacementComprobante } from "@/lib/api";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ⬇️ NUEVO: AlertDialog para confirmar cancelación */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

/* ================= Niveles (helpers a nivel de módulo) ================= */
const NIVEL_LABELS: Record<string, string> = {
  INTRO: "Introductorio",
  B1: "Básico 1",
  B2: "Básico 2",
  B3: "Básico 3",
  B4: "Básico 4",
  B5: "Básico 5",
  I1: "Intermedio 1",
  I2: "Intermedio 2",
  I3: "Intermedio 3",
  I4: "Intermedio 4",
  I5: "Intermedio 5",
  A1: "Avanzado 1",
  A2: "Avanzado 2",
  A3: "Avanzado 3",
  A4: "Avanzado 4",
  A5: "Avanzado 5",
  A6: "Avanzado 6",
};

function normalizeNivelKey(n: string | null | undefined): string | null {
  if (!n) return null;
  const k = String(n).trim().toUpperCase();
  if (k.startsWith("INTRO")) return "INTRO";
  if (k in NIVEL_LABELS) return k;
  return null;
}

function nivelLabel(nKey: string | null | "—"): string {
  if (!nKey || nKey === "—") return "—";
  return NIVEL_LABELS[nKey] ?? nKey;
}

function nivelClass(nKey: string | null | "—") {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1";
  switch (nKey) {
    case "INTRO":
      return `${base} bg-blue-50 text-blue-700 ring-blue-200`;
    case "B1":
    case "B2":
    case "B3":
    case "B4":
    case "B5":
      return `${base} bg-blue-100 text-blue-800 ring-blue-300`;
    case "I1":
    case "I2":
    case "I3":
    case "I4":
    case "I5":
      return `${base} bg-blue-200 text-blue-900 ring-blue-400`;
    case "A1":
    case "A2":
    case "A3":
    case "A4":
    case "A5":
    case "A6":
      return `${base} bg-blue-600 text-white ring-blue-500`;
    default:
      return `${base} bg-zinc-50 text-zinc-700 ring-zinc-200`;
  }
}

/* ================= Base API desde env ================= */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/* Pequeño flag de depuración */
const DEBUG =
  process.env.NODE_ENV !== "production" ||
  (typeof window !== "undefined" &&
    localStorage.getItem("debugPlacement") === "1");

/* ================= Tipos ================= */
type PlacementExam = {
  id: number;
  codigo: string;
  nombre?: string | null;
  idioma: string | null;
  fecha?: string | null;
  hora?: string | null;
  salon?: string | null;
  duracion_min?: number | null;
  cupo_total?: number | null;
  costo?: number | null;
  activo?: boolean | null;
  dias?: string[];
  insc_inicio?: string | null;
  insc_fin?: string | null;
  inscripcion_inicio?: string | null;
  inscripcion_fin?: string | null;
  registro_inicio?: string | null;
  registro_fin?: string | null;
  periodo_insc_inicio?: string | null;
  periodo_insc_fin?: string | null;
  disponibles?: number | null;
  cupo_disponible?: number | null;
  ocupados?: number | null;
  registros_ocupados?: number | null;
};

type PlacementList = {
  items: PlacementExam[];
  page: number;
  pages: number;
  total: number;
};

type ComprobanteMeta = {
  filename?: string | null;
  mimetype?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
};

type PlacementRegistro = {
  id: number;
  exam_id: number;
  status: string;
  referencia?: string | null;
  importe_centavos?: number | null;
  fecha_pago?: string | null;
  comprobante?: ComprobanteMeta | null;
  created_at: string;
  exam?: Partial<PlacementExam> | null;
  rechazo_motivo?: string | null;
  motivo_rechazo?: string | null;
  validation_notes?: string | null;
  reject_reason?: string | null;
  nivel_idioma?: string | null;
  nivel_asignado?: string | null;
  nivel?: string | null;
};

/* ================== Helpers numéricos y de cupo ================== */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function disponiblesDe(ex: {
  disponibles?: any;
  cupo_disponible?: any;
  cupo_total?: any;
  ocupados?: any;
  registros_ocupados?: any;
}): number | null {
  const d = toNum(ex.disponibles ?? ex.cupo_disponible);
  if (d !== null) return d;
  const total = toNum(ex.cupo_total);
  const occ = toNum(ex.ocupados ?? ex.registros_ocupados);
  if (total !== null && occ !== null) return Math.max(0, total - occ);
  return null;
}

function cupoPillClass(tone: "emerald" | "amber" | "red" | "zinc") {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1";
  switch (tone) {
    case "emerald":
      return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200`;
    case "amber":
      return `${base} bg-amber-50 text-amber-700 ring-amber-200`;
    case "red":
      return `${base} bg-red-50 text-red-700 ring-red-200`;
    default:
      return `${base} bg-zinc-50 text-zinc-700 ring-zinc-200`;
  }
}

function toneByDisponibles(
  disp: number | null,
  total: number | null
): "emerald" | "amber" | "red" | "zinc" {
  if (disp === null && total === null) return "zinc";
  if (disp !== null) {
    if (disp <= 0) return "red";
    if (disp <= 3) return "red";
    if (total !== null) {
      const ratio = disp / Math.max(total, 1);
      if (ratio <= 0.2) return "amber";
    }
    return "emerald";
  }
  return "emerald";
}

function CupoPill({ ex }: { ex: PlacementExam }) {
  const disp = disponiblesDe(ex);
  const total = toNum(ex.cupo_total);
  const occ = toNum(ex.ocupados ?? ex.registros_ocupados);

  const text =
    disp !== null && total !== null
      ? `${disp}/${total}`
      : disp !== null
      ? `${disp}`
      : total !== null
      ? `${total}`
      : "—";

  const tone = toneByDisponibles(disp, total);

  const badge = (
    <span
      className={cupoPillClass(tone)}
      title={occ !== null ? `Ocupados: ${occ}` : undefined}
      aria-label={occ !== null ? `Cupo ${text}. Ocupados ${occ}.` : `Cupo ${text}.`}
    >
      {tone === "red" && <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
      {text}
    </span>
  );

  if (occ !== null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Ocupados: {occ}
        </TooltipContent>
      </Tooltip>
    );
  }
  return badge;
}

/* ================== Helpers de status para reinscripción ================== */
function normalizeStatus(s?: string | null) {
  const k = (s || "").trim().toLowerCase();
  const map: Record<string, string> = {
    aprobada: "validada",
    validada: "validada",
    preinscrita: "preinscrita",
    en_revision: "en_revision",
    pendiente: "en_revision",
    pendiente_validacion: "en_revision",
    rechazado: "rechazada",
    rechazada: "rechazada",
    cancelada: "cancelada",
  };
  return map[k] ?? k;
}

function isBlockingStatus(s?: string | null) {
  const k = normalizeStatus(s);
  return k === "preinscrita" || k === "en_revision" || k === "validada";
}

function hasBlockingRegForExam(regs: PlacementRegistro[], examId: number) {
  return regs.some((r) => r.exam_id === examId && isBlockingStatus(r.status));
}

function hasRejectedRegForExam(regs: PlacementRegistro[], examId: number) {
  return regs.some((r) => r.exam_id === examId && normalizeStatus(r.status) === "rechazada");
}

/* ============ Página con Shell ============ */
export default function PlacementAlumnoPage() {
  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Exámenes de colocación">
        <div className="p-4 sm:p-6 space-y-6">
          <header className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6" />
            <div>
              <h1 className="text-xl font-semibold">Exámenes de colocación</h1>
              <p className="text-sm text-muted-foreground">
                Consulta tus registros abajo. Usa “Ver exámenes” para abrir el
                panel lateral con los exámenes disponibles e inscribirte.
              </p>
            </div>
          </header>

          <PlacementContent />
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}

/* ============ Contenido ============ */
function PlacementContent() {
  const [openSheet, setOpenSheet] = useState(false);

  // Exámenes
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<PlacementExam[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mis registros
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [regs, setRegs] = useState<PlacementRegistro[]>([]);
  const [regsError, setRegsError] = useState<string | null>(null);

  // [FIX DESCARGA] Folios con archivo faltante detectado (404)
  const [missingFiles, setMissingFiles] = useState<Set<number>>(new Set());

  // Diálogo/estado de inscripción
  const [openDialog, setOpenDialog] = useState(false);
  const [selected, setSelected] = useState<PlacementExam | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Campos del formulario
  const [referencia, setReferencia] = useState("");
  const [importePesos, setImportePesos] = useState<string>("");
  const [fechaPago, setFechaPago] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ⬇️ NUEVO: estado del AlertDialog de cancelación
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [regToCancel, setRegToCancel] = useState<PlacementRegistro | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // ====== carga de exámenes ======
  useEffect(() => {
    let ignore = false;

    const normalize = (xs: PlacementExam[]) =>
      (xs ?? []).map((ex: any) => {
        const cupo_total = toNum(ex.cupo_total);
        const ocupados = toNum(ex.registros_ocupados ?? ex.ocupados);
        let disponibles = toNum(ex.cupo_disponible ?? ex.disponibles);
        if (disponibles === null && cupo_total !== null && ocupados !== null) {
          disponibles = Math.max(0, cupo_total - ocupados);
        }
        return {
          ...ex,
          cupo_total,
          ocupados,
          disponibles,
          costo: toNum(ex.costo),
        } as PlacementExam;
      });

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const urlPublic = `${API_BASE}/placement-exams/public?page=1&page_size=20`;
        const dataPublic = await fetchJSON(urlPublic);
        if (!ignore) setExams(normalize((dataPublic?.items ?? []) as PlacementExam[]));
        if (DEBUG && !ignore) console.debug("[PUBLIC exams] items:", dataPublic?.items);
      } catch (e: any) {
        console.warn("[placement-exams/public] falló, fallback:", e?.message || e);
        try {
          const urlFallback = `${API_BASE}/placement-exams?page=1&page_size=20&estado=activo`;
          const dataFallback = await fetchJSON(urlFallback);
          if (!ignore) setExams(normalize((dataFallback?.items ?? []) as PlacementExam[]));
          if (DEBUG && !ignore) console.debug("[FALLBACK exams] items:", dataFallback?.items);
        } catch (e2: any) {
          if (!ignore) setError(e2?.message || "No se pudo cargar la lista.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  // ====== carga de mis registros ======
  const loadMyRegs = async () => {
    setLoadingRegs(true);
    setRegsError(null);
    try {
      const data = await apiFetch<PlacementRegistro[]>(
        `${API_BASE}/placement-exams/mis-registros`,
        { auth: true }
      );
      if (DEBUG) {
        console.groupCollapsed("[mis-registros] respuesta");
        console.table(data as any);
        console.log(data);
        console.groupEnd();
      }
      setRegs(Array.isArray(data) ? data : []);
      // [FIX DESCARGA] Resetear el mapa de faltantes al recargar
      setMissingFiles(new Set());
    } catch (e: any) {
      const msg = e?.message || "No se pudieron cargar tus registros.";
      setRegsError(msg);
      toast.error(msg);
      if (DEBUG) console.error("[mis-registros] error:", e);
    } finally {
      setLoadingRegs(false);
    }
  };

  useEffect(() => {
    loadMyRegs();
  }, []);

  /* ──────────────────────────────────────────────────
     VENTANA DE INSCRIPCIÓN & anti-doble-registro
  ─────────────────────────────────────────────────── */

  const hasActiveRegForExamLegacy = (examId: number) =>
    regs.some(
      (r) =>
        r.exam_id === examId && (r.status || "").toLowerCase() !== "cancelada"
    );

  const toDate = (s?: string | null): Date | null => {
    if (!s) return null;
    const t = s.trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return new Date(`${t}T00:00:00`);
    }
    return new Date(t);
  };

  const getEnrollWindow = (ex: PlacementExam): { start: Date; end: Date } | null => {
    const startRaw =
      ex.insc_inicio ??
      ex.inscripcion_inicio ??
      ex.registro_inicio ??
      ex.periodo_insc_inicio ??
      null;

    const endRaw =
      ex.insc_fin ??
      ex.inscripcion_fin ??
      ex.registro_fin ??
      ex.periodo_insc_fin ??
      null;

    const start = toDate(startRaw);
    const end = toDate(endRaw);

    if (!start || !end) return null;

    const s = new Date(start);
    const e = new Date(end);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(startRaw ?? ""))) s.setHours(0, 0, 0, 0);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(endRaw ?? ""))) e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  };

  const isEnrollmentOpen = (ex: PlacementExam): boolean => {
    const w = getEnrollWindow(ex);
    if (!w) return false;
    const now = new Date();
    return now >= w.start && now <= w.end;
  };

  const canEnroll = (ex: PlacementExam): boolean => {
    const activo = ex.activo !== false;
    const disp = disponiblesDe(ex);
    const dispOk = disp === null ? true : disp > 0;
    return activo && dispOk && isEnrollmentOpen(ex);
  };

  const visibleExams = useMemo(() => exams.filter(canEnroll), [exams]);

  const hasData = useMemo(
    () => visibleExams && visibleExams.length > 0,
    [visibleExams]
  );

  const onOpenInscribir = (exam: PlacementExam) => {
    if (hasBlockingRegForExam(regs, exam.id)) {
      toast.error("Ya cuentas con un registro vigente para este examen.");
      return;
    }
    setSelected(exam);
    setReferencia("");
    setImportePesos("");
    setFechaPago("");
    if (fileRef.current) fileRef.current.value = "";
    setSubmitErr(null);
    setSuccessMsg(null);
    setOpenDialog(true);
  };

  function cloneFormData(src: FormData): FormData {
    const out = new FormData();
    for (const [k, v] of src.entries()) out.append(k, v);
    return out;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;

    if (!canEnroll(selected)) {
      toast.error("El periodo de inscripción para este examen no está vigente.");
      return;
    }
    if (hasBlockingRegForExam(regs, selected.id)) {
      toast.error("Ya cuentas con un registro vigente para este examen.");
      return;
    }

    setSubmitting(true);
    setSubmitErr(null);
    setSuccessMsg(null);

    let fd: FormData;
    try {
      const pesos = parseFloat(importePesos.replace(",", "."));
      if (!referencia.trim()) throw new Error("Referencia requerida.");
      if (!fechaPago) throw new Error("Fecha de pago requerida (YYYY-MM-DD).");
      if (!Number.isFinite(pesos) || pesos < 0)
        throw new Error("Importe inválido (usa pesos, p.ej. 500 o 500.50).");
      const decOk = /^\d+(\.\d{1,2})?$/.test(String(pesos));
      if (!decOk) throw new Error("El importe solo admite 2 decimales.");

      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Comprobante requerido (PDF/JPG/PNG/WEBP).");

      const importeCentavos = Math.round(pesos * 100);

      fd = new FormData();
      fd.append("referencia", referencia.trim());
      fd.append("importe_centavos", String(importeCentavos));
      fd.append("fecha_pago", fechaPago);
      fd.append("comprobante", file);
    } catch (err: any) {
      setSubmitting(false);
      const msg = err?.message || "Datos inválidos.";
      setSubmitErr(msg);
      toast.error(msg);
      return;
    }

    const createUrl = `${API_BASE}/placement-exams/${selected.id}/registros`;

    try {
      await apiFetch(createUrl, { method: "POST", body: fd, auth: true });

      toast.success("¡Tu preinscripción fue registrada!");
      setSuccessMsg("¡Tu preinscripción fue registrada!");
      setOpenDialog(false);
      await loadMyRegs();
    } catch (e: any) {
      const raw = String(e?.message || "").toLowerCase();
      const isDuplicate =
        raw.includes("ya existe un registro") ||
        raw.includes("registro para este examen") ||
        raw.includes("duplicate") ||
        raw.includes("unique");

      const rejected = regs.find(
        (r) => r.exam_id === selected.id && normalizeStatus(r.status) === "rechazada"
      );

      if (isDuplicate && rejected) {
        if (DEBUG) console.info("[reintento] Detectado registro rechazado id=", rejected.id);

        const retryUrl1 = `${API_BASE}/placement-exams/registros/${rejected.id}/reintentar`;
        const retryUrl2 = `${API_BASE}/placement-exams/registros/${rejected.id}`;

        const fdPut = cloneFormData(fd);
        fdPut.append("_action", "reintentar");

        try {
          let ok = false;
          try {
            await apiFetch(retryUrl1, { method: "POST", body: fd, auth: true });
            ok = true;
          } catch (e1: any) {
            if (DEBUG) console.warn("[reintentar POST] no disponible:", e1?.message || e1);
            await apiFetch(retryUrl2, { method: "PUT", body: fdPut, auth: true });
            ok = true;
          }

          if (ok) {
            toast.success("¡Tu reinscripción fue registrada sobre el folio rechazado!");
            setSuccessMsg("¡Tu reinscripción fue registrada!");
            setOpenDialog(false);
            await loadMyRegs();
            setSubmitting(false);
            return;
          }
        } catch (eRetry: any) {
          if (DEBUG) console.error("[reintento] falló:", eRetry);
        }
      }

      let msg = e?.message || "No se pudo enviar tu solicitud.";
      if (isDuplicate) {
        msg = rejected
          ? "Tu registro previo fue rechazado, pero el servidor no permite reintento automático. Contacta a coordinación."
          : "Ya cuentas con un registro para este examen. Si necesitas cambiar algo, cancela el registro previo (si aún está preinscrita) o contacta a coordinación.";
      }
      if (raw.includes("no hay lugares disponibles")) {
        msg = "No hay lugares disponibles para este examen.";
      }
      if (raw.includes("tipo de archivo no permitido")) {
        msg = "Tipo de archivo no permitido (usa PDF, JPG, PNG o WEBP).";
      }
      if (raw.includes("demasiado grande") || raw.includes("413")) {
        msg = "Archivo demasiado grande (máx. 5 MB).";
      }

      setSubmitErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ====== DESCARGA ====== */
  const canDownloadReg = (r: PlacementRegistro) =>
    !!r.comprobante && !missingFiles.has(r.id);

  const handleDownload = async (regId: number) => {
    try {
      await downloadPlacementComprobante(regId);
      toast.success("Comprobante descargado.");
    } catch (e: any) {
      const raw = String(e?.message || "");
      if (raw.toLowerCase().includes("archivo no encontrado") || raw.includes("404")) {
        setMissingFiles((prev) => {
          const next = new Set(prev);
          next.add(regId);
          return next;
        });
        toast.error(
          "El archivo del comprobante no está disponible en el servidor. Si reinscribiste o se sustituyó el archivo, vuelve a subirlo o contacta a coordinación."
        );
        await loadMyRegs();
        return;
      }
      toast.error(e?.message || "No se pudo descargar el comprobante.");
      if (DEBUG) console.error("[download_comprobante] error:", e);
    }
  };

  /* ====== CANCELACIÓN (remplazo de window.confirm) ====== */

  // Abre el AlertDialog con el registro objetivo
  const requestCancel = (reg: PlacementRegistro) => {
    if (normalizeStatus(reg.status) !== "preinscrita") {
      toast.error("Solo puedes cancelar mientras está preinscrita.");
      return;
    }
    setRegToCancel(reg);
    setConfirmCancelOpen(true);
  };

  // Ejecuta la cancelación tras confirmar
  const confirmCancel = async () => {
    if (!regToCancel) return;
    setCancelSubmitting(true);
    try {
      await apiFetch(`${API_BASE}/placement-exams/registros/${regToCancel.id}`, {
        method: "DELETE",
        auth: true,
      });
      toast.success("Registro cancelado.");
      setConfirmCancelOpen(false);
      setRegToCancel(null);
      await loadMyRegs();
    } catch (e: any) {
      const msg = e?.message || "No se pudo cancelar el registro.";
      toast.error(msg);
      if (DEBUG) console.error("[cancel_registro] error:", e);
    } finally {
      setCancelSubmitting(false);
    }
  };

  /* ======= Helpers de formato ======= */
  const fmtMoney = (n?: number | null) =>
    typeof n === "number"
      ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
      : "—";

  const fmtCentavos = (c?: number | null) =>
    typeof c === "number"
      ? (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
      : "—";

  return (
    <>
      {/* ——— Barra de acciones: botón que abre el sheet ——— */}
      <div className="flex justify-end">
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetTrigger asChild>
            <Button
              variant="default"
              className="h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Inscribirte</span>
              <span className="sm:hidden">Ver exámenes</span>
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="w-full sm:max-w-[60rem] overflow-y-auto p-4 sm:p-6"
          >
            <SheetHeader className="mb-3 sm:mb-4">
              <SheetTitle className="text-base sm:text-lg">Exámenes disponibles</SheetTitle>
              <SheetDescription className="text-sm">
                Solo se muestran exámenes activos, con cupo y con <b>periodo de inscripción vigente</b>.
              </SheetDescription>
            </SheetHeader>

            <div className="pb-4 sm:pb-6">
              {loading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : error ? (
                <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
              ) : !hasData ? (
                <p className="text-sm text-muted-foreground">
                  No hay exámenes con periodo de inscripción vigente.
                </p>
              ) : (
                <>
                  {/* Vista móvil: tarjetas */}
                  <div className="sm:hidden space-y-3">
                    {visibleExams.map((ex) => {
                      const yaRegistrado = hasBlockingRegForExam(regs, ex.id);
                      const disp = disponiblesDe(ex);
                      const sinCupo = disp !== null && disp <= 0;
                      return (
                        <MobileExamCard
                          key={ex.id}
                          ex={ex}
                          onInscribir={() => onOpenInscribir(ex)}
                          sinCupo={sinCupo || !canEnroll(ex) || yaRegistrado}
                          yaRegistrado={yaRegistrado}
                        />
                      );
                    })}
                  </div>

                  {/* Vista desktop: tabla */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Idioma</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Hora</TableHead>
                          <TableHead>Salón</TableHead>
                          <TableHead>Cupo (disp/total)</TableHead>
                          <TableHead>Costo</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleExams.map((ex) => {
                          const yaRegistrado = hasBlockingRegForExam(regs, ex.id);
                          const disabled = !canEnroll(ex) || yaRegistrado;
                          return (
                            <TableRow key={ex.id}>
                              <TableCell className="font-medium">
                                {ex.codigo || ex.nombre || `#${ex.id}`}
                                {yaRegistrado && (
                                  <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200">
                                    Registro vigente
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="capitalize">{ex.idioma ?? "—"}</TableCell>
                              <TableCell>{ex.fecha ?? "—"}</TableCell>
                              <TableCell>{ex.hora ?? "—"}</TableCell>
                              <TableCell>{ex.salon ?? "—"}</TableCell>
                              <TableCell>
                                <CupoPill ex={ex} />
                              </TableCell>
                              <TableCell>{fmtMoney(ex.costo)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onOpenInscribir(ex)}
                                  disabled={disabled}
                                  className="h-8 rounded-full px-3.5 py-1.5 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                                  title={
                                    yaRegistrado
                                      ? "Ya tienes un registro vigente para este examen"
                                      : !canEnroll(ex)
                                      ? "Fuera de periodo o sin cupo"
                                      : "Inscribirme"
                                  }
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                  <span className="hidden sm:inline">Inscribirme</span>
                                  <span className="sm:hidden">Inscribir</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* ——— Mis registros (contenido principal) ——— */}
      <TooltipProvider delayDuration={150}>
        <Card className="rounded-2xl">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Mis registros</CardTitle>
            <CardDescription className="text-sm">
              Consulta el estado, descarga tu comprobante o cancela tu registro.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {loadingRegs ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : regsError ? (
              <p className="text-sm text-red-600 whitespace-pre-wrap">
                {regsError}
              </p>
            ) : regs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no tienes registros.
              </p>
            ) : (
              <>
                {/* Vista móvil: tarjetas */}
                <div className="sm:hidden space-y-3">
                  {regs.map((r) => (
                    <MobileRegCard
                      key={r.id}
                      r={r}
                      onCancel={() => requestCancel(r)}  
                      onDownload={() => handleDownload(r.id)}
                      canDownload={canDownloadReg(r)}
                    />
                  ))}
                </div>

                {/* Vista desktop: tabla */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Examen</TableHead>
                        <TableHead>Fecha pago</TableHead>
                        <TableHead>Referencia</TableHead>
                        <TableHead>Importe</TableHead>
                        <TableHead>Nivel asignado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {r.exam?.codigo ?? `#${r.exam_id}`}
                          </TableCell>
                          <TableCell>{r.fecha_pago ?? "—"}</TableCell>
                          <TableCell className="break-all">{r.referencia ?? "—"}</TableCell>
                          <TableCell>{fmtCentavos(r.importe_centavos)}</TableCell>
                          <TableCell>
                            {(() => {
                              const nivelKey = getNivelAsignado(r);
                              const label = nivelLabel(nivelKey);
                              return label === "—" ? (
                                <span className={nivelClass("—")}>—</span>
                              ) : (
                                <span className={nivelClass(nivelKey)} title="Asignado por el docente">
                                  {label}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <StatusCell registro={r} />
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownload(r.id)}
                              disabled={!canDownloadReg(r)}
                              title={
                                !r.comprobante
                                  ? "Sin comprobante"
                                  : missingFiles.has(r.id)
                                  ? "Archivo no disponible en el servidor"
                                  : ""
                              }
                              className="h-8"
                            >
                              Descargar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => requestCancel(r)} 
                              disabled={normalizeStatus(r.status) !== "preinscrita"}
                              title={
                                normalizeStatus(r.status) !== "preinscrita"
                                  ? "Solo puedes cancelar mientras está preinscrita"
                                  : "Cancelar inscripción"
                              }
                              className="h-8"
                            >
                              Cancelar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* ——— Diálogo de inscripción ——— */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Inscripción a examen</DialogTitle>
            <DialogDescription>
              Carga tu comprobante de pago. Formatos permitidos: PDF/JPG/PNG/WEBP
              (máx. 5&nbsp;MB).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Examen</Label>
                <div className="text-sm font-medium break-words">
                  {selected
                    ? `${selected.codigo || selected.nombre || ""} · ${
                        selected.fecha || "—"
                      } ${selected.hora || ""}`
                    : "—"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="referencia">Referencia</Label>
                  <Input
                    id="referencia"
                    placeholder="Ej. 123ABC"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="importe">Importe (pesos MXN)</Label>
                  <Input
                    id="importe"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Ej. 500 o 500.50"
                    value={importePesos}
                    onChange={(e) => setImportePesos(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="fecha_pago">Fecha de pago</Label>
                  <Input
                    id="fecha_pago"
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="comprobante">Comprobante</Label>
                  <Input
                    id="comprobante"
                    type="file"
                    ref={fileRef}
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    required
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            {submitErr && <p className="text-sm text-red-600">{submitErr}</p>}
            {successMsg && (
              <p className="text-sm text-green-600">{successMsg}</p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenDialog(false)}
                disabled={submitting}
                className="h-10"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="h-10">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
                  </>
                ) : (
                  "Enviar inscripción"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ——— NUEVO: AlertDialog de confirmación de cancelación ——— */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscripción</AlertDialogTitle>
            <AlertDialogDescription>
              {regToCancel ? (
                <>
                  ¿Deseas cancelar la inscripción del folio{" "}
                  <b>{regToCancel.exam?.codigo ?? `#${regToCancel.exam_id}`}</b>?<br />
                  Esta acción no se puede deshacer.
                </>
              ) : (
                "¿Deseas cancelar esta inscripción? Esta acción no se puede deshacer."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              className="h-10"
              disabled={cancelSubmitting}
            >
              No, conservar
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmCancel}
              disabled={cancelSubmitting}
            >
              {cancelSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando…
                </>
              ) : (
                "Sí, cancelar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ===== Helpers (fetch y UI status) ===== */
async function fetchJSON(url: string) {
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  const ct = resp.headers.get("content-type") || "";
  const bodyText = await resp.text();
  const body = ct.includes("application/json") ? safeParse(bodyText) : bodyText;

  if (!resp.ok) {
    throw new Error(
      typeof body === "string"
        ? `HTTP ${resp.status}: ${body}`
        : `HTTP ${resp.status}: ${JSON.stringify(body)}`
    );
  }
  return typeof body === "string" ? safeParse(body) : body;
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function prettyStatus(s: string) {
  switch ((s || "").toLowerCase()) {
    case "preinscrita":
      return "Preinscrita";
    case "validada":
      return "Validada";
    case "rechazada":
      return "Rechazada";
    case "cancelada":
      return "Cancelada";
    default:
      return s || "—";
  }
}

function statusMeta(s: string) {
  const k = normalizeStatus(s);
  switch (k) {
    case "preinscrita":
      return { key: k, label: "Preinscrita", tone: "amber", Icon: Clock };
    case "validada":
      return { key: k, label: "Validada", tone: "emerald", Icon: CheckCircle2 };
    case "en_revision":
      return { key: k, label: "En revisión", tone: "amber", Icon: Clock };
    case "rechazada":
      return { key: k, label: "Rechazada", tone: "red", Icon: XCircle };
    case "cancelada":
      return { key: k, label: "Cancelada", tone: "slate", Icon: Ban };
    default:
      return { key: k, label: s || "—", tone: "zinc", Icon: Clock };
  }
}

function pillClass(tone: string) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1";
  switch (tone) {
    case "amber":
      return `${base} bg-amber-50 text-amber-700 ring-amber-200`;
    case "emerald":
      return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200`;
    case "red":
      return `${base} bg-red-50 text-red-700 ring-red-200`;
    case "slate":
      return `${base} bg-slate-50 text-slate-700 ring-slate-200`;
    default:
      return `${base} bg-zinc-50 text-zinc-700 ring-zinc-200`;
  }
}

function getRejectionReason(r: any): string {
  const raw =
    r?.rechazo_motivo ??
    r?.motivo_rechazo ??
    r?.validation_notes ??
    r?.motivo ??
    r?.reject_reason ??
    "";

  const txt = (typeof raw === "string" ? raw : String(raw ?? "")).trim();
  if (txt) return txt;

  if (normalizeStatus(r?.status) === "rechazada") {
    return "Motivo no disponible. Contacta a coordinación si necesitas más detalle.";
  }
  return "";
}

function getNivelAsignado(r: PlacementRegistro): string | "—" {
  const raw =
    r.nivel_idioma ??
    r.nivel_asignado ??
    r.nivel ??
    (r as any)?.alumno_nivel ??
    null;
  const key = normalizeNivelKey(raw);
  return key ?? "—";
}

function StatusCell({ registro }: { registro: PlacementRegistro }) {
  const meta = statusMeta(registro.status);
  const { Icon } = meta;
  const reason = getRejectionReason(registro);

  const showTooltip = meta.key === "rechazada";

  const badge = (
    <span
      className={pillClass(meta.tone) + (showTooltip ? " cursor-help" : "")}
      title={showTooltip ? reason : undefined}
      tabIndex={showTooltip ? 0 : -1}
      role={showTooltip ? "button" : "status"}
      aria-label={showTooltip ? `Rechazada. Motivo: ${reason}` : meta.label}
      data-status={meta.key}
      data-has-reason={String(!!reason)}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-[min(80vw,420px)] text-sm"
        >
          <div className="font-medium mb-1">Motivo del rechazo</div>
          <p className="whitespace-pre-wrap break-words max-h-60 overflow-auto">
            {reason}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <div className="flex items-center gap-2">{badge}</div>;
}

/* ===================== VISTAS MÓVILES (Cards) ===================== */

function MobileExamCard({
  ex,
  onInscribir,
  sinCupo,
  yaRegistrado = false,
}: {
  ex: PlacementExam;
  onInscribir: () => void;
  sinCupo: boolean;
  yaRegistrado?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white/70 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide bg-[#7c0040]/10 text-[#7c0040] border-[#7c0040]/30">
            {ex.codigo ? ex.codigo : `#${ex.id}`}
          </span>

          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide bg-blue-50 text-blue-700 border-blue-200 capitalize">
            {ex.idioma ?? "—"}
          </span>

          {yaRegistrado && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200">
              Ya registrado
            </span>
          )}
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs text-neutral-500">Costo</span>
          <div className="text-sm font-medium">
            {typeof ex.costo === "number"
              ? ex.costo.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
              : "—"}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-700">
        <div><b>Fecha:</b> {ex.fecha ?? "—"}</div>
        <div><b>Hora:</b> {ex.hora ?? "—"}</div>
        <div><b>Salón:</b> {ex.salon ?? "—"}</div>
        <div className="flex items-center gap-1">
          <b>Cupo:</b> <CupoPill ex={ex} />
        </div>
      </div>

      <div className="mt-3">
        <Button
          onClick={onInscribir}
          disabled={sinCupo || yaRegistrado}
          variant="outline"
          className="w-full h-10 rounded-xl border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
          title={
            yaRegistrado
              ? "Ya cuentas con un registro para este examen"
              : sinCupo
              ? "Sin lugares disponibles o fuera de periodo"
              : "Inscribirme"
          }
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Inscribirme
        </Button>
      </div>
    </div>
  );
}

function MobileRegCard({
  r,
  onCancel,
  onDownload,
  canDownload,
}: {
  r: PlacementRegistro;
  onCancel: () => void;
  onDownload: () => void;
  canDownload: boolean;
}) {
  const nivelKey = getNivelAsignado(r);
  const nivelTxt = nivelLabel(nivelKey);
  const meta = statusMeta(r.status);
  const { Icon } = meta;

  return (
    <div className="rounded-xl border bg-white/70 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">
            {r.exam?.codigo ?? `#${r.exam_id}`}
          </div>
          <div className="mt-0.5 text-[12px] text-neutral-600">
            <b>Ref:</b>{" "}
            <span className="break-all">{r.referencia ?? "—"}</span>
          </div>
        </div>
        <span className={pillClass(meta.tone)}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-700">
        <div><b>Fecha pago:</b> {r.fecha_pago ?? "—"}</div>
        <div>
          <b>Importe:</b>{" "}
          {typeof r.importe_centavos === "number"
            ? (r.importe_centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
            : "—"}
        </div>
        <div className="col-span-2">
          <b>Nivel asignado:</b>{" "}
          {nivelTxt === "—" ? (
            <span className={nivelClass("—")}>—</span>
          ) : (
            <span className={nivelClass(nivelKey)}>{nivelTxt}</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={onDownload}
          disabled={!canDownload}
          className="h-10 rounded-xl"
          title={
            !r.comprobante
              ? "Sin comprobante"
              : !canDownload
              ? "Archivo no disponible en el servidor"
              : ""
          }
        >
          Descargar
        </Button>
        <Button
          variant="destructive"
          onClick={onCancel}
          disabled={normalizeStatus(r.status) !== "preinscrita"}
          className="h-10 rounded-xl"
          title={
            normalizeStatus(r.status) !== "preinscrita"
              ? "Solo puedes cancelar mientras está preinscrita"
              : "Cancelar inscripción"
          }
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
