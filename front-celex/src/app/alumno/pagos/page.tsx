"use client";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";

export default function Page() {
  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell>
        <h1 className="text-xl font-semibold">Pagos</h1>
        <p className="text-neutral-600 mt-2">Consulta y realiza tus pagos.</p>
      </AlumnoShell>
    </RequireAuth>
  );
}
