"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Users2, Star, GraduationCap, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDocenteOverview } from "@/lib/api";

type State = {
  grupos_activos: number;
  alumnos_total: number;
  satisfaccion_promedio: number;
  ultimo_grupo: string | null;
};

export default function OverviewSection() {
  const [stats, setStats] = useState<State | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  async function load() {
    try {
      const data = await getDocenteOverview();
      setStats({
        grupos_activos: data.grupos_activos ?? 0,
        alumnos_total: data.alumnos_total ?? 0,
        satisfaccion_promedio: data.satisfaccion_promedio ?? 0,
        ultimo_grupo: data.ultimo_grupo ?? null,
      });
    } catch (err: any) {
      toast.error(err?.message || "No se pudo cargar el resumen del docente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#7c0040]">Resumen</h2>
          <p className="text-sm text-neutral-600">Vista general de tu actividad docente.</p>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
          disabled={refreshing}
          title="Actualizar"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
        {/* Grupos activos */}
        <KpiCard
          icon={<BookOpen className="h-5 w-5 text-[#7c0040]" />}
          label="Grupos activos"
          value={stats?.grupos_activos ?? 0}
          loading={loading}
        />

        {/* Alumnos inscritos */}
        <KpiCard
          icon={<Users2 className="h-5 w-5 text-[#7c0040]" />}
          label="Alumnos inscritos"
          value={stats?.alumnos_total ?? 0}
          loading={loading}
        />

        {/* Satisfacción global (0..10) */}
        <KpiCard
          icon={<Star className="h-5 w-5 text-[#7c0040]" />}
          label="Satisfacción global"
          value={
            stats ? Number(stats.satisfaccion_promedio).toFixed(1) : "0.0"
          }
          loading={loading}
        />

        {/* Último grupo evaluado */}
        <Card className="border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-4 text-center">
            <GraduationCap className="h-5 w-5 text-[#7c0040]" />
            {loading ? (
              <div className="mt-1 h-4 w-40 animate-pulse rounded bg-neutral-200" />
            ) : (
              <div className="text-sm font-semibold text-[#7c0040] mt-1">
                {stats?.ultimo_grupo || "—"}
              </div>
            )}
            <div className="text-xs text-neutral-500">Último grupo evaluado</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  value,
  label,
  loading,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  loading?: boolean;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-4">
        {icon}
        {loading ? (
          <div className="mt-1 h-7 w-10 animate-pulse rounded bg-neutral-200" />
        ) : (
          <div className="text-2xl font-bold text-[#7c0040]">{value}</div>
        )}
        <div className="text-xs text-neutral-500">{label}</div>
      </CardContent>
    </Card>
  );
}
