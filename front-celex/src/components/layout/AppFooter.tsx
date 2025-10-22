export default function AppFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-3 px-4 sm:px-6 md:px-8 py-6 sm:py-8 text-[11.5px] sm:text-xs text-neutral-500 md:flex-row">
        <span className="text-center md:text-left">
          © {new Date().getFullYear()} CELEX · Centro de Estudios Científicos y Tecnológicos No. 4 "Lázaro Cárdenas"
        </span>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-neutral-700">Términos</a>
          <a href="#" className="hover:text-neutral-700">Privacidad</a>
          <a href="#" className="hover:text-neutral-700">Contacto</a>
        </div>
      </div>
    </footer>
  );
}
