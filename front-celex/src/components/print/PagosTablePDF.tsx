"use client";

import * as React from "react";

type PagoRow = {
  fecha_pago?: string | null;
  referencia?: string | null;
  importe_mxn?: number | null;
  alumno?: string | null;
  tipo?: string | null;
};

export function PagosTablePDF({ rows }: { rows: PagoRow[] }) {
  return (
    <div className="avoid-break">
      <table className="pdf-table">
        <colgroup>
          <col style={{ width: "18%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>

        <thead>
          <tr>
            <th className="nowrap">Fecha pago</th>
            <th>Referencia</th>
            <th className="text-right">Importe</th>
            <th>Alumno</th>
            <th>Tipo</th>
          </tr>
        </thead>

        <tbody>
          {rows?.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                <td className="nowrap">{formatFechaPago(r.fecha_pago)}</td>
                <td>{r.referencia ?? "—"}</td>
                <td className="text-right">{formatMXN(r.importe_mxn)}</td>
                <td>{r.alumno ?? "—"}</td>
                <td className="nowrap">{prettyTipo(r.tipo)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "10px 0" }}>
                Sin registros
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* Helpers */
function formatMXN(v?: number | null) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);
  } catch {
    return String(v);
  }
}
function formatFechaPago(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const dd = String(d.getDate()).padStart(2, "0");
  const m = meses[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${m}/${yyyy} ${hh}:${mm}`;
}
function prettyTipo(raw?: string | null) {
  if (!raw) return "—";
  const token = raw.includes(".") ? raw.split(".").pop()! : raw;
  const t = token.toLowerCase();
  const map: Record<string, string> = {
    pago: "Pago",
    exencion: "Exención",
    exencion_validado: "Exención",
    pago_validado: "Pago",
    deposito: "Depósito",
    transferencia: "Transferencia",
  };
  return map[t] ?? token.charAt(0).toUpperCase() + token.slice(1);
}
