"use client";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";

export default function Page() {
  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell>
        <h1 className="text-xl font-semibold">Historial</h1>
        <p className="text-neutral-600 mt-2">Notas, constancias y cursos previos.</p>
      </AlumnoShell>
    </RequireAuth>
  );
}
