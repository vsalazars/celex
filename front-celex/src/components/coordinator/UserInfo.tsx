"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";

export default function UserInfo() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    try {
      setName(localStorage.getItem("celex_nombre") || "");
      setEmail(localStorage.getItem("celex_email") || "");
      setRole(localStorage.getItem("celex_role") || "");
    } catch {}
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
      {/* Avatar con ícono de usuario */}
      <Avatar className="h-9 w-9 shrink-0 flex-none">
        <AvatarImage alt={name} />
        <AvatarFallback className="bg-[#7c0040] text-white flex items-center justify-center">
          <UserIcon className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        {/* Nombre */}
        <div className="text-sm font-medium break-words text-[#7c0040]">
          {name || "Coordinador(a)"}
        </div>

        {/* Correo */}
        <div className="truncate text-[11px] text-neutral-500">
          {email || "—"}
        </div>

        {/* Rol */}
        {role && (
          <div className="text-[11px] text-neutral-500">
            {role}
          </div>
        )}
      </div>
    </div>
  );
}
