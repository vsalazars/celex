export default function HeroFeatures() {
  return (
    <div>
      <h1 className="font-title text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
        CELEX "Cuauhtémoc"
        <span className="block text-neutral-500">Sistema de Gestión Escolar</span>
      </h1>
      <p className="mt-4 max-w-prose text-neutral-600">
        Administra <strong>inscripciones</strong>, <strong>reinscripciones</strong>,{" "}
        <strong>pagos</strong>, <strong>grupos</strong> y <strong>certificados</strong> en un solo lugar.
      </p>

      <ul className="mt-8 grid grid-cols-1 gap-4 text-sm text-neutral-600 sm:grid-cols-2">
        <li className="rounded-2xl border bg-white p-4 shadow-sm">• Horarios intensivos y sabatinos</li>
        <li className="rounded-2xl border bg-white p-4 shadow-sm">• Control de pagos y vouchers BBVA</li>
        <li className="rounded-2xl border bg-white p-4 shadow-sm">• Avance académico y constancias</li>
        <li className="rounded-2xl border bg-white p-4 shadow-sm">• Roles: Alumno, Docente, Coordinación</li>
      </ul>
    </div>
  );
}
