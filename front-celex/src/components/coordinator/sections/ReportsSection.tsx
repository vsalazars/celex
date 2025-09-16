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
import ReportPagosExamen from "./reports/ReportPagosExamen";
import { useReportFilters } from "./reports/useReportFilters";
import type { Idioma } from "./reports/useReportFilters";
import {
  ClipboardList,
  CreditCard,
  BarChart3,
  GraduationCap,
  ReceiptText,
} from "lucide-react";

type ReportKey = "alumnos" | "pagos" | "pagos_examen" | "encuesta" | "desempeno";

export default function ReportsSection() {
  const filters = useReportFilters();
  const [active, setActive] = useState<ReportKey>("alumnos");
  const [docenteId, setDocenteId] = useState<string>("");
  const [examCode, setExamCode] = useState<string>(""); // código de examen para pagos_examen

  const tabBtn = (key: ReportKey, label: React.ReactNode, Icon: any) => (
    <Button
      key={key}
      variant={active === key ? "default" : "outline"}
      onClick={() => setActive(key)}
      className={cn("rounded-full justify-center gap-2", "w-[260px] h-10")}
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
            {tabBtn("pagos_examen", "Pagos Examen de Colocación", ReceiptText)}
            {tabBtn("encuesta", "Encuesta", BarChart3)}
            {tabBtn("desempeno", "Desempeño Docente", GraduationCap)}
          </div>

          <Separator />

          <FiltersBar
            {...filters}
            mode={
              active === "desempeno"
                ? "docente"
                : active === "pagos_examen"
                ? "examen" // en pagos_examen mostramos selector de examen
                : "ciclos"
            }
            docenteId={docenteId}
            setDocenteId={setDocenteId}
            // Props para modo "examen"
            examCode={examCode}
            setExamCode={setExamCode}
          />
        </CardContent>
      </Card>

      {active === "alumnos" ? (
        <ReportAlumnos filters={filters} />
      ) : active === "pagos" ? (
        <ReportPagos filters={filters} />
      ) : active === "pagos_examen" ? (
        <ReportPagosExamen
          anio={filters.anio}
          idioma={filters.idioma as Idioma | ""}
          examCode={examCode}
        />
      ) : active === "encuesta" ? (
        <ReportEncuestaNivo filters={filters} />
      ) : (
        <ReportDesempenoDocente docenteId={docenteId} />
      )}
    </div>
  );
}
