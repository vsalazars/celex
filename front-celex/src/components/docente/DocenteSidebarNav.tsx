"use client";

import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Layers,
  FileStack,
  ClipboardCheck,
  Settings2,
  Shield,
  LogOut,
  User,
  Target,     // Colocación
  BarChart3,  // Encuestas
} from "lucide-react";
import { useRouter } from "next/navigation";
import UserInfo from "./UserInfo";

export type TeacherSection =
  | "overview"
  | "groups"
  | "placement"
  | "surveys"
  | "materials"
  | "evaluations"
  | "settings"
  | "security";

export default function DocenteSidebarNav({
  active,
  onChange,
}: {
  active: TeacherSection;
  onChange: (s: TeacherSection) => void;
}) {
  const router = useRouter();

  const items: { key: TeacherSection; label: string; icon: ReactNode }[] = [
    { key: "overview",    label: "Resumen",      icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "groups",      label: "Mis grupos",   icon: <Layers className="h-4 w-4" /> },
    { key: "evaluations", label: "Evaluaciones", icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: "placement",   label: "Colocación",   icon: <Target className="h-4 w-4" /> },
    { key: "surveys",     label: "Encuestas",    icon: <BarChart3 className="h-4 w-4" /> },
    //{ key: "materials",   label: "Materiales",   icon: <FileStack className="h-4 w-4" /> },
    //{ key: "settings",    label: "Configuración",icon: <Settings2 className="h-4 w-4" /> },
    { key: "security",    label: "Seguridad",    icon: <Shield className="h-4 w-4" /> },
  ];

  const handleLogout = () => {
    localStorage.removeItem("celex_token");
    localStorage.removeItem("celex_role");
    localStorage.removeItem("celex_nombre");
    localStorage.removeItem("celex_email");
    router.replace("/");
  };

  return (
    <aside className="w-72 shrink-0 border-r bg-white/50 p-4 backdrop-blur dark:bg-neutral-900/50">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <User className="h-4 w-4" />
          <span>Panel del Docente</span>
        </div>
        <h1 className="mt-1 text-xl font-semibold">Dashboard</h1>
      </div>

      <UserInfo />

      <nav className="mt-4 space-y-1">
        {items.map(({ key, label, icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                ${isActive
                  ? "bg-primary/10 text-primary ring-0 dark:bg-primary/20"
                  : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                }`}
            >
              {/* barrita lateral cuando está activo */}
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r
                ${isActive ? "bg-primary" : "bg-transparent"}`}
              />
              {icon}
              <span>{label}</span>
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
