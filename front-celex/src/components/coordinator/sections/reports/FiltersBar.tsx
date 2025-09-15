"use client";

import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Calendar as CalendarIcon, X } from "lucide-react"; /* NUEVO */
import { ReportFiltersState, Idioma, CicloLite } from "./useReportFilters";
import { getReportCiclos, getDocentes } from "@/lib/api";

/* NUEVO: popover + calendar (shadcn) */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type AnyDocente = Record<string, any>;
type DocenteLite = { id: string | number; nombre: string };

type Props = ReportFiltersState & {
  /** "ciclos": año/idioma/ciclo (default), "docente": selector de docente, "periodo": fechas */
  mode?: "ciclos" | "docente" | "periodo";
  // modo docente
  docenteId?: string;
  setDocenteId?: (v: string) => void;
  // modo periodo (opcionalmente controlado desde arriba)
  periodStart?: string; // "YYYY-MM-DD"
  periodEnd?: string;   // "YYYY-MM-DD"
  setPeriodStart?: (v: string) => void;
  setPeriodEnd?: (v: string) => void;
};

function normStr(v: any) {
  return (v ?? "").toString().trim();
}

/** Construye "Nombre Apellidos" con los campos que vengan */
function joinNameLike(d: AnyDocente) {
  const first = normStr(d.first_name ?? d.nombres);
  const last = normStr(d.last_name ?? d.apellidos);
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return "";
}

/** Normaliza el arreglo recibido de getDocentes() al shape {id, nombre} */
function normalizeDocentes(arr: AnyDocente[]): DocenteLite[] {
  return (arr || []).map((raw) => {
    const id = normStr(raw.id ?? raw.user_id ?? raw.docente_id);
    const cand =
      normStr(raw.nombre) ||
      normStr(raw.name) ||
      normStr(raw.fullName ?? raw.full_name) ||
      joinNameLike(raw);
    const nombre = cand || (id ? `(ID #${id})` : "(Sin nombre)");
    return { id: id || String(Math.random()), nombre };
  });
}

/* NUEVO: utilidades para convertir entre Date y "YYYY-MM-DD" */
function toISO(d?: Date) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(s?: string) {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return isNaN(dt.getTime()) ? undefined : dt;
}

export default function FiltersBar({
  anio,
  idioma,
  cicloId,
  setAnio,
  setIdioma,
  setCicloId,
  ciclos,
  setCiclos,
  loadingCiclos,
  setLoadingCiclos,
  setError,
  aniosList,
  // modos
  mode = "ciclos",
  // docente
  docenteId = "",
  setDocenteId,
  // periodo
  periodStart,
  periodEnd,
  setPeriodStart,
  setPeriodEnd,
}: Props) {
  const [docentes, setDocentes] = useState<DocenteLite[]>([]);
  const [loadingDocentes, setLoadingDocentes] = useState(false);

  // --- estado interno de periodo si no se controla desde arriba ---
  const [_pStart, _setPStart] = useState<string>(periodStart || "");
  const [_pEnd, _setPEnd] = useState<string>(periodEnd || "");
  useEffect(() => {
    _setPStart(periodStart || "");
  }, [periodStart]);
  useEffect(() => {
    _setPEnd(periodEnd || "");
  }, [periodEnd]);

  const handleStartChange = (v: string) => {
    _setPStart(v);
    setPeriodStart?.(v);
  };
  const handleEndChange = (v: string) => {
    _setPEnd(v);
    setPeriodEnd?.(v);
  };

  // --- MODO CICLOS (año/idioma/ciclo) ---
  useEffect(() => {
    if (mode !== "ciclos") return;
    (async () => {
      setLoadingCiclos(true);
      setError(null);
      setCiclos([]);
      setCicloId("");
      try {
        const raw = await getReportCiclos({
          anio: anio || undefined,
          idioma: idioma || undefined,
        });
        const data = Array.isArray(raw) ? raw : (raw as any)?.items ?? [];
        setCiclos(data);
      } catch (e: any) {
        setError(e?.message || "No se pudieron cargar los ciclos");
        setCiclos([]);
      } finally {
        setLoadingCiclos(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, anio, idioma]);

  // --- MODO DOCENTE ---
  useEffect(() => {
    if (mode !== "docente") return;
    (async () => {
      setLoadingDocentes(true);
      setError(null);
      try {
        const lista = (await getDocentes({
          incluir_inactivos: true,
        })) as AnyDocente[];
        const arr = normalizeDocentes(Array.isArray(lista) ? lista : []);
        setDocentes(arr);

        if (arr.length && setDocenteId && !docenteId) {
          setDocenteId(String(arr[0].id));
        }
      } catch (e: any) {
        setError(e?.message || "No se pudieron cargar los docentes");
        setDocentes([]);
      } finally {
        setLoadingDocentes(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const clearAllCiclos = () => {
    setAnio("");
    setIdioma("");
    setCicloId("");
    setCiclos([]);
    setError(null);
  };

  const clearDocente = () => {
    if (setDocenteId) setDocenteId("");
    setError(null);
  };

  const clearPeriodo = () => {
    handleStartChange("");
    handleEndChange("");
    setError(null);
  };

  // --- Render por modo ---
  if (mode === "docente") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:items-end">
        <div className="md:col-span-8">
          <Label>Docente</Label>
          <div className="w-full">
            <Select
              value={docenteId}
              onValueChange={(v) => setDocenteId?.(v === "__clear__" ? "" : v)}
              disabled={loadingDocentes || !setDocenteId}
            >
              <SelectTrigger className="w-full min-w-[320px] md:min-w-[380px] lg:min-w-[460px] bg-background text-foreground font-medium truncate">
                <SelectValue
                  placeholder={loadingDocentes ? "Cargando..." : "Selecciona un docente"}
                />
              </SelectTrigger>

              <SelectContent
                position="popper"
                sideOffset={6}
                align="start"
                className="max-h-72 overflow-auto min-w-[320px] md:min-w-[380px] lg:min-w-[460px] z-50 bg-popover text-popover-foreground border shadow-md"
              >
                {docentes.length === 0 ? (
                  <SelectItem disabled value="__empty__" className="text-popover-foreground">
                    Sin docentes
                  </SelectItem>
                ) : (
                  docentes.map((d) => {
                    const val = String(d.id);
                    const label = normStr(d.nombre) || `(ID #${val})`;
                    return (
                      <SelectItem
                        key={`doc-${val}`}
                        value={val}
                        className="text-popover-foreground truncate"
                        title={label}
                      >
                        {label}
                      </SelectItem>
                    );
                  })
                )}
                <SelectItem value="__clear__" className="text-popover-foreground">
                  Limpiar
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="md:col-span-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={clearDocente}
            className="flex-1"
            disabled={!setDocenteId}
          >
            <RefreshCcw className="h-4 w-4 mr-2" /> Limpiar
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "periodo") {
    // filtros para pagos de examen de colocación (por rango de fechas)
    /* NUEVO: reemplazamos los dos <input type="date"> por un picker de rango */
    const from = fromISO(_pStart);
    const to = fromISO(_pEnd);
    const label =
      from && to
        ? `${from.toLocaleDateString()} — ${to.toLocaleDateString()}`
        : from
        ? `${from.toLocaleDateString()} — …`
        : "Selecciona un periodo";

    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:items-end">
        <div className="md:col-span-8">
          <Label>Periodo</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-10 justify-between"
                title={label}
              >
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {label}
                </span>
                {(from || to) && (
                  <X
                    className="h-4 w-4 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearPeriodo();
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-2 w-auto" align="start">
              <Calendar
                mode="range"
                selected={{ from: from, to: to } as any}
                onSelect={(next: any) => {
                  const s = toISO(next?.from);
                  const e = toISO(next?.to);
                  handleStartChange(s || "");
                  handleEndChange(e || "");
                }}
                numberOfMonths={2}
                ISOWeek
              />
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="ghost">
                  Cerrar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="md:col-span-4 flex gap-2">
          <Button variant="secondary" onClick={clearPeriodo} className="flex-1">
            <RefreshCcw className="h-4 w-4 mr-2" /> Limpiar
          </Button>
        </div>
      </div>
    );
  }

  // --- MODO CICLOS por defecto ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:items-end">
      {/* Año */}
      <div className="md:col-span-2">
        <Label>Año</Label>
        <Select value={anio} onValueChange={(v) => setAnio(v === "__clear__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            {aniosList.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
            <SelectItem value="__clear__">Limpiar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Idioma */}
      <div className="md:col-span-2">
        <Label>Idioma</Label>
        <Select
          value={idioma}
          onValueChange={(v) => setIdioma(v === "__clear__" ? "" : (v as Idioma))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ingles">Inglés</SelectItem>
            <SelectItem value="frances">Francés</SelectItem>
            <SelectItem value="aleman">Alemán</SelectItem>
            <SelectItem value="__clear__">Limpiar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ciclo */}
      <div className="md:col-span-5">
        <Label>Ciclo</Label>
        <Select value={cicloId} onValueChange={(v) => setCicloId(v === "__clear__" ? "" : v)}>
          <SelectTrigger disabled={loadingCiclos}>
            <SelectValue placeholder={loadingCiclos ? "Cargando..." : "Selecciona un ciclo"} />
          </SelectTrigger>
          <SelectContent>
            {(Array.isArray(ciclos) ? ciclos : []).map((c: CicloLite) => (
              <SelectItem key={String(c.id)} value={String(c.id)}>
                {c.codigo}
              </SelectItem>
            ))}
            <SelectItem value="__clear__">Limpiar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Acciones */}
      <div className="md:col-span-3 flex gap-2">
        <Button variant="secondary" onClick={clearAllCiclos} className="flex-1">
          <RefreshCcw className="h-4 w-4 mr-2" /> Limpiar
        </Button>
      </div>
    </div>
  );
}
