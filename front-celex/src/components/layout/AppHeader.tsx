"use client";

import { useState } from "react";
import Image from "next/image";
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
          {/* Logo */}
          <Image
            src="/logo.png"   // tu archivo en /public
            alt="Logo CELEX"
            width={80}
            height={80}
            className="rounded-md"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-md font-semibold text-neutral-700">
              Instituto Politécnico Nacional
            </span>
            <span className="text-sm font-medium text-neutral-600">
              Centro de Estudios Científicos y Tecnológicos No. 15 "Diódoro Antúnez Echegaray"
            </span>
            <span className="text-sm font-medium text-neutral-600">
              Cursos Extracurriculares de Lenguas Extranjeras (CELEX)
            </span>
          </div>
        </div>

        <LoginSheet open={open} setOpen={setOpen} onSuccess={onLoginSuccess} />
      </div>
    </header>
  );
}
