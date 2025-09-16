"use client";

import { useRouter } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import HeroFeatures from "@/components/landing/HeroFeatures";
import RegisterCard from "@/components/auth/RegisterCard";

export default function Page() {
  const router = useRouter();

  const redirectByRole = (role: string) => {
    if (role === "student") return router.push("/alumno/dashboard");
    if (role === "teacher") return router.push("/docente/dashboard");
    if (role === "coordinator") return router.push("/coordinador/dashboard");
    if (role === "superuser") return router.push("/admin/dashboard");
    return router.push("/");
  };

  return (
    <main className="min-h-dvh flex flex-col bg-gradient-to-b from-white to-neutral-50">
      <AppHeader onLoginSuccess={(data) => redirectByRole(data.role || "")} />

      {/* Contenido principal: se expande para que las columnas puedan igualar alturas */}
      <section className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-stretch">
            {/* Columna izquierda: Hero / ofertas */}
            <div className="h-full flex flex-col">
              <HeroFeatures />
            </div>

            {/* Columna derecha: Registro */}
            <div className="h-full flex flex-col">
              <RegisterCard />
            </div>
          </div>
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
