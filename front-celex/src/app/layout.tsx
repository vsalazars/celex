import "./globals.css";
import { Poppins, Montserrat } from "next/font/google";
import { Toaster } from "sonner";

// Fuente para títulos
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

// Fuente para cuerpo
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
});

export const metadata = {
  title: "Sistema de Gestión Escolar del CELEX",
  description: "CECyT No. 7 Cuauhtémoc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${poppins.variable} ${montserrat.variable}`}>
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton expand />
      </body>
    </html>
  );
}
