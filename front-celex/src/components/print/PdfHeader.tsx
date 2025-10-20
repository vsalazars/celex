"use client";

import React from "react";
import { Separator } from "@/components/ui/separator";

type DocenteMini = { id?: number | string; nombre?: string } | null;

type CicloPayload = {
  id?: number | string;
  codigo?: string;

  // Enums (pueden venir como "Enum.valor" o solo "valor")
  idioma?: string | null;
  modalidad?: string | null;
  turno?: string | null;
  nivel?: string | null;

  // Horario
  dias?: string[] | null;        // ['lunes','miercoles']
  hora_inicio?: string | null;   // "HH:MM[:SS]" (SQL Time)
  hora_fin?: string | null;      // "HH:MM[:SS]"

  // Fechas de curso
  curso_inicio?: string | null;  // ISO "YYYY-MM-DD"
  curso_fin?: string | null;     // ISO "YYYY-MM-DD"

  // Extra del modelo
  modalidad_asistencia?: string | null; // Enum
  aula?: string | null;

  // Docente
  docente?: DocenteMini;
  docente_nombre?: string | null;
};

type Filtros = {
  anio?: number | string | null;
  idioma?: string | null;
};

type Resumen = {
  total: number;
  validado: number;
  pendiente: number;
  rechazado: number;
  sumaValidadoMXN: number; // en MXN
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

const M_NIVEL: Record<string, string> = {
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const M_ASISTENCIA: Record<string, string> = {
  presencial: "Presencial",
  en_linea: "En línea",
  mixta: "Mixta",
};

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

function orDash(v?: any) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

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
  const turno = headPrettyEnum(ciclo?.turno ?? null, M_TURNO);
  const nivel = headPrettyEnum(ciclo?.nivel ?? null, M_NIVEL);
  const modAsistencia = headPrettyEnum(ciclo?.modalidad_asistencia ?? null, M_ASISTENCIA);
  const aula = ciclo?.aula || null;

  const cursoRango = `${formatISODateToDMY(ciclo?.curso_inicio)} – ${formatISODateToDMY(ciclo?.curso_fin)}`;
  const diasTxt = joinDias(ciclo?.dias);
  const hi = formatSqlTime(ciclo?.hora_inicio);
  const hf = formatSqlTime(ciclo?.hora_fin);
  const horario =
    (diasTxt ? diasTxt : "") +
    (hi || hf ? `${diasTxt ? " · " : ""}${orDash(hi)} – ${orDash(hf)}` : "");
  const docenteNombre =
    (ciclo?.docente && ciclo?.docente?.nombre) ||
    (ciclo?.docente_nombre ?? "—");

  return (
    <div className="pdf-header px-4 pt-4 pb-2 text-[11px] text-black">
      {/* Título + emisión (línea única, compacto) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="pdf-title text-[15px] font-semibold leading-tight">{title}</h2>
        <div className="pdf-subtitle text-[10px]">
          <strong>Fecha de emisión:</strong> {nowEmitido()}
        </div>
      </div>

      {/* Meta compacta en una sola rejilla (etiqueta: valor) */}
      <div className="pdf-meta-grid mt-2">
        <div><span className="pdf-meta-label">Ciclo:</span> <span className="pdf-meta-value">{orDash(ciclo?.codigo)}</span></div>
        <div><span className="pdf-meta-label">Idioma:</span> <span className="pdf-meta-value">{idioma}</span></div>
        <div><span className="pdf-meta-label">Modalidad:</span> <span className="pdf-meta-value">{modalidad}</span></div>
        <div><span className="pdf-meta-label">Turno:</span> <span className="pdf-meta-value">{turno}</span></div>
        <div><span className="pdf-meta-label">Nivel:</span> <span className="pdf-meta-value">{nivel}</span></div>
        <div><span className="pdf-meta-label">Curso (inicio–fin):</span> <span className="pdf-meta-value">{cursoRango}</span></div>
        <div className="col-span-2">
          <span className="pdf-meta-label">Horario:</span>{" "}
          <span className="pdf-meta-value">{horario || "—"}</span>
        </div>
        <div><span className="pdf-meta-label">Asistencia:</span> <span className="pdf-meta-value">{modAsistencia}</span></div>
        <div><span className="pdf-meta-label">Aula:</span> <span className="pdf-meta-value">{orDash(aula)}</span></div>
        <div className="col-span-2">
          <span className="pdf-meta-label">Docente:</span>{" "}
          <span className="pdf-meta-value">{docenteNombre || "—"}</span>
        </div>
      </div>

      {/* Resumen como chips compactos */}
      {resumen && (
        <>
          <Separator className="my-2" />
          <div className="pdf-chips-wrap">
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
