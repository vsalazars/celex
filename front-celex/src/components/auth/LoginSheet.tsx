// src/components/auth/LoginSheet.tsx
"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
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
  showTrigger = true,          // 👈 nueva prop
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: (data: LoginData) => void;
  showTrigger?: boolean;       // 👈 nueva prop
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
      localStorage.setItem("celex_nombre", `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
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
      {/* 👇 el trigger SOLO se muestra si showTrigger === true */}
      {showTrigger && (
        <SheetTrigger asChild>
          <Button variant="default" size="lg" className="gap-2 rounded-full px-5 shadow-md hover:shadow-lg">
            <LogIn className="h-4 w-4" />
            Iniciar sesión
          </Button>
        </SheetTrigger>
      )}

      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <div className="flex h-full flex-col items-center pt-8">
          <div className="w-full max-w-sm px-6">
            <SheetHeader className="text-center">
              <SheetTitle className="font-title text-xl">
                Bienvenido al CELEX "Diódoro Antúnez Echegaray"
              </SheetTitle>
              <SheetDescription className="text-neutral-500">
                Ingresa tu correo y contraseña.
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={handleLogin} className="mt-6 space-y-6 w-full" autoComplete="on">
              <div className="space-y-2 w-full">
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
                  />
                </div>
                {loginErrors.email && <p className="text-xs text-red-600">{loginErrors.email}</p>}
              </div>

              <div className="space-y-2 w-full">
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
                  />
                  <button
                    type="button"
                    aria-label={showLoginPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowLoginPwd((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100 focus:outline-none z-10"
                    aria-pressed={showLoginPwd}
                  >
                    {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {loginErrors.pwd && <p className="text-xs text-red-600">{loginErrors.pwd}</p>}
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={loginLoading}>
                {loginLoading ? "Entrando..." : "Entrar"}
              </Button>
              <p className="text-center text-xs text-neutral-500">
                ¿No tienes cuenta? Crea tu cuenta en la página principal.
              </p>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
