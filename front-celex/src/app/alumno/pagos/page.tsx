// app/alumno/pagos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  listMisInscripciones,
  downloadArchivoInscripcion, // (id: number, tipo: "comprobante" | "exencion" | "estudios")
} from "@/lib/api";

import {
  Loader2,
  FileDown,
  ReceiptText,
  ShieldCheck,
  FileQuestion,
  BadgeDollarSign,
  CalendarDays,
  Info,
} from "lucide-react";

/* ===== Tipos mínimos que usamos aquí ===== */
type InscripcionLite = {
  id: number;
  ciclo_id: number;
  status: string; // registrada | preinscrita | confirmada | rechazada | en_revision ...
  tipo?: "pago" | "exencion"; // si tu backend lo llama diferente, se adapta en map
  referencia?: string | null;
  importe_centavos?: number | null;
  fecha_pago?: string | null; // YYYY-MM-DD
  ciclo?: {
    codigo?: string;
    idioma?: string;
    nivel?: string;
    modalidad?: string;
    turno?: string;
  };
  // flags opcionales si tu API ya los expone:
  has_comprobante?: boolean;
  has_exencion?: boolean;
  has_estudios?: boolean;
};

/* ===== Helpers ===== */
function moneyMXN(centavos?: number | null) {
  if (centavos == null) return "—";
  const value = Math.round(centavos) / 100;
  try {
    return value.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    });
  } catch {
    return `MXN ${value.toFixed(2)}`;
  }
}

function d(s?: string | null) {
  if (!s) return "—";
  const dt = new Date(`${s}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString("es-MX");
}

function statusBadgeTone(status: string) {
  const s = status.toLowerCase();
  if (["confirmada", "validada", "aceptada"].includes(s)) {
    return { variant: "secondary" as const, className: "bg-emerald-100 text-emerald-900 border-emerald-200" };
  }
  if (["preinscrita", "en_revision", "en revisión", "pendiente"].includes(s)) {
    return { variant: "secondary" as const, className: "bg-amber-100 text-amber-900 border-amber-200" };
  }
  if (["rechazada", "cancelada"].includes(s)) {
    return { variant: "secondary" as const, className: "bg-red-100 text-red-900 border-red-200" };
  }
  return { variant: "outline" as const, className: "" };
}

export default function AlumnoPagosPage() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<InscripcionLite[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await listMisInscripciones(); // tu helper ya existe
        // Normaliza campos mínimos que necesitamos
        const mapped: InscripcionLite[] = (data ?? []).map((raw: any) => ({
          id: raw.id,
          ciclo_id: raw.ciclo_id ?? raw.ciclo?.id,
          status: raw.status ?? raw.estado ?? "pendiente",
          tipo: (raw.tipo ?? raw.payment_type ?? (raw.referencia ? "pago" : raw.comprobante_exencion ? "exencion" : undefined)) as any,
          referencia: raw.referencia ?? raw.payment_ref ?? null,
          importe_centavos: raw.importe_centavos ?? raw.amount_centavos ?? null,
          fecha_pago: raw.fecha_pago ?? null,
          ciclo: {
            codigo: raw.ciclo?.codigo ?? raw.curso?.codigo ?? "",
            idioma: raw.ciclo?.idioma ?? raw.curso?.idioma ?? "",
            nivel: raw.ciclo?.nivel ?? raw.curso?.nivel ?? "",
            modalidad: raw.ciclo?.modalidad ?? raw.curso?.modalidad ?? "",
            turno: raw.ciclo?.turno ?? raw.curso?.turno ?? "",
          },
          has_comprobante: raw.has_comprobante ?? !!raw.comprobante,
          has_exencion: raw.has_exencion ?? !!raw.comprobante_exencion,
          has_estudios: raw.has_estudios ?? !!raw.comprobante_estudios,
        }));
        setItems(mapped);
      } catch (e: any) {
        console.error(e);
        toast.error("No se pudieron cargar tus pagos y exenciones.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay = `${it.ciclo?.codigo ?? ""} ${it.status} ${it.tipo ?? ""} ${it.referencia ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  async function onDownload(id: number, tipo: "comprobante" | "exencion" | "estudios") {
    try {
      await downloadArchivoInscripcion(id, tipo);
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("404") || msg.includes("no encontrado")) {
        toast.error(`No hay archivo de ${tipo} para esta inscripción.`);
      } else {
        toast.error(`No se pudo descargar el archivo de ${tipo}.`);
      }
    }
  }

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="Pagos y Exenciones">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Mis pagos / exenciones</CardTitle>
              <div className="w-72">
                <Input
                  placeholder="Buscar por código, estatus o referencia…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No hay registros que coincidan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px] text-left">Curso</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead className="text-center">Referencia</TableHead>
                        <TableHead className="text-center">Importe</TableHead>
                        <TableHead className="text-center">Fecha de pago</TableHead>
                        <TableHead className="text-center">Archivos</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((it) => {
                        const curso =
                          `${it.ciclo?.codigo ?? "—"} • ${it.ciclo?.idioma ?? ""} ${it.ciclo?.nivel ?? ""} • ${it.ciclo?.modalidad ?? ""}/${it.ciclo?.turno ?? ""}`.trim();
                        const tone = statusBadgeTone(it.status || "");

                        return (
                          <TableRow key={it.id} className="align-top">
                            <TableCell className="text-left">
                              <div className="font-medium">{curso}</div>
                              <div className="text-xs text-muted-foreground">ID inscripción: {it.id}</div>
                            </TableCell>

                            <TableCell className="text-center">
                              {it.tipo === "exencion" ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <ShieldCheck className="h-4 w-4" /> Exención
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <ReceiptText className="h-4 w-4" /> Pago
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center text-sm">{it.referencia || "—"}</TableCell>

                            <TableCell className="text-center text-sm">
                              {it.tipo === "exencion" ? "—" : moneyMXN(it.importe_centavos)}
                            </TableCell>

                            <TableCell className="text-center text-sm">
                              {it.tipo === "exencion" ? "—" : (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-4 w-4" /> {d(it.fecha_pago)}
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                {/* Comprobante de pago */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  disabled={it.tipo === "exencion"}
                                  onClick={() => onDownload(it.id, "comprobante")}
                                  title="Descargar comprobante de pago"
                                >
                                  <FileDown className="h-4 w-4 mr-1" />
                                  Comprobante
                                </Button>

                                {/* Exención */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  disabled={it.tipo !== "exencion"}
                                  onClick={() => onDownload(it.id, "exencion")}
                                  title="Descargar comprobante de exención"
                                >
                                  <FileDown className="h-4 w-4 mr-1" />
                                  Exención
                                </Button>

                                {/* Estudios (solo algunas IPN/pago) */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => onDownload(it.id, "estudios")}
                                  title="Descargar comprobante de estudios (si aplica)"
                                >
                                  <FileDown className="h-4 w-4 mr-1" />
                                  Estudios
                                </Button>
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              <Badge variant={tone.variant} className={tone.className}>
                                {it.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Nota informativa */}
                  <div className="mt-3 text-[12px] text-neutral-600 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5" />
                    <p>
                      Si un botón de descarga marca error, puede deberse a que aún no has cargado ese archivo
                      o está en revisión. Para pagos: muestra <BadgeDollarSign className="inline h-3 w-3" /> importe y{" "}
                      <CalendarDays className="inline h-3 w-3" /> fecha cuando han sido capturados.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}
