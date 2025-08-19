"use client";

import { useState, useRef} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, IdCard, BadgeCheck } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const emailRegex = /^\S+@\S+\.\S+$/;
const boletaRegex = /^\d{10}$/; // 10 dígitos, p. ej. 2025070109
const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/i; // CURP 18 caracteres

export default function Page() {
  const router = useRouter();

  // --- Sheet de login (visible para TODOS los perfiles) ---
  const [open, setOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginErrors, setLoginErrors] = useState<{ email?: string; pwd?: string }>({});
  const [loginLoading, setLoginLoading] = useState(false);

  const redirectByRole = (role: string) => {
    if (role === "student") return router.push("/alumno/dashboard");
    if (role === "teacher") return router.push("/docente/dashboard");
    if (role === "coordinator") return router.push("/coordinador/dashboard");
    if (role === "superuser") return router.push("/admin/dashboard"); // super usuario al panel admin
    return router.push("/");
  };


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

      const data = await res.json();

      // 👇 AQUÍ ES LA CLAVE: debe existir access_token
      if (!data?.access_token) {
        console.error("[LOGIN] Respuesta sin access_token:", data);
        toast.error("Token no recibido");
        return;
      }

      // Guarda sesión
      localStorage.setItem("celex_token", data.access_token);
      localStorage.setItem("celex_role", data.role ?? "");
      localStorage.setItem("celex_email", data.email ?? "");
      localStorage.setItem("celex_nombre", `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
      localStorage.setItem("celex_curp", data.curp ?? "");              // ya lo tenías
      localStorage.setItem("celex_is_ipn", String(!!data.is_ipn));      // 👈 NUEVO ("true"/"false")
      localStorage.setItem("celex_boleta", data.boleta ?? "");          // 👈 NUEVO

      // Limpieza UI
      setLoginErrors({});
      setLoginPwd("");
      setShowLoginPwd(false);
      toast.success("Inicio de sesión correcto");
      setOpen(false);

      redirectByRole(data.role || "");
    } catch (err: any) {
      console.error("[LOGIN] network/unexpected error:", err);
      toast.error("Error de red o servidor");
    } finally {
      setLoginLoading(false);
    }
  };






  const pwdRef = useRef<HTMLInputElement>(null);


  // --- Registro (flujo único). Marcas "Soy alumno del IPN" para pedir Boleta ---
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
      // limpia
      setRegNombre("");
      setRegApellidos("");
      setRegEmail("");
      setRegEmail2("");
      setRegBoleta("");
      setRegCURP("");
      setRegPwd("");
      setRegPwd2("");
      // abre el login para comodidad
      setOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Error al registrar");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white to-neutral-50">
      {/* HEADER */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-neutral-900 font-bold text-white">
              CE
            </div>
            <span className="text-sm font-medium text-neutral-600">
              CELEX · Gestión Escolar
            </span>
          </div>

          {/* Sheet de login para TODOS */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full px-5 hover:bg-neutral-100"
              >
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-md p-0">
              <div className="flex h-full flex-col items-center pt-10">
                <div className="w-full max-w-sm px-6">
                  <SheetHeader className="text-center">
                    <SheetTitle className="font-title text-xl">
                      Bienvenido al CELEX "Cuauhtémoc"
                    </SheetTitle>
                    <SheetDescription className="text-neutral-500">
                      Ingresa tu correo y contraseña.
                    </SheetDescription>
                  </SheetHeader>

                  {/* Form de login */}
                  <form onSubmit={handleLogin} className="mt-6 space-y-6 w-full">
                    <div className="space-y-2 w-full">
                      <Label htmlFor="login-email">Correo</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="tunombre@correo.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-9"
                          autoComplete="email"
                          required
                        />
                      </div>
                      {loginErrors.email && (
                        <p className="text-xs text-red-600">{loginErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2 w-full">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                          id="login-password"
                          ref={pwdRef}                       // <- referencia para enfocar/seleccionar
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100 focus:outline-none z-10" // <- z-10
                          aria-pressed={showLoginPwd}
                        >
                          {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {loginErrors.pwd && (
                        <p className="text-xs text-red-600">{loginErrors.pwd}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={loginLoading}>
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
        </div>
      </header>

      {/* HERO + Registro */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <h1 className="font-title text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
            CELEX Cuauhtémoc
            <span className="block text-neutral-500">Sistema de Gestión Escolar</span>
          </h1>
          <p className="mt-4 max-w-prose text-neutral-600">
            Administra <strong>inscripciones</strong>, <strong>reinscripciones</strong>,{" "}
            <strong>pagos</strong>, <strong>grupos</strong> y <strong>certificados</strong> en un solo lugar.
          </p>

          <ul className="mt-8 grid grid-cols-1 gap-4 text-sm text-neutral-600 sm:grid-cols-2">
            <li className="rounded-2xl border bg-white p-4 shadow-sm">• Horarios intensivos y sabatinos</li>
            <li className="rounded-2xl border bg-white p-4 shadow-sm">• Control de pagos y vouchers BBVA</li>
            <li className="rounded-2xl border bg-white p-4 shadow-sm">• Avance académico y constancias</li>
            <li className="rounded-2xl border bg-white p-4 shadow-sm">• Roles: Alumno, Docente, Coordinación</li>
          </ul>
        </div>

        {/* Card de Registro (flujo único) */}
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

            {/* Toggle: Soy alumno del IPN (Switch) */}
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

              {/* Email + Confirmación */}
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

              {/* CURP */}
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

              {/* Boleta (solo si marcó IPN) */}
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

              {/* Password + Confirmación — MISMA FILA */}
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
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-neutral-500 md:flex-row">
          <span>© {new Date().getFullYear()} CELEX · CECyT 7</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-neutral-700">Términos</a>
            <a href="#" className="hover:text-neutral-700">Privacidad</a>
            <a href="#" className="hover:text-neutral-700">Contacto</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
