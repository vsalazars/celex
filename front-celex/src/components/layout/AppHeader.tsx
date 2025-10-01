"use client";

import Image from "next/image";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-6 md:px-8 py-2.5 sm:py-3">
        <div
          className="grid items-center gap-2 sm:gap-3"
          style={{ gridTemplateColumns: "auto 1fr", gridTemplateRows: "auto" }}
        >
          {/* Logo */}
          <div className="mr-2">
            <Image
              src="/logo.png"
              alt="Logo CELEX"
              width={56}
              height={56}
              className="rounded-md w-12 h-12 sm:w-[72px] sm:h-[72px]"
              priority
            />
          </div>

          {/* Texto */}
          <div className="min-w-0 whitespace-normal break-words hyphens-auto leading-snug">
            <h1 className="text-[13px] sm:text-base font-bold tracking-tight text-[#7c0040]">
              Instituto Politécnico Nacional
            </h1>
            <p className="text-[12px] sm:text-sm text-neutral-800 font-medium">
              CECyT 15 “Diódoro Antúnez Echegaray”
            </p>
            <p className="text-[11.5px] sm:text-sm text-neutral-600">
              Cursos Extracurriculares de Lenguas Extranjeras (CELEX)
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
