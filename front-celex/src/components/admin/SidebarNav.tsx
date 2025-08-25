"use client";

import { Section } from "./DashboardShell";
import {
  LayoutDashboard,
  Shield,
  GraduationCap,
  Users,
  Mail,
  Settings2,
  Lock,
  LogOut,
} from "lucide-react";
import UserInfo from "./UserInfo";
import { useRouter } from "next/navigation";

export default function SidebarNav({
  active,
  onChange,
}: {
  active: Section;
  onChange: (s: Section) => void;
}) {
  const router = useRouter();

  const items: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Resumen", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "coordinators", label: "Coordinadores", icon: <Shield className="h-4 w-4" /> },
    { key: "teachers", label: "Docentes", icon: <GraduationCap className="h-4 w-4" /> },
    { key: "students", label: "Alumnos", icon: <Users className="h-4 w-4" /> },
    { key: "settings_catalogs", label: "Catálogos", icon: <Settings2 className="h-4 w-4" /> },
  ];

  const handleLogout = () => {
    localStorage.removeItem("celex_token");
    localStorage.removeItem("celex_role");
    localStorage.removeItem("celex_email");
    localStorage.removeItem("celex_userId");
    router.replace("/");
  };

  return (
    <aside className="hidden w-80 shrink-0 border-r bg-white/70 p-3 md:block">
      
      {/* 👇 Bloque de usuario en sesión */}
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

        {/* Botón de Cerrar sesión */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </nav>

      <div className="mt-6 px-2 text-[11px] text-neutral-400">
        © {new Date().getFullYear()} CELEX · CECyT 7 "Cuauhtémoc"
      </div>
    </aside>
  );
}
