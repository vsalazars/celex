"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  ListChecks,
  HelpCircle,
  ListFilter,
  RefreshCcw,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/constants";

// =====================
// Tipos (DTOs)
// =====================
export type SurveyCategoryDTO = {
  id: number;
  name: string;
  description?: string | null;
  order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SurveyQuestionType = "likert_1_5" | "yes_no" | "open_text" | "scale_0_10";
export type SurveyQuestionDTO = {
  id: number;
  category_id: number;
  text: string;
  help_text?: string | null;
  type: SurveyQuestionType;
  required: boolean;
  order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

// =====================
// Endpoints asumidos
// =====================
const CATEGORIES_URL = `${API_URL}/coordinacion/encuestas/categories`;
const QUESTIONS_URL = `${API_URL}/coordinacion/encuestas/questions`;

// =====================
// Schemas zod
// =====================
const CategorySchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

type CategoryForm = z.infer<typeof CategorySchema>;

const QuestionSchema = z.object({
  category_id: z.number().int().positive("Selecciona una categoría"),
  text: z.string().min(5, "Mínimo 5 caracteres"),
  help_text: z.string().optional(),
  type: z.enum(["likert_1_5", "yes_no", "open_text", "scale_0_10"]),
  required: z.boolean().default(true),
  active: z.boolean().default(true),
});
type QuestionForm = z.infer<typeof QuestionSchema>;

// =====================
// Helpers UI
// =====================
const TYPE_LABEL: Record<SurveyQuestionType, string> = {
  likert_1_5: "Likert 1–5",
  yes_no: "Sí/No",
  open_text: "Texto libre",
  scale_0_10: "Escala 0–10",
};

function SectionSwitcher({
  section,
  onChange,
}: {
  section: "categories" | "questions";
  onChange: (s: "categories" | "questions") => void;
}) {
  return (
    <div className="inline-flex rounded-xl border bg-white shadow-sm overflow-hidden">
      <button
        className={`px-3 py-2 text-sm ${section === "categories" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}
        onClick={() => onChange("categories")}
      >
        Categorías
      </button>
      <button
        className={`px-3 py-2 text-sm ${section === "questions" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}
        onClick={() => onChange("questions")}
      >
        Preguntas
      </button>
    </div>
  );
}

// =====================
// Componente principal
// =====================
export default function SurveySection() {
  const [section, setSection] = useState<"categories" | "questions">("categories");

  // Data global
  const [categories, setCategories] = useState<SurveyCategoryDTO[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestionDTO[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros preguntas
  const [filterCategoryId, setFilterCategoryId] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Diálogos Categoría
  const [catOpen, setCatOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<SurveyCategoryDTO | null>(null);
  const catForm = useForm<CategoryForm>({ resolver: zodResolver(CategorySchema), defaultValues: { active: true } });

  // Diálogos Pregunta
  const [qOpen, setQOpen] = useState(false);
  const [qEditing, setQEditing] = useState<SurveyQuestionDTO | null>(null);
  const qForm = useForm<QuestionForm>({
    resolver: zodResolver(QuestionSchema),
    defaultValues: { type: "likert_1_5", required: true, active: true },
  });

  // =====================
  // Fetchers
  // =====================
  async function fetchCategories() {
    try {
      const data = (await apiFetch(CATEGORIES_URL, { auth: true })) as SurveyCategoryDTO[];
      setCategories(Array.isArray(data) ? data.sort((a, b) => a.order - b.order) : []);
    } catch (e: any) {
      toast.error("No se pudieron cargar las categorías");
      console.error(e);
    }
  }

  async function fetchQuestions() {
    try {
      const params = new URLSearchParams();
      if (filterCategoryId !== "all") params.set("category_id", String(filterCategoryId));
      const url = `${QUESTIONS_URL}?${params.toString()}`;
      const data = (await apiFetch(url, { auth: true })) as SurveyQuestionDTO[];
      const filtered = (Array.isArray(data) ? data : []).sort((a, b) => a.order - b.order);
      setQuestions(filtered);
    } catch (e: any) {
      toast.error("No se pudieron cargar las preguntas");
      console.error(e);
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchQuestions()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategoryId]);

  // =====================
  // CRUD Categorías
  // =====================
  function openNewCategory() {
    setCatEditing(null);
    catForm.reset({ name: "", description: "", active: true });
    setCatOpen(true);
  }

  function openEditCategory(c: SurveyCategoryDTO) {
    setCatEditing(c);
    catForm.reset({ name: c.name, description: c.description ?? "", active: c.active });
    setCatOpen(true);
  }

  async function submitCategory(values: CategoryForm) {
    try {
      const method = catEditing ? "PATCH" : "POST";
      const url = catEditing ? `${CATEGORIES_URL}/${catEditing.id}` : CATEGORIES_URL;
      await apiFetch(url, { method, body: JSON.stringify(values), auth: true });
      toast.success(catEditing ? "Categoría actualizada" : "Categoría creada");
      setCatOpen(false);
      await fetchCategories();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al guardar la categoría");
    }
  }

  async function deleteCategory(c: SurveyCategoryDTO) {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    try {
      await apiFetch(`${CATEGORIES_URL}/${c.id}`, { method: "DELETE", auth: true });
      toast.success("Categoría eliminada");
      await fetchCategories();
      // Si estábamos filtrando por esta categoría, resetea filtro
      if (filterCategoryId !== "all" && Number(filterCategoryId) === c.id) {
        setFilterCategoryId("all");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo eliminar la categoría");
    }
  }

  async function moveCategory(c: SurveyCategoryDTO, direction: "up" | "down") {
    try {
      await apiFetch(`${CATEGORIES_URL}/${c.id}/move`, {
        method: "POST",
        body: JSON.stringify({ direction }),
        auth: true,
      });
      await fetchCategories();
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo reordenar la categoría");
    }
  }

  // =====================
  // CRUD Preguntas
  // =====================
  function openNewQuestion() {
    setQEditing(null);
    const firstCat = categories[0]?.id;
    qForm.reset({
      category_id: (filterCategoryId !== "all" ? Number(filterCategoryId) : firstCat) || 0,
      text: "",
      help_text: "",
      type: "likert_1_5",
      required: true,
      active: true,
    });
    setQOpen(true);
  }

  function openEditQuestion(q: SurveyQuestionDTO) {
    setQEditing(q);
    qForm.reset({
      category_id: q.category_id,
      text: q.text,
      help_text: q.help_text ?? "",
      type: q.type,
      required: q.required,
      active: q.active,
    });
    setQOpen(true);
  }

  async function submitQuestion(values: QuestionForm) {
    try {
      const method = qEditing ? "PATCH" : "POST";
      const url = qEditing ? `${QUESTIONS_URL}/${qEditing.id}` : QUESTIONS_URL;
      await apiFetch(url, { method, body: JSON.stringify(values), auth: true });
      toast.success(qEditing ? "Pregunta actualizada" : "Pregunta creada");
      setQOpen(false);
      await fetchQuestions();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al guardar la pregunta");
    }
  }

  async function deleteQuestion(q: SurveyQuestionDTO) {
    if (!confirm(`¿Eliminar la pregunta?\n\n"${q.text}"`)) return;
    try {
      await apiFetch(`${QUESTIONS_URL}/${q.id}`, { method: "DELETE", auth: true });
      toast.success("Pregunta eliminada");
      await fetchQuestions();
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo eliminar la pregunta");
    }
  }

  async function moveQuestion(q: SurveyQuestionDTO, direction: "up" | "down") {
    try {
      await apiFetch(`${QUESTIONS_URL}/${q.id}/move`, {
        method: "POST",
        body: JSON.stringify({ direction }),
        auth: true,
      });
      await fetchQuestions();
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo reordenar la pregunta");
    }
  }

  // =====================
  // Derivados
  // =====================
  const filteredQuestions = useMemo(() => {
    let list = questions.slice();
    if (filterStatus !== "all") {
      list = list.filter((q) => (filterStatus === "active" ? q.active : !q.active));
    }
    return list;
  }, [questions, filterStatus]);

  // =====================
  // Render
  // =====================
  return (
    <Card className="overflow-hidden border-0 shadow-sm bg-white/50 dark:bg-neutral-900/50">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <ListChecks className="h-5 w-5" /> Encuesta de evaluación docente
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setLoading(true); Promise.all([fetchCategories(), fetchQuestions()]).finally(() => setLoading(false)); }}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
            <SectionSwitcher section={section} onChange={setSection} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Define categorías y preguntas que contestarán los alumnos para evaluar a sus docentes en cada ciclo.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {section === "categories" ? (
          // ============ VISTA CATEGORÍAS ============
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {categories.length} categorías
              </div>
              <Button onClick={openNewCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva categoría
              </Button>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow key="loading-cat">
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando…</TableCell>
                    </TableRow>
                  )}
                  {!loading && categories.length === 0 && (
                    <TableRow key="empty-cat">
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin categorías</TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    categories.map((c, idx) => (
                      <TableRow key={`cat-${c.id}-${idx}`}>
                        <TableCell className="w-28">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="outline" onClick={() => moveCategory(c, "up")} disabled={idx === 0}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" onClick={() => moveCategory(c, "down")} disabled={idx === categories.length - 1}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{c.description || "—"}</TableCell>
                        <TableCell>
                          {c.active ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Activa</Badge>
                          ) : (
                            <Badge className="bg-neutral-200 text-neutral-700">Inactiva</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditCategory(c)}>
                              <Edit3 className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteCategory(c)}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          // ============ VISTA PREGUNTAS ============
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <div>
                  <Label className="text-xs">Categoría</Label>
                  <Select
                    value={filterCategoryId === "all" ? "all" : String(filterCategoryId)}
                    onValueChange={(v) =>
                      setFilterCategoryId(v === "all" ? "all" : Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={`opt-cat-${c.id}`} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Estado</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(v: "all" | "active" | "inactive") => setFilterStatus(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Activa</SelectItem>
                      <SelectItem value="inactive">Inactiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={openNewQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva pregunta
                </Button>
              </div>
            </div>

            {/* Tabla preguntas */}
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Pregunta</TableHead>
                    <TableHead className="hidden md:table-cell">Ayuda</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Obligatoria</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow key="loading-q">
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell>
                    </TableRow>
                  )}
                  {!loading && filteredQuestions.length === 0 && (
                    <TableRow key="empty-q">
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin preguntas</TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    filteredQuestions.map((q, idx) => (
                      <TableRow key={`q-${q.id}-${idx}`}>
                        <TableCell className="w-28">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="outline" onClick={() => moveQuestion(q, "up")} disabled={idx === 0}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" onClick={() => moveQuestion(q, "down")} disabled={idx === filteredQuestions.length - 1}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="mb-1">{q.text}</div>
                          <div className="text-xs text-neutral-500">
                            {categories.find((c) => c.id === q.category_id)?.name || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {q.help_text || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-neutral-200 text-neutral-700">{TYPE_LABEL[q.type]}</Badge>
                        </TableCell>
                        <TableCell>{q.required ? "Sí" : "No"}</TableCell>
                        <TableCell>
                          {q.active ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Activa</Badge>
                          ) : (
                            <Badge className="bg-neutral-200 text-neutral-700">Inactiva</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditQuestion(q)}>
                              <Edit3 className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteQuestion(q)}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>

      {/* ===== Diálogo Categoría ===== */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{catEditing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
            <DialogDescription>
              Las categorías agrupan preguntas (p. ej., <em>Planificación</em>, <em>Dominio del tema</em>, <em>Evaluación</em>).
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={catForm.handleSubmit(submitCategory)}
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                {...catForm.register("name")}
                placeholder="p. ej. Planificación de clases"
              />
              {catForm.formState.errors.name && (
                <p className="text-xs text-rose-600">
                  {catForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                {...catForm.register("description")}
                placeholder="Breve descripción de la categoría"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="flex items-center gap-1 text-sm">
                  <HelpCircle className="h-4 w-4" />
                  Activa
                </Label>
                <p className="text-xs text-neutral-500">
                  Si está inactiva no se mostrará a los alumnos.
                </p>
              </div>
              <Switch
                checked={catForm.watch("active")}
                onCheckedChange={(v) => catForm.setValue("active", v)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {catEditing ? "Guardar cambios" : "Crear categoría"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Diálogo Pregunta ===== */}
      <Dialog open={qOpen} onOpenChange={setQOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{qEditing ? "Editar pregunta" : "Nueva pregunta"}</DialogTitle>
            <DialogDescription>
              Define el enunciado, tipo de respuesta y la categoría a la que pertenece.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={qForm.handleSubmit(submitQuestion)}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select
                  value={String(qForm.watch("category_id") || "")}
                  onValueChange={(v) => qForm.setValue("category_id", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={`cat-opt-${c.id}`} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {qForm.formState.errors.category_id && (
                  <p className="text-xs text-rose-600">
                    {qForm.formState.errors.category_id.message as string}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={qForm.watch("type")}
                  onValueChange={(v: SurveyQuestionType) =>
                    qForm.setValue("type", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="likert_1_5">Likert 1–5</SelectItem>
                    <SelectItem value="yes_no">Sí/No</SelectItem>
                    <SelectItem value="open_text">Texto libre</SelectItem>
                    <SelectItem value="scale_0_10">Escala 0–10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Pregunta</Label>
              <Textarea
                {...qForm.register("text")}
                placeholder="Escribe el enunciado de la pregunta"
              />
              {qForm.formState.errors.text && (
                <p className="text-xs text-rose-600">
                  {qForm.formState.errors.text.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Texto de ayuda (opcional)</Label>
              <Input
                {...qForm.register("help_text")}
                placeholder="Ejemplo: Considera la puntualidad y preparación del docente."
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="flex items-center gap-1 text-sm">
                    <ListFilter className="h-4 w-4" />
                    Obligatoria
                  </Label>
                  <p className="text-xs text-neutral-500">El alumno debe responderla.</p>
                </div>
                <Switch
                  checked={qForm.watch("required")}
                  onCheckedChange={(v) => qForm.setValue("required", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="flex items-center gap-1 text-sm">
                    <HelpCircle className="h-4 w-4" />
                    Activa
                  </Label>
                  <p className="text-xs text-neutral-500">
                    Si está inactiva no se verá en la encuesta.
                  </p>
                </div>
                <Switch
                  checked={qForm.watch("active")}
                  onCheckedChange={(v) => qForm.setValue("active", v)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {qEditing ? "Guardar cambios" : "Crear pregunta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
