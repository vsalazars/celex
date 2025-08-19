// src/lib/session.ts
export type SessionData = {
  access_token: string;
  role: string;
  email: string;
  nombre?: string;
  curp?: string;
  is_ipn?: boolean;
  boleta?: string | null;
};

export function setSession(data: SessionData) {
  localStorage.setItem("celex_token", data.access_token);
  localStorage.setItem("celex_role", data.role ?? "");
  localStorage.setItem("celex_email", data.email ?? "");
  localStorage.setItem("celex_nombre", data.nombre ?? "");
  localStorage.setItem("celex_curp", data.curp ?? "");
  localStorage.setItem("celex_is_ipn", String(!!data.is_ipn));
  localStorage.setItem("celex_boleta", data.boleta ?? "");
}

export function clearSession() {
  localStorage.removeItem("celex_token");
  localStorage.removeItem("celex_role");
  localStorage.removeItem("celex_email");
  localStorage.removeItem("celex_nombre");
  localStorage.removeItem("celex_curp");
  localStorage.removeItem("celex_is_ipn");
  localStorage.removeItem("celex_boleta");
}

export function getSession() {
  const token = localStorage.getItem("celex_token");
  const role = localStorage.getItem("celex_role");
  const email = localStorage.getItem("celex_email");
  const nombre = localStorage.getItem("celex_nombre") || "";
  const curp = localStorage.getItem("celex_curp") || "";
  const is_ipn = localStorage.getItem("celex_is_ipn") === "true";
  const boleta = localStorage.getItem("celex_boleta") || "";
  return { token, role, email, nombre, curp, is_ipn, boleta };
}
