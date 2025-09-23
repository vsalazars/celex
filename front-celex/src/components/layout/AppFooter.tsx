export default function AppFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-3 px-6 md:px-8 py-8 text-xs text-neutral-500 md:flex-row">
        <span>
          © {new Date().getFullYear()} CELEX · CECyT 15 "Diódoro Antúnez Echegaray"
        </span>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-neutral-700">
            Términos
          </a>
          <a href="#" className="hover:text-neutral-700">
            Privacidad
          </a>
          <a href="#" className="hover:text-neutral-700">
            Contacto
          </a>
        </div>
      </div>
    </footer>
  );
}
