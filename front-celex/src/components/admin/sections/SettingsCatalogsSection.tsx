"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsCatalogsSection() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Catálogos</h1>
      <p className="text-sm text-neutral-600">Idiomas, niveles, horarios, grupos (próximamente).</p>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">En desarrollo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-500">Aquí podrás gestionar catálogos.</CardContent>
      </Card>
    </div>
  );
}
