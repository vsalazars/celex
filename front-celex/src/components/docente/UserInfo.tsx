"use client";

import { useEffect, useState } from "react";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CE";
  if (parts.length === 1) return parts[0][0] || "C";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserInfo() {
  const [name, setName]   = useState<string>("");
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
        <div className="grid h-10 w-10 place-items-center rounded-full border text-xs font-semibold">
          {getInitials(name || "CE")}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name || "Docente"}</div>
          <div className="truncate text-xs text-neutral-500">{email || "—"}</div>
        </div>
      </div>
    </div>
  );
}
