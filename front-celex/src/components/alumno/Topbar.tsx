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
        "sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-white/70",
        "bg-white/80"
      )}
    >
      {/* Franja superior con color guinda */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #7c0040 0%, #a00057 40%, #7c0040 100%)",
        }}
      />

      <div className="flex h-14 items-center gap-3 px-3">
        {/* Botón menú móvil */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden rounded-xl"
          onClick={onOpenSidebar}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Título visible completo */}
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight break-words">
            {title}
          </h1>
          <p className="hidden xs:block text-[11px] leading-none text-neutral-500">
            CELEX Diódoro Antúnez Echegaray
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Botón notificaciones (opcional) */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
          </Button>

          {/* Menú de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 gap-2 rounded-xl hover:bg-neutral-100"
                aria-label="Abrir menú de cuenta"
              >
                <Avatar
                  className="h-8 w-8 ring-2 ring-offset-2"
                  style={{ ringColor: "#7c0040" as any }}
                >
                  <AvatarFallback className="text-[11px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium leading-none max-w-[160px]">
                    {nombre}
                  </div>
                  <div className="text-xs text-neutral-500 max-w-[180px]">
                    {email}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl shadow-lg"
            >
              <DropdownMenuLabel>Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/alumno/perfil")}>
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/alumno/ayuda")}>
                Ayuda
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
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
