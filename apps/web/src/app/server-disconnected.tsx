import { useKey } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { useEffect, useRef } from "react";
import { DiffgazerWordmark } from "@/components/layout/wordmark";
import { BASE_URL } from "@/lib/api";

// Precomputed figlet "Big" rendering of OFFLINE, same lock rules as the
// wordmark: hard px font and line-height, white-space: pre, aria-hidden art
// behind an accessible name. 49 columns overflow a 390 frame at the crash
// screen's 13px mobile tier, so this art steps down to 11px instead.
const OFFLINE_ASCII_ROWS = [
  "   ____  ______ ______ _      _____ _   _ ______",
  "  / __ \\|  ____|  ____| |    |_   _| \\ | |  ____|",
  " | |  | | |__  | |__  | |      | | |  \\| | |__",
  " | |  | |  __| |  __| | |      | | | . ` |  __|",
  " | |__| | |    | |    | |____ _| |_| |\\  | |____",
  "  \\____/|_|    |_|    |______|_____|_| \\_|______|",
] as const;

// Duplicated from route-error-boundary.tsx: a class string is not worth an
// export contract between two dead-end screens.
const PROMPT_ACTION_CLASS =
  "px-2 py-0.5 text-sm text-foreground focus:bg-secondary focus:outline-solid focus:outline-1 focus:outline-offset-0 focus:outline-border-strong";

// The crash screen's SessionChip grammar with this gate's own words. The chip
// renders twice — inside the header band on desktop, as a stacked row on
// mobile — but the breakpoint classes keep exactly one in the accessibility
// tree at a time, so it is announced once.
function StatusChip({ className }: { className: string }) {
  return (
    <span
      className={`${className} items-center gap-[7px] text-[11px] font-bold tracking-widest whitespace-nowrap text-muted-foreground uppercase`}
    >
      <span aria-hidden="true" className="size-[7px] rounded-full bg-error-text" />
      server · <span className="text-error-text">offline</span>
    </span>
  );
}

/**
 * The boot dead end: the SPA is up but the local server behind it is not.
 * It renders outside the shell (no FooterProvider, no Panel), so it builds its
 * own frame in the root crash screen's language — header band, figlet art,
 * labelled detail rule, prompt-row action, own kbd footer — with the content
 * in the app-wide 1:2 band, like every other gate.
 */
export function ServerDisconnectedGate({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);

  // KeyboardProvider mounts in AppProviders above the router, so useKey works
  // here without the crash screen's own provider.
  useKey("r", onRetry);

  // The gate has one control; focus lands on it so Enter retries.
  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-background font-mono text-sm text-foreground">
      <header className="px-4 pt-5">
        {/* Equal 1fr side columns center the wordmark on the viewport itself —
            in a flex row the chip's width would pull it left of true center. */}
        <div
          data-slot="session-band"
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3.5"
        >
          <span aria-hidden="true" className="h-px bg-border" />
          <DiffgazerWordmark tier="dense" />
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
            <StatusChip className="hidden sm:flex" />
            <span aria-hidden="true" className="hidden h-px w-4 shrink-0 bg-border sm:block" />
          </div>
        </div>
        <div className="flex justify-end pt-1.5 sm:hidden">
          <StatusChip className="flex" />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-12">
        <div aria-hidden className="grow" />
        <div className="mx-auto w-full max-w-[45rem] shrink-0">
          <div role="img" aria-label="Offline">
            <pre
              aria-hidden="true"
              className="mb-2.5 text-[11px] leading-[11px] whitespace-pre text-error-text sm:text-[18px] sm:leading-[18px]"
            >
              {OFFLINE_ASCII_ROWS.join("\n")}
            </pre>
          </div>
          <div role="alert">
            <h1 className="mt-6 mb-1 text-sm font-normal">
              <span aria-hidden="true" className="mr-2 text-error-text">
                ✗
              </span>
              <strong>server disconnected</strong>
            </h1>
            <p className="mb-6 max-w-[56ch] pl-[22px] text-[13px] text-pretty text-muted-foreground">
              The Diffgazer server is not responding. Restart diffgazer in your terminal, or retry
              if it is still starting.
            </p>
          </div>
          <div className="mb-2 flex items-center gap-2.5 text-[11px] tracking-widest text-muted-foreground uppercase before:h-px before:w-4 before:shrink-0 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']">
            connection
          </div>
          {/* The rows tell only the truth: the health URL the browser polls and
              the error it actually reported — a dead server yields "Failed to
              fetch"; the browser never surfaces an errno, so none is shown. */}
          <pre
            role="log"
            aria-label="connection"
            className="mb-7 text-xs leading-[1.7] whitespace-pre-wrap text-muted-foreground"
          >
            {"        target  "}
            {BASE_URL}/api/health{"\n"}
            {"         error  "}
            <span className="text-[color-mix(in_oklab,var(--error-text)_70%,var(--muted-foreground))]">
              {message || "no response"}
            </span>
          </pre>
          <div className="flex items-center gap-5">
            <span aria-hidden="true" className="font-bold text-error-text">
              ❯
            </span>
            <button ref={retryRef} type="button" onClick={onRetry} className={PROMPT_ACTION_CLASS}>
              <span className="font-bold text-error-text">[r]</span> retry connection
            </button>
            {/* erb-cursor-blink comes from route-error-boundary.css, already
                loaded globally: __root.tsx — this gate's only mount point —
                imports the boundary module. */}
            <span
              data-slot="prompt-cursor"
              aria-hidden="true"
              className="inline-block h-[17px] w-2 animate-[erb-cursor-blink_1.1s_steps(1)_infinite] bg-foreground motion-reduce:animate-none"
            />
          </div>
        </div>
        <div aria-hidden className="grow-[2]" />
      </main>
      <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          <Kbd size="sm">enter</Kbd> retry
        </span>
        <span>
          <Kbd size="sm">r</Kbd> retry
        </span>
      </footer>
    </div>
  );
}
