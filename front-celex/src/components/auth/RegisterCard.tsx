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
  const [curp, setCurp] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [regPwd2, setRegPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    const nombre = regNombre.trim();
    const apellidos = regApellidos.trim();

    if (nombre.length < 2) errs.nombre = "Ingresa tu nombre";
    if (apellidos.length < 2) errs.apellidos = "Ingresa tus apellidos";

    if (!emailRegex.test(regEmail)) errs.email = "Correo inválido";
    if (regEmail !== regEmail2) errs.email2 = "Los correos no coinciden";

    if (isIPN === "ipn" && !boletaRegex.test(regBoleta)) {
      errs.boleta = "Boleta inválida (10 dígitos, ej. 2025070109)";
    }

    if (!curpRegex.test(curp)) errs.curp = "CURP inválido (verifica formato)";
    if (regPwd.length < 6) errs.password = "Mínimo 6 caracteres";
    if (regPwd !== regPwd2) errs.password2 = "Las contraseñas no coinciden";

    setRegErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Corrige los campos marcados");
      return;
    }

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

      const resp = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const msg =
          (data?.detail && (Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail)) ||
          "No se pudo crear la cuenta";
        throw new Error(typeof msg === "string" ? msg : "Error de registro");
      }

      toast.success("Cuenta creada. Revisa tu correo para confirmar.");
      setRegNombre("");
      setRegApellidos("");
      setRegEmail("");
      setRegEmail2("");
      setRegBoleta("");
      setCurp("");
      setRegPwd("");
      setRegPwd2("");
      setIsIPN("externo");
      setRegErrors({});
    } catch (err: any) {
      toast.error(err?.message || "No se pudo registrar");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      <div className="mx-auto w-full max-w-lg md:max-w-xl flex-1 rounded-3xl border bg-white p-6 shadow-xl flex flex-col">

        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-900 text-white">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-title text-xl">Crear cuenta de usuario</h2>
            <p className="text-sm text-neutral-500">
              Regístrate para inscribirte a los cursos y exámenes.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border bg-neutral-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">¿Perteneces al IPN?</span>
              </div>
              <p className="text-xs text-neutral-500">
                Actívalo si eres estudiante del Instituto Politécnico Nacional (se pedirá tu boleta).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isIPN === "externo" ? "text-neutral-700" : "text-neutral-400"}`}>
                Externo
              </span>
              <Switch
                checked={isIPN === "ipn"}
                onCheckedChange={(v) => setIsIPN(v ? "ipn" : "externo")}
                aria-label="Perteneces al IPN"
              />
              <span className={`text-xs ${isIPN === "ipn" ? "text-neutral-700" : "text-neutral-400"}`}>
                IPN
              </span>
            </div>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="curp">CURP</Label>
                <div className="relative">
                  <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="curp"
                    value={curp}
                    onChange={(e) => setCurp(e.target.value.trim().toUpperCase())}
                    className="pl-9"
                    placeholder="GAXX000101HDFLRS09"
                    required
                  />
                </div>
                {regErrors.curp && <p className="text-xs text-red-600">{regErrors.curp}</p>}
              </div>

              {/* 👇 Solo mostrar Boleta cuando el switch esté en IPN */}
              {isIPN === "ipn" && (
                <div className="space-y-2">
                  <Label htmlFor="boleta">Boleta</Label>
                  <Input
                    id="boleta"
                    value={regBoleta}
                    onChange={(e) => setRegBoleta(e.target.value)}
                    placeholder="2025150109"
                    inputMode="numeric"
                    pattern="\d{10}"
                    required
                  />
                  {regErrors.boleta && <p className="text-xs text-red-600">{regErrors.boleta}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
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
                <Label htmlFor="reg-email2">Confirma tu correo</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="reg-email2"
                    type="email"
                    placeholder="tunombre@correo.com"
                    value={regEmail2}
                    onChange={(e) => setRegEmail2(e.target.value)}
                    className="pl-9"
                    autoComplete="email"
                    required
                  />
                </div>
                {regErrors.email2 && (
                  <p className="text-xs text-red-600">{regErrors.email2}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="password"
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
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 hover:text-neutral-700"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {regErrors.password && <p className="text-xs text-red-600">{regErrors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password2">Confirma contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="password2"
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
                    onClick={() => setShowPwd2((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 hover:text-neutral-700"
                    aria-label={showPwd2 ? "Ocultar contraseña" : "Mostrar contraseña"}
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

            
          </form>
        </div>

        {/* decoraciones */}
        <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-neutral-200/60 blur-2xl" />
        <div className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-neutral-300/60 blur-2xl" />
      </div>
    </div>
  );
}
