"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button"; // si usas shadcn
import { clearSession, getSession } from "@/lib/session";

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

    if (!token || role !== "student") {
      router.replace("/");
      return;
    }

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
    router.replace("/"); // o push, según prefieras
  };

  if (loading) return <p className="p-6">Verificando sesión...</p>;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel del Alumno</h1>
        <Button variant="outline" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>

      <div className="rounded-lg border p-4 shadow-sm bg-white space-y-1">
        <p className="text-lg">
          👋 Bienvenido, <span className="font-semibold">{nombre}</span>
        </p>
        <p className="text-neutral-600">📧 {email}</p>
        <p className="text-neutral-600">🆔 CURP: {curp}</p>
        <p className="text-neutral-500">👤 Perfil: {role}</p>
        {isIpn && (
          <p className="text-neutral-600">
            🎓 IPN · Boleta: <span className="font-medium">{boleta}</span>
          </p>
        )}
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Contenido protegido</h2>
        <p className="text-neutral-700 mt-2">
          Aquí irá la información, herramientas y recursos exclusivos para alumnos.
        </p>
      </section>
    </main>
  );
}
