"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { ReportFiltersState } from "./useReportFilters";
import { downloadCSV, exportNodeToPDF } from "./utils/export";
import { getReportePagos, type ReportReportePagos } from "@/lib/api";

export default function ReportPagos({ filters }: { filters: ReportFiltersState }) {
  const { anio, idioma, cicloId } = filters;
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<ReportReportePagos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const money = (cents: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format((cents || 0) / 100);

  // ---- Helpers de nombres y orden (sin coma) ----
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

  async function consultar() {
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
  }

  // Auto-consulta al cambiar ciclo
  useEffect(() => {
    if (cicloId) consultar();
    else setReporte(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  // Orden por apellidos, luego nombres
  const sortedRows = (reporte?.rows || [])
    .slice()
    .sort((ra, rb) => compareByApellidoNombre(ra.alumno || "", rb.alumno || ""));

  const csv = () => {
    if (!sortedRows.length || !reporte) return;
    const rows = sortedRows.map((r) => {
      const { apellidos, nombres } = parseAlumno(r.alumno || "");
      return {
        inscripcion_id: r.inscripcion_id,
        alumno: apellidosEspacioNombres(r.alumno || ""), // sin coma
        alumno_apellidos: apellidos,
        alumno_nombres: nombres,
        email: r.email ?? "",
        tipo: (r as any).tipo ?? "", // "pago" | "exencion" (compat)
        status: r.status,
        fecha_pago: r.fecha_pago ?? "",
        referencia: r.referencia ?? "",
        importe_centavos: r.importe_centavos,
      };
    });
    downloadCSV(`pagos_${reporte.ciclo.codigo}.csv`, rows);
  };

  const pdf = () => exportNodeToPDF(ref.current, "Pagos por ciclo");

  /** Renderiza badge por tipo con colores distintos */
  function renderTipoBadge(tipo?: "pago" | "exencion") {
    if (tipo === "exencion") {
      // Ámbar tenue (exención)
      return (
        <Badge variant="outline" className="border-amber-200 text-amber-800 bg-amber-50">
          Exención
        </Badge>
      );
    }
    // Azul tenue (pago) – default si viene undefined/null
    return (
      <Badge variant="outline" className="border-blue-200 text-blue-800 bg-blue-50">
        Pago
      </Badge>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Pagos</h3>
            {reporte?.ciclo && <Badge variant="secondary">Ciclo: {reporte.ciclo.codigo}</Badge>}
            {anio && <Badge variant="secondary">Año: {anio}</Badge>}
            {idioma && <Badge variant="secondary">Idioma: {idioma}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={csv} disabled={!sortedRows.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" onClick={pdf} disabled={!sortedRows.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        <div ref={ref}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            CELEX — Pagos por ciclo
          </h2>
          <div className="meta">
            {reporte?.ciclo ? `Ciclo: ${reporte.ciclo.codigo}` : "Sin ciclo seleccionado"}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th>Inscripción</th>
                  <th>Alumno (Apellidos Nombres)</th>
                  <th>Email</th>
                  <th>Tipo</th>
                  <th>Estatus</th>
                  <th>Fecha pago</th>
                  <th>Referencia</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 12, color: "#666" }}>
                      Cargando…
                    </td>
                  </tr>
                ) : sortedRows.length ? (
                  sortedRows.map((r) => {
                    const tipo = (r as any).tipo as "pago" | "exencion" | undefined;
                    const isExencion = tipo === "exencion";
                    return (
                      <tr key={String(r.inscripcion_id)} className={isExencion ? "opacity-90" : undefined}>
                        <td>{r.inscripcion_id}</td>
                        <td>{apellidosEspacioNombres(r.alumno || "")}</td>
                        <td>{r.email || "—"}</td>
                        <td>{renderTipoBadge(tipo)}</td>
                        <td>{r.status}</td>
                        <td>{r.fecha_pago || "—"}</td>
                        <td>{r.referencia || "—"}</td>
                        <td>{money(r.importe_centavos)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 12, color: "#666" }}>
                      {cicloId ? "Sin resultados." : "Selecciona un ciclo en la barra superior."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!!reporte && !loading && (
            <div className="totals mt-2">
              Total registros: <strong>{reporte.total_registros}</strong> — Total validado:{" "}
              <strong>{money(reporte.total_validado_centavos)}</strong>{" "}
             
            </div>
          )}
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
