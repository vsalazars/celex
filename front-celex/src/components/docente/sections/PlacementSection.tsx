"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI (shadcn)
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// ───────────────────────────────────────────────────────────────────────────────
// Tipos locales
interface PlacementExamAsignado {
  id: number | string;
  titulo?: string;
  fecha?: string;     // ISO
  modalidad?: string; // "PRESENCIAL" | "LINEA" | etc.
  idioma?: string;
  nivel?: string;     // nivel actual del examen (opcional)
  sede?: string;
  turno?: string;
  inscritos?: number; // (del back) puede incluir PREINSCRITA+VALIDADA; en UI usaremos validados calculados
}

interface RegistroAlumno {
  id: number | string;     // id del registro/inscripción al examen
  alumno_nombre?: string;
  alumno_email?: string;
  alumno_boleta?: string;
  nivel_asignado?: string | null; // nivel ya asignado (si existe)
}
// ───────────────────────────────────────────────────────────────────────────────

// Helpers locales (no dependemos de lib/constants ni lib/sessions)
function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error(
      "FALTA_CONFIG_API_URL: Define NEXT_PUBLIC_API_URL en tu .env.local"
    );
  }
  return url.replace(/\/+$/, "");
}

function getToken(): string | null {
  try {
    return (
      localStorage.getItem("celex_token") ||
      localStorage.getItem("token") ||
      null
    );
  } catch {
    return null;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/* ============================================================================
   Catálogo de niveles (Ajustado al enum Nivel del backend)
   - value = clave del enum (INTRO, B1..B5, I1..I5, A1..A6)
   - label = texto legible
   - normalizeNivelKey: convierte variantes del back a la clave correcta
============================================================================ */

const NIVEL_LABELS: Record<string, string> = {
  INTRO: "Introductorio",
  B1: "Básico 1",
  B2: "Básico 2",
  B3: "Básico 3",
  B4: "Básico 4",
  B5: "Básico 5",
  I1: "Intermedio 1",
  I2: "Intermedio 2",
  I3: "Intermedio 3",
  I4: "Intermedio 4",
  I5: "Intermedio 5",
  A1: "Avanzado 1",
  A2: "Avanzado 2",
  A3: "Avanzado 3",
  A4: "Avanzado 4",
  A5: "Avanzado 5",
  A6: "Avanzado 6",
};

// Orden explícito para el select
const NIVEL_ORDER: string[] = [
  "INTRO",
  "B1","B2","B3","B4","B5",
  "I1","I2","I3","I4","I5",
  "A1","A2","A3","A4","A5","A6",
];

const NIVELES: { value: string; label: string }[] = NIVEL_ORDER.map((k) => ({
  value: k,
  label: NIVEL_LABELS[k],
}));

/** Normaliza lo que venga del back a la CLAVE del enum (INTRO, B1..B5, I1..I5, A1..A6) */
function normalizeNivelKey(n: string | null | undefined): string | null {
  if (!n) return null;
  const k = String(n).trim().toUpperCase();

  // Soportar palabras completas como "INTRODUCTORIO", "BÁSICO 1", "INTERMEDIO 3", "AVANZADO 2"
  if (k.startsWith("INTRO")) return "INTRO";

  const basico = k.match(/^B[ÁA]SICO\s*([1-5])$/);
  if (basico) return `B${basico[1]}`;

  const inter = k.match(/^INTERMEDIO\s*([1-5])$/);
  if (inter) return `I${inter[1]}`;

  const avan = k.match(/^AVANZADO\s*([1-6])$/);
  if (avan) return `A${avan[1]}`;

  if (k in NIVEL_LABELS) return k;
  return null;
}

/* ======= Chips de color por nivel ======= */
function nivelChipClass(nKey: string | null | undefined, { subdued = false } = {}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 whitespace-nowrap";
  const k = normalizeNivelKey(nKey ?? null);

  if (!k) return `${base} bg-zinc-50 text-zinc-700 ring-zinc-200`;

  const soft = subdued ? "50" : "100";
  if (k === "INTRO") return `${base} bg-slate-${soft} text-slate-700 ring-slate-200`;
  if (k.startsWith("B")) return `${base} bg-amber-${soft} text-amber-800 ring-amber-200`;
  if (k.startsWith("I")) return `${base} bg-blue-${soft} text-blue-800 ring-blue-200`;
  if (k.startsWith("A")) return `${base} bg-violet-${soft} text-violet-800 ring-violet-200`;

  return `${base} bg-zinc-${soft} text-zinc-700 ring-zinc-200`;
}

function NivelBadge({
  nKey,
  prefix,
  subdued,
  locked = false,
}: {
  nKey: string | null | undefined;
  prefix?: string;
  subdued?: boolean;
  locked?: boolean;
}) {
  const labelKey = normalizeNivelKey(nKey);
  const label = labelKey ? NIVEL_LABELS[labelKey] : "Sin nivel";
  return (
    <span
      className={nivelChipClass(labelKey, { subdued })}
      title={locked ? "Nivel ya fijado en el servidor" : undefined}
    >
      {prefix ? <strong>{prefix}:</strong> : null} {label}
      {locked ? " · Fijado" : ""}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
async function fetchExamenesAsignados(): Promise<PlacementExamAsignado[]> {
  const token = getToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const API = getApiUrl();

  const endpoints = [
    `${API}/placement-exams/teachers/mis-examenes`,
    `${API}/placement-exams?assigned_to=me`,
  ];

  for (const url of endpoints) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json) ? json : json.items ?? [];
    }
    if (res.status === 404) continue;
    if (res.status === 401) throw new Error("UNAUTHORIZED");
  }
  return [];
}

async function fetchRegistrosPorExamen(examId: string | number): Promise<RegistroAlumno[]> {
  const token = getToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const API = getApiUrl();

  const candidates = [
    `${API}/placement-exams/${examId}/registros-admin`,
    `${API}/placement-exams/${examId}/registros?scope=teacher`,
    `${API}/placement-exams/${examId}/registros`,
  ];

  for (const url of candidates) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const items = Array.isArray(json) ? json : json.items ?? [];
      return items.map((r: any) => ({
        id: r.id ?? r.registro_id ?? r.pk ?? r.uuid ?? String(Math.random()),
        alumno_nombre: r.alumno_nombre ?? r.nombre ?? r.full_name ?? r.alumno?.nombre,
        alumno_email: r.alumno_email ?? r.email ?? r.alumno?.email,
        alumno_boleta: r.alumno_boleta ?? r.boleta ?? r.alumno?.boleta,
        nivel_asignado: r.nivel_asignado ?? r.nivel ?? r.nivel_idioma ?? null,
      })) as RegistroAlumno[];
    }
    if (res.status === 404) continue;
    if (res.status === 401) throw new Error("UNAUTHORIZED");
  }
  return [];
}

async function persistNivelPorRegistro(
  registroId: number | string,
  nivel: string
): Promise<boolean> {
  const token = getToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const API = getApiUrl();

  const body = JSON.stringify({ nivel_idioma: nivel, nivel });

  const candidates: { url: string; method: "PATCH" | "PUT" | "POST" }[] = [
    { url: `${API}/placement-exams/registros/${registroId}/nivel-idioma`, method: "PATCH" },
    { url: `${API}/placement-exams/registros/${registroId}`, method: "PATCH" },
    { url: `${API}/placement-exams/registros/${registroId}`, method: "PUT" },
    { url: `${API}/registros/${registroId}/nivel-idioma`, method: "PATCH" },
    { url: `${API}/registros/${registroId}`, method: "PATCH" },
  ];

  for (const c of candidates) {
    const res = await fetch(c.url, {
      method: c.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (res.ok) return true;

    if (res.status === 409) {
      let detail = "Este registro ya tiene un nivel asignado y no puede modificarse.";
      try {
        const j = await res.json();
        detail = j?.detail || detail;
      } catch {}
      throw new Error(detail);
    }

    if (res.status === 404) continue;
    if (res.status === 401) throw new Error("UNAUTHORIZED");

    try {
      const j = await res.json();
      throw new Error(j?.detail || "Error al guardar el nivel.");
    } catch {
      throw new Error("Error al guardar el nivel.");
    }
  }
  throw new Error("ENDPOINT_NO_DISPONIBLE");
}

// ───────────────────────────────────────────────────────────────────────────────

export default function PlacementSection() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [data, setData] = useState<PlacementExamAsignado[]>([]);

  const [validadosByExam, setValidadosByExam] = useState<Record<string, number>>({});

  // Sheet state
  const [open, setOpen] = useState(false);
  const [examFocus, setExamFocus] = useState<PlacementExamAsignado | null>(null);
  const [registros, setRegistros] = useState<RegistroAlumno[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regFilter, setRegFilter] = useState("");
  const [savingByRegId, setSavingByRegId] = useState<Record<string, boolean>>({});
  const [nivelUIByRegId, setNivelUIByRegId] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const items = await fetchExamenesAsignados();
        if (alive) setData(items ?? []);
      } catch (err: any) {
        console.error(err);
        if (err?.message === "UNAUTHORIZED") {
          toast.error("Tu sesión expiró. Inicia sesión nuevamente.");
        } else if (String(err?.message || "").startsWith("FALTA_CONFIG_API_URL")) {
          toast.error("Configura NEXT_PUBLIC_API_URL en tu .env.local.");
        } else {
          toast.error("No se pudieron cargar los exámenes de colocación.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!data || data.length === 0) return;
    let canceled = false;

    (async () => {
      try {
        const results = await Promise.allSettled(
          data.map(async (ex) => {
            const regs = await fetchRegistrosPorExamen(ex.id);
            return [String(ex.id), regs.length] as const;
          })
        );

        if (canceled) return;

        const next: Record<string, number> = {};
        for (const r of results) {
          if (r.status === "fulfilled") {
            const [id, count] = r.value;
            next[id] = count;
          }
        }
        setValidadosByExam(next);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    const hay = (v?: string | number) => String(v ?? "").toLowerCase();
    return data.filter((ex) =>
      [
        ex.titulo,
        ex.modalidad,
        ex.idioma,
        ex.nivel,
        ex.sede,
        ex.turno,
        ex.fecha,
        ex.id,
      ].some((v) => hay(v).includes(needle))
    );
  }, [data, q]);

  const filteredRegistros = useMemo(() => {
    const needle = regFilter.trim().toLowerCase();
    if (!needle) return registros;
    const hay = (v?: string | number | null) => String(v ?? "").toLowerCase();
    return registros.filter((r) =>
      [r.alumno_nombre, r.alumno_email, r.alumno_boleta, r.nivel_asignado, r.id]
        .some((v) => hay(v).includes(needle))
    );
  }, [registros, regFilter]);

  const openAlumnosSheet = async (ex: PlacementExamAsignado) => {
    setExamFocus(ex);
    setOpen(true);
    setRegLoading(true);
    try {
      const regs = await fetchRegistrosPorExamen(ex.id);
      setRegistros(regs);
      const initial: Record<string, string | undefined> = {};
      regs.forEach((r) => {
        initial[String(r.id)] = normalizeNivelKey(r.nivel_asignado) ?? undefined;
      });
      setNivelUIByRegId(initial);
    } catch (err: any) {
      console.error(err);
      if (err?.message === "UNAUTHORIZED") {
        toast.error("Tu sesión expiró. Inicia sesión nuevamente.");
        setOpen(false);
      } else if (String(err?.message || "").startsWith("FALTA_CONFIG_API_URL")) {
        toast.error("Configura NEXT_PUBLIC_API_URL en tu .env.local.");
      } else {
        toast.error("No se pudieron cargar los alumnos de este examen.");
      }
    } finally {
      setRegLoading(false);
    }
  };

  const handleGuardarNivel = async (r: RegistroAlumno) => {
    const id = String(r.id);
    const elegido = nivelUIByRegId[id];
    const previoKey = normalizeNivelKey(r.nivel_asignado);

    if (previoKey) {
      toast.error("Este alumno ya tiene un nivel asignado y no puede modificarse.");
      return;
    }

    if (!elegido) {
      toast.message("Selecciona un nivel antes de guardar.");
      return;
    }

    setSavingByRegId((p) => ({ ...p, [id]: true }));

    try {
      setRegistros((rows) =>
        rows.map((x) =>
          String(x.id) === id ? { ...x, nivel_asignado: elegido } : x
        )
      );
      await persistNivelPorRegistro(r.id, elegido);
      toast.success("Nivel asignado.");
    } catch (err: any) {
      console.error(err);
      setRegistros((rows) =>
        rows.map((x) =>
          String(x.id) === id ? { ...x, nivel_asignado: r.nivel_asignado ?? null } : x
        )
      );

      const msg = String(err?.message || "");
      if (err?.message === "UNAUTHORIZED") {
        toast.error("Sesión expirada. Inicia sesión nuevamente.");
      } else if (msg.startsWith("FALTA_CONFIG_API_URL")) {
        toast.error("Configura NEXT_PUBLIC_API_URL en tu .env.local.");
      } else if (msg.includes("ya tiene un nivel") || msg.includes("no puede modificarse") || msg.includes("conflic")) {
        toast.info("Este registro ya estaba fijado en el servidor.");
      } else if (err?.message === "ENDPOINT_NO_DISPONIBLE") {
        toast.info("No hay endpoint disponible.");
      } else {
        toast.error("No se pudo guardar el nivel.");
      }
    } finally {
      setSavingByRegId((p) => ({ ...p, [id]: false }));
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Colocación — Mis exámenes</CardTitle>
          <div className="flex w-full max-w-[540px] items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por título, idioma, nivel, modalidad, sede…"
            />
            <Button variant="outline" onClick={() => setQ("")}>
              Limpiar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-neutral-500">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No hay exámenes de colocación asignados
              {q ? " que coincidan con el filtro." : "."}
            </p>
          ) : (
            <Table>
              <TableCaption>
                {filtered.length} examen{filtered.length === 1 ? "" : "es"} asignado
                {filtered.length === 1 ? "" : "s"}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Aula</TableHead>
                  <TableHead className="text-right">Inscritos</TableHead>
                  <TableHead className="text-right">Alumnos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ex) => {
                  const validados = validadosByExam[String(ex.id)];
                  return (
                    <TableRow key={ex.id}>
                      <TableCell className="font-medium">
                        {ex.titulo ?? `Examen #${ex.id}`}
                      </TableCell>
                      <TableCell>{formatDate(ex.fecha)}</TableCell>
                      <TableCell>{ex.idioma ?? "—"}</TableCell>
                      <TableCell>
                        {[ex.sede, ex.turno].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {typeof validados === "number" ? validados : "…"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="default" onClick={() => openAlumnosSheet(ex)}>
                          Ver alumnos
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sheet de alumnos */}
      <Sheet open={open} onOpenChange={setOpen}>
        {/* ⬇️ altura controlada y sin scroll del contenedor; el scroll vive adentro */}
        <SheetContent className="w-full p-0 sm:max-w-2xl h-[100svh] sm:h-[85vh] overflow-hidden">
          {/* ⬇️ importantísimo para que el hijo pueda scrollear */}
          <div className="flex h-full flex-col">
            <SheetHeader className="p-4 pb-2">
              <SheetTitle>Alumnos — {examFocus?.titulo ?? `Examen #${examFocus?.id}`}</SheetTitle>
              <SheetDescription>
                Asigna el <strong>nivel a cursar</strong> para cada alumno inscrito.
              </SheetDescription>
            </SheetHeader>

            {/* Filtro superior */}
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2">
                <Input
                  value={regFilter}
                  onChange={(e) => setRegFilter(e.target.value)}
                  placeholder="Buscar por nombre, email, boleta o nivel…"
                />
                <Badge variant="secondary">{filteredRegistros.length}</Badge>
              </div>
            </div>

            <Separator />

            {/* ⬇️ contenedor que permite que ScrollArea calcule bien el alto */}
            <div className="flex-1 min-h-0">
              {regLoading ? (
                <div className="p-4 text-sm text-neutral-500">Cargando alumnos…</div>
              ) : filteredRegistros.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">
                  No hay alumnos inscritos {regFilter ? "que coincidan con la búsqueda." : "."}
                </div>
              ) : (
                // ⬇️ el scroll ocurre aquí
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3 pr-2">
                    {filteredRegistros.map((r) => {
                      const id = String(r.id);
                      const saving = !!savingByRegId[id];

                      const actualKey = normalizeNivelKey(r.nivel_asignado);
                      const seleccionado = nivelUIByRegId[id];
                      const seleccionadoKey = normalizeNivelKey(seleccionado);
                      const hasChanges =
                        (normalizeNivelKey(r.nivel_asignado) ?? undefined) !== (seleccionadoKey ?? undefined);
                      const locked = !!actualKey;

                      return (
                        <div key={id} className="rounded-xl border p-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {r.alumno_nombre ?? "Alumno sin nombre"}
                                </div>
                                <div className="truncate text-xs text-neutral-500">
                                  {r.alumno_email ?? "sin-email"} · {r.alumno_boleta ?? "sin-boleta"}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <NivelBadge nKey={actualKey} prefix="" locked={locked} />
                                {hasChanges && seleccionadoKey && (
                                  <NivelBadge nKey={seleccionadoKey} prefix="Nuevo" subdued />
                                )}
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-end gap-2">
                              <div className="grid gap-1">
                                <Label className="text-xs text-neutral-500">Nivel a cursar</Label>
                                <Select
                                  value={seleccionado ?? undefined}
                                  onValueChange={(v) =>
                                    setNivelUIByRegId((p) => ({ ...p, [id]: v }))
                                  }
                                  disabled={saving || locked}
                                >
                                  <SelectTrigger className="w-56">
                                    <SelectValue placeholder={locked ? "Nivel fijado" : "Elige nivel"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {NIVELES.map((n) => (
                                      <SelectItem key={n.value} value={n.value} disabled={locked}>
                                        {n.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {locked && (
                                  <span className="text-[11px] text-neutral-500">
                                    Este nivel fue asignado y ya no se puede cambiar.
                                  </span>
                                )}
                              </div>

                              <Button
                                variant={hasChanges ? "default" : "secondary"}
                                onClick={() => handleGuardarNivel(r)}
                                disabled={saving || !hasChanges || !seleccionadoKey || locked}
                              >
                                {saving ? "Guardando…" : hasChanges ? "Guardar" : locked ? "Asignado" : "Guardado"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Separator />

            <SheetFooter className="p-3">
              <div className="text-xs text-neutral-500">
                © {new Date().getFullYear()} CELEX · CECyT 15 "Diódoro Antúnez"
              </div>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
