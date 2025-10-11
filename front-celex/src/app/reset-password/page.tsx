"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { resetPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = (sp.get("token") || "").trim();

  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error("Token faltante o inválido");
    if (pwd1.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (pwd1 !== pwd2) return toast.error("La confirmación no coincide");

    setLoading(true);
    try {
      await resetPassword({
        token,
        new_password: pwd1,
        confirm_new_password: pwd2,
      });
      toast.success("Tu contraseña fue restablecida. Ya puedes iniciar sesión.");
      router.push("/");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-800">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 shadow-lg rounded-2xl p-8 border border-neutral-200 dark:border-neutral-800 text-center">
        <div className="mb-6">
          <div className="mx-auto w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
          </div>
          <h1 className="text-2xl font-semibold mb-1">Restablecer contraseña</h1>
          <p className="text-sm text-neutral-500">
            Ingresa tu nueva contraseña. El enlace expira en pocos minutos.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 text-left">
          {/* Contraseña nueva */}
          <div>
            <Label htmlFor="pwd1">Nueva contraseña</Label>
            <div className="relative mt-1">
              <Input
                id="pwd1"
                type={showPwd1 ? "text" : "password"}
                value={pwd1}
                onChange={(e) => setPwd1(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd1(!showPwd1)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-700"
                tabIndex={-1}
              >
                {showPwd1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div>
            <Label htmlFor="pwd2">Confirmar contraseña</Label>
            <div className="relative mt-1">
              <Input
                id="pwd2"
                type={showPwd2 ? "text" : "password"}
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd2(!showPwd2)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-700"
                tabIndex={-1}
              >
                {showPwd2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-4 font-medium"
          >
            {loading ? "Guardando…" : "Restablecer contraseña"}
          </Button>
        </form>

        <p className="text-xs text-neutral-400 mt-6">
          © {new Date().getFullYear()} CELEX CECyT 15 — IPN
        </p>
      </div>
    </div>
  );
}
