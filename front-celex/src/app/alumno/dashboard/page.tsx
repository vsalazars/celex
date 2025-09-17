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
    const { token, role, email, nombre, curp, is_ipn, boleta } = getSession();
    // RequireAuth se encarga de bloquear si no hay token/rol
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
      <AlumnoShell title="Cursos Extracurriculares de Lenguas Extranjeras">
        {loading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando sesión...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Hola, <span className="text-neutral-900">{nombre}</span>
                </h2>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </Button>
              </div>

              <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm text-neutral-700">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  <span className="truncate">CURP: {curp || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="truncate">Perfil: {role || "—"}</span>
                </div>
                {isIpn && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    <span className="truncate">
                      IPN · Boleta: <b>{boleta || "—"}</b>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="font-medium flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Inscripción
                </h3>
                <p className="text-sm text-neutral-600 mt-1">
                  Revisa grupos disponibles y realiza tu inscripción.
                </p>
                <Button className="mt-3" onClick={() => router.push("/alumno/inscripcion")}>
                  Ver grupos
                </Button>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="font-medium flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Mis cursos
                </h3>
                <p className="text-sm text-neutral-600 mt-1">
                  Consulta horarios y materiales de tus cursos.
                </p>
                <Button className="mt-3" onClick={() => router.push("/alumno/cursos")}>
                  Ir a mis cursos
                </Button>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="font-medium flex items-center gap-2">
                  <BadgeDollarSign className="h-5 w-5" />
                  Pagos
                </h3>
                <p className="text-sm text-neutral-600 mt-1">
                  Consulta detales de comprobantes de pago.
                </p>
                <Button className="mt-3" onClick={() => router.push("/alumno/pagos")}>
                  Gestionar pagos
                </Button>
              </div>
            </div>
          </div>
        )}
      </AlumnoShell>
    </RequireAuth>
  );
}
