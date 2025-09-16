"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Printer, RefreshCcw } from "lucide-react";
import { ReportFiltersState } from "./useReportFilters";
import { downloadCSV, exportNodeToPDF } from "./utils/export";
import { getReportePagos, type ReportReportePagos } from "@/lib/api";

// ---- Utils dinero ----
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

// ---- Orden/nombres (misma heurística que usabas) ----
const collator = new Intl.Collator("es", { sensitivity: "base" });

/** Parse genérico: soporta "Apellidos, Nombres" o "Nombre(s) Apellido(s)". */
function parseAlumno(full: string) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { apellidos: "", nombres: "" };

  const commaIdx = s.indexOf(",");
  if (commaIdx !== -1) {
    const ap = s.slice(0, commaIdx).trim();
    const no = s.slice(commaIdx + 1).trim();
    return { apellidos: ap, nombres: no };
  }

  // Heurística cuando no hay coma: últimas 2 palabras como apellidos
  const parts = s.split(" ");
  if (parts.length === 1) return { apellidos: "", nombres: parts[0] };
  const apellidos = parts.slice(-2).join(" ");
  const nombres = parts.slice(0, -2).join(" ");
  return { apellidos, nombres };
}

/** Devuelve "Apellidos Nombres" (sin coma). */
function apellidosEspacioNombres(full: string) {
  const { apellidos, nombres } = parseAlumno(full || "");
  if (!apellidos && !nombres) return (full || "").trim();
  if (!apellidos) return nombres;
  if (!nombres) return apellidos;
  return `${apellidos} ${nombres}`;
}

/** Ordena por apellidos y luego nombres. */
function compareByApellidoNombre(a: string, b: string) {
  const A = parseAlumno(a);
  const B = parseAlumno(b);
  const c1 = collator.compare(A.apellidos, B.apellidos);
  if (c1 !== 0) return c1;
  return collator.compare(A.nombres, B.nombres);
}

// ---- Normalizadores comunes (compat con listado de exámenes) ----
function readEstado(row: any): "pendiente" | "validado" | "rechazado" {
  const raw = (row.estado ?? row.status) as string | undefined;
  if (typeof raw === "string" && raw.trim()) return raw.trim().toLowerCase() as any;
  if (typeof row.validado === "boolean") return row.validado ? "validado" : "pendiente";
  return "pendiente";
}

function readImporteMXN(row: any) {
  if (typeof row.importe_centavos === "number") return row.importe_centavos / 100;
  if (typeof row.importe === "number") return row.importe;
  return 0;
}

function readValidador(row: any) {
  return row.validated_by_name || row.validated_by_id || "—";
}

function readFechaValidacion(row: any) {
  // Si no existe validated_at, usa fecha_pago como fallback
  const v = row.validated_at || row.fecha_validacion || row.fecha_pago;
  return v ? new Date(v).toLocaleString() : "—";
}

export default function ReportPagos({ filters }: { filters: ReportFiltersState }) {
  const { anio, idioma, cicloId } = filters;
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<ReportReportePagos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Cargar
  const consultar = async () => {
    if (!cicloId) {
      setError("Selecciona un ciclo");
      setReporte(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getReportePagos({ cicloId });
      setReporte(data);
    } catch (e: any) {
      setError(e?.message || "No se pudo obtener el reporte");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-consulta al cambiar ciclo o recargar
  useEffect(() => {
    if (cicloId) consultar();
    else setReporte(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId, reloadTick]);

  // Filas ordenadas por apellidos, nombres
  const sortedRows = useMemo(() => {
    const rows = (reporte?.rows || []).slice();
    rows.sort((ra: any, rb: any) => compareByApellidoNombre(ra.alumno || "", rb.alumno || ""));
    return rows;
  }, [reporte?.rows]);

  // Resumen (mismo set que exámenes)
  const resumen = useMemo(() => {
    const acc = (sortedRows || []).reduce(
      (acc: any, r: any) => {
        const st = readEstado(r);
        const mxn = readImporteMXN(r);
        acc.total += 1;
        acc.sumaMXN += mxn;
        if (st === "validado") acc.validado += 1;
        else if (st === "rechazado") acc.rechazado += 1;
        else acc.pendiente += 1;
        return acc;
      },
      { total: 0, validado: 0, pendiente: 0, rechazado: 0, sumaMXN: 0 }
    );
    return acc;
  }, [sortedRows]);

  // Exportaciones (conservadas)
  const csv = () => {
    if (!sortedRows.length || !reporte) return;
    const rows = sortedRows.map((r: any) => {
      const { apellidos, nombres } = parseAlumno(r.alumno || "");
      return {
        inscripcion_id: r.inscripcion_id,
        alumno: apellidosEspacioNombres(r.alumno || ""), // sin coma
        alumno_apellidos: apellidos,
        alumno_nombres: nombres,
        email: r.email ?? "",
        tipo: (r as any).tipo ?? "", // "pago" | "exencion" (compat)
        status: (r.status ?? r.estado ?? "").toString().toLowerCase(),
        fecha_pago: r.fecha_pago ?? "",
        referencia: r.referencia ?? "",
        importe_centavos: r.importe_centavos ?? Math.round((r.importe ?? 0) * 100),
        validated_at: r.validated_at ?? r.fecha_validacion ?? "",
        validated_by_id: r.validated_by_id ?? "",
        validated_by_name: r.validated_by_name ?? "",
      };
    });
    const filename = `pagos_${reporte?.ciclo?.codigo || cicloId}.csv`;
    downloadCSV(filename, rows);
  };

  const pdf = () => exportNodeToPDF(ref.current, "Pagos por ciclo");

  // Header (alineado al de exámenes)
  const header = useMemo(() => {
    const ciclo = reporte?.ciclo?.codigo || "s/ciclo";
    return `Pagos — ${ciclo}`;
  }, [reporte?.ciclo?.codigo]);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Header + meta */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold">{header}</h3>
          <div className="text-sm text-muted-foreground flex gap-3 flex-wrap">
            {reporte?.ciclo && <span>Ciclo: <strong>{reporte.ciclo.codigo}</strong></span>}
            {anio && <span>Año: <strong>{anio}</strong></span>}
            {idioma && <span>Idioma: <strong>{idioma}</strong></span>}
          </div>
        </div>

        {/* Resumen (mismo set que exámenes) */}
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

        {/* Acciones */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {cicloId ? null : "Selecciona un ciclo en la barra superior."}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={csv} disabled={!sortedRows.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => pdf()} disabled={!sortedRows.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setReloadTick((t) => t + 1)} disabled={!cicloId}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Recargar
            </Button>
          </div>
        </div>

        {/* Tabla (mismo formato que exámenes) */}
        <div ref={ref}>
          <div className="overflow-x-auto">
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
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-3 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                ) : !cicloId ? (
                  <tr>
                    <td colSpan={8} className="py-3 text-center text-muted-foreground">
                      Selecciona un ciclo en la barra superior.
                    </td>
                  </tr>
                ) : sortedRows.length ? (
                  sortedRows.map((r: any) => {
                    const tipo = (r as any).tipo as "pago" | "exencion" | undefined;
                    const estado = readEstado(r);
                    const importe = readImporteMXN(r);
                    const alumno = apellidosEspacioNombres(r.alumno || "");
                    const email = r.email || "—";
                    const referencia = r.referencia || "—";
                    const validador = readValidador(r);
                    const fechaVal = readFechaValidacion(r);

                    return (
                      <tr key={String(r.inscripcion_id)} className="border-b last:border-0">
                        <td className="py-2 pr-3">{alumno || "(Sin nombre)"}</td>
                        <td className="py-2 pr-3">{email}</td>
                        <td className="py-2 pr-3">{referencia}</td>
                        <td className="py-2 pr-3 capitalize">{(tipo || "pago").toLowerCase()}</td>
                        <td className="py-2 pr-3 capitalize">{estado}</td>
                        <td className="py-2 pr-3">{validador}</td>
                        <td className="py-2 pr-3">{fechaVal}</td>
                        <td className="py-2 pr-0 text-right">{formatMoney(importe)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-3 text-center text-muted-foreground">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totales de backend, si vienen, se muestran debajo */}
          {!!reporte && !loading && (
            <div className="mt-2 text-sm">
              Total registros: <strong>{reporte.total_registros}</strong>
              {" — "}
              Total validado:{" "}
              <strong>{formatMoney((reporte.total_validado_centavos || 0) / 100)}</strong>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
