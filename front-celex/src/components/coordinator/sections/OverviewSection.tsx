"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
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

export default function OverviewSection() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Resumen</h1>
        <p className="text-sm text-neutral-600">Indicadores rápidos de coordinación.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Grupos activos" value="12" hint="Periodo actual" />
        <Kpi title="Docentes" value="18" hint="Asignados a grupos" />
        <Kpi title="Alumnos" value="342" hint="Matriculados" />
        <Kpi title="Pagos verificados" value="97%" hint="Últimos 30 días" />
      </section>
    </div>
  );
}
