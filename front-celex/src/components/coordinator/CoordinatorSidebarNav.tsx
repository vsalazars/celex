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
  ListChecks,
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
  | "encuesta"
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
    { key: "reports",       label: "Reportes",       icon: <BarChart3 className="h-4 w-4" /> },
    { key: "encuesta",      label: "Encuesta",       icon: <ListChecks className="h-4 w-4" /> },
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
    <aside className="hidden w-80 shrink-0 border-r bg-white/70 p-3 backdrop-blur dark:bg-neutral-900/50 md:block">
      <div className="mb-8 px-2">
        <UserInfo />
      </div>

      <nav className="space-y-1">
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c0040]/50
                ${
                  isActive
                    ? "bg-[#7c0040]/10 text-[#7c0040] dark:bg-[#7c0040]/20"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                }`}
            >
              {/* barrita lateral */}
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r
                ${isActive ? "bg-[#7c0040]" : "bg-transparent"}`}
              />
              {it.icon}
              <span>{it.label}</span>
            </button>
          );
        })}

        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:hover:bg-red-900/20"
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
