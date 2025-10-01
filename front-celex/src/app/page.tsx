// page.tsx (solo reemplaza la sección móvil)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import HeroFeatures from "@/components/landing/HeroFeatures";
import RegisterCard from "@/components/auth/RegisterCard";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, UserRoundPlus } from "lucide-react";

type MobileTab = "cursos" | "registro";

export default function Page() {
  const router = useRouter();
  const [mobileTab, setMobileTab] = useState<MobileTab>("cursos"); // 👈 Cursos primero

  const redirectByRole = (role: string) => {
    if (role === "student") return router.push("/alumno/dashboard");
    if (role === "teacher") return router.push("/docente/dashboard");
    if (role === "coordinator") return router.push("/coordinador/dashboard");
    if (role === "superuser") return router.push("/admin/dashboard");
    return router.push("/");
  };

  return (
    <main className="min-h-dvh flex flex-col bg-gradient-to-b from-white to-neutral-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <AppHeader />

      <section className="flex-1">
        <div className="mx-auto max-w-screen-2xl w-full px-4 sm:px-6 md:px-8 py-6 sm:py-10">

          {/* === MÓVIL: segmented tabs limpio === */}
          <div className="lg:hidden">
            <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as MobileTab)} className="w-full">
              <TabsList className="grid grid-cols-2 w-full bg-neutral-100/80 p-1 rounded-2xl">
                <TabsTrigger
                  value="cursos"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Cursos
                </TabsTrigger>
                <TabsTrigger
                  value="registro"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <UserRoundPlus className="h-4 w-4 mr-2" />
                  Registrarse/Entrar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cursos" className="mt-4">
                <HeroFeatures />
              </TabsContent>
              <TabsContent value="registro" className="mt-4">
                {/* RegisterCard ya trae el botón “Entrar” (LoginSheet) dentro */}
                <RegisterCard />
              </TabsContent>
            </Tabs>
          </div>

          {/* === ESCRITORIO: layout lado a lado sin cambios === */}
          <div className="hidden lg:grid grid-cols-5 gap-8 items-stretch">
            <div className="order-1 col-span-3 h-full flex flex-col min-w-0">
              <HeroFeatures />
            </div>
            <div className="order-2 col-span-2 h-full flex flex-col min-w-0">
              <RegisterCard />
            </div>
          </div>
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
