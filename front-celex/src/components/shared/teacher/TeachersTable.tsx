"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Teacher } from "@/lib/types";

export default function TeachersTable({
  items,
  loading,
  onSuspend,
}: {
  items: Teacher[];
  loading?: boolean;
  onSuspend: (id: string | number) => void;
}) {
  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500">
        Cargando docentes…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500">
        No hay docentes registrados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Correo</th>
            <th className="px-3 py-2">CURP</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="px-3 py-2">{t.first_name} {t.last_name}</td>
              <td className="px-3 py-2">{t.email}</td>
              <td className="px-3 py-2">{t.curp}</td>
              <td className="px-3 py-2">
                {t.status === "activo" && <Badge>Activo</Badge>}
                {t.status === "invitado" && <Badge variant="secondary">Invitado</Badge>}
                {t.status === "suspendido" && <Badge variant="destructive">Suspendido</Badge>}
              </td>
              <td className="px-3 py-2 text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-red-600">
                      Deshabilitar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deshabilitar docente</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Seguro que deseas deshabilitar a <strong>{t.first_name} {t.last_name}</strong>?
                        Podrá reactivarse más tarde desde el panel (cuando implementes esa acción).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <Button
                        variant="destructive"
                        onClick={() => onSuspend(t.id)}
                      >
                        Deshabilitar
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
