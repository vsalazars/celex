"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, Printer, RefreshCcw } from "lucide-react";
import { Idioma } from "./useReportFilters"; // path correcto
import {
  listPlacementExamsLite,
  getPlacementRegistrosAdmin,
  type PlacementExamLite,
} from "@/lib/api";
import { downloadCSV, exportNodeToPDF } from "./utils/export";

type PagoPlacementRow = {
  id: string | number;
  alumno_id?: number | string;
  alumno?: {
    id?: number | string;
    nombres?: string;
    apellidos?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  alumno_nombre?: string;
  alumno_apellidos?: string;
  alumno_email?: string;
  referencia?: string;
  tipo?: "pago" | "exencion" | string;
  estado?: "pendiente" | "validado" | "rechazado" | string;
  status?: "pendiente" | "validado" | "rechazado" | string;
  validado?: boolean;
  validated_at?: string | null;
  validated_by_id?: number | string | null;
  validated_by_name?: string | null;
  importe_centavos?: number | null;
  importe?: number | null;
  created_at?: string;
};

type Props = { anio: string; idioma: Idioma | ""; examCode: string };

// --- Utils ---
function formatMoney(mxn: number) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(mxn);
  } catch {
    return `$${mxn.toFixed(2)} MXN`;
  }
}

function readAlumno(row: PagoPlacementRow) {
  const a = (row.alumno || {}) as any;
  const nestedNombre = [a.nombres ?? a.first_name, a.apellidos ?? a.last_name]
    .filter(Boolean)
    .join(" ");
  const flatNombre = [row.alumno_nombre, row.alumno_apellidos]
    .filter(Boolean)
    .join(" ");
  const nombre =
    row.alumno_nombre || nestedNombre || flatNombre || "(Sin nombre)";
  const email = a.email || row.alumno_email || "";
  return { nombre: (nombre || "").trim() || "(Sin nombre)", email };
}

function readApellidosNombres(row: PagoPlacementRow) {
  const a = (row.alumno || {}) as any;
  const apellidos = a.apellidos ?? a.last_name ?? row.alumno_apellidos ?? "";
  const nombres = a.nombres ?? a.first_name ?? row.alumno_nombre ?? "";
  return { apellidos: String(apellidos), nombres: String(nombres) };
}

function readImporteMXN(row: PagoPlacementRow) {
  if (typeof row.importe_centavos === "number") return row.importe_centavos / 100;
  if (typeof row.importe === "number") return row.importe;
  return 0;
}

function readEstado(row: PagoPlacementRow) {
  const raw = (row.estado ?? row.status) as string | undefined;
  if (typeof raw === "string" && raw.trim()) return raw.trim().toLowerCase();
  if (typeof row.validado === "boolean")
    return row.validado ? "validado" : "pendiente";
  return "pendiente";
}

export default function ReportPagosExamen({ anio, idioma, examCode }: Props) {
  const [selectedExam, setSelectedExam] = useState<PlacementExamLite | null>(null);
  const [rows, setRows] = useState<PagoPlacementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const [resumen, setResumen] = useState({
    total: 0,
    validado: 0,
    pendiente: 0,
    rechazado: 0,
    sumaMXN: 0,          // suma de todos
    sumaValidadoMXN: 0,  // suma solo validado (para el texto final)
  });

  // 1) Resolver examen por (anio, idioma, examCode)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setFetchError(null);
      setSelectedExam(null);
      setRows([]);
      setResumen({
        total: 0,
        validado: 0,
        pendiente: 0,
        rechazado: 0,
        sumaMXN: 0,
        sumaValidadoMXN: 0,
      });
      if (!examCode) return;

      try {
        const items = await listPlacementExamsLite({
          idioma: idioma || undefined,
          anio: anio || undefined,
          page_size: 200,
        } as any);
        if (!mounted) return;

        const filtered = (items || []).filter((e: any) => {
          if (!anio) return true;
          const raw = (e as any)?.fecha;
          const yy = (() => {
            if (typeof raw === "string") {
              if (/^\d{4}/.test(raw)) return raw.slice(0, 4);
              const d = new Date(raw);
              return isNaN(d.getTime()) ? "" : String(d.getFullYear());
            }
            const d = raw instanceof Date ? raw : new Date(raw);
            return isNaN(d.getTime()) ? "" : String(d.getFullYear());
          })();
          return yy === anio;
        });

        const norm = (s: string) => (s || "").trim().toLowerCase();
        const found =
          filtered.find((e) => norm((e as any).codigo) === norm(examCode)) ||
          null;

        setSelectedExam(found || null);
        if (!found)
          setFetchError("No se encontró el examen con el código seleccionado.");
      } catch (e: any) {
        if (!mounted) return;
        setFetchError(e?.message || "No se pudo resolver el examen seleccionado.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [anio, idioma, examCode]);

  // 2) Cargar pagos/registros por examId
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedExam?.id) return;
      setLoading(true);
      setFetchError(null);
      try {
        const json = await getPlacementRegistrosAdmin(selectedExam.id, {
          page_size: 500,
        });
        const items: PagoPlacementRow[] = json?.items ?? [];
        if (!mounted) return;

        // Orden local por apellidos, nombres (por si el backend no ordena)
        const coll = new Intl.Collator("es", { sensitivity: "base" });
        const sorted = items.slice().sort((a, b) => {
          const A = readApellidosNombres(a);
          const B = readApellidosNombres(b);
          const ap = coll.compare(A.apellidos || "", B.apellidos || "");
          return ap !== 0 ? ap : coll.compare(A.nombres || "", B.nombres || "");
        });

        setRows(sorted);

        const acc = sorted.reduce(
          (acc, r) => {
            const st = readEstado(r);
            const mxn = readImporteMXN(r);
            acc.total += 1;
            acc.sumaMXN += mxn;
            if (st === "validado") {
              acc.validado += 1;
              acc.sumaValidadoMXN += mxn;
            } else if (st === "rechazado") {
              acc.rechazado += 1;
            } else {
              acc.pendiente += 1;
            }
            return acc;
          },
          { total: 0, validado: 0, pendiente: 0, rechazado: 0, sumaMXN: 0, sumaValidadoMXN: 0 }
        );

        setResumen(acc);
      } catch (e: any) {
        if (!mounted) return;
        setRows([]);
        setResumen({
          total: 0,
          validado: 0,
          pendiente: 0,
          rechazado: 0,
          sumaMXN: 0,
          sumaValidadoMXN: 0,
        });
        setFetchError(e?.message || "No se pudieron cargar los pagos del examen.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedExam?.id, reloadTick]);

  const header = useMemo(() => {
    if (!selectedExam) return "Pagos de examen de colocación";
    const lblFecha = (selectedExam as any).fecha || "s/fecha";
    return `Pagos — ${selectedExam.codigo} (${selectedExam.idioma}) · ${lblFecha}`;
  }, [selectedExam]);

  // --- Exportaciones (CSV / PDF) ---
  const csv = () => {
    if (!rows.length) return;
    const filename = `pagos_examen_${selectedExam?.codigo || "sin_codigo"}.csv`;
    const out = rows.map((r) => {
      const { apellidos, nombres } = readApellidosNombres(r);
      return {
        id: r.id,
        alumno: `${apellidos} ${nombres}`.trim() || "(Sin nombre)",
        alumno_apellidos: apellidos,
        alumno_nombres: nombres,
        email: r.alumno_email || r.alumno?.email || "",
        tipo: (r.tipo || "pago").toLowerCase(),
        estado: readEstado(r),
        referencia: r.referencia || "",
        validated_at: r.validated_at || "",
        validated_by_id: r.validated_by_id ?? "",
        validated_by_name: r.validated_by_name ?? "",
        importe_centavos:
          typeof r.importe_centavos === "number"
            ? r.importe_centavos
            : Math.round(readImporteMXN(r) * 100),
        created_at: r.created_at || "",
      };
    });
    downloadCSV(filename, out);
  };

  const pdf = () => exportNodeToPDF(ref.current, header);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Header + meta */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{header}</h3>
          <div className="text-sm text-muted-foreground">
            {anio ? (
              <span className="mr-2">
                Año: <strong>{anio}</strong>
              </span>
            ) : null}
            {idioma ? (
              <span>
                Idioma: <strong>{idioma}</strong>
              </span>
            ) : null}
          </div>
        </div>

        {/* Resumen igual que en Pagos */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs md:text-sm">
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Total registros</div>
            <div className="font-semibold">{resumen.total}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Validados</div>
            <div className="font-semibold">{resumen.validado}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Pendientes</div>
            <div className="font-semibold">{resumen.pendiente}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Rechazados</div>
            <div className="font-semibold">{resumen.rechazado}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">Suma montos</div>
            <div className="font-semibold">{formatMoney(resumen.sumaMXN)}</div>
          </div>
        </div>

        <Separator />

        {/* Acciones (CSV / PDF / Recargar) */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {!examCode ? "Selecciona un código de examen en la barra superior." : null}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={csv}
              disabled={!rows.length || loading}
            >
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={pdf}
              disabled={!rows.length || loading}
            >
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setReloadTick((t) => t + 1)}
              disabled={!selectedExam?.id}
            >
              <RefreshCcw className="h-4 w-4 mr-2" /> Recargar
            </Button>
          </div>
        </div>

        {/* Tabla */}
        {!examCode ? (
          <div className="text-sm text-muted-foreground">
            Selecciona un <strong>código de examen</strong> en los filtros.
          </div>
        ) : fetchError ? (
          <div className="text-sm text-red-600">{fetchError}</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Cargando pagos…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay pagos/registro para este examen.
          </div>
        ) : (
          <>
            <div ref={ref} className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Alumno</th>
                    <th className="py-2 pr-3">Correo</th>
                    <th className="py-2 pr-3">Referencia</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Validador</th>
                    <th className="py-2 pr-3">Fecha validación</th>
                    <th className="py-2 pr-0 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const { nombre, email } = readAlumno(r);
                    const estado = readEstado(r);
                    const importe = readImporteMXN(r);
                    return (
                      <tr key={String(r.id)} className="border-b last:border-0">
                        <td className="py-2 pr-3">{nombre}</td>
                        <td className="py-2 pr-3">{email || "—"}</td>
                        <td className="py-2 pr-3">{r.referencia || "—"}</td>
                        <td className="py-2 pr-3 capitalize">
                          {(r.tipo || "pago").toLowerCase()}
                        </td>
                        <td className="py-2 pr-3 capitalize">{estado}</td>
                        <td className="py-2 pr-3">
                          {r.validated_by_name || r.validated_by_id || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {r.validated_at
                            ? new Date(r.validated_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="py-2 pr-0 text-right">
                          {formatMoney(importe)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totales al final, igual que en Pagos */}
            <div className="mt-2 text-sm">
              Total registros: <strong>{resumen.total}</strong>
              {" — "}
              Total validado:{" "}
              <strong>{formatMoney(resumen.sumaValidadoMXN)}</strong>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
