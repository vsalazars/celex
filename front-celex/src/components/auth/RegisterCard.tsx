"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, UserPlus, IdCard, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const boletaRegex = /^\d{10}$/;
const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/i;

export default function RegisterCard() {
  const [isIPN, setIsIPN] = useState<"ipn" | "externo">("externo");
  const [regNombre, setRegNombre] = useState("");
  const [regApellidos, setRegApellidos] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regEmail2, setRegEmail2] = useState("");
  const [regBoleta, setRegBoleta] = useState("");
  const [regCURP, setRegCURP] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [regPwd2, setRegPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regLoading, setRegLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const curp = regCURP.trim().toUpperCase();

    if (regNombre.trim().length < 2) errs.nombre = "Ingresa tu nombre";
    if (regApellidos.trim().length < 2) errs.apellidos = "Ingresa tus apellidos";

    if (!emailRegex.test(regEmail)) errs.email = "Correo inválido";
    if (regEmail !== regEmail2) errs.email2 = "Los correos no coinciden";

    if (isIPN === "ipn" && !boletaRegex.test(regBoleta)) {
      errs.boleta = "Boleta inválida (10 dígitos, ej. 2025070109)";
    }

    if (!curpRegex.test(curp)) errs.curp = "CURP inválido (verifica formato)";
    if (regPwd.length < 6) errs.password = "Mínimo 6 caracteres";
    if (regPwd !== regPwd2) errs.password2 = "Las contraseñas no coinciden";

    setRegErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setRegLoading(true);
      const payload = {
        first_name: regNombre.trim(),
        last_name: regApellidos.trim(),
        email: regEmail.trim(),
        is_ipn: isIPN === "ipn",
        boleta: isIPN === "ipn" ? regBoleta.trim() : null,
        curp,
        password: regPwd,
        password_confirm: regPwd2,
      };

      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "No fue posible registrar tu cuenta");
      }

      toast.success("Cuenta creada. Ahora inicia sesión.");
      // Limpieza
      setRegNombre("");
      setRegApellidos("");
      setRegEmail("");
      setRegEmail2("");
      setRegBoleta("");
      setRegCURP("");
      setRegPwd("");
      setRegPwd2("");
    } catch (err: any) {
      toast.error(err.message || "Error al registrar");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="mx-auto w-full max-w-lg rounded-3xl border bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-900 text-white">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-title text-xl">Crear cuenta de usuario</h2>
            <p className="text-sm text-neutral-500">
              Si ya tienes cuenta, inicia sesión desde el panel superior.
            </p>
          </div>
        </div>

        <div className="mb-1 flex items-center justify-between rounded-xl border bg-white p-3">
          <Label htmlFor="soy-ipn" className="cursor-pointer">
            Soy alumno del Instituto Politécnico Nacional
          </Label>
          <Switch
            id="soy-ipn"
            checked={isIPN === "ipn"}
            onCheckedChange={(checked) => setIsIPN(checked ? "ipn" : "externo")}
          />
        </div>
        <p className="mb-4 text-xs text-neutral-500">
          Si el switch está desactivado, te registras como <span className="font-medium">Externo</span>.
        </p>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre(s)</Label>
              <Input
                id="nombre"
                value={regNombre}
                onChange={(e) => setRegNombre(e.target.value)}
                placeholder="María Fernanda"
                required
              />
              {regErrors.nombre && <p className="text-xs text-red-600">{regErrors.nombre}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                value={regApellidos}
                onChange={(e) => setRegApellidos(e.target.value)}
                placeholder="García López"
                required
              />
              {regErrors.apellidos && <p className="text-xs text-red-600">{regErrors.apellidos}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email">Correo</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="reg-email"
                type="email"
                placeholder="tunombre@correo.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="pl-9"
                autoComplete="email"
                required
              />
            </div>
            {regErrors.email && <p className="text-xs text-red-600">{regErrors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email2">Confirmar correo</Label>
            <div className="relative">
              <BadgeCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="reg-email2"
                type="email"
                placeholder="Repite tu correo"
                value={regEmail2}
                onChange={(e) => setRegEmail2(e.target.value)}
                className="pl-9"
                autoComplete="email"
                required
              />
            </div>
            {regErrors.email2 && <p className="text-xs text-red-600">{regErrors.email2}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="curp">CURP</Label>
            <Input
              id="curp"
              placeholder="Ej. GAXX000101HDFLRN09"
              value={regCURP}
              onChange={(e) => setRegCURP(e.target.value.toUpperCase())}
              maxLength={18}
              required
            />
            {regErrors.curp && <p className="text-xs text-red-600">{regErrors.curp}</p>}
            <p className="text-[11px] text-neutral-500">
              18 caracteres alfanuméricos. Se convertirá a mayúsculas automáticamente.
            </p>
          </div>

          {isIPN === "ipn" && (
            <div className="space-y-2">
              <Label htmlFor="boleta">Boleta (IPN)</Label>
              <div className="relative">
                <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="boleta"
                  placeholder="2025070109"
                  value={regBoleta}
                  onChange={(e) => setRegBoleta(e.target.value.replace(/\D/g, ""))}
                  className="pl-9"
                  inputMode="numeric"
                  maxLength={10}
                  required
                />
              </div>
              {regErrors.boleta && <p className="text-xs text-red-600">{regErrors.boleta}</p>}
              <p className="text-[11px] text-neutral-500">Debe tener exactamente 10 dígitos.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reg-password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="reg-password"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={regPwd}
                  onChange={(e) => setRegPwd(e.target.value)}
                  className="pl-9 pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {regErrors.password && <p className="text-xs text-red-600">{regErrors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password2">Confirmar contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="reg-password2"
                  type={showPwd2 ? "text" : "password"}
                  placeholder="••••••••"
                  value={regPwd2}
                  onChange={(e) => setRegPwd2(e.target.value)}
                  className="pl-9 pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPwd2 ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPwd2((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  {showPwd2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {regErrors.password2 && <p className="text-xs text-red-600">{regErrors.password2}</p>}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={regLoading}>
            {regLoading ? "Creando..." : "Crear cuenta"}
          </Button>

          <p className="text-center text-xs text-neutral-500">
            Al crear tu cuenta aceptas los lineamientos del CELEX y el tratamiento de datos.
          </p>
        </form>
      </div>

      {/* decoraciones */}
      <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-neutral-200/60 blur-2xl" />
      <div className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-neutral-300/60 blur-2xl" />
    </div>
  );
}
