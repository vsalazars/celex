// src/components/auth/LoginSheet.tsx
"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

type LoginData = {
  access_token: string;
  role?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  curp?: string;
  is_ipn?: boolean;
  boleta?: string | null;
};

export default function LoginSheet({
  open,
  setOpen,
  onSuccess,
  showTrigger = true,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: (data: LoginData) => void;
  showTrigger?: boolean;
}) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginErrors, setLoginErrors] = useState<{ email?: string; pwd?: string }>({});
  const pwdRef = useRef<HTMLInputElement>(null);

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: typeof loginErrors = {};
    if (!emailRegex.test(loginEmail)) next.email = "Ingresa un correo válido";
    if (loginPwd.length < 6) next.pwd = "Mínimo 6 caracteres";
    setLoginErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoginLoading(true);
    try {
      const res = await fetch(`/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPwd }),
        credentials: "omit",
        cache: "no-store",
      });

      if (!res.ok) {
        let detail = "No fue posible iniciar sesión";
        try {
          const err = await res.json();
          detail = err?.detail || err?.message || err?.error || detail;
        } catch {}
        if (res.status === 401 || res.status === 400) {
          setLoginErrors((prev) => ({ ...prev, pwd: "Credenciales inválidas" }));
          toast.error("Credenciales inválidas");
          return;
        }
        toast.error(detail);
        return;
      }

      const data: LoginData = await res.json();
      if (!data?.access_token) {
        toast.error("Token no recibido");
        return;
      }

      localStorage.setItem("celex_token", data.access_token);
      localStorage.setItem("celex_role", data.role ?? "");
      localStorage.setItem("celex_email", data.email ?? "");
      localStorage.setItem(
        "celex_nombre",
        `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim()
      );
      localStorage.setItem("celex_curp", data.curp ?? "");
      localStorage.setItem("celex_is_ipn", String(!!data.is_ipn));
      localStorage.setItem("celex_boleta", data.boleta ?? "");

      setLoginErrors({});
      setLoginPwd("");
      setShowLoginPwd(false);
      toast.success("Inicio de sesión correcto");
      setOpen(false);
      onSuccess(data);
    } catch (err: any) {
      console.error("[LOGIN] network/unexpected error:", err);
      toast.error("Error de red o servidor");
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <SheetTrigger asChild>
          <Button
            variant="default"
            size="lg"
            className="gap-2 rounded-full px-5 shadow-md hover:shadow-lg"
          >
            <LogIn className="h-4 w-4" />
            Iniciar sesión
          </Button>
        </SheetTrigger>
      )}

      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 overflow-hidden"
      >
        {/* Fondo decorativo */}
        <div className="absolute inset-0 -z-10 opacity-20">
          <div className="absolute -top-20 left-0 h-64 w-64 rounded-full bg-[#7c0040]/30 blur-3xl" />
          <div className="absolute top-40 -right-10 h-64 w-64 rounded-full bg-fuchsia-400/30 blur-3xl" />
        </div>

        {/* Contenedor principal */}
        <div className="flex h-full flex-col">
          {/* HERO / Encabezado visual (sin ícono) */}
          <div className="relative overflow-hidden border-b bg-gradient-to-br from-white via-fuchsia-50 to-rose-50">
            <div className="relative px-6 pt-8 pb-6 sm:px-8">
              <div className="min-w-0">
                

                <SheetHeader className="text-left">
                  <SheetTitle className="font-title leading-tight">
                    <span className="block text-[58px] sm:text-[32px] font-extrabold tracking-tight text-[#7c0040]">
                      CELEX
                    </span>
                    <span className="block text-xl sm:text-base text-neutral-700 mt-0.5">
                      “Diódoro Antúnez”
                    </span>
                  </SheetTitle>
                  <SheetDescription className="text-neutral-600">
                    Accede con tu correo y contraseña.
                  </SheetDescription>
                </SheetHeader>

                
                
                <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-neutral-700">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Acceso seguro</span>
                  <span className="mx-1 opacity-40">•</span>
                  <span>Datos protegidos</span>
                </div>
              </div>

              {/* Cinta decorativa */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7c0040] via-fuchsia-500 to-rose-400 opacity-80" />
            </div>
          </div>

          {/* CONTENIDO */}
          <div className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-md px-6 py-6 sm:px-8 sm:py-8">
              <form
                onSubmit={handleLogin}
                className="space-y-6"
                autoComplete="on"
                aria-label="Formulario de inicio de sesión"
              >
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="login-email">Correo</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="login-email"
                      type="email"
                      inputMode="email"
                      placeholder="usuario@correo.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-9"
                      autoComplete="email"
                      required
                      aria-invalid={!!loginErrors.email}
                      aria-describedby={loginErrors.email ? "login-email-error" : undefined}
                    />
                  </div>
                  {loginErrors.email && (
                    <p id="login-email-error" className="text-xs text-red-600">
                      {loginErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="login-password"
                      ref={pwdRef}
                      type={showLoginPwd ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPwd}
                      onChange={(e) => setLoginPwd(e.target.value)}
                      className="pl-9 pr-10"
                      autoComplete="current-password"
                      required
                      aria-invalid={!!loginErrors.pwd}
                      aria-describedby={loginErrors.pwd ? "login-pwd-error" : undefined}
                    />
                    <button
                      type="button"
                      aria-label={showLoginPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                      onClick={() => setShowLoginPwd((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100 focus:outline-none z-10"
                      aria-pressed={showLoginPwd}
                      title={showLoginPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {loginErrors.pwd && (
                    <p id="login-pwd-error" className="text-xs text-red-600">
                      {loginErrors.pwd}
                    </p>
                  )}

                  {/* Ayuda sutil de password */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>6+ caracteres, distingue mayúsculas</span>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => toast.info("Si olvidaste tu contraseña, contacta a Coordinación.")}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>

                {/* CTA principal */}
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="group w-full h-12 rounded-full text-base font-semibold tracking-wide
                            bg-gradient-to-r from-[#7c0040] via-[#5a002f] to-[#400022]
                            text-white shadow-md hover:shadow-lg hover:scale-[1.01]
                            transition-all duration-200 ease-in-out
                            disabled:opacity-70 disabled:hover:scale-100"
                >
                  {loginLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Entrando…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Entrar
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>


                {/* Divider sutil */}
                <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

                {/* Nota legal / confidencialidad */}
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Al continuar, aceptas nuestras políticas de privacidad y el uso responsable de tu
                  información. Este acceso es personal e intransferible.
                </p>
              </form>
            </div>
          </div>

          {/* FOOTER sticky del sheet */}
          <div className="border-t bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
            <div className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-3 sm:max-w-xl">
              <div className="text-[11px] text-neutral-500">
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  className="font-medium text-[#7c0040] underline-offset-2 hover:underline"
                  onClick={() => toast.info("El registro se realiza desde la página principal.")}
                >
                  Regístrate
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
