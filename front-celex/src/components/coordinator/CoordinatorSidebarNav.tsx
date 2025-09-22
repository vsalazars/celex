"use client";

import React from "react";
import {
  LayoutDashboard,
  Layers,
  GraduationCap,
  Users,
  ClipboardCheck,
  BarChart3,
  Settings2,
  Shield,
  LogOut,
  FileSearch,
  ListChecks, // 👈 NUEVO (icono para Encuesta)
} from "lucide-react";
import { useRouter } from "next/navigation";
import UserInfo from "@/components/coordinator/UserInfo";

export type CoordinatorSection =
  | "overview"
  | "groups"
  | "teachers"
  | "students"
  | "inscripciones"
  | "placement"
  | "encuesta"      // 👈 NUEVO
  | "reports"
  | "settings"
  | "security";

export default function CoordinatorSidebarNav({
  active,
  onChange,
}: {
  active: CoordinatorSection;
  onChange: (s: CoordinatorSection) => void;
}) {
  const router = useRouter();

  const items: { key: CoordinatorSection; label: string; icon: React.ReactNode }[] = [
    { key: "overview",      label: "Resumen",        icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "teachers",      label: "Docentes",       icon: <GraduationCap className="h-4 w-4" /> },
    { key: "groups",        label: "Grupos",         icon: <Layers className="h-4 w-4" /> },
    { key: "students",      label: "Alumnos",        icon: <Users className="h-4 w-4" /> },
    { key: "inscripciones", label: "Inscripciones",  icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: "placement",     label: "Colocación",     icon: <FileSearch className="h-4 w-4" /> },
    { key: "encuesta",      label: "Encuesta",       icon: <ListChecks className="h-4 w-4" /> }, // 👈 NUEVO
    { key: "reports",       label: "Reportes",       icon: <BarChart3 className="h-4 w-4" /> },
    { key: "settings",      label: "Configuración",  icon: <Settings2 className="h-4 w-4" /> },
    { key: "security",      label: "Seguridad",      icon: <Shield className="h-4 w-4" /> },
  ];

  const handleLogout = () => {
    localStorage.removeItem("celex_token");
    localStorage.removeItem("celex_role");
    localStorage.removeItem("celex_email");
    localStorage.removeItem("celex_nombre");
    localStorage.removeItem("celex_userId");
    localStorage.removeItem("celex_curp");
    localStorage.removeItem("celex_is_ipn");
    localStorage.removeItem("celex_boleta");
    router.replace("/");
  };

  return (
    <aside className="hidden w-80 shrink-0 border-r bg-white/70 p-3 md:block">
      <div className="mb-8 px-2">
        <UserInfo />
      </div>

      <nav className="space-y-1">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={[
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
              active === it.key
                ? "bg-neutral-900 text-white"
                : "hover:bg-neutral-100 text-neutral-700",
            ].join(" ")}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </nav>

      <div className="mt-6 px-2 text-[11px] text-neutral-400">
        © {new Date().getFullYear()} CELEX · CECyT 15 "Diódoro Antúnez"
      </div>
    </aside>
  );
}
