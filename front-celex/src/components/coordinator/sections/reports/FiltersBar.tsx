"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { ReportFiltersState, Idioma, CicloLite } from "./useReportFilters";
import {
  getReportCiclos,
  getDocentes,
  listPlacementExamsLite,
  type PlacementExamLite,
} from "@/lib/api";

type AnyDocente = Record<string, any>;
type DocenteLite = { id: string | number; nombre: string };

type Props = ReportFiltersState & {
  /** modos: "ciclos" (default), "docente", "examen" */
  mode?: "ciclos" | "docente" | "examen";

  // ---- docente ----
  docenteId?: string;
  setDocenteId?: (v: string) => void;

  // ---- examen (selector por código dependiente de año + idioma) ----
  examCode?: string;
  setExamCode?: (v: string) => void;

  /** callback que ANTES disparabas con el botón "Aplicar".
   *  Ahora lo invoco automáticamente al seleccionar un código. */
  onApply?: () => void;
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

  mode = "ciclos",

  // docente
  docenteId = "",
  setDocenteId,

  // examen
  examCode = "",
  setExamCode,
  onApply,
}: Props) {
  const [docentes, setDocentes] = useState<DocenteLite[]>([]);
  const [loadingDocentes, setLoadingDocentes] = useState(false);

  // =======================
  // MODO: CICLOS (año/idioma/ciclo)
  // =======================
  useEffect(() => {
    if (mode !== "ciclos") return;
    (async () => {
      setLoadingCiclos(true);
      setError?.(null);
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
        setError?.(e?.message || "No se pudieron cargar los ciclos");
        setCiclos([]);
      } finally {
        setLoadingCiclos(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, anio, idioma]);

  // =======================
  // MODO: DOCENTE
  // =======================
  useEffect(() => {
    if (mode !== "docente") return;
    (async () => {
      setLoadingDocentes(true);
      setError?.(null);
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
        setError?.(e?.message || "No se pudieron cargar los docentes");
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
    setError?.(null);
  };

  const clearDocente = () => {
    if (setDocenteId) setDocenteId("");
    setError?.(null);
  };

  // =======================
  // MODO: EXAMEN (Año → Idioma → Código)
  // =======================
  const [examOpts, setExamOpts] = useState<PlacementExamLite[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  useEffect(() => {
    if (mode !== "examen") return;
    let mounted = true;
    (async () => {
      setLoadingExams(true);
      setError?.(null);
      try {
        const items = await listPlacementExamsLite({
          idioma: idioma || undefined,
          anio: anio || undefined,
          page_size: 200,
        } as any);

        if (!mounted) return;

        // Filtro por año en el cliente por si la API ignora "anio"
        const filtered =
          (items || []).filter((e: PlacementExamLite) => {
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
          }) ?? [];

        setExamOpts(filtered);

        // Si cambió año/idioma y el código ya no existe, limpia selección
        const exists = filtered.some((i) => i.codigo === examCode);
        if (!exists) setExamCode?.("");
      } catch (e: any) {
        if (!mounted) return;
        setExamOpts([]);
        setExamCode?.("");
        setError?.(e?.message || "No se pudieron cargar los exámenes");
      } finally {
        if (mounted) setLoadingExams(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, anio, idioma]);

  const selectedExam = useMemo(
    () => examOpts.find((e) => e.codigo === examCode) || null,
    [examOpts, examCode]
  );

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

  if (mode === "examen") {
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
        <div className="md:col-span-3">
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

        {/* Código (dependiente de Año + Idioma) */}
        <div className="md:col-span-4">
          <Label>Examen (Código — Idioma — Fecha)</Label>
          <Select
            value={examCode}
            onValueChange={(v) => {
              const val = v === "__clear__" ? "" : v;
              setExamCode?.(val);
              // 🔥 Dispara automáticamente al seleccionar un código válido
              if (val && onApply) setTimeout(() => onApply(), 0);
            }}
            disabled={loadingExams || !setExamCode}
          >
            <SelectTrigger className="w-full min-w-[320px] md:min-w-[380px] lg:min-w-[460px] bg-background text-foreground font-medium truncate">
              <SelectValue
                placeholder={loadingExams ? "Cargando..." : "Selecciona un examen"}
              />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={6}
              align="start"
              className="max-h-72 overflow-auto min-w-[320px] md:min-w-[380px] lg:min-w-[460px] z-50 bg-popover text-popover-foreground border shadow-md"
            >
              {examOpts.length === 0 ? (
                <SelectItem disabled value="__empty__" className="text-popover-foreground">
                  {anio || idioma ? "Sin resultados para el filtro" : "Sin exámenes"}
                </SelectItem>
              ) : (
                examOpts.map((e) => {
                  const label = `${e.codigo} — ${e.idioma} — ${e.fecha || "s/fecha"}`;
                  return (
                    <SelectItem
                      key={`exam-${e.id}`}
                      value={e.codigo}
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

        {/* Acciones (solo dejar "Limpiar") */}
        <div className="md:col-span-3 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setExamCode?.("")}
            className="flex-1"
            disabled={!setExamCode}
          >
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
        <Label>Curso</Label>
        <Select value={cicloId} onValueChange={(v) => setCicloId(v === "__clear__" ? "" : v)}>
          <SelectTrigger disabled={loadingCiclos}>
            <SelectValue placeholder={loadingCiclos ? "Cargando..." : "Selecciona un curso"} />
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
