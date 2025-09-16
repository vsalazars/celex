"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Info,
  GraduationCap,
  BookOpen,
  Phone,
  Mail,
  Clock,
  Link as LinkIcon,
  Coins,
  Ticket,
  Users,
} from "lucide-react";

type InfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children?: ReactNode;
  className?: string;
};

export default function InfoDialog({
  open,
  onOpenChange,
  title = "Información",
  children,
  className,
}: InfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "rounded-2xl shadow-xl",
          // ancho responsivo
          "w-[min(92vw,64rem)] sm:max-w-3xl md:max-w-5xl",
          className || "",
        ].join(" ")}
      >
        {/* Header compacto */}
        <DialogHeader className="space-y-1.5 pb-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Info className="h-4.5 w-4.5" />
            </span>
            <DialogTitle className="text-lg tracking-tight">{title}</DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5">
              <GraduationCap className="h-3.5 w-3.5 text-neutral-500" />
              CELEX · CECyT 15
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">
              <BookOpen className="h-3.5 w-3.5" />
              Lineamientos IPN
            </span>
          </div>
        </DialogHeader>

        <DialogDescription asChild>
          {/* Contenido con menor separación global */}
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {children ?? (
              // items-stretch garantiza que las celdas de la fila se estiren a la misma altura
              <div className="mt-3 grid gap-4 md:grid-cols-5 items-stretch">
                {/* Descripción */}
                <section className="md:col-span-3">
                  <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-3">
                    <p className="text-sm text-neutral-800 leading-snug">
                      Los <b>Cursos Extracurriculares de Lenguas Extranjeras (CELEX)</b> del
                      <b> CECyT 15 “Diódoro Antúnez Echegaray”</b> ofrece la enseñanza del idioma <b>Inglés</b>; CELEX
                      desarrolla <b>habilidades comunicativas</b> que impulsan la <b>Formación Integral Académica</b> del
                      estudiante, fortaleciendo <b>competencias profesionales</b>; apoyando la <b>Titulación de Estudios
                      Superiores</b> y permitiendo tener una mejor <b>Oportunidad Laboral</b>.
                    </p>
                  </div>
                </section>

                {/* Lineamientos */}
                <section className="md:col-span-2">
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <h4 className="text-[13px] font-semibold text-neutral-800">
                      Lineamientos para la enseñanza de las Lenguas Extranjeras en el IPN
                      <span className="block text-[11px] font-normal text-neutral-500">
                        (Publicados en la Gaceta Politécnica)
                      </span>
                    </h4>

                    <div className="mt-2 rounded-lg border-l-4 border-indigo-300 bg-indigo-50/60 p-2">
                      <p className="text-[12.5px] font-medium text-indigo-800">
                        VII. De la Comunidad Politécnica
                      </p>
                    </div>

                    <ol className="mt-2 list-decimal space-y-2 pl-5 marker:text-indigo-600">
                      <li className="text-sm leading-snug text-neutral-800">
                        Prioridad en servicios CENLEX y CELEX para alumnos, egresados, personal académico, de apoyo y directivo del IPN.
                      </li>
                      <li className="text-sm leading-snug text-neutral-800">
                        Cuotas conforme al Catálogo autorizado por la SHCP, según año fiscal aplicable.
                      </li>
                      <li className="text-sm leading-snug text-neutral-800">
                        Gratuidad de cursos en CENLEX hasta tres por trabajador y beneficiarios (condiciones IPN y COFAA).
                      </li>
                      <li className="text-sm leading-snug text-neutral-800">
                        Las prestaciones se pierden una a una por reprobación o baja por faltas del módulo.
                      </li>
                    </ol>
                  </div>
                </section>

                {/* === Fila con DOS TARJETAS DE MISMA ALTURA === */}
                {/* Coordinación y contacto */}
                <section className="md:col-span-3">
                  <div className="h-full rounded-xl border border-neutral-200 bg-white p-3 flex flex-col">
                    <h4 className="text-[13px] font-semibold text-neutral-900 mb-2">Coordinación General</h4>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[14px]">
                        Dra. en Ed. Janett Velasco de la Peña
                      </Badge>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm text-neutral-700">
                        <Phone className="h-4 w-4 text-neutral-500" />
                        <a className="hover:underline" href="tel:+525556242000">55 5624 2000</a>
                        <span className="text-neutral-400">·</span>
                        <span>Ext. 72511</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-neutral-700">
                        <Mail className="h-4 w-4 text-neutral-500" />
                        <a className="hover:underline" href="mailto:celexcecyt15@ipn.mx">celexcecyt15@ipn.mx</a>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-neutral-700">
                        <Mail className="h-4 w-4 text-neutral-500" />
                        <a className="hover:underline" href="mailto:celex15dae@gmail.com">celex15dae@gmail.com</a>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-neutral-700">
                        <LinkIcon className="h-4 w-4 text-neutral-500" />
                        <a
                          className="hover:underline"
                          href="https://www.facebook.com/celex15dae/?locale=es_LA"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Facebook: <b>Celex 15 DAE Oficial</b>
                        </a>
                      </div>
                    </div>

                    {/* Empuja el contenido para usar toda la altura si es necesario */}
                    <div className="mt-auto" />
                  </div>
                </section>

                {/* Horarios (misma altura gracias a h-full) */}
                <section className="md:col-span-2">
                  <div className="h-full rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex flex-col">
                    <h4 className="text-[13px] font-semibold text-emerald-900">Horarios de atención</h4>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-700" />
                        <div className="text-sm text-neutral-800">
                          Lunes a Viernes: <b>11:00–17:00</b>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-700" />
                        <div className="text-sm text-neutral-800">
                          Sábado: <b>08:00–16:00</b>
                        </div>
                      </div>
                    </div>

                    {/* Relleno para igualar alturas si el otro bloque crece */}
                    <div className="mt-auto" />
                  </div>
                </section>
                {/* === /fin fila de misma altura === */}

                {/* Cuotas (tarjetas densas) */}
                <section className="md:col-span-5">
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[13px] font-semibold text-neutral-900">Cuotas vigentes</h4>
                      <span className="text-[10.5px] text-neutral-500">Sujetos a cambio sin previo aviso</span>
                    </div>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-3">
                        <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-600">
                          <Coins className="h-4 w-4 text-amber-600" />
                          Público general
                        </div>
                        <div className="mt-1.5 text-sm font-medium text-neutral-700">Introductorio y Básico</div>
                        <div className="mt-0.5 text-xl font-semibold tracking-tight">$1,200</div>
                      </div>

                      <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-3">
                        <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-600">
                          <Coins className="h-4 w-4 text-amber-600" />
                          Público general
                        </div>
                        <div className="mt-1.5 text-sm font-medium text-neutral-700">Intermedio y Avanzado</div>
                        <div className="mt-0.5 text-xl font-semibold tracking-tight">$1,300</div>
                      </div>

                      <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-3">
                        <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-600">
                          <Ticket className="h-4 w-4 text-blue-600" />
                          Examen de colocación
                        </div>
                        <div className="mt-1.5 text-sm font-medium text-neutral-700">Único pago</div>
                        <div className="mt-0.5 text-xl font-semibold tracking-tight">$160</div>
                      </div>

                      <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-3">
                        <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-600">
                          <Users className="h-4 w-4 text-emerald-700" />
                          Comunidad IPN
                        </div>
                        <div className="mt-1.5 text-sm font-medium text-neutral-700">Todos los niveles</div>
                        <div className="mt-0.5 text-xl font-semibold tracking-tight">$620</div>
                      </div>
                    </div>
                  </div>
                </section>

               
              </div>
            )}
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
