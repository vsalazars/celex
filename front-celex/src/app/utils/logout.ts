"use client";

export async function logout(redirectTo: string = "/") {
  try {
    // borra cookies httpOnly en servidor
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {}
  try {
    // limpia storage del cliente (no sensible)
    localStorage.removeItem("celex_token");
    localStorage.removeItem("celex_role");
    localStorage.removeItem("celex_email");
    // por si quedaron cookies NO httpOnly de ambientes previos
    document.cookie = "celex_role=; path=/; max-age=0; samesite=lax";
    document.cookie = "celex_token=; path=/; max-age=0; samesite=lax";
  } catch {}
  window.location.replace(redirectTo);
}
