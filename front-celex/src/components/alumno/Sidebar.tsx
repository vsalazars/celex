"use client";

import {
  LayoutDashboard,
  BookOpen,
  CreditCard,
  History,
  User,
  HelpCircle,
} from "lucide-react";
import NavLink from "./NavLink";

const links = [
  { href: "/alumno/dashboard", label: "Resumen", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/alumno/cursos", label: "Mis cursos", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/alumno/inscripcion", label: "Inscripción", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/alumno/pagos", label: "Pagos", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/alumno/historial", label: "Historial", icon: <History className="h-4 w-4" /> },
  { href: "/alumno/perfil", label: "Perfil", icon: <User className="h-4 w-4" /> },
  { href: "/alumno/ayuda", label: "Ayuda", icon: <HelpCircle className="h-4 w-4" /> },
];

export default function AlumnoSidebar({
  onNavigate,
}: {
  onNavigate?: () => void; // para cerrar el drawer en móvil
}) {
  return (
    <aside className="h-full w-full p-3">
      <div className="mb-3 px-2">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Alumno
        </h2>
      </div>
      <nav className="space-y-1">
        {links.map((l) => (
          <NavLink key={l.href} href={l.href} icon={l.icon} onClick={onNavigate}>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
