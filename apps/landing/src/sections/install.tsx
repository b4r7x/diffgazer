import { INSTALL_CAPTION, INSTALL_COMMAND, INSTALL_HEADING } from "../content";
import { CopyButton } from "./copy-button";

export function Install() {
  return (
    <section
      id="install"
      aria-labelledby="install-heading"
      className="flex scroll-mt-8 flex-col items-center gap-4 text-center"
    >
      <h2
        id="install-heading"
        className="font-mono text-sm uppercase tracking-widest text-muted-foreground"
      >
        {INSTALL_HEADING}
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <figure aria-label="Install command" className="m-0">
          <code className="rounded-sm border border-border bg-secondary px-3 py-2 text-sm text-foreground">
            {INSTALL_COMMAND}
          </code>
        </figure>
        <CopyButton text={INSTALL_COMMAND} label="Copy install command" />
      </div>
      <p className="font-sans text-sm text-muted-foreground">{INSTALL_CAPTION}</p>
    </section>
  );
}
