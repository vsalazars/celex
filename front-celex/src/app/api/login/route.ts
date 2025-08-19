// src/app/api/login/route.ts
import { NextResponse } from "next/server";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      const detail = data?.detail || data?.message || "No fue posible iniciar sesión";
      return NextResponse.json({ detail }, { status: res.status });
    }

    // 👇 Reenviamos todo lo que necesitamos al front
    return NextResponse.json(
      {
        access_token: data.access_token,
        token_type: data.token_type,
        role: data.role,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        curp: data.curp,
        is_ipn: data.is_ipn,     // 👈 NUEVO
        boleta: data.boleta,     // 👈 NUEVO
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ detail: "Error en el proxy de login" }, { status: 500 });
  }
}
