"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, CalendarDays, Clock3, Search, FilterX,
} from "lucide-react";

import type { PlacementExam } from "@/lib/types";
import {
  listPlacement, createPlacement, updatePlacement, deletePlacement,
} from "@/lib/api";

/* ===== Helpers ===== */
const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "—";
  const day = dt.getDate();
  const month = dt.toLocaleString("es-MX", { month: "short" });
  const year = dt.getFullYear();
  return `${day}/${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`;
};
const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "—");

const estados = ["borrador", "publicado", "cerrado"] as const;
const idiomas = ["ingles", "frances", "aleman", "italiano", "portugues"] as const;

type Estado = typeof estados[number];
type Idioma = typeof idiomas[number];

export default function CoordinatorPlacement() {
  // Listado / filtros / paginación
  const [items, setItems] = useState<PlacementExam[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<Estado | undefined>();
  const [idioma, setIdioma] = useState<Idioma | undefined>();
  const [loading, setLoading] = useState(true);

  // Formulario
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<PlacementExam | null>(null);

  const hasAnyFilter = useMemo(() => !!(q.trim() || estado || idioma), [q, estado, idioma]);

  async function reload(p = page) {
    setLoading(true);
    try {
      const resp = await listPlacement({
        page: p,
        page_size: 10,
        q: q.trim() || undefined,
        estado,
        idioma,
      });
      setItems(resp.items);
      setPages(resp.pages);
      setPage(p);
    } catch (e: any) {
      toast.error(e.message || "No se pudo cargar la lista");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado, idioma]);

  useEffect(() => {
    reload(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function startCreate() {
    setEditing(null);
    setOpenForm(true);
  }
  function startEdit(it: PlacementExam) {
    setEditing(it);
    setOpenForm(true);
  }
  async function onDelete(it: PlacementExam) {
    try {
      await deletePlacement(it.id);
      toast.success("Examen eliminado");
      reload();
    } catch (e: any) {
      toast.error(e.message || "No se pudo eliminar");
    }
  }

  function clearFilters() {
    setQ("");
    setEstado(undefined);
    setIdioma(undefined);
  }

  async function onSubmitForm(form: FormData) {
    const payload = {
      nombre: String(form.get("nombre") || "").trim(),
      idioma: String(form.get("idioma") || "").trim() || "ingles",
      modalidad: String(form.get("modalidad") || "").trim() || undefined,
      fecha: String(form.get("fecha") || "") || undefined,
      hora: String(form.get("hora") || "") || undefined,
      duracion_min: Number(form.get("duracion_min") || 60),
      cupo_total: Number(form.get("cupo_total") || 0),
      costo: form.get("costo") ? Number(form.get("costo")) : undefined,
      nivel_objetivo: String(form.get("nivel_objetivo") || "").trim() || undefined,
      estado: String(form.get("estado") || "borrador"),
      instrucciones: String(form.get("instrucciones") || "").trim() || undefined,
      link_registro: String(form.get("link_registro") || "").trim() || undefined,
      activo: form.get("activo") === "on",
    } as Partial<PlacementExam>;

    try {
      if (!payload.nombre) {
        toast.error("El nombre es obligatorio");
        return;
      }
      if (editing) {
        await updatePlacement(editing.id, payload);
        toast.success("Examen actualizado");
      } else {
        await createPlacement(payload);
        toast.success("Examen creado");
      }
      setOpenForm(false);
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Buscar por nombre / idioma"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 w-[240px] pl-9"
              />
            </div>

            <Select value={estado} onValueChange={(v) => setEstado(v as Estado)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {estados.map((e) => (
                  <SelectItem key={e} value={e} className="capitalize">
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={idioma} onValueChange={(v) => setIdioma(v as Idioma)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                {idiomas.map((x) => (
                  <SelectItem key={x} value={x} className="capitalize">
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={hasAnyFilter ? "default" : "outline"}
              className="h-9 rounded-xl"
              onClick={clearFilters}
            >
              <FilterX className="mr-2 h-4 w-4" />
              {hasAnyFilter ? "Limpiar filtros" : "Sin filtros"}
            </Button>
          </div>

          <Dialog open={openForm} onOpenChange={(o) => { setOpenForm(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={startCreate} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo examen
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar examen de colocación" : "Nuevo examen de colocación"}</DialogTitle>
              </DialogHeader>

              <form action={(fd) => onSubmitForm(fd)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Nombre</Label>
                  <Input name="nombre" defaultValue={editing?.nombre} placeholder="Examen de colocación Agosto" required />
                </div>

                <div className="space-y-1">
                  <Label>Idioma</Label>
                  <Select name="idioma" defaultValue={editing?.idioma || "ingles"}>
                    <SelectTrigger><SelectValue placeholder="Selecciona idioma" /></SelectTrigger>
                    <SelectContent>
                      {idiomas.map((x) => (
                        <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Modalidad</Label>
                  <Input name="modalidad" defaultValue={editing?.modalidad || "presencial"} />
                </div>

                <div className="space-y-1">
                  <Label>Fecha</Label>
                  <Input type="date" name="fecha" defaultValue={editing?.fecha ?? undefined} />
                </div>

                <div className="space-y-1">
                  <Label>Hora</Label>
                  <Input type="time" name="hora" defaultValue={editing?.hora ? editing.hora.slice(0, 5) : undefined} />
                </div>

                <div className="space-y-1">
                  <Label>Duración (min)</Label>
                  <Input type="number" name="duracion_min" min={10} max={600} defaultValue={editing?.duracion_min ?? 60} />
                </div>

                <div className="space-y-1">
                  <Label>Cupo total</Label>
                  <Input type="number" name="cupo_total" min={0} defaultValue={editing?.cupo_total ?? 0} />
                </div>

                <div className="space-y-1">
                  <Label>Costo (MXN)</Label>
                  <Input type="number" name="costo" min={0} defaultValue={editing?.costo ?? undefined} />
                </div>

                <div className="space-y-1">
                  <Label>Nivel objetivo</Label>
                  <Input name="nivel_objetivo" defaultValue={editing?.nivel_objetivo ?? ""} placeholder="A1..C2" />
                </div>

                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select name="estado" defaultValue={editing?.estado || "borrador"}>
                    <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
                    <SelectContent>
                      {estados.map((e) => (
                        <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label>Link de registro</Label>
                  <Input name="link_registro" defaultValue={editing?.link_registro ?? ""} placeholder="https://..." />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label>Instrucciones</Label>
                  <Input name="instrucciones" defaultValue={editing?.instrucciones ?? ""} placeholder="Llevar identificación, llegar 10 min antes..." />
                </div>

                <DialogFooter className="sm:col-span-2 mt-2">
                  <Button type="submit" className="rounded-xl">Guardar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Idioma</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-36"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <div className="h-6 w-full animate-pulse rounded bg-neutral-100" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-neutral-500">
                  No hay exámenes con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.nombre}</TableCell>
                  <TableCell className="capitalize">{it.idioma}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDate(it.fecha)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {fmtTime(it.hora)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={[
                        "capitalize",
                        it.estado === "publicado"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : it.estado === "cerrado"
                          ? "bg-red-100 text-red-800 border-red-200"
                          : "bg-amber-100 text-amber-800 border-amber-200",
                      ].join(" ")}
                      variant="outline"
                    >
                      {it.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => startEdit(it)}
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => onDelete(it)}
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          Página {page} de {pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
