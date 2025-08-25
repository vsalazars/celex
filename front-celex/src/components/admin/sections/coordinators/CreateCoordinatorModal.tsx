"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, IdCard, Shield, UserPlus, Loader2 } from "lucide-react";
import { CURP_REGEX } from "@/lib/constants";
import { createCoordinator } from "@/lib/api";

export default function CreateCoordinatorModal({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [email2, setEmail2]       = useState(""); // confirmación
  const [curp, setCurp]           = useState("");

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setEmail2("");
    setCurp("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (email.trim().toLowerCase() !== email2.trim().toLowerCase()) {
      toast.error("Los correos no coinciden");
      return;
    }
    if (!CURP_REGEX.test(curp.trim())) {
      toast.error("CURP inválido (formato de 18 caracteres)");
      return;
    }

    setSaving(true);
    try {
      await createCoordinator({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        curp: curp.trim().toUpperCase(),
      });

      toast.success("Coordinador creado. Se envió una contraseña temporal por correo.");
      reset();
      setOpen(false);
      router.refresh();
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Error al crear coordinador");
    } finally {
      setSaving(false);
    }
  };

  const emailsMismatch =
    !!email && !!email2 && email.trim().toLowerCase() !== email2.trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <UserPlus className="mr-2 h-4 w-4" />
          Crear coordinador
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Coordinador</DialogTitle>
          <DialogDescription>
            Ingresa nombre, apellidos, correo (x2) y CURP. Se enviará una contraseña temporal por correo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="María Fernanda"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellidos</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="García López"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="email"
                type="email"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coord@ejemplo.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email2">Confirmar correo</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="email2"
                type="email"
                className="pl-9"
                value={email2}
                onChange={(e) => setEmail2(e.target.value)}
                placeholder="Repite el correo"
                required
              />
            </div>
            {emailsMismatch && (
              <p className="text-xs text-red-600">Los correos no coinciden</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="curp">CURP</Label>
            <div className="relative">
              <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="curp"
                className="pl-9"
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                placeholder="GAXX000101HDFLRN09"
                maxLength={18}
                required
              />
            </div>
            <p className="text-[11px] text-neutral-500">
              18 caracteres; se convierte a mayúsculas automáticamente.
            </p>
          </div>

          <DialogFooter className="mt-2 flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || emailsMismatch || !email || !email2}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              {saving ? "Creando..." : "Crear coordinador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
