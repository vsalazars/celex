"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import type { CreateTeacherInput } from "@/lib/types";
import { EMAIL_REGEX, CURP_REGEX } from "@/lib/constants";

export default function AddTeacherDialog({
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
    if (lastName.trim().length < 2)  e.lastName  = "Ingresa los apellidos";
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
      toast.success("Docente dado de alta. Se envió la contraseña por correo.");
      setOpen(false);
      reset();
      onCreated?.();
    } catch (e: any) {
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
