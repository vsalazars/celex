"use client";

import { useState } from "react";
import LoginSheet from "@/components/auth/LoginSheet";

export default function AppHeader({
  onLoginSuccess,
}: {
  onLoginSuccess: (data: { role?: string }) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-neutral-900 font-bold text-white">
            CE
          </div>
          <span className="text-sm font-medium text-neutral-600">
            CELEX · Gestión Escolar
          </span>
        </div>

        <LoginSheet open={open} setOpen={setOpen} onSuccess={onLoginSuccess} />
      </div>
    </header>
  );
}
