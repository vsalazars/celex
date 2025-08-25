"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarImage } from "@/components/ui/avatar";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CE";
  if (parts.length === 1) return parts[0][0] || "C";
  return (parts[0][0] + parts[parts.length - 1][0]) || "CE";
}

export default function UserInfo() {
  const [name, setName]   = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [role, setRole]   = useState<string>("");

  useEffect(() => {
    try {
      setName(localStorage.getItem("celex_nombre") || "");
      setEmail(localStorage.getItem("celex_email") || "");
      setRole(localStorage.getItem("celex_role") || "");
    } catch {}
  }, []);

  const initials = getInitials(name || "CE");

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
      {/* Avatar (si usas shadcn) */}
      {/* 
      <Avatar className="h-9 w-9">
        <AvatarImage alt={name} />
        <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
      </Avatar>
      */}

      {/* Fallback simple */}
      <div className="grid h-9 w-9 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
        {initials.toUpperCase()}
      </div>

      <div className="min-w-0">
        {/* 👇 nombre sin truncate */}
        <div className="text-sm font-medium break-words">
          {name || "Administrador"}
        </div>
        {/* email sí puede truncarse */}
        <div className="truncate text-[11px] text-neutral-500">
          {email || "—"}
        </div>
        {role && (
          <div className="text-[11px] text-neutral-500">
            {role}
          </div>
        )}
      </div>
    </div>
  );
}
