"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsSecuritySection() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Seguridad</h1>
      <p className="text-sm text-neutral-600">Roles, permisos y políticas (próximamente).</p>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">En desarrollo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-500">
          Define reglas de acceso y contraseñas.
        </CardContent>
      </Card>
    </div>
  );
}
