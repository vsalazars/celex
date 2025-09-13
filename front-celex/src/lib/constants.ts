// src/lib/constants.ts

// URL base de la API (obligatoria vía env)
const rawApi = process.env.NEXT_PUBLIC_API_URL;
if (!rawApi) {
  // Falla claramente en dev si olvidaste definir la env
  throw new Error("NEXT_PUBLIC_API_URL no está definida (.env.local)");
}

function normalizeBase(u: string) {
  const s = String(u).trim();
  // Debe traer protocolo válido
  if (!/^https?:\/\//i.test(s)) {
    throw new Error(
      `NEXT_PUBLIC_API_URL debe incluir protocolo (http/https). Valor: "${s}"`
    );
  }
  // Sin trailing slash
  return s.replace(/\/+$/, "");
}

export const API_URL = normalizeBase(rawApi);

// Aviso en cliente si hay mixed content (app https llamando API http)
if (typeof window !== "undefined") {
  const isAppHttps = window.location.protocol === "https:";
  const isApiHttp = /^http:\/\//i.test(API_URL);
  if (isAppHttps && isApiHttp) {
    // No lanzamos error para no tumbar toda la app, pero dejamos un warning claro
    // (si prefieres, cámbialo por throw new Error(...) para fallar duro en prod)
    console.warn(
      `[CELEX] Mixed content: la app corre en HTTPS y la API es HTTP (${API_URL}). ` +
        `El navegador bloqueará las peticiones. Usa HTTPS en la API o un proxy del mismo origen.`
    );
  }
}

// Validaciones reusables
export const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const CURP_REGEX =
  /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/i;
export const BOLETA_REGEX = /^\d{10}$/;

// Carpeta relativa donde se sirven los archivos estáticos (comprobantes, estudios, exenciones)
export const UPLOADS_BASE_URL = `${API_URL}/uploads`;
