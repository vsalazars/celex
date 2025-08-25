"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsMailSection() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Correo saliente</h1>
      <p className="text-sm text-neutral-600">SMTP (Titan), DKIM/SPF/DMARC.</p>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Configuración (placeholder)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-600">
          <p>Ya estás usando Titan (smtp.titan.email). Revisa que el correo no caiga en SPAM.</p>
          <ul className="list-disc pl-5">
            <li>SPF: incluye <code>include:_spf.titan.email</code></li>
            <li>DKIM: clave en DNS de tu dominio (Titan)</li>
            <li>DMARC: <code>p=quarantine</code> o <code>p=reject</code> progresivamente</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
