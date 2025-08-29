"use client";

import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { clearSession, getSession } from "@/lib/sessions";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

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
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
      <div className="flex h-14 items-center gap-3 px-3">
        {/* Mobile: botón para abrir drawer */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenSidebar}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <h1 className="text-base font-semibold">{title}</h1>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium leading-none">{nombre}</div>
                  <div className="text-xs text-neutral-500">{email}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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
