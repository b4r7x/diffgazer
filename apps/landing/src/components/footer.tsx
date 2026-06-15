import { DOCS_LINK_TEXT, DOCS_URL, GITHUB_URL } from "../content";

const linkClass =
  "font-sans text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-3xl items-center justify-center gap-6 px-4 pb-16">
      <a href={DOCS_URL} className={linkClass}>
        {DOCS_LINK_TEXT}
      </a>
      <a href={GITHUB_URL} className={linkClass}>
        GitHub
      </a>
    </footer>
  );
}
