"use client";

import { Menu, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { clearSession, getSession } from "@/lib/sessions";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export default function Topbar({
  onOpenSidebar,
  title = "Panel del Alumno",
}: {
  onOpenSidebar: () => void;
  title?: string;
}) {
  const router = useRouter();
  const { nombre, email } = useMemo(() => {
    const s = getSession();
    return {
      nombre: (s?.nombre as string) || "Alumno",
      email: (s?.email as string) || "",
    };
  }, []);

  const initials = (nombre || "A")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    clearSession();
    router.replace("/");
  };

  return (
    <header
      className={cn(
        // barra completa en guinda
        "sticky top-0 z-40 border-b bg-[#7c0040] border-[#6a0038] text-white"
      )}
    >
      {/* Contenido de la barra */}
      <div className="flex h-14 items-center gap-3 px-3">
        {/* Botón menú móvil */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden rounded-xl text-white hover:bg-white/10 focus-visible:ring-white"
          onClick={onOpenSidebar}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Título */}
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight break-words text-white">
            {title}
          </h1>
          <p className="hidden xs:block text-[11px] leading-none text-white/80">
            CELEX Diódoro Antúnez Echegaray
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Notificaciones */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-white hover:bg-white/10 focus-visible:ring-white"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
          </Button>

          {/* Menú de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 gap-2 rounded-xl text-white hover:bg-white/10 focus-visible:ring-white"
                aria-label="Abrir menú de cuenta"
              >
                <Avatar className="h-8 w-8 ring-2 ring-white ring-offset-2 ring-offset-[#7c0040]">
                  <AvatarFallback className="text-[11px] bg-white/10 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium leading-none max-w-[160px] truncate text-white">
                    {nombre}
                  </div>
                  <div className="text-xs text-white/80 max-w-[180px] truncate">
                    {email}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>

            {/* Dropdown en blanco con acentos guinda */}
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl shadow-lg border border-neutral-200"
            >
              <DropdownMenuLabel className="text-neutral-800">Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/alumno/perfil")}
                className="focus:bg-[#7c0040]/10 focus:text-[#7c0040]"
              >
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/alumno/ayuda")}
                className="focus:bg-[#7c0040]/10 focus:text-[#7c0040]"
              >
                Ayuda
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
