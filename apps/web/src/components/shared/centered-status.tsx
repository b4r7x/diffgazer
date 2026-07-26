import { Panel } from "@diffgazer/ui/components/panel";
import { Spinner } from "@diffgazer/ui/components/spinner";
import type { ReactNode } from "react";

interface CenteredStatusProps {
  tone?: "info" | "error";
  children: ReactNode;
}

/**
 * Full-pane status readout. The hairline frame keeps it looking like the product
 * without claiming a reticle it cannot earn — nothing here takes keystrokes — and
 * the label keeps the app's uppercase tracked vocabulary over the braille spinner.
 */
export function CenteredStatus({ tone = "info", children }: CenteredStatusProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 font-mono">
      <Panel density="compact">
        <Panel.Content spacing="none">
          {tone === "error" ? (
            <p role="alert" className="text-sm uppercase tracking-[0.14em] text-error-text">
              {children}
            </p>
          ) : (
            <Spinner
              variant="braille"
              className="uppercase tracking-[0.14em] text-muted-foreground"
            >
              {children}
            </Spinner>
          )}
        </Panel.Content>
      </Panel>
    </div>
  );
}
