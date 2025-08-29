"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, UserPlus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import { EMAIL_REGEX, CURP_REGEX } from "@/lib/constants";
import { listTeachers, inviteTeacher, suspendTeacher } from "@/lib/api";
import type { Teacher, CreateTeacherInput } from "@/lib/types";

/* ============================================================
 *  TeachersSection (single file, sin shared components)
 * ============================================================ */
export default function TeachersSection() {
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((t) =>
      (`${t.first_name} ${t.last_name} ${t.email} ${t.curp}`.toLowerCase()).includes(term)
    );
  }, [items, q]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listTeachers();
      setItems(data);
    } catch (e: any) {
      toast.error(e?.message || "No fue posible actualizar la lista");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleInvite = async (input: CreateTeacherInput) => {
    await inviteTeacher(input);
    toast.success("Docente invitado. La contraseña se envió por correo.");
    await refresh();
  };

  const handleSuspend = async (id: string | number) => {
    try {
      await suspendTeacher(id);
      toast.success("Docente deshabilitado");
      await refresh();
    } catch (e:any) {
      toast.error(e?.message || "No fue posible deshabilitar");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Docentes</h1>
          <p className="text-sm text-neutral-600">Alta/baja de docentes y asignación.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <AddTeacherDialogInline invite={handleInvite} />
        </div>
      </header>

      {/* Card listado */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <SearchBarInline value={q} onChange={setQ} />
        </div>

        <TeachersTableInline
          items={filtered}
          loading={loading}
          onSuspend={handleSuspend}
        />
      </div>
    </div>
  );
}

/* ============================================================
 *  Subcomponentes inline (mismo archivo)
 * ============================================================ */

/** Buscador */
function SearchBarInline({
  value, onChange, placeholder = "Buscar por nombre, correo o CURP…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <Input
        placeholder={placeholder}
        className="pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Modal de alta (invitar) */
function AddTeacherDialogInline({
  invite,
  onCreated,
  disabled,
}: {
  invite: (data: CreateTeacherInput) => Promise<void>;
  onCreated?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [email2, setEmail2]       = useState("");
  const [curp, setCurp]           = useState("");
  const [errs, setErrs] = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setEmail2(""); setCurp("");
    setErrs({});
  };

  const validate = () => {
    const e: Record<string,string> = {};
    if (firstName.trim().length < 2) e.firstName = "Ingresa el/los nombre(s)";
    if (lastName .trim().length < 2) e.lastName  = "Ingresa los apellidos";
    if (!EMAIL_REGEX.test(email))    e.email     = "Correo inválido";
    if (email.toLowerCase() !== email2.toLowerCase()) e.email2 = "Los correos no coinciden";
    if (!CURP_REGEX.test(curp.trim())) e.curp = "CURP inválido (18 caracteres)";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await invite({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        curp: curp.trim().toUpperCase(),
      });
      setOpen(false);
      reset();
      onCreated?.();
    } catch (e:any) {
      toast.error(e?.message || "Error al crear docente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={disabled}>
          <UserPlus className="h-4 w-4" /> Alta de docente
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar de alta docente</DialogTitle>
          <DialogDescription>
            Captura los datos del docente. La <strong>contraseña se enviará por correo</strong> automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="t-first">Nombre(s)</Label>
            <Input id="t-first" value={firstName}
              onChange={(e)=>setFirstName(e.target.value)}
              placeholder="María Fernanda" required />
            {errs.firstName && <p className="text-xs text-red-600">{errs.firstName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-last">Apellidos</Label>
            <Input id="t-last" value={lastName}
              onChange={(e)=>setLastName(e.target.value)}
              placeholder="García López" required />
            {errs.lastName && <p className="text-xs text-red-600">{errs.lastName}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-email">Correo</Label>
          <Input id="t-email" type="email" value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="tunombre@correo.com" autoComplete="email" required />
          {errs.email && <p className="text-xs text-red-600">{errs.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-email2">Confirmar correo</Label>
          <Input id="t-email2" type="email" value={email2}
            onChange={(e)=>setEmail2(e.target.value)}
            placeholder="Repite tu correo" autoComplete="email" required />
          {errs.email2 && <p className="text-xs text-red-600">{errs.email2}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-curp">CURP</Label>
          <Input id="t-curp" value={curp}
            onChange={(e)=>setCurp(e.target.value.toUpperCase())}
            placeholder="GAXX000101HDFLRN09" maxLength={18} required />
          {errs.curp && <p className="text-xs text-red-600">{errs.curp}</p>}
          <p className="text-[11px] text-neutral-500">Se convierte a mayúsculas automáticamente.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={()=>setOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Guardando…" : "Crear e invitar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tabla con acción “Deshabilitar” */
function TeachersTableInline({
  items,
  loading,
  onSuspend,
}: {
  items: Teacher[];
  loading?: boolean;
  onSuspend: (id: string | number) => void;
}) {
  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500">
        Cargando docentes…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500">
        No hay docentes registrados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Correo</th>
            <th className="px-3 py-2">CURP</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="px-3 py-2">{t.first_name} {t.last_name}</td>
              <td className="px-3 py-2">{t.email}</td>
              <td className="px-3 py-2">{t.curp}</td>
              <td className="px-3 py-2">
                {t.status === "activo" && <Badge>Activo</Badge>}
                {t.status === "invitado" && <Badge variant="secondary">Invitado</Badge>}
                {t.status === "suspendido" && <Badge variant="destructive">Suspendido</Badge>}
              </td>
              <td className="px-3 py-2 text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-red-600">
                      Deshabilitar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deshabilitar docente</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Seguro que deseas deshabilitar a <strong>{t.first_name} {t.last_name}</strong>?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <Button
                        variant="destructive"
                        onClick={() => onSuspend(t.id)}
                      >
                        Deshabilitar
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
