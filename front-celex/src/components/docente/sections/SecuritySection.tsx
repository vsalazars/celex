"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { changeTeacherPassword } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

type PasswordFormValues = {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
};

export default function SecuritySection() {
  const form = useForm<PasswordFormValues>({
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_new_password: "",
    },
    mode: "onChange",
  });

  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);

  async function onSubmit(values: PasswordFormValues) {
    if (!values.current_password || values.current_password.length < 6) {
      form.setError("current_password", { type: "manual", message: "Contraseña actual inválida" });
      toast.error("Revisa tu contraseña actual.");
      return;
    }
    if (!values.new_password || values.new_password.length < 8) {
      form.setError("new_password", { type: "manual", message: "Mínimo 8 caracteres" });
      toast.error("La nueva contraseña es muy corta.");
      return;
    }
    if (values.new_password === values.current_password) {
      form.setError("new_password", { type: "manual", message: "Debe ser distinta a la actual" });
      toast.error("La nueva contraseña debe ser distinta.");
      return;
    }
    if (values.new_password !== values.confirm_new_password) {
      form.setError("confirm_new_password", { type: "manual", message: "No coincide" });
      toast.error("La confirmación no coincide.");
      return;
    }

    try {
      await changeTeacherPassword(values);
      toast.success("Contraseña actualizada correctamente.");
      form.reset();
    } catch (err: any) {
      const msg = err?.message || "No se pudo cambiar la contraseña.";
      if (/actual no es correcta/i.test(msg)) {
        form.setError("current_password", { type: "server", message: "La contraseña actual no es correcta." });
      }
      toast.error(msg);
    }
  }

  const inputClass = "h-11 text-[15px]";

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Seguridad</h2>
      <p className="text-sm text-neutral-600">Contraseña y sesiones activas.</p>

      <div className="rounded-2xl border bg-white p-4 space-y-4">
        <h3 className="text-base font-semibold">Cambiar contraseña</h3>
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="current_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña actual</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        className={inputClass + " pr-10"}
                        type={showCur ? "text" : "password"}
                        placeholder="Tu contraseña actual"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowCur((v) => !v)}
                      className="absolute inset-y-0 right-2 inline-flex items-center"
                    >
                      {showCur ? <EyeOff className="h-4 w-4 text-neutral-500" /> : <Eye className="h-4 w-4 text-neutral-500" />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          className={inputClass + " pr-10"}
                          type={showNew ? "text" : "password"}
                          placeholder="Mínimo 8 caracteres"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowNew((v) => !v)}
                        className="absolute inset-y-0 right-2 inline-flex items-center"
                      >
                        {showNew ? <EyeOff className="h-4 w-4 text-neutral-500" /> : <Eye className="h-4 w-4 text-neutral-500" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm_new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nueva contraseña</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          className={inputClass + " pr-10"}
                          type={showConf ? "text" : "password"}
                          placeholder="Vuelve a escribirla"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowConf((v) => !v)}
                        className="absolute inset-y-0 right-2 inline-flex items-center"
                      >
                        {showConf ? <EyeOff className="h-4 w-4 text-neutral-500" /> : <Eye className="h-4 w-4 text-neutral-500" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button className="h-11 px-6 text-[15px]" type="button" onClick={form.handleSubmit(onSubmit)}>
                Cambiar contraseña
              </Button>
            </div>

            <p className="text-xs text-neutral-500">Sugerencia: usa una frase segura con más de 8 caracteres.</p>
          </div>
        </Form>
      </div>
    </div>
  );
}
