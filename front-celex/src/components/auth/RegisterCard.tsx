"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Mail, Lock, Eye, EyeOff, UserRoundPlus, IdCard, BadgeCheck, LogIn, Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import LoginSheet from "@/components/auth/LoginSheet";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const boletaRegex = /^\d{10}$/;
const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/i;

export default function RegisterCard() {
  const router = useRouter();

  const redirectByRole = (role?: string) => {
    if (role === "student") return router.push("/alumno/dashboard");
    if (role === "teacher") return router.push("/docente/dashboard");
    if (role === "coordinator") return router.push("/coordinador/dashboard");
    if (role === "superuser") return router.push("/admin/dashboard");
    return router.push("/");
  };

  const [loginOpen, setLoginOpen] = useState(false);

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

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
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

      // --- Manejo de errores mejorado (409, 400 y otros) ---
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        const detail = data?.detail;
        const detailMsg =
          typeof detail === "string"
            ? detail
            : typeof detail?.message === "string"
            ? detail.message
            : (Array.isArray(detail) ? detail[0]?.msg : null);

        if (resp.status === 409) {
          const msg = detailMsg || "Este correo o CURP ya están registrados.";
          // Toast con acción para abrir el Login
          toast.info(msg, {
            action: {
              label: "Iniciar sesión",
              onClick: () => setLoginOpen(true),
            },
          });
          // Opcional: marca errores de campo si backend manda { field }
          if (typeof detail === "object" && detail?.field) {
            setRegErrors((prev) => ({ ...prev, [detail.field]: msg }));
          }
          // Detén el flujo (no limpies el formulario)
          return;
        }

        if (resp.status === 400) {
          const msg =
            detailMsg ||
            "Datos inválidos. Revisa el formulario.";
          // Intenta mapear a campos si vino un objeto { field, message }
          if (typeof detail === "object" && detail?.field && detail?.message) {
            setRegErrors((prev) => ({ ...prev, [detail.field]: detail.message }));
          }
          throw new Error(msg);
        }

        // Cualquier otro status
        throw new Error(detailMsg || "No se pudo crear la cuenta");
      }
      // --- fin manejo de errores ---

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
      <div className="mx-auto w-full max-w-lg md:max-w-xl flex-1 rounded-3xl border bg-white p-5 sm:p-6 shadow-xl flex flex-col">
        {/* Encabezado con icono y título */}
        <div className="mb-4 sm:mb-5 flex items-start gap-3">
          <div className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <UserRoundPlus className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-title text-lg sm:text-xl">Crear cuenta de usuario</h2>
            <p className="text-xs sm:text-sm text-neutral-600">
              Regístrate para inscribirte a cursos y exámenes.
            </p>
          </div>
        </div>

        {/* Botón en un renglón aparte, full width y alineado a la izquierda */}
        <div className="flex justify-center mb-4">
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-2
                      text-sm font-semibold hover:bg-primary/20 
                      hover:scale-105 hover:shadow-md
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary 
                      transition-transform duration-200 ease-in-out"
            aria-label="Abrir inicio de sesión"
          >
            <LogIn className="h-4 w-4" />
            ¿Ya tienes cuenta? Inicia sesión
          </button>
        </div>

        {/* Tarjeta con selector IPN y formulario */}
        <div className="mb-4 rounded-2xl border bg-neutral-50 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">¿Perteneces al IPN?</span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500">
                Actívalo si eres estudiante del Instituto Politécnico Nacional. Se pedirá tu boleta.
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

          <form onSubmit={handleRegister} className="mt-3 space-y-5" autoComplete="on">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre(s)</Label>
                <Input
                  id="nombre"
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  placeholder="María Fernanda"
                  autoComplete="given-name"
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
                  autoComplete="family-name"
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
                    autoComplete="off"
                    required
                  />
                </div>
                {regErrors.curp && <p className="text-xs text-red-600">{regErrors.curp}</p>}
              </div>

              {isIPN === "ipn" && (
                <div className="space-y-2">
                  <Label htmlFor="boleta">Boleta</Label>
                  <Input
                    id="boleta"
                    value={regBoleta}
                    onChange={(e) => setRegBoleta(e.target.value)}
                    placeholder="2025150109"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    autoComplete="off"
                    required
                  />
                  {regErrors.boleta && <p className="text-xs text-red-600">{regErrors.boleta}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="reg-email"
                    type="email"
                    inputMode="email"
                    placeholder="usuario@correo.com"
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
                <Label htmlFor="reg-email2">Confirma correo electrónico</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="reg-email2"
                    type="email"
                    inputMode="email"
                    placeholder="usuario@correo.com"
                    value={regEmail2}
                    onChange={(e) => setRegEmail2(e.target.value)}
                    className="pl-9"
                    autoComplete="email"
                    required
                  />
                </div>
                {regErrors.email2 && <p className="text-xs text-red-600">{regErrors.email2}</p>}
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

            <Button
              type="submit"
              disabled={regLoading}
              className="group w-full h-12 rounded-full text-base font-semibold tracking-wide
                        bg-gradient-to-r from-[#7c0040] via-[#5a002f] to-[#400022]
                        text-white shadow-md hover:shadow-lg hover:scale-[1.01]
                        transition-all duration-200 ease-in-out
                        disabled:opacity-70 disabled:hover:scale-100"
            >
              {regLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creando…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  ✨ Crear cuenta
                </span>
              )}
            </Button>

          </form>
        </div>

        {/* decoraciones */}
        <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-neutral-200/60 blur-2xl" />
      </div>

      {/* LoginSheet controlado por el enlace del encabezado */}
      <LoginSheet
        id="register-login-sheet"
        open={loginOpen}
        setOpen={setLoginOpen}
        onSuccess={(data) => redirectByRole(data.role)}
        showTrigger={false}
      />
    </div>
  );
}
