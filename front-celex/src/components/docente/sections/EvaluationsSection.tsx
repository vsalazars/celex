"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { apiFetch, buildURL } from "@/lib/api";

// ────────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────────

type CursoItem = {
  id: number;
  codigo: string;
  idioma: string;
  nivel: string;
  modalidad: string;
  turno: string;
};

type AlumnoItem = {
  inscripcionId: number; // id de Inscripcion
  alumnoId: number;
  nombre: string;
  correo: string;
  curp: string;
  asistenciaPct: number; // 0..100
  // Criterios de evaluación (pueden venir precargados si existen en backend)
  medio_examen?: number | null;   // 0..80
  medio_continua?: number | null; // 0..20
  final_examen?: number | null;   // 0..60
  final_continua?: number | null; // 0..20
  final_tarea?: number | null;    // 0..20
};

// ────────────────────────────────────────────────────────────────────────────────
// API helpers (docente)
// ────────────────────────────────────────────────────────────────────────────────

async function listCursosDocente(): Promise<CursoItem[]> {
  const url = buildURL("/docente/grupos");
  const data = await apiFetch(url, { auth: true });
  return (data?.items ?? data ?? []).map((r: any) => ({
    id: r.id ?? r.ciclo_id ?? r.curso_id,
    codigo: r.codigo ?? r.code ?? `CIC-${r.id}`,
    idioma: r.idioma,
    nivel: r.nivel,
    modalidad: r.modalidad,
    turno: r.turno,
  }));
}

async function getAlumnosConAsistencia(cicloId: number): Promise<AlumnoItem[]> {
  // 1) Alumnos (tu endpoint plano con alumno_nombre, alumno_email, curp, etc.)
  const urlAlumnos = buildURL(`/docente/grupos/${cicloId}/alumnos`);
  const alumnosRaw = await apiFetch(urlAlumnos, { auth: true });

  // 2) Matriz de asistencia
  const urlMatriz = buildURL(`/docente/asistencia/ciclos/${cicloId}/matriz`);
  const matriz = await apiFetch(urlMatriz, { auth: true });

  const totalSesiones: number =
    matriz?.total_sesiones ?? matriz?.total ?? matriz?.sesiones?.length ?? 0;

  // Calcula porcentaje de asistencia por fila (acepta array u objeto)
  const pctFromRegistros = (row: any): number => {
    const regs = row?.registros;
    const estados = Array.isArray(regs)
      ? regs.map((r: any) => r?.estado)
      : Object.values(regs ?? {});
    const ok = estados.filter((e: any) => {
      const s = String(e ?? "").toLowerCase();
      return s === "presente" || s === "justificado";
    }).length;
    if (!totalSesiones || totalSesiones <= 0) return 0;
    return Math.round((ok / totalSesiones) * 100);
  };

  const idxMatriz: Record<number, { pct: number }> = {};
  for (const row of matriz?.alumnos ?? matriz?.rows ?? []) {
    const inscId = row?.inscripcion_id ?? row?.inscripcionId ?? row?.id;
    if (inscId != null) idxMatriz[inscId] = { pct: pctFromRegistros(row) };
  }

  // Mapeo defensivo (prioriza alumno_nombre)
  const list = (alumnosRaw?.items ?? alumnosRaw ?? []) as any[];
  return list.map((a) => {
    const inscripcionId = a?.inscripcion_id ?? a?.inscripcionId ?? a?.id;

    // --------------- NOMBRE ---------------
    // 1) Prioriza el que manda el back ya listo
    let nombre: string =
      (typeof a?.alumno_nombre === "string" && a.alumno_nombre.trim()) ? a.alumno_nombre.trim() : "";

    // 2) Si no viene, intenta con campos planos
    if (!nombre) {
      const firstFlat = a?.first_name ?? a?.nombres ?? a?.name ?? null;
      const lastFlat  = a?.last_name ?? a?.apellidos ?? a?.surname ?? null;
      const plano = [firstFlat, lastFlat].filter(Boolean).join(" ").trim();
      if (plano) nombre = plano;
    }

    // 3) Si tu endpoint alguna vez devuelve objeto anidado (compatibilidad)
    if (!nombre) {
      const alumnoObj = a?.alumno ?? a?.user ?? a?.estudiante ?? a?.student ?? {};
      const first = alumnoObj?.first_name ?? alumnoObj?.nombres ?? alumnoObj?.name ?? null;
      const last  = alumnoObj?.last_name  ?? alumnoObj?.apellidos ?? alumnoObj?.surname ?? null;
      const combo = [first, last].filter(Boolean).join(" ").trim();
      if (combo) nombre = combo;
      else {
        const full =
          a?.nombre_completo ??
          alumnoObj?.nombre_completo ??
          a?.full_name ??
          alumnoObj?.full_name ??
          a?.nombre ??
          alumnoObj?.nombre ??
          null;
        if (full) nombre = String(full).trim();
      }
    }

    // 4) Último recurso: username o parte local del email
    const correoPlano =
      a?.alumno_email ??
      a?.email ??
      a?.alumno?.email ??
      "";
    if (!nombre) {
      const username =
        a?.alumno_username ??
        a?.username ??
        (correoPlano ? String(correoPlano).split("@")[0] : "");
      nombre = username
        ? String(username).replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "(Sin nombre)";
    }

    // --------------- CORREO / CURP ---------------
    const correo =
      a?.alumno_email ??
      a?.email ??
      a?.alumno?.email ??
      "";

    const curp =
      a?.curp ??
      a?.CURP ??
      a?.alumno_curp ??
      a?.alumno?.curp ??
      "";

    // --------------- ASISTENCIA ---------------
    const asistenciaPct = idxMatriz[inscripcionId]?.pct ?? 0;

    return {
      inscripcionId,
      alumnoId:
        a?.alumno_id ??
        a?.alumnoId ??
        a?.user_id ??
        a?.alumno?.id ??
        0,
      nombre,
      correo,
      curp,
      asistenciaPct,
      // precarga si el back ya guarda algo
      medio_examen:   a?.medio_examen ?? a?.medioExamen ?? null,
      medio_continua: a?.medio_continua ?? a?.medioContinua ?? null,
      final_examen:   a?.final_examen ?? a?.finalExamen ?? null,
      final_continua: a?.final_continua ?? a?.finalContinua ?? null,
      final_tarea:    a?.final_tarea ?? a?.finalTarea ?? null,
    } as AlumnoItem;
  });
}


async function saveEvaluacion(
  cicloId: number,
  inscripcionId: number,
  payload: Partial<Omit<AlumnoItem, "inscripcionId" | "alumnoId" | "nombre" | "correo" | "curp" | "asistenciaPct" >>
) {
  // Endpoint sugerido (crearás en backend):
  // POST /docente/evaluaciones/ciclos/{cicloId}/alumnos/{inscripcionId}
  const url = buildURL(`/docente/evaluaciones/ciclos/${cicloId}/alumnos/${inscripcionId}`);
  return apiFetch(url, {
    auth: true,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers de puntuación
// ────────────────────────────────────────────────────────────────────────────────

const MAX = {
  medio_examen: 80,
  medio_continua: 20,
  final_examen: 60,
  final_continua: 20,
  final_tarea: 20,
} as const;

type Draft = Record<number, Partial<Pick<AlumnoItem, keyof typeof MAX>>>;

function clamp(v: number | null | undefined, max: number): number | null {
  if (v === null || v === undefined) return null;
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(max, n));
}

function sumMedio(d: Partial<AlumnoItem>): number {
  return (clamp(d.medio_examen, MAX.medio_examen) ?? 0) + (clamp(d.medio_continua, MAX.medio_continua) ?? 0);
}

function sumFinal(d: Partial<AlumnoItem>): number {
  return (
    (clamp(d.final_examen, MAX.final_examen) ?? 0) +
    (clamp(d.final_continua, MAX.final_continua) ?? 0) +
    (clamp(d.final_tarea, MAX.final_tarea) ?? 0)
  );
}

function promedioFinal(d: Partial<AlumnoItem>): number {
  return Math.round(((sumMedio(d) + sumFinal(d)) / 2) * 100) / 100; // 2 decimales
}

// ────────────────────────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────────────────────────

export default function DocenteEvaluacionesPage() {
  const router = useRouter();

  const [loadingCursos, setLoadingCursos] = useState(true);
  const [cursos, setCursos] = useState<CursoItem[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | null>(null);

  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [alumnos, setAlumnos] = useState<AlumnoItem[]>([]);

  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        setLoadingCursos(true);
        const items = await listCursosDocente();
        setCursos(items);
        if (items.length > 0) setSelectedCursoId(items[0].id);
      } catch (e: any) {
        toast.error(e?.message ?? "No se pudieron cargar tus cursos");
      } finally {
        setLoadingCursos(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCursoId) return;
    (async () => {
      try {
        setLoadingAlumnos(true);
        const rows = await getAlumnosConAsistencia(selectedCursoId);
        setAlumnos(rows);
        const d: Draft = {};
        for (const r of rows) {
          d[r.inscripcionId] = {
            medio_examen: r.medio_examen ?? null,
            medio_continua: r.medio_continua ?? null,
            final_examen: r.final_examen ?? null,
            final_continua: r.final_continua ?? null,
            final_tarea: r.final_tarea ?? null,
          };
        }
        setDraft(d);
      } catch (e: any) {
        toast.error(e?.message ?? "No se pudo cargar el listado de alumnos");
      } finally {
        setLoadingAlumnos(false);
      }
    })();
  }, [selectedCursoId]);

  const selectedCurso = useMemo(() => cursos.find(c => c.id === selectedCursoId) ?? null, [cursos, selectedCursoId]);

  function setDraftField(inscripcionId: number, key: keyof typeof MAX, value: number | "") {
    setDraft(prev => ({
      ...prev,
      [inscripcionId]: {
        ...prev[inscripcionId],
        [key]: value === "" ? null : clamp(Number(value), MAX[key]),
      },
    }));
  }

  async function handleSaveRow(a: AlumnoItem) {
    if (!selectedCursoId) return;
    const vals = draft[a.inscripcionId] ?? {};
    setSaving(s => ({ ...s, [a.inscripcionId]: true }));
    try {
      await saveEvaluacion(selectedCursoId, a.inscripcionId, vals);
      toast.success(`Evaluación guardada para ${a.nombre}`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la evaluación");
    } finally {
      setSaving(s => ({ ...s, [a.inscripcionId]: false }));
    }
  }

  async function handleSaveAll() {
    if (!selectedCursoId) return;
    try {
      const promises = alumnos.map(a => saveEvaluacion(selectedCursoId, a.inscripcionId, draft[a.inscripcionId] ?? {}));
      await Promise.all(promises);
      toast.success("Todas las evaluaciones fueron guardadas");
    } catch (e: any) {
      toast.error(e?.message ?? "Hubo errores al guardar en masa");
    }
  }

  function Th({
    title,
    hint,
    className = "",
  }: { title: string; hint?: string; className?: string }) {
    return (
      <TableHead className={`${className} text-center align-top`}>
        <div className="leading-tight whitespace-normal break-words [text-wrap:balance]">
          <div className="font-medium">{title}</div>
          {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
        </div>
      </TableHead>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 space-y-4">

    <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Evaluaciones del docente</CardTitle>
            <p className="text-sm text-muted-foreground">Selecciona un curso y captura las calificaciones por bloque.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => selectedCursoId && router.refresh()}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Refrescar
            </Button>
            <Button size="sm" onClick={handleSaveAll} disabled={!alumnos.length}>
              <Save className="h-4 w-4 mr-2" /> Guardar todo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Curso</label>
              <Select
                value={selectedCursoId ? String(selectedCursoId) : undefined}
                onValueChange={(v) => setSelectedCursoId(Number(v))}
                disabled={loadingCursos}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCursos ? "Cargando cursos..." : "Selecciona un curso"} />
                </SelectTrigger>
                <SelectContent>
                  {cursos.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.codigo} · {c.idioma?.toUpperCase()} {c.nivel} · {c.modalidad} · {c.turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCurso && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Seleccionado</div>
                <div className="text-sm font-medium">{selectedCurso.codigo}</div>
                <div className="text-xs text-muted-foreground">{selectedCurso.idioma?.toUpperCase()} {selectedCurso.nivel} · {selectedCurso.modalidad} · {selectedCurso.turno}</div>
              </div>
            )}
          </div>

          <div className="border rounded-xl overflow-x-hidden">
          <Table className="table-fixed w-full text-[11px]">
            <colgroup>
              <col className="w-[160px]" />
              <col className="w-[130px]" />
              <col className="w-[100px]" />
              <col className="w-[70px]" />
              <col className="w-[76px]" />
              <col className="w-[76px]" />
              <col className="w-[70px]" />
              <col className="w-[76px]" />
              <col className="w-[76px]" />
              <col className="w-[86px]" />
              <col className="w-[70px]" />
              <col className="w-[70px]" />
              <col className="w-[90px]" />
            </colgroup>

            <TableHeader>
              <TableRow className="leading-tight">
                <TableHead className="min-w-0">Alumno</TableHead>
                <TableHead className="min-w-0">Correo</TableHead>
                <Th title="Asist." />

                <Th title="Medio · Examen" hint="0–80" />
                <Th title="Medio · Cont." hint="0–20" />
                <Th title="Subtotal" hint="Medio" />

                <Th title="Final · Examen" hint="0–60" />
                <Th title="Final · Cont." hint="0–20" />
                <Th title="Final · Tarea" hint="0–20" />
                <Th title="Subtotal" hint="Final" />

                <Th title="Promedio" />
                <TableHead className="min-w-0"></TableHead>
              </TableRow>
            </TableHeader>

              <TableBody>
                {loadingAlumnos ? (
                  <TableRow>
                    <TableCell colSpan={14}>
                      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando alumnos...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : alumnos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14}>
                      <div className="py-8 text-center text-muted-foreground">No hay alumnos para este curso</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  alumnos.map((r) => {
                    const d = draft[r.inscripcionId] ?? {};
                    const savingRow = saving[r.inscripcionId] ?? false;
                    const mid = sumMedio(d);
                    const fin = sumFinal(d);
                    const prom = promedioFinal(d);

                    return (
                      <TableRow key={r.inscripcionId}>
                        <TableCell>
                          <div className="text-sm">{r.nombre}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.correo}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={r.asistenciaPct >= 80 ? "default" : r.asistenciaPct >= 60 ? "secondary" : "destructive"}>
                            {r.asistenciaPct}%
                          </Badge>
                        </TableCell>

                        {/* Medio curso */}
                        <TableCell className="text-center">
                          <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0-80"
                            value={d.medio_examen ?? ""}
                            onChange={(e) => setDraftField(r.inscripcionId, "medio_examen", e.target.value === "" ? "" as any : Number(e.target.value))}
                            className="text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0-20"
                            value={d.medio_continua ?? ""}
                            onChange={(e) => setDraftField(r.inscripcionId, "medio_continua", e.target.value === "" ? "" as any : Number(e.target.value))}
                            className="text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{mid}</Badge>
                        </TableCell>

                        {/* Final de curso */}
                        <TableCell className="text-center">
                          <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0-60"
                            value={d.final_examen ?? ""}
                            onChange={(e) => setDraftField(r.inscripcionId, "final_examen", e.target.value === "" ? "" as any : Number(e.target.value))}
                            className="text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0-20"
                            value={d.final_continua ?? ""}
                            onChange={(e) => setDraftField(r.inscripcionId, "final_continua", e.target.value === "" ? "" as any : Number(e.target.value))}
                            className="text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0-20"
                            value={d.final_tarea ?? ""}
                            onChange={(e) => setDraftField(r.inscripcionId, "final_tarea", e.target.value === "" ? "" as any : Number(e.target.value))}
                            className="text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{fin}</Badge>
                        </TableCell>

                        {/* Promedio */}
                        <TableCell className="text-center">
                          <Badge variant={prom >= 70 ? "default" : "secondary"}>{prom}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" disabled={savingRow} onClick={() => handleSaveRow(r)}>
                            {savingRow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Guardar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
