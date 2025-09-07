// src/components/docente/sections/AttendanceMatrix.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { matrizCiclo, marcarMatriz } from "@/lib/api/docente";
import type { MatrizDTO, AsistenciaEstado, MatrizMarcarItem } from "@/lib/types/asistencia";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const ESTADOS: AsistenciaEstado[] = ["presente", "ausente", "retardo", "justificado"];

// ✅ Utilidades de fecha (evitar parse UTC)
function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const fmtDiaCorto = new Intl.DateTimeFormat("es-MX", { weekday: "short" });
const fmtFechaCorta = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit" });
function diaCorto(d: Date): string {
  const raw = fmtDiaCorto.format(d).replace(".", "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function AttendanceMatrix({ cicloId }: { cicloId: number }) {
  const [data, setData] = useState<MatrizDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, { estado: AsistenciaEstado; nota?: string | null }>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const m = await matrizCiclo(cicloId);
        setData(m);
        setDirty({});
      } catch (err) {
        console.error(err);
        toast.error("No se pudo cargar la matriz de asistencia.");
      } finally {
        setLoading(false);
      }
    })();
  }, [cicloId]);

  const regMap = useMemo(() => {
    const m = new Map<string, { estado: AsistenciaEstado; nota?: string | null }>();
    if (data) {
      for (const r of data.registros) {
        m.set(`${r.sesion_id}:${r.inscripcion_id}`, { estado: r.estado as AsistenciaEstado, nota: r.nota });
      }
    }
    return m;
  }, [data]);

  const getEstado = (sesionId: number, inscripcionId: number): AsistenciaEstado => {
    const k = `${sesionId}:${inscripcionId}`;
    if (dirty[k]) return dirty[k].estado;
    const base = regMap.get(k);
    return base?.estado ?? "presente";
  };

  const setEstado = (sesionId: number, inscripcionId: number, estado: AsistenciaEstado) => {
    const k = `${sesionId}:${inscripcionId}`;
    setDirty((prev) => ({ ...prev, [k]: { ...(prev[k] ?? {}), estado } }));
  };

  const save = async () => {
    if (!data) return;

    const entries = Object.entries(dirty);
    if (entries.length === 0) {
      toast.info("No hay cambios por guardar.");
      return;
    }

    const items: MatrizMarcarItem[] = entries.map(([k, v]) => {
      const [sesion_id, inscripcion_id] = k.split(":").map(Number);
      return { sesion_id, inscripcion_id, estado: v.estado, nota: v.nota };
    });

    setSaving(true);
    const dismissId = toast.loading("Guardando cambios…");
    try {
      const fresh = await marcarMatriz(cicloId, { items });
      setData(fresh);
      setDirty({});
      toast.success(`Asistencia guardada (${items.length} cambio${items.length > 1 ? "s" : ""}).`, {
        id: dismissId,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`No se pudo guardar: ${err?.message ?? "error desconocido"}`, { id: dismissId });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500 p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando matriz…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Header con info y botón */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600">
          {data.alumnos.length} alumnos · {data.sesiones.length} sesiones
        </div>
        <Button onClick={save} disabled={saving || Object.keys(dirty).length === 0} className="ml-2">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cambios {Object.keys(dirty).length ? `(${Object.keys(dirty).length})` : ""}
        </Button>
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-xl border bg-white dark:bg-neutral-950 shadow-sm">
        <table className="min-w-[950px] w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900/70">
            <tr>
              <th className="px-4 py-3 sticky left-0 z-20 bg-neutral-100 dark:bg-neutral-900/70 text-left font-semibold">
                Alumno
              </th>
              {data.sesiones.map((s) => {
                const d = parseISODateLocal(String(s.fecha));
                return (
                  <th
                    key={s.id}
                    className="px-3 py-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap text-center"
                  >
                    <div>{diaCorto(d)}</div>
                    <div>{fmtFechaCorta.format(d)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.alumnos.map((a, i) => (
              <tr key={a.inscripcion_id} className={i % 2 === 0 ? "bg-neutral-50 dark:bg-neutral-900/40" : ""}>
                <td className="px-4 py-2 sticky left-0 z-10 bg-inherit font-medium whitespace-nowrap">
                  {a.nombre ?? `#${a.alumno_id ?? a.inscripcion_id}`}
                </td>
                {data.sesiones.map((s) => {
                  const val = getEstado(s.id, a.inscripcion_id);
                  return (
                    <td key={`${s.id}-${a.inscripcion_id}`} className="px-3 py-2 text-center">
                      <Select value={val} onValueChange={(v) => setEstado(s.id, a.inscripcion_id, v as AsistenciaEstado)}>
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS.map((e) => (
                            <SelectItem key={e} value={e}>
                              {e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
