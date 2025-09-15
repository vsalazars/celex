"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { ReportFiltersState } from "./useReportFilters";
import { downloadCSV, exportNodeToPDF } from "./utils/export";
import { getReporteInscritos, type ReportReporteInscritos } from "@/lib/api";

export default function ReportAlumnos({ filters }: { filters: ReportFiltersState }) {
  const { anio, idioma, cicloId } = filters;
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<ReportReporteInscritos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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
      const data = await getReporteInscritos({ cicloId });
      setReporte(data);
    } catch (e: any) {
      setError(e?.message || "No se pudo obtener el reporte");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  // Ejecuta automáticamente cuando cambia el ciclo seleccionado
  useEffect(() => {
    if (cicloId) consultar();
    else setReporte(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloId]);

  // Orden por apellidos, luego nombres (sin coma)
  const sortedAlumnos = (reporte?.alumnos || [])
    .slice()
    .sort((a, b) => compareByApellidoNombre(a.nombre || "", b.nombre || ""));

  const csv = () => {
    if (!sortedAlumnos.length || !reporte) return;
    const rows = sortedAlumnos.map((a) => {
      const { apellidos, nombres } = parseAlumno(a.nombre || "");
      return {
        inscripcion_id: a.inscripcion_id,
        boleta: a.boleta ?? "",
        nombre: apellidosEspacioNombres(a.nombre || ""), // sin coma
        alumno_apellidos: apellidos,
        alumno_nombres: nombres,
        email: a.email ?? "",
        fecha_inscripcion: a.fecha_inscripcion ?? "",
        estado: a.estado ?? "",
      };
    });
    downloadCSV(`alumnos_inscritos_${reporte.ciclo.codigo}.csv`, rows);
  };

  const pdf = () => exportNodeToPDF(ref.current, "Alumnos inscritos");

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Alumnos inscritos</h3>
            {reporte?.ciclo && <Badge variant="secondary">Ciclo: {reporte.ciclo.codigo}</Badge>}
            {anio && <Badge variant="secondary">Año: {anio}</Badge>}
            {idioma && <Badge variant="secondary">Idioma: {idioma}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={csv} disabled={!sortedAlumnos.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button size="sm" onClick={pdf} disabled={!sortedAlumnos.length}>
              <Printer className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        <div ref={ref}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            CELEX — Alumnos inscritos
          </h2>
          <div className="meta">
            {reporte?.ciclo ? `Ciclo: ${reporte.ciclo.codigo}` : "Sin ciclo seleccionado"}
          </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full">
            <thead>
              <tr>
                <th>Inscripción</th>
                <th>Boleta</th>
                <th>Nombre (Apellidos Nombres)</th>
                <th>Email</th>
                <th>Fecha inscripción</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 12, color: "#666" }}>
                    Cargando…
                  </td>
                </tr>
              ) : sortedAlumnos.length ? (
                sortedAlumnos.map((a) => (
                  <tr key={String(a.inscripcion_id)}>
                    <td>{a.inscripcion_id}</td>
                    <td>{a.boleta || "—"}</td>
                    <td>{apellidosEspacioNombres(a.nombre || "")}</td>
                    <td>{a.email || "—"}</td>
                    <td>{a.fecha_inscripcion || "—"}</td>
                    <td>{a.estado || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 12, color: "#666" }}>
                    {cicloId ? "Sin resultados." : "Selecciona un ciclo en la barra superior."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

          {!!reporte && !loading && (
            <div className="totals mt-2">
              Total inscritos: <strong>{reporte.total}</strong>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-amber-600 mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}
