"use client";

import React from "react";
import { Separator } from "@/components/ui/separator";

type DocenteMini = { id?: number | string; nombre?: string } | null;

type CicloPayload = {
  id?: number | string;
  codigo?: string;
  idioma?: string | null;
  modalidad?: string | null;
  turno?: string | null;
  nivel?: string | null;
  dias?: string[] | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  curso_inicio?: string | null;
  curso_fin?: string | null;
  modalidad_asistencia?: string | null;
  aula?: string | null;
  docente?: DocenteMini;
  docente_nombre?: string | null;
};

type Filtros = { anio?: number | string | null; idioma?: string | null };
type Resumen = {
  total: number;
  validado: number;
  pendiente: number;
  rechazado: number;
  sumaValidadoMXN: number;
};

// ---------- Helpers ----------
function headPrettyEnum(raw?: string | null, dict?: Record<string, string>) {
  if (!raw) return "—";
  const token = raw.includes(".") ? raw.split(".").pop()! : raw;
  const key = token.toLowerCase();
  if (dict && dict[key]) return dict[key];
  return token.charAt(0).toUpperCase() + token.slice(1);
}
const M_IDIOMA: Record<string, string> = {
  ingles: "Inglés",
  frances: "Francés",
  aleman: "Alemán",
  italiano: "Italiano",
  portugues: "Portugués",
};
const M_MODALIDAD: Record<string, string> = {
  intensivo: "Intensivo",
  sabatino: "Sabatino",
  regular: "Regular",
};
const M_TURNO: Record<string, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  nocturno: "Nocturno",
};
const M_NIVEL: Record<string, string> = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado" };
const M_ASISTENCIA: Record<string, string> = { presencial: "Presencial", en_linea: "En línea", mixta: "Mixta" };

function formatISODateToDMY(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const dd = String(d.getDate()).padStart(2, "0");
  const m = meses[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd}/${m}/${yyyy}`;
}
function formatSqlTime(t?: string | null) {
  if (!t) return null;
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(t.trim());
  if (!m) return t;
  return `${m[1]}:${m[2]}`;
}
function joinDias(dias?: string[] | null) {
  if (!Array.isArray(dias) || !dias.length) return null;
  return dias.map((d) => (d ? d.charAt(0).toUpperCase() + d.slice(1) : d)).join(", ");
}
function orDash(v?: any) { return (v === null || v === undefined || v === "") ? "—" : String(v); }
function nowEmitido() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const m = meses[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${m}/${yyyy} ${hh}:${mm}`;
}

// Etiqueta:valor – bloque con ellipsis y SIN wrap
function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 min-w-0 max-w-full">
      <span className="font-medium shrink-0 whitespace-nowrap">{label}:</span>
      <span
        className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </span>
    </span>
  );
}

// ---------- Componente ----------
export default function PdfHeader({
  title,
  ciclo,
  filtros,
  resumen,
}: {
  title: string;
  ciclo: CicloPayload;
  filtros?: Filtros;
  resumen?: Resumen;
}) {
  const idioma = headPrettyEnum(ciclo?.idioma ?? (filtros?.idioma ?? ""), M_IDIOMA);
  const modalidad = headPrettyEnum(ciclo?.modalidad ?? null, M_MODALIDAD);
  const nivel = headPrettyEnum(ciclo?.nivel ?? null, M_NIVEL);
  const modAsistencia = headPrettyEnum(ciclo?.modalidad_asistencia ?? null, M_ASISTENCIA);
  const aula = ciclo?.aula || null;

  const cursoRango = `${formatISODateToDMY(ciclo?.curso_inicio)} – ${formatISODateToDMY(ciclo?.curso_fin)}`;
  const diasTxt = joinDias(ciclo?.dias);
  const hi = formatSqlTime(ciclo?.hora_inicio);
  const hf = formatSqlTime(ciclo?.hora_fin);
  const horario = (diasTxt ? diasTxt : "") + (hi || hf ? `${diasTxt ? " · " : ""}${orDash(hi)} – ${orDash(hf)}` : "");
  const docenteNombre = (ciclo?.docente && ciclo?.docente?.nombre) || (ciclo?.docente_nombre ?? "—");

  return (
    <div className="pdf-header px-4 pt-4 pb-2 text-[11px] text-black">
      {/* Título + emisión */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="pdf-title text-[15px] font-semibold leading-tight">{title}</h2>
        <div className="pdf-subtitle text-[10px]"><strong>Fecha de emisión:</strong> {nowEmitido()}</div>
      </div>

      {/* ===== TABLA estable (una sola línea por celda) ===== */}
      <table className="w-full table-fixed mt-2 text-[11px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
        <tbody>
          {/* Fila 1: sin Aula */}
          <tr className="align-baseline">
            <td className="pr-3 whitespace-nowrap" style={{ width: "30%" }}>
              <Meta label="Curso" value={orDash(ciclo?.codigo)} />
            </td>
            <td className="pr-3 whitespace-nowrap" style={{ width: "14%" }}>
              <Meta label="Idioma" value={idioma} />
            </td>
            <td className="pr-3 whitespace-nowrap" style={{ width: "14%" }}>
              <Meta label="Nivel" value={nivel} />
            </td>
            <td className="pr-3 whitespace-nowrap" style={{ width: "21%" }}>
              <Meta label="Modalidad" value={modalidad} />
            </td>
            <td className="pr-0 whitespace-nowrap" style={{ width: "21%" }}>
              <Meta label="Asistencia" value={modAsistencia} />
            </td>
          </tr>

          {/* Fila 2: Curso (inicio–fin) · Aula · Horario */}
          <tr className="align-baseline">
            <td className="pr-3 whitespace-nowrap" style={{ width: "36%" }}>
              <Meta label="Periodo" value={cursoRango} />
            </td>
            <td className="pr-3 whitespace-nowrap" style={{ width: "8%" }}>
              <Meta label="Aula" value={orDash(aula)} />
            </td>
            <td className="pr-0 whitespace-nowrap" style={{ width: "56%" }} colSpan={3}>
              <Meta label="Horario" value={horario || "—"} />
            </td>
          </tr>

          {/* Fila 3: Docente */}
          <tr className="align-baseline">
            <td className="pr-0 whitespace-nowrap" style={{ width: "100%" }} colSpan={5}>
              <Meta label="Docente" value={docenteNombre || "—"} />
            </td>
          </tr>
        </tbody>
      </table>

      {resumen && (
        <>
          <Separator className="my-2" />
          <div className="pdf-chips-wrap flex flex-wrap gap-2">
            <span className="pdf-chip"><strong>Total:</strong> {resumen.total}</span>
            <span className="pdf-chip"><strong>Validados:</strong> {resumen.validado}</span>
            <span className="pdf-chip"><strong>Pendientes:</strong> {resumen.pendiente}</span>
            <span className="pdf-chip"><strong>Rechazados:</strong> {resumen.rechazado}</span>
            <span className="pdf-chip">
              <strong>Suma validado:</strong>{" "}
              {new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(resumen.sumaValidadoMXN)}
            </span>
          </div>
        </>
      )}

      <Separator className="mt-2" />
    </div>
  );
}
