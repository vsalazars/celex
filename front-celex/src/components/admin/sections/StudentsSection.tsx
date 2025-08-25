"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentsSection() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Alumnos</h1>
      <p className="text-sm text-neutral-600">Inscripciones, reinscripciones y control (próximamente).</p>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">En desarrollo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-500">
          Aquí verás la gestión de alumnos (altas manuales, listados, estatus).
        </CardContent>
      </Card>
    </div>
  );
}
