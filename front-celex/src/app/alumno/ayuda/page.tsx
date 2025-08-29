"use client";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";

export default function Page() {
  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell>
        <h1 className="text-xl font-semibold">Ayuda</h1>
        <p className="text-neutral-600 mt-2">Preguntas frecuentes y soporte.</p>
      </AlumnoShell>
    </RequireAuth>
  );
}
