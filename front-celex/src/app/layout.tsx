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

        {/* >>> Tracer solo en desarrollo: amplía el error de Radix con una traza legible */}
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
              (function () {
                try {
                  var origError = window.console.error;
                  window.console.error = function () {
                    try {
                      var first = arguments[0];
                      if (typeof first === "string" &&
                          first.indexOf("DialogContent") !== -1 &&
                          first.indexOf("DialogTitle") !== -1) {
                        var trace = new Error("Dialog a11y trace");
                        origError.apply(console, [].slice.call(arguments).concat(
                          "\\n--- Caller stack ---\\n",
                          trace.stack,
                          "\\n--------------------"
                        ));
                      } else {
                        origError.apply(console, arguments);
                      }
                    } catch (e) {
                      origError.apply(console, arguments);
                    }
                  };

                  // (Opcional) Detector en vivo de Dialogs abiertos SIN título
                  var obs = new MutationObserver(function () {
                    document
                      .querySelectorAll('[data-state="open"][data-radix-dialog-content]')
                      .forEach(function (el) {
                        var hasTitle =
                          !!el.querySelector('[data-radix-dialog-title]') ||
                          !!el.querySelector('[aria-labelledby]');
                        if (!hasTitle) {
                          console.warn(
                            "DialogContent sin DialogTitle detectado:",
                            el,
                            (el.outerHTML || "").slice(0, 300) + "..."
                          );
                        }
                      });
                  });
                  obs.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
                } catch (_) {}
              })();
            `,
            }}
          />
        )}
        {/* <<< fin tracer */}
      </body>
    </html>
  );
}
