"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem("celex_token");
      const role  = localStorage.getItem("celex_role");
      if (!token || role !== "teacher") {
        router.replace("/");
        return;
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-neutral-500">
        Verificando sesión…
      </div>
    );
  }

  return <>{children}</>;
}
