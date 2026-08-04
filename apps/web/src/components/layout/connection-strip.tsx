import { Button } from "@diffgazer/ui/components/button";
import type { HeaderServerState } from "./header";

interface ConnectionStripProps {
  state: Exclude<HeaderServerState, "live">;
  onRetry: () => void;
}

const COPY: Record<ConnectionStripProps["state"], string> = {
  offline: "Server not responding — reviews and history are frozen.",
  retrying: "Reconnecting…",
};

/**
 * The body a lost connection gets: cause plus a way back, directly under the
 * header so it is visible on every route without scrolling. It states the fact
 * in the active voice and does not apologise.
 */
export function ConnectionStrip({ state, onRetry }: ConnectionStripProps) {
  return (
    <output
      aria-live="polite"
      data-connection-strip={state}
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-error-border bg-[color-mix(in_oklab,var(--error)_7%,transparent)] px-4 py-1.5 pointer-coarse:min-h-11"
    >
      <span className="min-w-0 text-[11px] uppercase tracking-[0.12em] text-error-text">
        {COPY[state]}
      </span>
      <Button
        variant="secondary"
        size="sm"
        bracket
        loading={state === "retrying"}
        onClick={onRetry}
      >
        Retry
      </Button>
    </output>
  );
}
