"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/sessions";

type Props = { children: React.ReactNode; roles?: string[] };

export default function RequireAuth({ children, roles }: Props) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { token, role } = getSession();

    if (!token) {
      router.replace("/");
      return;
    }
    if (roles && roles.length > 0 && !roles.includes(role || "")) {
      router.replace("/");
      return;
    }
    setOk(true);
  }, [router, roles]);

  if (!ok) return <p className="p-6">Verificando sesión…</p>;
  return <>{children}</>;
}
