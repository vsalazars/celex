"use client";

import { useEffect, useState } from "react";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CE";
  if (parts.length === 1) return parts[0][0] || "C";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserInfo() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    try {
      setName(localStorage.getItem("celex_nombre") || "");
      setEmail(localStorage.getItem("celex_email") || "");
    } catch {}
  }, []);

  return (
    <div className="rounded-xl border bg-white/60 p-3 dark:bg-neutral-900/60">
      <div className="flex items-center gap-3">
        {/* Avatar circular con iniciales */}
        <div
          className="h-10 w-10 shrink-0 grid place-items-center rounded-full bg-[#7c0040] text-xs font-semibold text-white leading-none select-none"
        >
          {getInitials(name || "CE")}
        </div>

        <div className="min-w-0">
          {/* Nombre en varias líneas si es necesario */}
          <div className="text-sm font-medium text-[#7c0040] dark:text-white break-words whitespace-normal">
            {name || "Docente"}
          </div>

          {/* Correo siempre en una línea */}
          <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {email || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
