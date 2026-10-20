import Link from 'next/link';

const linkClassName = 'underline-offset-4 hover:text-foreground hover:underline';

/** Footer of the public pages: the legal links and the trademark notice. */
export function SiteFooter() {
  return (
    <footer className="border-t text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-6 py-6">
        <p>
          Unabhängiges Lernprojekt, nicht mit Google verbunden. NotebookLM ist eine Marke von Google
          LLC.
        </p>
        <nav aria-label="Rechtliches" className="flex shrink-0 gap-4">
          <Link href="/impressum" className={linkClassName}>
            Impressum
          </Link>
          <Link href="/datenschutz" className={linkClassName}>
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  );
}
