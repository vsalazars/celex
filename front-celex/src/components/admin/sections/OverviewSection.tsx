"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function KpiCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-neutral-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      </CardContent>
    </Card>
  );
}

type Stats = {
  coordinators?: number;
  teachers?: number;
  students?: number;
  revenue_month?: number; // en tu backend puedes ajustar el formato
};

export default function OverviewSection() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    // Nombre / email desde localStorage (se setean en el login)
    try {
      setName(localStorage.getItem("celex_nombre") || "");
      setEmail(localStorage.getItem("celex_email") || "");
    } catch {}

    // (Opcional) Cargar KPIs si tienes un endpoint /admin/stats
    // Ignora silenciosamente si no existe o no hay token.
    (async () => {
      try {
        const token = localStorage.getItem("celex_token");
        if (!token) return;
        const res = await fetch(`${API_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return; // evita romper UI si aún no tienes el endpoint
        const data = (await res.json()) as Stats;
        setStats(data);
      } catch {
        // no-op
      }
    })();
  }, []);

  const first = name ? name.split(/\s+/)[0] : "";
  const greeting = first ? `Hola, ${first} 👋` : "Resumen";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Panel de administración</h1>
        <h3 className="text-2xl font-semibold">{greeting}</h3>
        <p className="text-sm text-neutral-600">
          {email ? (
            <>
              Usuario en sesión: <span className="font-medium">{email}</span>
            </>
          ) : (
            "Indicadores rápidos del sistema."
          )}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Coordinadores"
          value={typeof stats?.coordinators === "number" ? String(stats.coordinators) : "—"}
          hint={typeof stats?.coordinators === "number" ? undefined : "Conteo real próximamente"}
        />
        <KpiCard
          title="Docentes"
          value={typeof stats?.teachers === "number" ? String(stats.teachers) : "—"}
          hint={typeof stats?.teachers === "number" ? undefined : "Próximamente"}
        />
        <KpiCard
          title="Alumnos"
          value={typeof stats?.students === "number" ? String(stats.students) : "—"}
          hint={typeof stats?.students === "number" ? undefined : "Próximamente"}
        />
        <KpiCard
          title="Ingresos (mes)"
          value={
            typeof stats?.revenue_month === "number"
              ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
                  stats.revenue_month
                )
              : "$ —"
          }
          hint={typeof stats?.revenue_month === "number" ? undefined : "Próximamente"}
        />
      </section>
    </div>
  );
}
