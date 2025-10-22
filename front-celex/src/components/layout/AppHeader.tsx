// src/components/AppHeader.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function AppHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detecta si es móvil (tailwind sm breakpoint ≈ 640px)
    const mql = window.matchMedia("(max-width: 640px)");
    const handleMql = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile("matches" in e ? e.matches : (e as MediaQueryList).matches);
    };
    handleMql(mql);
    const mqlListener = (e: MediaQueryListEvent) => handleMql(e);
    mql.addEventListener?.("change", mqlListener);

    // Listener de scroll
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      mql.removeEventListener?.("change", mqlListener);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const activeMobile = isMobile && scrolled;

  return (
    <header
      className={[
        "sticky top-0 z-30 w-full border-b transition-colors duration-200",
        activeMobile
          ? "bg-[#7c0040] text-white border-b-transparent"
          : "bg-white/70 text-neutral-900 backdrop-blur supports-[backdrop-filter]:bg-white/60",
      ].join(" ")}
    >
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
              className={[
                "rounded-md w-12 h-12 sm:w-[72px] sm:h-[72px] transition-[filter,box-shadow] duration-200",
                activeMobile ? "drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]" : "",
              ].join(" ")}
              priority
            />
          </div>

          {/* Texto */}
          <div className="min-w-0 whitespace-normal break-words hyphens-auto leading-snug">
            <h1
              className={[
                "text-[13px] sm:text-base font-bold tracking-tight transition-colors",
                activeMobile ? "text-white" : "text-[#7c0040]",
              ].join(" ")}
            >
              Instituto Politécnico Nacional
            </h1>
            <p
              className={[
                "text-[12px] sm:text-sm font-medium transition-colors",
                activeMobile ? "text-white/90" : "text-neutral-800",
              ].join(" ")}
            >
              Centro de Estudios Científicos y Tecnológicos No. 4 "Lázaro Cárdenas"
            </p>
            <p
              className={[
                "text-[11.5px] sm:text-sm transition-colors",
                activeMobile ? "text-white/80" : "text-neutral-600",
              ].join(" ")}
            >
              Cursos Extracurriculares de Lenguas Extranjeras (CELEX)
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
