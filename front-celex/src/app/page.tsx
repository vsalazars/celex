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
    <main className="min-h-dvh bg-gradient-to-b from-white to-neutral-50">
      <AppHeader onLoginSuccess={(data) => redirectByRole(data.role || "")} />

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 md:grid-cols-2 items-stretch">
        <div className="h-full">
          <HeroFeatures />
        </div>
        <div className="h-full">
          <RegisterCard />
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
