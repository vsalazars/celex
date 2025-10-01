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
  title: "Cursos Extracurriculares de Lenguas Extranjeras (CELEX)",
  description: "CECyT No. 15 Diódoro Antúnez",
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
