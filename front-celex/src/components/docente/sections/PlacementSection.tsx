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
  inscritos?: number;
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

// Catálogo de niveles
const NIVELES: { value: string; label: string }[] = [
  { value: "A1", label: "A1 — Principiante" },
  { value: "A2", label: "A2 — Básico" },
  { value: "B1", label: "B1 — Intermedio" },
  { value: "B2", label: "B2 — Intermedio alto" },
  { value: "C1", label: "C1 — Avanzado" },
  { value: "C2", label: "C2 — Maestría" },
  { value: "BASICO", label: "Básico" },
  { value: "INTERMEDIO", label: "Intermedio" },
  { value: "AVANZADO", label: "Avanzado" },
];

// ───────────────────────────────────────────────────────────────────────────────
// Llamadas de red autocontenidas
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
    // Admin/coord style
    `${API}/placement-exams/${examId}/registros-admin`,
    // Docente/mis registros (si el backend los filtra por docente asignado)
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
      // Normalizamos campos comunes
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
    // Endpoints específicos por registro
    { url: `${API}/placement-exams/registros/${registroId}/nivel-idioma`, method: "PATCH" },
    { url: `${API}/placement-exams/registros/${registroId}`, method: "PATCH" },
    { url: `${API}/placement-exams/registros/${registroId}`, method: "PUT" },
    // Genéricos
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
    if (res.status === 404) continue;
    if (res.status === 401) throw new Error("UNAUTHORIZED");
  }
  throw new Error("ENDPOINT_NO_DISPONIBLE");
}
// ───────────────────────────────────────────────────────────────────────────────

export default function PlacementSection() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [data, setData] = useState<PlacementExamAsignado[]>([]);

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

  // Abrir sheet y cargar alumnos
  const openAlumnosSheet = async (ex: PlacementExamAsignado) => {
    setExamFocus(ex);
    setOpen(true);
    setRegLoading(true);
    try {
      const regs = await fetchRegistrosPorExamen(ex.id);
      setRegistros(regs);
      const initial: Record<string, string | undefined> = {};
      regs.forEach((r) => {
        initial[String(r.id)] = r.nivel_asignado ?? undefined;
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
    if (!elegido) {
      toast.message("Selecciona un nivel antes de guardar.");
      return;
    }
    setSavingByRegId((p) => ({ ...p, [id]: true }));
    const prev = r.nivel_asignado ?? null;

    try {
      // Optimista
      setRegistros((rows) =>
        rows.map((x) => (String(x.id) === id ? { ...x, nivel_asignado: elegido } : x))
      );
      await persistNivelPorRegistro(r.id, elegido);
      toast.success("Nivel guardado.");
    } catch (err: any) {
      console.error(err);
      // revert
      setRegistros((rows) =>
        rows.map((x) => (String(x.id) === id ? { ...x, nivel_asignado: prev } : x))
      );
      if (err?.message === "UNAUTHORIZED") {
        toast.error("Sesión expirada. Inicia sesión nuevamente.");
      } else if (String(err?.message || "").startsWith("FALTA_CONFIG_API_URL")) {
        toast.error("Configura NEXT_PUBLIC_API_URL en tu .env.local.");
      } else if (err?.message === "ENDPOINT_NO_DISPONIBLE") {
        toast.info("No hay endpoint disponible. Se guardó localmente.");
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
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Nivel actual</TableHead>
                  <TableHead>Sede/Turno</TableHead>
                  <TableHead className="text-right">Inscritos</TableHead>
                  <TableHead className="text-right">Alumnos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell className="font-medium">
                      {ex.titulo ?? `Examen #${ex.id}`}
                    </TableCell>
                    <TableCell>{formatDate(ex.fecha)}</TableCell>
                    <TableCell>{ex.modalidad ?? "—"}</TableCell>
                    <TableCell>{ex.idioma ?? "—"}</TableCell>
                    <TableCell>{ex.nivel ?? "—"}</TableCell>
                    <TableCell>
                      {[ex.sede, ex.turno].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">{ex.inscritos ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="default" onClick={() => openAlumnosSheet(ex)}>
                        Ver alumnos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sheet de alumnos */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="p-4 pb-2">
              <SheetTitle>Alumnos — {examFocus?.titulo ?? `Examen #${examFocus?.id}`}</SheetTitle>
              <SheetDescription>
                Asigna el <strong>nivel a cursar</strong> para cada alumno inscrito.
              </SheetDescription>
            </SheetHeader>
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
            <div className="flex-1">
              {regLoading ? (
                <div className="p-4 text-sm text-neutral-500">Cargando alumnos…</div>
              ) : filteredRegistros.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">
                  No hay alumnos inscritos {regFilter ? "que coincidan con la búsqueda." : "."}
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {filteredRegistros.map((r) => {
                      const id = String(r.id);
                      const saving = !!savingByRegId[id];
                      const seleccionado = nivelUIByRegId[id];
                      const hasChanges =
                        (r.nivel_asignado ?? undefined) !== (seleccionado ?? undefined);

                      return (
                        <div
                          key={id}
                          className="rounded-xl border p-3"
                        >
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
                              <Badge variant="outline">
                                {r.nivel_asignado ? `Actual: ${r.nivel_asignado}` : "Sin nivel"}
                              </Badge>
                            </div>

                            <div className="mt-2 flex flex-wrap items-end gap-2">
                              <div className="grid gap-1">
                                <Label className="text-xs text-neutral-500">Nivel a cursar</Label>
                                <Select
                                  value={seleccionado}
                                  onValueChange={(v) =>
                                    setNivelUIByRegId((p) => ({ ...p, [id]: v }))
                                  }
                                  disabled={saving}
                                >
                                  <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Elige nivel" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {NIVELES.map((n) => (
                                      <SelectItem key={n.value} value={n.value}>
                                        {n.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <Button
                                variant={hasChanges ? "default" : "secondary"}
                                onClick={() => handleGuardarNivel(r)}
                                disabled={saving || !hasChanges || !seleccionado}
                              >
                                {saving ? "Guardando…" : hasChanges ? "Guardar" : "Guardado"}
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
