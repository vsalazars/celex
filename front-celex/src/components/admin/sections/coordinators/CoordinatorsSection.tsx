"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCcw, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { CURP_REGEX } from "@/lib/constants";
import { listCoordinators, toggleCoordinatorStatus } from "@/lib/api";
import type { CoordItem, CoordResp } from "@/lib/types";
import CreateCoordinatorModal from "./CreateCoordinatorModal";

export default function CoordinatorsSection() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CoordResp | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const json = await listCoordinators({ q, page, page_size: pageSize });
      setData(json);
    } catch (e: any) {
      toast.error(e.message || "Fallo al listar coordinadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleToggle = async (user: CoordItem) => {
    const next = !user.is_active;
    try {
      await toggleCoordinatorStatus(user.id, next);
      toast.success(next ? "Coordinador habilitado" : "Coordinador deshabilitado");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Fallo al cambiar estado");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Coordinadores</h1>
          <p className="text-sm text-neutral-600">Búsqueda, paginación y habilitar/deshabilitar.</p>
        </div>
        <CreateCoordinatorModal onCreated={load} />
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Buscar por nombre, apellidos, email o CURP"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  load();
                }
              }}
            />
          </div>
          <Button
            onClick={() => {
              setPage(1);
              load();
            }}
            variant="secondary"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Buscar
          </Button>
        </div>

        <div className="text-sm text-neutral-500">
          {data ? <>Total: <span className="font-medium">{data.total}</span></> : <>Total: –</>}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>CURP</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <div className="inline-flex items-center gap-2 text-neutral-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.items.length > 0 ? (
                data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">
                        {u.first_name} {u.last_name}
                      </div>
                      <div className="text-xs text-neutral-500">ID: {u.id}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{u.curp}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {u.is_active ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant={u.is_active ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleToggle(u)}
                        className="gap-2"
                      >
                        {u.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                        {u.is_active ? "Deshabilitar" : "Habilitar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-neutral-500">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-3 py-3">
            <span className="text-sm text-neutral-600">
              Página {data.page} de {data.pages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages || loading}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
