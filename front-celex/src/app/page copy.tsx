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

      {/* Contenido principal */}
      <section className="flex-1">
        {/* max-w-screen-2xl ~1536px para aprovechar más ancho sin ir full-bleed */}
        <div className="mx-auto max-w-screen-2xl px-6 md:px-8 py-12 md:py-16">
          {/* 1 columna en móvil, 5 en desktop; proporción 3/2 (Hero/Register) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12 items-stretch">
            {/* Columna izquierda: Hero (3/5) */}
            <div className="lg:col-span-3 h-full flex flex-col">
              <HeroFeatures />
            </div>

            {/* Columna derecha: Registro (2/5) */}
            <div className="lg:col-span-2 h-full flex flex-col">
              <RegisterCard />
            </div>
          </div>
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
