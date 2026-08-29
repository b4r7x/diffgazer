import { Spinner } from "@diffgazer/ui/components/spinner";
import type { ReactNode } from "react";

interface CenteredStatusProps {
  tone?: "info" | "error";
  children: ReactNode;
}

/**
 * Full-pane status readout. Plain centered text on the page background: a
 * transient status line is not a pane, and boxing one sentence in panel chrome
 * read as a control the user could enter. The label keeps the app's uppercase
 * tracked vocabulary over the braille spinner. It sits in the app-wide centered −38px
 * optical band (card.tsx) so the loaded screen's content lands where the
 * status line was, instead of jumping up from dead centre.
 */
export function CenteredStatus({ tone = "info", children }: CenteredStatusProps) {
  return (
    <div className="flex flex-1 flex-col items-center p-4 font-mono">
      <div aria-hidden className="grow" />
      {tone === "error" ? (
        <p role="alert" className="text-sm uppercase tracking-[0.14em] text-error-text">
          {children}
        </p>
      ) : (
        <Spinner variant="braille" className="uppercase tracking-[0.14em] text-muted-foreground">
          {children}
        </Spinner>
      )}
      <div aria-hidden className="mt-[76px] grow" />
    </div>
  );
}
