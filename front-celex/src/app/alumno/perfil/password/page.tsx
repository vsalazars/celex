"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import RequireAuth from "@/components/RequireAuth";
import AlumnoShell from "@/components/alumno/Shell";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { changeAlumnoPassword } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  current_password: z.string().min(6, "Mínimo 6 caracteres"),
  new_password: z.string().min(8, "Mínimo 8 caracteres"),
  confirm_new_password: z.string().min(8, "Mínimo 8 caracteres"),
}).refine((d) => d.new_password === d.confirm_new_password, {
  message: "La confirmación no coincide",
  path: ["confirm_new_password"],
});

type FormData = z.infer<typeof schema>;

export default function Page() {
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: {
    current_password: "",
    new_password: "",
    confirm_new_password: "",
  }});

  const onSubmit = async (values: FormData) => {
    try {
      await changeAlumnoPassword(values);
      toast.success("Contraseña actualizada correctamente");
      form.reset();
    } catch (err: any) {
      const msg = err?.message ?? "No se pudo cambiar la contraseña";
      toast.error(msg);
    }
  };

  return (
    <RequireAuth roles={["student"]}>
      <AlumnoShell>
        <div className="max-w-2xl">
          <div className="mb-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/alumno/perfil"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al perfil</Link>
            </Button>
          </div>

          <Card className="border">
            <CardHeader>
              <CardTitle>Cambiar contraseña</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="current_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña actual</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="new_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nueva contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="pt-2">
                    <Button type="submit">Guardar</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </AlumnoShell>
    </RequireAuth>
  );
}
