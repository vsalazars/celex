// src/lib/constants.ts

// URL base de la API (obligatoria vía env)
const api = process.env.NEXT_PUBLIC_API_URL;
if (!api) {
  // Falla claramente en dev si olvidaste definir la env
  throw new Error("NEXT_PUBLIC_API_URL no está definida (.env.local)");
}
export const API_URL = api;

// Validaciones reusables
export const EMAIL_REGEX  = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const CURP_REGEX   = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/i;
export const BOLETA_REGEX = /^\d{10}$/;

// Carpeta relativa donde se sirven los archivos estáticos (comprobantes, estudios, exenciones)
export const UPLOADS_BASE_URL = `${API_URL}/uploads`;
