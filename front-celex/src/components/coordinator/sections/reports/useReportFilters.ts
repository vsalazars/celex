"use client";

import { useMemo, useState } from "react";

export type Idioma = "ingles" | "frances" | "aleman";

export type CicloLite = {
  id: string | number;
  codigo: string;
  idioma?: string | Idioma | null;
  anio?: number | null;
};

export type ReportFiltersState = {
  anio: string;           // "" = sin selección
  idioma: string;         // "" = sin selección
  cicloId: string;        // "" = sin selección

  setAnio: (v: string) => void;
  setIdioma: (v: string) => void;
  setCicloId: (v: string) => void;

  ciclos: CicloLite[];
  setCiclos: (c: CicloLite[]) => void;

  loadingCiclos: boolean;
  setLoadingCiclos: (b: boolean) => void;

  error: string | null;
  setError: (e: string | null) => void;

  aniosList: string[];
};

export function useReportFilters(): ReportFiltersState {
  const [anio, setAnio] = useState<string>("");       // controlado
  const [idioma, setIdioma] = useState<string>("");   // controlado
  const [cicloId, setCicloId] = useState<string>(""); // controlado

  const [ciclos, setCiclos] = useState<CicloLite[]>([]);
  const [loadingCiclos, setLoadingCiclos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aniosList = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }).map((_, i) => String(now - i));
  }, []);

  return {
    anio,
    idioma,
    cicloId,
    setAnio,
    setIdioma,
    setCicloId,
    ciclos,
    setCiclos,
    loadingCiclos,
    setLoadingCiclos,
    error,
    setError,
    aniosList,
  };
}
