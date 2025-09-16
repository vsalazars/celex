"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import type { Idioma, PlacementExam, Paginated } from "@/lib/types";
import { API_URL } from "@/lib/constants";
import { getToken } from "@/lib/sessions";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableHeader, TableHead, TableRow, TableCell, TableBody,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormField, FormItem, FormLabel, FormMessage, FormControl,
} from "@/components/ui/form";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

// 👉 NUEVO: rango de fechas (shadcn + react-day-picker)
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* ======================================================
                    Validación (Zod)
   ====================================================== */
const idiomas: Idioma[] = ["ingles", "frances", "aleman", "italiano", "portugues"];

const createSchema = z.object({
  codigo: z.string().min(2, "Requerido"),
  idioma: z.enum([idiomas[0], ...idiomas.slice(1)] as [Idioma, ...Idioma[]]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:mm"),
  salon: z.string().max(120).optional(),
  duracion_min: z.coerce.number().int().positive("Minutos > 0"),
  cupo_total: z.coerce.number().int().nonnegative("Cupo ≥ 0"),
  costo: z.coerce.number().nonnegative("No puede ser negativo").optional(),
  docente_id: z.coerce.number().int().optional(),
  instrucciones: z.string().optional(),

  // Ventana de inscripción (llenada por el selector de rango)
  insc_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Requerido"),
  insc_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Requerido"),
}).superRefine((v, ctx) => {
  const from = new Date(`${v.insc_from}T00:00:00`);
  const to = new Date(`${v.insc_to}T23:59:59`);
  if (isNaN(from.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida", path: ["insc_from"] });
  }
  if (isNaN(to.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida", path: ["insc_to"] });
  }
  if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from > to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe ser ≤ que 'al'", path: ["insc_from"] });
  }
});

type CreateFormValues = z.infer<typeof createSchema>;

/* ======================================================
                       Helpers
   ====================================================== */
const IDIOMAS_OPTS: { value: Idioma; label: string }[] = [
  { value: "ingles", label: "Inglés" },
  { value: "frances", label: "Francés" },
  { value: "aleman", label: "Alemán" },
  { value: "italiano", label: "Italiano" },
  { value: "portugues", label: "Portugués" },
];
const idiomaLabel = (v: Idioma) => IDIOMAS_OPTS.find(i => i.value === v)?.label ?? v;

const money = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
    : (0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const authHeaders = () => {
  try {
    const t = typeof getToken === "function" ? getToken() : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
};

function inferFilenameFromResponse(resp: Response): string | null {
  const cd = resp.headers.get("content-disposition") || "";
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
  if (match?.[1]) return decodeURIComponent(match[1].replace(/\"/g, ""));
  return null;
}

// Lector tolerante del periodo de inscripción para la tabla
function pickInscripcionWindowRow(e: any) {
  const ins = e?.inscripcion || e?.registro || undefined;
  const from =
    ins?.from ??
    e?.insc_inicio ??
    e?.inscripcion_inicio ??
    e?.registro_inicio ??
    e?.insc_from ??
    null;
  const to =
    ins?.to ??
    e?.insc_fin ??
    e?.inscripcion_fin ??
    e?.registro_fin ??
    e?.insc_to ??
    null;
  return { from, to };
}

// Normaliza a YYYY-MM-DD sin offset de zona
const toYMD = (d?: Date) =>
  d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10) : "";

/* ======================================================
                   Componente principal
   ====================================================== */
export default function CoordinatorPlacement() {
  /* ======= Listado de exámenes ======= */
  const [items, setItems] = React.useState<PlacementExam[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(10);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  /* ======= Docentes (select) ======= */
  type Teacher = { id: number; name: string };
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = React.useState(false);

  const fetchTeachers = React.useCallback(async () => {
    setLoadingTeachers(true);
    try {
      const res = await fetch(`${API_URL}/placement-exams/teachers`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = (await res.json()) as Teacher[];
      setTeachers(data);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron cargar docentes");
      setTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/placement-exams`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(pageSize));
      if (q) url.searchParams.set("q", q);

      const res = await fetch(url.toString(), {
        headers: { ...authHeaders() },
        cache: "no-store",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error ${res.status}`);
      }
      const data = (await res.json()) as Paginated<PlacementExam>;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cargar la lista");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  /* ======= Crear examen (modal) ======= */
  const [open, setOpen] = React.useState(false);

  // 👉 Estado del rango de inscripción
  const [inscRange, setInscRange] = React.useState<DateRange | undefined>();

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      codigo: "",
      idioma: "ingles",
      fecha: "",
      hora: "",
      salon: "",
      duracion_min: 90,
      cupo_total: 30,
      costo: 0,
      docente_id: undefined,
      instrucciones: "",
      insc_from: "",
      insc_to: "",
    },
    mode: "onBlur",
  });

  const onSelectRange = (range?: DateRange) => {
    setInscRange(range);
    const fromStr = toYMD(range?.from);
    const toStr = toYMD(range?.to);
    form.setValue("insc_from", fromStr, { shouldValidate: true, shouldDirty: true });
    form.setValue("insc_to", toStr, { shouldValidate: true, shouldDirty: true });
    form.trigger(["insc_from", "insc_to"]);
  };

  React.useEffect(() => {
    if (open && teachers.length === 0) fetchTeachers();
  }, [open, teachers.length, fetchTeachers]);

  const [saving, setSaving] = React.useState(false);

  const onCreate = async (values: CreateFormValues) => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        codigo: values.codigo.trim(),
        nombre: values.codigo.trim(),
        idioma: values.idioma,
        fecha: values.fecha,
        hora: values.hora,
        salon: values.salon?.trim() || undefined,
        duracion_min: values.duracion_min,
        cupo_total: values.cupo_total,
        costo: values.costo ?? undefined,
        docente_id: values.docente_id ?? undefined,
        instrucciones: values.instrucciones?.trim() || undefined,

        // Ventana de inscripción
        insc_inicio: values.insc_from,
        insc_fin: values.insc_to,

        // (opcional por compat)
        inscripcion: { from: values.insc_from, to: values.insc_to },
      };

      const res = await fetch(`${API_URL}/placement-exams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error ${res.status}`);
      }

      toast.success("Examen de colocación creado");
      setOpen(false);
      form.reset();
      setInscRange(undefined);
      setPage(1);
      fetchList();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear el examen");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("¿Eliminar este examen?")) return;
    try {
      const res = await fetch(`${API_URL}/placement-exams/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error ${res.status}`);
      }
      toast.success("Examen eliminado");
      fetchList();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  };

  /* ======================================================
                Validación de pagos: Sheet lateral
     ====================================================== */
  const [payOpen, setPayOpen] = React.useState(false);
  const [payExam, setPayExam] = React.useState<PlacementExam | null>(null);
  const [payLoading, setPayLoading] = React.useState(false);
  const [payRows, setPayRows] = React.useState<any[]>([]);

  const fetchPagos = React.useCallback(async (examId: number) => {
    setPayLoading(true);
    try {
      const res = await fetch(`${API_URL}/placement-exams/${examId}/registros-admin`, {
        headers: { ...authHeaders() },
        cache: "no-store",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error ${res.status}`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setPayRows(items);
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar los pagos");
      setPayRows([]);
    } finally {
      setPayLoading(false);
    }
  }, []);

  const openPagos = (exam: PlacementExam) => {
    setPayExam(exam);
    setPayOpen(true);
    fetchPagos(exam.id);
  };

  const canValidate = (s: string) => (s || "").toLowerCase() === "preinscrita";

  const approvePago = async (regId: number) => {
    try {
      const res = await fetch(`${API_URL}/placement-exams/registros/${regId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error ${res.status}`);
      }
      toast.success("Pago validado");
      if (payExam) fetchPagos(payExam.id);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo validar el pago");
    }
  };

  const rejectPago = async (regId: number, motivo: string) => {
    try {
      const res = await fetch(`${API_URL}/placement-exams/registros/${regId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "REJECT", motivo }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error ${res.status}`);
      }
      toast.success("Pago rechazado");
      if (payExam) fetchPagos(payExam.id);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo rechazar el pago");
    }
  };

  const downloadComprobanteAdmin = async (regId: number) => {
    try {
      const res = await fetch(`${API_URL}/placement-exams/registros/${regId}/comprobante-admin`, {
        headers: { ...authHeaders(), Accept: "*/*" },
      });
    }
    catch (e: any) {
      toast.error(e?.message || "No se pudo descargar el comprobante");
      return;
    }
  };

  /* ====== PREVIEW MODAL (Ver comprobante) ====== */
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerUrl, setViewerUrl] = React.useState<string | null>(null);
  const [viewerMime, setViewerMime] = React.useState<string | null>(null);
  const [viewerName, setViewerName] = React.useState<string>("comprobante");

  const openViewer = async (regId: number) => {
    try {
      const res = await fetch(`${API_URL}/placement-exams/registros/${regId}/comprobante-admin`, {
        headers: { ...authHeaders(), Accept: "*/*" },
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const mime = blob.type || res.headers.get("content-type") || "";
      const name = inferFilenameFromResponse(res) || `comprobante_${regId}`;
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
      setViewerUrl(url);
      setViewerMime(mime.toLowerCase());
      setViewerName(name);
      setViewerOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo abrir el comprobante");
    }
  };

  const closeViewer = () => {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    setViewerUrl(null);
    setViewerMime(null);
    setViewerOpen(false);
  };

  React.useEffect(() => {
    return () => {
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    };
  }, [viewerUrl]);

  /* ====== REJECT MODAL (motivo rechazo) ====== */
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectRegId, setRejectRegId] = React.useState<number | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejecting, setRejecting] = React.useState(false);

  const openReject = (regId: number) => {
    setRejectRegId(regId);
    setRejectReason("");
    setRejectOpen(true);
  };

  const submitReject = async () => {
    const motivo = rejectReason.trim();
    if (motivo.length < 6) {
      toast.error("El motivo debe tener al menos 6 caracteres.");
      return;
    }
    if (!rejectRegId) return;
    setRejecting(true);
    try {
      await rejectPago(rejectRegId, motivo);
      setRejectOpen(false);
    } finally {
      setRejecting(false);
    }
  };

  /* ======================================================
                              UI
     ====================================================== */
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Exámenes de colocación</CardTitle>

          {/* Modal para crear examen */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Nuevo examen</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo examen de colocación</DialogTitle>
                <DialogDescription>
                  Captura los datos y guarda para publicar el examen.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreate)} className="grid gap-4">
                  {/* === Fila: código + idioma === */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="codigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código del examen</FormLabel>
                          <FormControl>
                            <Input placeholder="EJ: PLC-SEP-2025-01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="idioma"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Idioma</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={(v) => field.onChange(v as Idioma)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona idioma" />
                              </SelectTrigger>
                              <SelectContent>
                                {IDIOMAS_OPTS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* === Fila: fecha + hora + salón === */}
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="fecha"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hora"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hora</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="salon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salón</FormLabel>
                          <FormControl>
                            <Input placeholder="Aula / Sala (opcional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* === Rango de inscripción (date range) === */}
                  <div className="grid gap-2">
                    <FormLabel>Periodo de inscripción</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {inscRange?.from && inscRange?.to ? (
                            <>
                              {format(inscRange.from, "dd/MM/yyyy", { locale: es })} –{" "}
                              {format(inscRange.to, "dd/MM/yyyy", { locale: es })}
                            </>
                          ) : (
                            <span>Selecciona rango</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          numberOfMonths={2}
                          selected={inscRange}
                          onSelect={onSelectRange}
                          locale={es}
                          defaultMonth={inscRange?.from}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Inputs ocultos para que Zod valide y para enviar al back */}
                    <div className="hidden">
                      <FormField
                        control={form.control}
                        name="insc_from"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="text" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="insc_to"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="text" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Mensaje de error combinado */}
                    {(form.formState.errors.insc_from || form.formState.errors.insc_to) && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.insc_from?.message ||
                          form.formState.errors.insc_to?.message ||
                          "Selecciona un rango válido"}
                      </p>
                    )}
                  </div>

                  {/* duración / cupo / costo */}
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="duracion_min"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duración (min)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cupo_total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cupo total</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="costo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Costo (MXN)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="1"
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* docente */}
                  <FormField
                    control={form.control}
                    name="docente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Docente</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ? String(field.value) : ""}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={loadingTeachers ? "Cargando..." : "Selecciona docente (opcional)"} />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.map(t => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* instrucciones */}
                  <FormField
                    control={form.control}
                    name="instrucciones"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instrucciones (opcional)</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Indicaciones para los aspirantes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter className="gap-2">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Guardando…" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="grid gap-4">
          {/* Buscador */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por código, nombre o texto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  fetchList();
                }
              }}
              className="max-w-sm"
            />
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                fetchList();
              }}
            >
              Buscar
            </Button>
          </div>

          {/* Tabla de exámenes */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Salón</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Cupo</TableHead>
                  <TableHead>Disponible</TableHead>
                  <TableHead>Inscripción</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11}>Cargando…</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={11}>Sin resultados</TableCell></TableRow>
                ) : (
                  items.map((it) => {
                    const codigo = (it as any).codigo ?? it.nombre;
                    const disponible = (it as any).cupo_disponible;
                    const { from: insFrom, to: insTo } = pickInscripcionWindowRow(it);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{codigo}</TableCell>
                        <TableCell><Badge variant="secondary">{idiomaLabel((it as any).idioma)}</Badge></TableCell>
                        <TableCell>{it.fecha}</TableCell>
                        <TableCell>{it.hora}</TableCell>
                        <TableCell>{(it as any).salon ?? "-"}</TableCell>
                        <TableCell>{it.duracion_min} min</TableCell>
                        <TableCell>{it.cupo_total}</TableCell>
                        <TableCell>
                          {typeof disponible === "number" ? (
                            <Badge variant={disponible > 0 ? "secondary" : "destructive"}>
                              {disponible}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {insFrom && insTo ? `${insFrom} – ${insTo}` : "—"}
                        </TableCell>
                        <TableCell>{money((it as any).costo)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => openPagos(it)}>
                            Pagos
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => onDelete(it.id)}>
                            Eliminar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación simple */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {items.length ? `Mostrando ${items.length} de ${total}` : `0 de ${total}`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== Sheet lateral de Pagos por examen ====== */}
      <Sheet open={payOpen} onOpenChange={setPayOpen}>
        <SheetContent
          side="left"
          className="!w-screen sm:!w-[70vw] !max-w-none overflow-y-auto p-4 sm:p-6"
          style={{ width: "70vw", maxWidth: "70vw" }}
        >
          <SheetHeader>
            <SheetTitle>
              Pagos — {payExam ? ((payExam as any).codigo ?? payExam.nombre) : "—"}
            </SheetTitle>
            <SheetDescription>
              Valida o rechaza los pagos enviados por los alumnos. Sólo puedes cambiar los que están <strong>preinscrita</strong>.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Fecha pago</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo rechazo</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payLoading ? (
                  <TableRow><TableCell colSpan={8}>Cargando…</TableCell></TableRow>
                ) : payRows.length === 0 ? (
                  <TableRow><TableCell colSpan={8}>Sin registros</TableCell></TableRow>
                ) : (
                  payRows.map((r) => {
                    const nombre =
                      (r.alumno?.first_name?.trim() || "") +
                      (r.alumno?.last_name ? ` ${r.alumno?.last_name}` : "");
                    const status = (r.status || "").toLowerCase();
                    const motivo = (r.rechazo_motivo ?? "").trim();
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-[220px]">
                          <div className="font-medium truncate">
                            {nombre.trim() || r.alumno?.email || "—"}
                          </div>
                          {r.alumno?.email && (
                            <div className="text-xs text-muted-foreground truncate">{r.alumno.email}</div>
                          )}
                        </TableCell>
                        <TableCell>{r.referencia ?? "—"}</TableCell>
                        <TableCell>
                          {typeof r.importe_centavos === "number"
                            ? (r.importe_centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })
                            : "—"}
                        </TableCell>
                        <TableCell>{r.fecha_pago ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={
                            status === "validada" ? "default" :
                            status === "rechazada" ? "destructive" :
                            status === "cancelada" ? "outline" : "secondary"
                          }>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {motivo ? (
                            <span className="inline-block max-w-[260px] truncate" title={motivo}>
                              {motivo}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openViewer(r.id)}
                            disabled={!r.comprobante}
                            title={!r.comprobante ? "Sin comprobante" : "Ver comprobante"}
                          >
                            Ver
                          </Button>
                          {/* Descarga directa en el viewer modal */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openViewer(r.id)}
                            disabled={!r.comprobante}
                            title={!r.comprobante ? "Sin comprobante" : "Descargar/Ver"}
                          >
                            Descargar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approvePago(r.id)}
                            disabled={!canValidate(r.status)}
                            title={!canValidate(r.status) ? "Sólo preinscrita" : ""}
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openReject(r.id)}
                            disabled={!canValidate(r.status)}
                            title={!canValidate(r.status) ? "Sólo preinscrita" : ""}
                          >
                            Rechazar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 py-4">
            {payExam && (
              <Button
                variant="outline"
                onClick={() => fetchPagos(payExam.id)}
                disabled={payLoading}
              >
                Refrescar
              </Button>
            )}
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cerrar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ====== Modal viewer del comprobante ====== */}
      <Dialog open={viewerOpen} onOpenChange={(o) => (o ? setViewerOpen(true) : closeViewer())}>
        <DialogContent className="!max-w-[95vw] !w-[95vw] sm:!max-w-6xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="truncate">{viewerName}</DialogTitle>
            <DialogDescription className="flex items-center gap-3">
              Vista previa del comprobante.{" "}
              {viewerUrl && (
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Abrir en nueva pestaña
                </a>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6">
            {viewerUrl ? (
              viewerMime?.includes("pdf") ? (
                <iframe
                  src={viewerUrl}
                  className="w-full h-[75vh] rounded-md border"
                  title="comprobante-pdf"
                />
              ) : viewerMime?.startsWith("image/") ? (
                <div className="w-full h-[75vh] flex items-center justify-center bg-muted/30 rounded-md border overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={viewerUrl}
                    alt="comprobante"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Tipo de archivo no previsualizable ({viewerMime || "desconocido"}). Usa{" "}
                  <button
                    className="underline"
                    onClick={() => {
                      if (!viewerUrl) return;
                      const a = document.createElement("a");
                      a.href = viewerUrl;
                      a.download = viewerName || "comprobante";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                  >
                    descargar
                  </button>.
                </div>
              )
            ) : (
              <div className="text-sm text-muted-foreground">Cargando…</div>
            )}
          </div>

          <div className="px-6 pb-6">
            <DialogClose asChild>
              <Button onClick={closeViewer}>Cerrar</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Modal de motivo de rechazo ====== */}
      <Dialog open={rejectOpen} onOpenChange={(o) => setRejectOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar pago</DialogTitle>
            <DialogDescription>
              Escribe el motivo del rechazo (mínimo 6 caracteres). Este mensaje puede ser visible para el alumno.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              autoFocus
              placeholder="Ej. El comprobante no corresponde al importe indicado…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              {Math.max(0, 6 - rejectReason.trim().length)} caracteres para el mínimo
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={submitReject}
              disabled={rejecting || rejectReason.trim().length < 6}
            >
              {rejecting ? "Rechazando…" : "Rechazar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
