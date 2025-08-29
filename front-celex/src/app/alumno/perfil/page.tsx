"use client";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";

export default function Page() {
  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell>
        <h1 className="text-xl font-semibold">Perfil</h1>
        <p className="text-neutral-600 mt-2">Edita tu información personal.</p>
      </AlumnoShell>
    </RequireAuth>
  );
}
