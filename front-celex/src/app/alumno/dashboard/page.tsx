"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/sessions";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import { Button } from "@/components/ui/button";

import {
  Mail,
  IdCard,
  User as UserIcon,
  GraduationCap,
  ClipboardList,
  BookOpen,
  BadgeDollarSign,
  LogOut,
  Loader2,
  LayoutDashboard,
  History,
  HelpCircle,
} from "lucide-react";

export default function AlumnoDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [curp, setCurp] = useState("");
  const [isIpn, setIsIpn] = useState(false);
  const [boleta, setBoleta] = useState("");

  useEffect(() => {
    const { role, email, nombre, curp, is_ipn, boleta } = getSession();
    setRole(role || "");
    setEmail(email || "");
    setNombre(nombre || "Alumno");
    setCurp(curp || "");
    setIsIpn(!!is_ipn);
    setBoleta(boleta || "");
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.replace("/");
  };

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell title="CELEX Diódoro Antúnez Echegaray">
        {loading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando sesión...
          </div>
        ) : (
          <div className="space-y-5 md:space-y-6">
            {/* HERO */}
            <section className="relative overflow-hidden rounded-2xl border shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_10%_-10%,#7c0040_0%,transparent_50%),radial-gradient(80%_60%_at_110%_10%,#ff6ea6_0%,transparent_50%)] opacity-15" />
              <div className="relative p-5 sm:p-6 bg-gradient-to-br from-white to-white/80 dark:from-zinc-900 dark:to-zinc-900/70">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-[#7c0040] text-white flex items-center justify-center shadow-md">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold leading-tight">
                      ¡Hola, {nombre}!
                    </h2>
                    <p className="text-[13px] text-muted-foreground">
                      Bienvenido a tu panel del alumno
                    </p>
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    title="Cerrar sesión"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>

                {/* chips de información */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <InfoChip icon={<Mail className="h-4 w-4" />} text={email || "—"} />
                  <InfoChip icon={<IdCard className="h-4 w-4" />} text={`CURP: ${curp || "—"}`} />
                  <InfoChip icon={<UserIcon className="h-4 w-4" />} text={`Perfil: ${role || "—"}`} />
                  {isIpn && (
                    <InfoChip
                      icon={<GraduationCap className="h-4 w-4" />}
                      text={
                        <>
                          IPN · Boleta: <b>{boleta || "—"}</b>
                        </>
                      }
                    />
                  )}
                </div>
              </div>
            </section>

            {/* ACCIONES RÁPIDAS (móvil first) */}
            <section className="-mx-3 px-3">
              <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar">
                <QuickAction
                  title="Inscripción"
                  desc="Regístrate en un grupo."
                  icon={<ClipboardList className="h-5 w-5" />}
                  onClick={() => router.push("/alumno/inscripcion")}
                />
                <QuickAction
                  title="Mis cursos"
                  desc="Horarios y materiales."
                  icon={<BookOpen className="h-5 w-5" />}
                  onClick={() => router.push("/alumno/cursos")}
                />
                <QuickAction
                  title="Pagos"
                  desc="Comprobantes y estados."
                  icon={<BadgeDollarSign className="h-5 w-5" />}
                  onClick={() => router.push("/alumno/pagos")}
                 />

                 <QuickAction
                    title="Colocación"
                    desc="Examen para ubicar tu nivel."
                    icon={<GraduationCap className="h-5 w-5" />}
                    onClick={() => router.push("/alumno/placement")}
                  />

                  <QuickAction
                    title="Historial"
                    desc="Calificaciones y asistencias."
                    icon={<History className="h-5 w-5" />}
                    onClick={() => router.push("/alumno/historial")}
                  />

                  <QuickAction
                    title="Perfil"
                    desc="Datos y credenciales."
                    icon={<UserIcon className="h-5 w-5" />}
                    onClick={() => router.push("/alumno/perfil")}
                  />

                  <QuickAction
                    title="Ayuda"
                    desc="Preguntas frecuentes."
                    icon={<HelpCircle className="h-5 w-5" />}
                    onClick={() => router.push("/alumno/ayuda")}
                  />
              </div>
            </section>

           
          </div>
        )}
      </AlumnoShell>
    </RequireAuth>
  );
}

/* ====================== UI Helpers ======================= */

function InfoChip({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur-sm dark:bg-zinc-900/60">
      <span className="text-[#7c0040]">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function QuickAction({
  title,
  desc,
  icon,
  onClick,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="snap-start min-w-[70%] xs:min-w-[260px] sm:min-w-[280px] active:scale-[0.99] transition-transform"
      aria-label={title}
    >
      <div className="relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#7c0040]/10" />
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#7c0040] text-white flex items-center justify-center shadow">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-none">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
          </div>
        </div>
      </div>
    </button>
  );
}

function FeatureCard({
  title,
  desc,
  icon,
  action,
  onClick,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-[#7c0040] text-white flex items-center justify-center shadow">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

/* ===== util: ocultar scrollbar horizontal en acciones rápidas ===== */
declare global {
  interface HTMLElementTagNameMap {
    "no-scrollbar": Element;
  }
}
