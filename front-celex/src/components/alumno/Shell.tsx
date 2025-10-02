"use client";

import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Topbar from "./Topbar";
import AlumnoSidebar from "./Sidebar";

export default function AlumnoShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  const openSidebar = useCallback(() => setOpen(true), []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  return (
    <div className="min-h-dvh bg-neutral-50">
      <Topbar onOpenSidebar={openSidebar} title={title} />

      {/* Layout: sidebar fixed en desktop, drawer en móvil */}
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:gap-6 px-3 md:px-6 py-4">
          {/* Sidebar desktop */}
          <div className="hidden md:block">
            <div className="sticky top-16 h-[calc(100dvh-5rem)] rounded-2xl border bg-white shadow-sm">
              <AlumnoSidebar />
            </div>
          </div>

          {/* Contenido */}
          <main className="min-h-[60vh]">
            {children}
          </main>
        </div>
      </div>

      {/* Drawer móvil */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-[86%] sm:w-[360px]">
          <SheetHeader>
            <VisuallyHidden>
              <SheetTitle>Navegación del alumno</SheetTitle>
            </VisuallyHidden>
          </SheetHeader>

          <div className="h-full">
            <AlumnoSidebar onNavigate={closeSidebar} />
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
