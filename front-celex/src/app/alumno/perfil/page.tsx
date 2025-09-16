"use client";

import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import StudentProfileForm from "@/components/alumno/StudentProfileForm";

export default function Page() {
  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell>
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold">Perfil del alumno</h1>
          <p className="text-neutral-600 mt-2">
            Revisa y completa tu información para agilizar inscripciones y trámites.
          </p>
          <div className="mt-6">
            <StudentProfileForm />
          </div>
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}
