"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import FiltersBar from "./reports/FiltersBar";
import ReportAlumnos from "./reports/ReportAlumnos";
import ReportPagos from "./reports/ReportPagos";
import ReportEncuestaNivo from "./reports/ReportEncuestaNivo";
import ReportDesempenoDocente from "./reports/ReportDesempenoDocente";
import ReportPagosExamen from "./reports/ReportPagosExamen"; // ← nuevo componente
import { useReportFilters } from "./reports/useReportFilters";
import {
  ClipboardList,
  CreditCard,
  BarChart3,
  GraduationCap,
  FileCheck, // ícono sugerido para el examen
} from "lucide-react";

type ReportKey =
  | "alumnos"
  | "pagos"
  | "pagos_examen"
  | "encuesta"
  | "desempeno";

export default function ReportsSection() {
  const filters = useReportFilters();
  const [active, setActive] = useState<ReportKey>("alumnos");
  const [docenteId, setDocenteId] = useState<string>("");

  const tabBtn = (key: ReportKey, label: React.ReactNode, Icon: any) => (
    <Button
      key={key}
      variant={active === key ? "default" : "outline"}
      onClick={() => setActive(key)}
      className={cn(
        "rounded-full justify-center gap-2",
        "min-w-[220px] h-10" // mismo tamaño para todos
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {tabBtn("alumnos", "Alumnos inscritos", ClipboardList)}
            {tabBtn("pagos", "Pagos", CreditCard)}
            {tabBtn("pagos_examen", "Pagos Examen de Colocación", FileCheck)}
            {tabBtn("encuesta", "Encuesta", BarChart3)}
            {tabBtn("desempeno", "Desempeño Docente", GraduationCap)}
          </div>

          <Separator />

          <FiltersBar
            {...filters}
            mode={active === "desempeno" ? "docente" : "ciclos"}
            docenteId={docenteId}
            setDocenteId={setDocenteId}
          />
        </CardContent>
      </Card>

      {active === "alumnos" ? (
        <ReportAlumnos filters={filters} />
      ) : active === "pagos" ? (
        <ReportPagos filters={filters} />
      ) : active === "pagos_examen" ? (
        <ReportPagosExamen filters={filters} />
      ) : active === "encuesta" ? (
        <ReportEncuestaNivo filters={filters} />
      ) : (
        <ReportDesempenoDocente docenteId={docenteId} />
      )}
    </div>
  );
}
