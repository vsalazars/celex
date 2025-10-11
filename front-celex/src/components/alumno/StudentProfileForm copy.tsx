"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Mail,
  IdCard,
  BadgeCheck,
  Phone,
  MapPin,
  School,
  User,
  Users2,
  Hash,
  Building2,
  Globe,
} from "lucide-react";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

import { getAlumnoPerfil, updateAlumnoPerfil, type AlumnoPerfil } from "@/lib/student";
import { getSession } from "@/lib/sessions";

/* —————————————————————————————————————————————————————
   Helpers
————————————————————————————————————————————————————— */
const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/i;

function parseDOBFromCURP(curp: string): { dobISO: string; age: number } | null {
  const m = curp.match(/^[A-Z]{4}(\d{2})(\d{2})(\d{2})[HM][A-Z]{5}[A-Z0-9]{2}$/i);
  if (!m) return null;
  const [yy, mm, dd] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  const now = new Date();
  const currentYY = now.getFullYear() % 100;
  const fullYear = yy <= currentYY ? 2000 + yy : 1900 + yy;
  const dob = new Date(fullYear, mm - 1, dd);
  if (isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - fullYear;
  const hasHadBirthdayThisYear =
    now.getMonth() > (mm - 1) || (now.getMonth() === (mm - 1) && now.getDate() >= dd);
  if (!hasHadBirthdayThisYear) age -= 1;
  const dobISO = dob.toISOString().slice(0, 10);
  return { dobISO, age };
}

function splitNombre(full?: string): { nombre: string; apellidos: string } {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { nombre: "", apellidos: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { nombre: parts[0], apellidos: "" };
  const nombre = parts.slice(0, parts.length - 2).join(" ") || parts[0];
  const apellidos = parts.slice(parts.length - 2).join(" ");
  return { nombre, apellidos };
}

// Unidades IPN (lista acotada + "Otro")
const IPN_UNIDADES: Record<string, string[]> = {
  "Medio superior": [
    "CECyT 1","CECyT 2","CECyT 3","CECyT 4","CECyT 5","CECyT 6",
    "CECyT 7","CECyT 8","CECyT 9","CECyT 10","CECyT 11","CECyT 12",
    "CECyT 13","CECyT 14","CECyT 15","CET 1","Otro",
  ],
  Superior: [
    "ESCOM","ESIME Azcapotzalco","ESIME Zacatenco","ESIME Culhuacán",
    "UPIICSA","UPIITA","ESIA Zacatenco","ESIA Ticomán",
    "ESIQIE","ESFM","ESCA Santo Tomás","ESCA Tepepan",
    "ESE","ENMyH","Otro",
  ],
  Posgrado: ["CIC","SEPI","Otro"],
};

const PARENTESCOS = ["Padre","Madre","Tutor legal","Hermano/a","Abuelo/a","Otro"] as const;
type Parentesco = (typeof PARENTESCOS)[number];

/* —————————————————————————————————————————————————————
   Form types
————————————————————————————————————————————————————— */
type FormValues = {
  nombre: string;
  apellidos: string;
  email: string;
  curp: string;
  telefono?: string;
  tutor_nombre?: string;
  tutor_parentesco?: Parentesco | "";
  tutor_telefono?: string;
  calle?: string;
  numero?: string;
  colonia?: string;
  municipio?: string;
  estado?: string;
  cp?: string;
  boleta?: string;
  ipn_nivel?: "Medio superior" | "Superior" | "Posgrado" | "";
  ipn_unidad?: string | "";
  ipn_unidad_otro?: string;
};

/* —————————————————————————————————————————————————————
   UI presets (mobile-first)
————————————————————————————————————————————————————— */
const inputClass = "h-11 text-[15px]";
const triggerClass = "h-11 text-[15px]";
const cardClass = "rounded-2xl border bg-white shadow-sm ring-1 ring-black/5 overflow-hidden";
const cardHeaderClass = "bg-gradient-to-br from-neutral-50 to-white px-4 py-3 sm:px-6 sm:py-4";
const sectionTitleClass = "text-base sm:text-lg font-semibold tracking-tight flex items-center gap-2";
const GUINDA = "#7c0040";

/* —————————————————————————————————————————————————————
   Component
————————————————————————————————————————————————————— */
export default function StudentProfileForm() {
  const session = getSession();
  const { nombre: nombreFull, email, curp, is_ipn: sessionIsIPN, boleta: sessionBoleta } = {
    nombre: session?.nombre || "",
    email: session?.email || "",
    curp: session?.curp || "",
    is_ipn: !!session?.is_ipn,
    boleta: session?.boleta || "",
  };

  const { nombre, apellidos } = splitNombre(nombreFull);

  const form = useForm<FormValues>({
    defaultValues: {
      nombre,
      apellidos,
      email,
      curp,
      telefono: "",
      tutor_nombre: "",
      tutor_parentesco: "" as any,
      tutor_telefono: "",
      calle: "",
      numero: "",
      colonia: "",
      municipio: "",
      estado: "",
      cp: "",
      boleta: sessionBoleta || "",
      ipn_nivel: "" as any,
      ipn_unidad: "" as any,
      ipn_unidad_otro: "",
    },
    mode: "onChange",
  });

  const [isIPN, setIsIPN] = useState<boolean>(sessionIsIPN);
  const watchCURP = form.watch("curp");
  const watchNivel = form.watch("ipn_nivel");
  const watchUnidad = form.watch("ipn_unidad");

  const dobInfo = useMemo(() => parseDOBFromCURP(watchCURP || ""), [watchCURP]);
  const isMinor = !!dobInfo && dobInfo.age < 18;

  // Cargar perfil
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const perfil: AlumnoPerfil = await getAlumnoPerfil();
        if (!mounted || !perfil) return;

        setIsIPN(!!(perfil.is_ipn ?? sessionIsIPN));

        form.reset({
          nombre: perfil.nombre ?? nombre,
          apellidos: perfil.apellidos ?? apellidos,
          email: perfil.email ?? email,
          curp: perfil.curp ?? curp,
          telefono: perfil.telefono ?? "",
          tutor_nombre: (perfil.tutor as any)?.nombre ?? "",
          tutor_parentesco: (perfil.tutor as any)?.parentesco ?? "",
          tutor_telefono: perfil.tutor?.telefono ?? "",
          calle: perfil.direccion?.calle ?? "",
          numero: perfil.direccion?.numero ?? "",
          colonia: perfil.direccion?.colonia ?? "",
          municipio: perfil.direccion?.municipio ?? "",
          estado: perfil.direccion?.estado ?? "",
          cp: perfil.direccion?.cp ?? "",
          boleta: perfil.boleta ?? sessionBoleta ?? "",
          ipn_nivel: (perfil.ipn?.nivel as any) ?? "",
          ipn_unidad: (perfil.ipn?.unidad as any) ?? "",
          ipn_unidad_otro: "",
        });
      } catch {
        // Silencioso
      }
    })();
    return () => { mounted = false; };
  }, []); // eslint-disable-line

  async function onSubmit(values: FormValues) {
    const errs: Record<string, string> = {};
    if (!values.nombre || values.nombre.trim().length < 2) errs["nombre"] = "Ingresa tu nombre";
    if (!values.apellidos || values.apellidos.trim().length < 2) errs["apellidos"] = "Ingresa tus apellidos";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) errs["email"] = "Correo inválido";
    if (!curpRegex.test(values.curp)) errs["curp"] = "CURP inválido";
    if (values.telefono && !/^\d{10}$/.test(values.telefono)) errs["telefono"] = "Teléfono a 10 dígitos";
    if (isMinor) {
      if (!values.tutor_nombre || values.tutor_nombre.trim().length < 3) errs["tutor_nombre"] = "Nombre del padre/tutor es obligatorio";
      if (!values.tutor_parentesco) errs["tutor_parentesco"] = "Selecciona el parentesco";
      if (!values.tutor_telefono || !/^\d{10}$/.test(values.tutor_telefono)) errs["tutor_telefono"] = "Teléfono de tutor (10 dígitos) es obligatorio";
    }
    if (values.cp && !/^\d{5}$/.test(values.cp)) errs["cp"] = "C.P. debe tener 5 dígitos";
    if (isIPN) {
      if (!values.boleta || !/^\d{10}$/.test(values.boleta)) errs["boleta"] = "Boleta inválida (10 dígitos)";
      if (!values.ipn_nivel) errs["ipn_nivel"] = "Selecciona un nivel";
      if (!values.ipn_unidad) errs["ipn_unidad"] = "Selecciona una unidad";
      if (values.ipn_unidad === "Otro" && !values.ipn_unidad_otro?.trim()) errs["ipn_unidad_otro"] = "Especifica tu unidad";
    }

    if (Object.keys(errs).length) {
      for (const [k, v] of Object.entries(errs)) form.setError(k as any, { type: "manual", message: v });
      toast.error("Revisa los campos marcados.");
      return;
    }

    try {
      await updateAlumnoPerfil({
        nombre: values.nombre.trim(),
        apellidos: values.apellidos.trim(),
        email: values.email.trim(),
        curp: values.curp.trim().toUpperCase(),
        telefono: values.telefono?.trim() || null,
        direccion: {
          calle: values.calle?.trim() || "",
          numero: values.numero?.trim() || "",
          colonia: values.colonia?.trim() || "",
          municipio: values.municipio?.trim() || "",
          estado: values.estado?.trim() || "",
          cp: values.cp?.trim() || "",
        },
        boleta: isIPN ? (values.boleta?.trim() || "") : null,
        ipn: isIPN
          ? {
              nivel: values.ipn_nivel!,
              unidad: values.ipn_unidad === "Otro" ? (values.ipn_unidad_otro || "Otro") : values.ipn_unidad!,
            }
          : null,
        tutor: isMinor
          ? {
              nombre: values.tutor_nombre!.trim(),
              parentesco: values.tutor_parentesco!,
              telefono: values.tutor_telefono!.trim(),
            }
          : null,
      });

      toast.success("Perfil actualizado correctamente.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el perfil.");
    }
  }

  /* —————————————————————————————————————————————————————
     Render
  —————————————————————————————————————————————————————— */
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24 sm:pb-0" noValidate>
        {/* =============== MOBILE-FIRST: ACORDEÓN =============== */}
        <Accordion type="single" collapsible defaultValue="personales" className="space-y-4">
          {/* Datos personales */}
          <AccordionItem value="personales" className="border-none">
            <Card className={cardClass}>
              <CardHeader className={cardHeaderClass}>
                <AccordionTrigger className="px-0">
                  <CardTitle className={sectionTitleClass}>
                    <BadgeCheck className="h-5 w-5" style={{ color: GUINDA }} />
                    Datos personales
                  </CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" style={{ color: GUINDA }} /> Nombre(s)
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} placeholder="Tu nombre" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="apellidos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" style={{ color: GUINDA }} /> Apellidos
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} placeholder="Tus apellidos" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" style={{ color: GUINDA }} /> Correo
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} type="email" placeholder="correo@ejemplo.com" {...field} readOnly />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">El correo no se edita desde aquí.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="curp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IdCard className="h-4 w-4" style={{ color: GUINDA }} /> CURP
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} placeholder="ABCD000101HDFRRN09" {...field} readOnly />
                          </FormControl>
                          {dobInfo && (
                            <p className="text-xs text-muted-foreground">
                              Fecha de nacimiento: <b>{dobInfo.dobISO}</b> • Edad: <b>{dobInfo.age}</b> años
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Teléfonos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="telefono"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="h-4 w-4" style={{ color: GUINDA }} /> Teléfono del alumno
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} placeholder="10 dígitos" inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {isMinor && (
                      <FormField
                        control={form.control}
                        name="tutor_telefono"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Phone className="h-4 w-4" style={{ color: GUINDA }} /> Teléfono del padre/tutor
                            </FormLabel>
                            <FormControl>
                              <Input
                                className={inputClass}
                                placeholder="Obligatorio si eres menor (10 dígitos)"
                                inputMode="numeric"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {/* Tutor — solo si es menor */}
                  {isMinor && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="tutor_nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <User className="h-4 w-4" style={{ color: GUINDA }} /> Nombre del padre/tutor
                            </FormLabel>
                            <FormControl>
                              <Input className={inputClass} placeholder="Nombre completo del padre/tutor" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tutor_parentesco"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Users2 className="h-4 w-4" style={{ color: GUINDA }} /> Parentesco
                            </FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className={triggerClass}>
                                  <SelectValue placeholder="Selecciona parentesco" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PARENTESCOS.map((p) => (
                                  <SelectItem key={p} value={p}>
                                    {p}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Domicilio */}
          <AccordionItem value="domicilio" className="border-none">
            <Card className={cardClass}>
              <CardHeader className={cardHeaderClass}>
                <AccordionTrigger className="px-0">
                  <CardTitle className={sectionTitleClass}>
                    <MapPin className="h-5 w-5" style={{ color: GUINDA }} />
                    Domicilio
                  </CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="calle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" style={{ color: GUINDA }} /> Calle
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Hash className="h-4 w-4" style={{ color: GUINDA }} /> Número
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Hash className="h-4 w-4" style={{ color: GUINDA }} /> C.P.
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} inputMode="numeric" maxLength={5} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="colonia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" style={{ color: GUINDA }} /> Colonia
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="municipio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" style={{ color: GUINDA }} /> Alcaldía/Municipio
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Globe className="h-4 w-4" style={{ color: GUINDA }} /> Estado
                          </FormLabel>
                          <FormControl>
                            <Input className={inputClass} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* IPN (mostrar solo si es IPN) */}
          {isIPN && (
            <AccordionItem value="ipn" className="border-none">
              <Card className={cardClass}>
                <CardHeader className={cardHeaderClass}>
                  <AccordionTrigger className="px-0">
                    <CardTitle className={sectionTitleClass}>
                      <School className="h-5 w-5" style={{ color: GUINDA }} />
                      IPN
                    </CardTitle>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="boleta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <BadgeCheck className="h-4 w-4" style={{ color: GUINDA }} /> Boleta (10 dígitos)
                            </FormLabel>
                            <FormControl>
                              <Input className={inputClass} inputMode="numeric" maxLength={10} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ipn_nivel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <School className="h-4 w-4" style={{ color: GUINDA }} /> Nivel
                            </FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className={triggerClass}>
                                  <SelectValue placeholder="Selecciona nivel" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Medio superior">Medio superior</SelectItem>
                                <SelectItem value="Superior">Superior</SelectItem>
                                <SelectItem value="Posgrado">Posgrado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ipn_unidad"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" style={{ color: GUINDA }} /> Unidad académica
                            </FormLabel>
                            <Select
                              value={field.value || ""}
                              onValueChange={field.onChange}
                              disabled={!watchNivel}
                            >
                              <FormControl>
                                <SelectTrigger className={triggerClass}>
                                  <SelectValue
                                    placeholder={watchNivel ? "Selecciona unidad" : "Selecciona nivel primero"}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(IPN_UNIDADES[watchNivel as keyof typeof IPN_UNIDADES] || []).map((u) => (
                                  <SelectItem key={u} value={u}>
                                    {u}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {watchUnidad === "Otro" && (
                        <FormField
                          control={form.control}
                          name="ipn_unidad_otro"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" style={{ color: GUINDA }} /> Especifica tu unidad
                              </FormLabel>
                              <FormControl>
                                <Input className={inputClass} placeholder="Nombre de tu unidad" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          )}
        </Accordion>

        <Separator className="hidden sm:block" />

        {/* Acciones desktop */}
        <div className="hidden sm:flex items-center justify-end gap-3">
          <Button type="submit" className="h-11 px-6 text-[15px]">Guardar cambios</Button>
        </div>

        {/* Barra sticky de acción (móvil) */}
        <div className="sm:hidden">
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur p-3">
            <div className="mx-auto max-w-screen-sm">
              <Button type="submit" className="h-11 w-full text-[15px] rounded-xl">
                Guardar cambios
              </Button>
              <p className="mt-2 text-[11px] text-center text-neutral-500">
                Revisa los campos marcados si aparece algún error.
              </p>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
