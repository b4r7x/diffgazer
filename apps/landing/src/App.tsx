import { CopyButton } from "./copy-button";
import {
  DOCS_LINK_TEXT,
  DOCS_URL,
  INSTALL_COMMAND,
  PRODUCT_NAME,
  TAGLINE,
} from "./content";

export function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:border focus:border-tui-border focus:bg-tui-surface-1 focus:px-3 focus:py-2 focus:text-tui-fg"
      >
        Skip to content
      </a>
      <header className="mx-auto max-w-2xl px-4 pt-16">
        <h1 className="text-2xl font-bold text-tui-fg">{PRODUCT_NAME}</h1>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-tui-dim">{TAGLINE}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <code
            aria-label="Install command"
            className="rounded border border-tui-border bg-tui-surface-1 px-3 py-2 text-sm text-tui-blue"
          >
            {INSTALL_COMMAND}
          </code>
          <CopyButton text={INSTALL_COMMAND} label="Copy install command" />
        </div>
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-16">
        <a
          href={DOCS_URL}
          className="text-tui-blue underline hover:text-tui-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {DOCS_LINK_TEXT}
        </a>
      </footer>
    </>
  );
}
