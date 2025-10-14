// src/components/docente/sections/GroupsSection.tsx
"use client";

import { useEffect, useState } from "react";
import { listMisGrupos, listarSesiones, listAlumnosDeCiclo } from "@/lib/api/docente";
import type { CicloLite, AlumnoEnGrupo } from "@/lib/types/docente";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, TableProperties, FileDown } from "lucide-react";
import AttendanceMatrix from "./AttendanceMatrix";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import jsPDF from "jspdf";

export default function GroupsSection() {
  const [data, setData] = useState<CicloLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Sheet matriz
  const [openMatriz, setOpenMatriz] = useState(false);
  const [cicloMatriz, setCicloMatriz] = useState<CicloLite | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const items = await listMisGrupos(q ? { q } : undefined);
      setData(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const abrirMatriz = (ciclo: CicloLite) => {
    setCicloMatriz(ciclo);
    setOpenMatriz(true);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========= Helpers comunes =========
  function fmtDM(isoDate: string) {
    // "YYYY-MM-DD" -> "dd/mm"
    const [y, m, d] = isoDate.split("-").map(Number);
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  }

  // Parse seguro a Date (local) para ordenar y comparar
  function toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    const s = String(value);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      return new Date(y, mm - 1, dd, 0, 0, 0, 0);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  // Extrae rango de fechas del curso (si existe)
  function getCursoRange(ciclo: any): { from?: Date; to?: Date } {
    const from = ciclo?.curso?.from ? toDate(ciclo.curso.from) : undefined;
    const to = ciclo?.curso?.to ? toDate(ciclo.curso.to) : undefined;
    return { from, to };
  }

  // Convierte ciclo.dias (["Lun","Mar",...]/["lunes","martes",...]) a set de weekday JS (0=Dom..6=Sáb)
  function allowedWeekdaysFromCiclo(ciclo: any): Set<number> | null {
    const dias: string[] | undefined = ciclo?.dias;
    if (!dias || !dias.length) return null; // sin restricción

    const map: Record<string, number> = {
      // abreviaturas
      "lun": 1, "mar": 2, "mié": 3, "mie": 3, "jue": 4, "vie": 5, "sáb": 6, "sab": 6, "dom": 0,
      // nombres completos
      "lunes": 1, "martes": 2, "miércoles": 3, "miercoles": 3, "jueves": 4, "viernes": 5, "sábado": 6, "sabado": 6, "domingo": 0,
    };

    const set = new Set<number>();
    for (const d of dias) {
      const key = d.trim().toLowerCase();
      if (map[key] !== undefined) set.add(map[key]);
    }
    return set.size ? set : null;
  }

  // Filtro maestro de sesiones por rango y por días permitidos
  function filtrarSesionesPorRangoYDias(ciclo: any, sesiones: any[]): any[] {
    const { from, to } = getCursoRange(ciclo);
    const allowed = allowedWeekdaysFromCiclo(ciclo); // puede ser null (sin restricción)

    return sesiones.filter((s) => {
      const d = toDate(s.fecha);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (allowed && !allowed.has(d.getDay())) return false;
      return true;
    });
  }

  // ========= Generación del PDF =========
  async function handleDescargarListado(ciclo: CicloLite) {
    try {
      // Trae sesiones (fechas) y alumnos inscritos
      const [sesionesRaw, alumnos] = await Promise.all([
        listarSesiones(ciclo.id),
        listAlumnosDeCiclo(ciclo.id),
      ]);

      if (!sesionesRaw?.length) {
        alert("Este grupo no tiene sesiones generadas.");
        return;
      }

      // 🔧 Orden real por fecha (timestamp)
      let sesiones = [...sesionesRaw].sort(
        (a, b) => toDate(a.fecha).getTime() - toDate(b.fecha).getTime()
      );

      // 🔧 Filtra por rango [from, to] y por días válidos (evita “un día de más”)
      sesiones = filtrarSesionesPorRangoYDias(ciclo, sesiones);

      if (!sesiones.length) {
        alert("No hay sesiones dentro del rango/días del curso.");
        return;
      }

      // Ordenar alumnos por nombre (asc)
      const alumnosOrdenados: AlumnoEnGrupo[] = [...alumnos].sort((a, b) =>
        String(a.alumno_nombre ?? "").localeCompare(String(b.alumno_nombre ?? ""))
      );

      // PDF: Carta (US Letter) apaisado
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const margin = 10;
      const pageW = doc.internal.pageSize.getWidth();   // ~279.4 mm
      const pageH = doc.internal.pageSize.getHeight();  // ~215.9 mm
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;

      // Config tabla (todas las fechas en una sola hoja/encabezado por página)
      const colNumW = 10;        // "#"
      const colNameBaseW = 80;   // "Nombre" (ajustable si faltara ancho)
      const headerH = 10;        // alto del header de tabla
      const rowH = 7;            // alto de fila por alumno

      // Calcular ancho por fecha para que QUEPAN TODAS
      const remainingWForDates = usableW - colNumW - colNameBaseW;
      const minColDateW = 6.5; // mínimo razonable
      let colDateW = remainingWForDates / sesiones.length;
      if (colDateW < minColDateW) colDateW = minColDateW;

      // Si aún no cabe, reducimos el ancho de "Nombre" hasta un mínimo
      let adjColNameW = colNameBaseW;
      const minColNameW = 60;
      const totalDatesW = colDateW * sesiones.length;
      if (colNumW + adjColNameW + totalDatesW > usableW) {
        const exceso = colNumW + adjColNameW + totalDatesW - usableW;
        adjColNameW = Math.max(minColNameW, adjColNameW - exceso);
      }

      const tableWidth = colNumW + adjColNameW + colDateW * sesiones.length;

      // Altura disponible para filas (deja espacio para encabezado de texto)
      const headerTextH = 22; // título y detalles arriba
      const maxRows = Math.max(5, Math.floor((usableH - headerTextH - headerH - 8) / rowH));

      // Paginamos SOLO alumnos; fechas completas en cada página
      const totalPages = Math.ceil(alumnosOrdenados.length / maxRows) || 1;

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) doc.addPage("letter", "landscape");

        // ====== Encabezado (texto) ======
        let y = margin;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`Listado de asistencia — ${ciclo.codigo}`, margin, y);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        y += 6;
        const linea2 = [
          `Idioma: ${ciclo.idioma ?? "—"}`,
          `Nivel: ${ciclo.nivel ?? "—"}`,
          `Modalidad: ${ciclo.modalidad ?? "—"}`,
          `Turno: ${ciclo.turno ?? "—"}`,
        ].join("   ·   ");
        doc.text(linea2, margin, y);

        y += 6;
        const linea3 = [
          `Días: ${Array.isArray(ciclo.dias) ? ciclo.dias.join(", ") : "—"}`,
          `Horario: ${ciclo.hora_inicio && ciclo.hora_fin ? `${ciclo.hora_inicio}–${ciclo.hora_fin}` : "—"}`,
          `Aula: ${ciclo.aula ?? "—"}`,
        ].join("   ·   ");
        doc.text(linea3, margin, y);

        y += 6;
        const pagInfo = `Página ${p + 1}/${totalPages}  ·  Fechas: ${sesiones.length}`;
        const tw = doc.getTextWidth(pagInfo);
        doc.text(pagInfo, margin + usableW - tw, y);

        // ====== Encabezados de tabla (fechas, sin rotación) ======
        y += 6;
        const tableTop = y;
        let x = margin;

        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.setFont("helvetica", "bold");

        // "#"
        doc.rect(x, y, colNumW, headerH);
        doc.text("#", x + 2, y + headerH - 3);
        x += colNumW;

        // "Nombre"
        doc.rect(x, y, adjColNameW, headerH);
        doc.text("Nombre", x + 2, y + headerH - 3);
        x += adjColNameW;

        // Fechas (centradas en su celda)
        const dateFontSize = Math.max(6, Math.min(9, colDateW - 1));
        doc.setFontSize(dateFontSize);
        sesiones.forEach((s, idx) => {
          const cx = x + idx * colDateW;
          doc.rect(cx, y, colDateW, headerH);
          const label = fmtDM(String(s.fecha)); // "dd/mm"
          const tx = cx + colDateW / 2;
          const ty = y + headerH / 2 + (dateFontSize <= 7 ? 1 : 0);
          doc.text(label, tx, ty, { align: "center", baseline: "middle" } as any);
        });

        // ====== Filas (alumnos) ======
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const start = p * maxRows;
        const rows = alumnosOrdenados.slice(start, start + maxRows);

        for (let r = 0; r < rows.length; r++) {
          const rowY = y + headerH + r * rowH;
          let rx = margin;

          // "#"
          doc.rect(rx, rowY, colNumW, rowH);
          const numStr = String(start + r + 1);
          doc.text(numStr, rx + 2, rowY + rowH - 2);
          rx += colNumW;

          // Nombre (truncate suave)
          doc.rect(rx, rowY, adjColNameW, rowH);
          const nom = rows[r]?.alumno_nombre || "";
          const maxNameChars = Math.max(20, Math.floor(adjColNameW / 2.2));
          const nomTxt = nom.length > maxNameChars ? nom.slice(0, maxNameChars - 1) + "…" : nom;
          doc.text(nomTxt, rx + 2, rowY + rowH - 2);
          rx += adjColNameW;

          // Recuadros de asistencia (uno por fecha, vacíos)
          for (let c = 0; c < sesiones.length; c++) {
            doc.rect(rx + c * colDateW, rowY, colDateW, rowH);
          }
        }

        // ====== Pie ======
        const footerY = margin + usableH - 5;
        doc.setFontSize(9);
        doc.text("Firma del docente: ____________________________", margin, footerY);
        const today = new Date();
        const fechaHoy = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
        const rightText = `Generado el ${fechaHoy}`;
        const rtW = doc.getTextWidth(rightText);
        doc.text(rightText, margin + usableW - rtW, footerY);

        // Marco exterior de la tabla
        const tableHeight = Math.min(headerH + rows.length * rowH, usableH - (tableTop - margin));
        doc.rect(margin, tableTop, tableWidth, tableHeight, "S");
      }

      doc.save(`Listado_${ciclo.codigo}.pdf`);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el PDF del listado.");
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por código o aula…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900/40">
              <tr className="text-left">
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Idioma</th>
                <th className="px-4 py-2">Nivel</th>
                <th className="px-4 py-2">Modalidad</th>
                <th className="px-4 py-2">Turno</th>
                <th className="px-4 py-2">Días</th>
                <th className="px-4 py-2">Horario</th>
                <th className="px-4 py-2">Aula</th>
                <th className="px-4 py-2">Curso</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={10}>
                    Cargando…
                  </td>
                </tr>
              )}

              {!loading && data.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={10}>
                    Sin grupos asignados.
                  </td>
                </tr>
              )}

              {!loading &&
                data.map((g) => {
                  const horario =
                    g.hora_inicio && g.hora_fin ? `${g.hora_inicio}–${g.hora_fin}` : "—";
                  const curso =
                    g.curso?.from && g.curso?.to ? `${g.curso.from} → ${g.curso.to}` : "—";
                  return (
                    <tr key={g.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{g.codigo}</td>
                      <td className="px-4 py-2">{g.idioma || "—"}</td>
                      <td className="px-4 py-2">{g.nivel || "—"}</td>
                      <td className="px-4 py-2">{g.modalidad || "—"}</td>
                      <td className="px-4 py-2">{g.turno || "—"}</td>
                      <td className="px-4 py-2">{g.dias?.join(", ") || "—"}</td>
                      <td className="px-4 py-2">{horario}</td>
                      <td className="px-4 py-2">{g.aula || "—"}</td>
                      <td className="px-4 py-2">{curso}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => abrirMatriz(g)}>
                            <TableProperties className="mr-2 h-4 w-4" />
                            Control de asistencia
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDescargarListado(g)}
                            title="PDF tamaño carta con todas las fechas en una página"
                          >
                            <FileDown className="mr-2 h-4 w-4" />
                            Descargar listado
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sheet Matriz rápida */}
      <Sheet open={openMatriz} onOpenChange={setOpenMatriz}>
        <SheetContent
          side="left"
          className="w-full max-w-[1400px] sm:max-w-[1400px] overflow-x-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {cicloMatriz ? `Matriz de asistencia · ${cicloMatriz.codigo}` : "Matriz de asistencia"}
            </SheetTitle>
            <SheetDescription>
              {cicloMatriz
                ? `Idioma: ${cicloMatriz.idioma || "—"} · Nivel: ${cicloMatriz.nivel || "—"}`
                : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            {cicloMatriz ? (
              <AttendanceMatrix cicloId={cicloMatriz.id} />
            ) : (
              <p className="text-sm text-neutral-500">Selecciona un curso...</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
