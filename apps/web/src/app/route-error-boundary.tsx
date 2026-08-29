import { redactSecrets } from "@diffgazer/core/redaction";
import { KeyboardProvider, useActionRowNavigation, useKey } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { useCopyToClipboard } from "@diffgazer/ui/hooks/copy-to-clipboard";
import { type ErrorComponentProps, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { DiffgazerWordmark } from "@/components/layout/wordmark";
import { FailureView } from "@/components/shared/failure-view";
import { buildCrashReport } from "@/lib/crash-report";
import { RouteModuleImportError } from "./route-import";
import "./route-error-boundary.css";

// Precomputed figlet "Big" rendering of ERROR, same lock rules as the wordmark:
// hard px font and line-height, white-space: pre, aria-hidden art behind an
// accessible name. One row renders glitch-shifted — a single deliberate move,
// no animation.
const ERROR_ASCII_ROWS = [
  "  ______ _____  _____   ____  _____",
  " |  ____|  __ \\|  __ \\ / __ \\|  __ \\",
  " | |__  | |__) | |__) | |  | | |__) |",
  " |  __| |  _  /|  _  /| |  | |  _  / ",
  " | |____| | \\ \\| | \\ \\| |__| | | \\ \\",
  " |______|_|  \\_\\_|  \\_\\\\____/|_|  \\_\\",
] as const;
const GLITCH_ROW = 3;

const PROMPT_ACTION_CLASS =
  "px-2 py-0.5 text-sm text-foreground focus:bg-secondary focus:outline-solid focus:outline-1 focus:outline-offset-0 focus:outline-border-strong";

const COPY_LABEL = { idle: "copy report", copied: "copied", failed: "copy failed" } as const;

// The chip renders twice — inside the header band on desktop, as a stacked row
// on mobile — but the breakpoint classes keep exactly one in the accessibility
// tree at a time, so it is announced once.
function SessionChip({ className }: { className: string }) {
  return (
    <span
      className={`${className} items-center gap-[7px] text-[11px] font-bold tracking-widest whitespace-nowrap text-muted-foreground uppercase`}
    >
      <span aria-hidden="true" className="size-[7px] rounded-full bg-error-text" />
      session · <span className="text-error-text">interrupted</span>
    </span>
  );
}

function RootRouteRecoveryPage({
  error,
  onRetry,
  onGoHome,
}: {
  error: Error;
  onRetry: () => void;
  onGoHome: () => void;
}) {
  const [crashedAt] = useState(() => new Date());
  const clock = crashedAt.toTimeString().slice(0, 8);
  // A query string can carry a secret (?access_token=...), so the route is
  // redacted before it renders. The report redacts its own copy: each
  // destination owns its redaction, so neither relies on the other.
  const rawRoute = window.location.pathname + window.location.search;
  const routePath = redactSecrets(rawRoute, []);

  const { status: copyStatus, copy } = useCopyToClipboard();
  const handleCopy = () => {
    void copy(buildCrashReport(error, rawRoute, crashedAt));
  };

  useKey({ r: onRetry, h: onGoHome, c: handleCopy, Escape: onGoHome });

  const actions = [
    { key: "r", label: "retry", run: onRetry },
    { key: "h", label: "home", run: onGoHome },
    { key: "c", label: COPY_LABEL[copyStatus], run: handleCopy },
  ];

  // The root gate renders outside the shell; defaultZone "actions" lands focus
  // on retry so Enter retries immediately.
  const prompt = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    defaultZone: "actions",
    wrap: true,
    canExitActions: false,
    onAction: (index) => actions[index]?.run(),
  });

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
            <SessionChip className="hidden sm:flex" />
            <span aria-hidden="true" className="hidden h-px w-4 shrink-0 bg-border sm:block" />
          </div>
        </div>
        <div className="flex justify-end pt-1.5 sm:hidden">
          <SessionChip className="flex" />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-12">
        <div aria-hidden className="grow" />
        <div className="mx-auto w-full max-w-[45rem] shrink-0">
          <div role="img" aria-label="Error">
            <pre
              aria-hidden="true"
              className="mb-2.5 text-[13px] leading-[13px] whitespace-pre text-error-text sm:text-[18px] sm:leading-[18px]"
            >
              {ERROR_ASCII_ROWS.map((row, index) => (
                <Fragment key={row}>
                  {index === GLITCH_ROW ? (
                    <span className="inline-block translate-x-1.5 text-[color-mix(in_oklab,var(--error-text)_55%,var(--background))] sm:translate-x-2">
                      {row}
                    </span>
                  ) : (
                    row
                  )}
                  {"\n"}
                </Fragment>
              ))}
            </pre>
          </div>
          <div role="alert">
            <h1 className="mt-6 mb-1 text-sm font-normal">
              <span aria-hidden="true" className="mr-2 text-error-text">
                ✗
              </span>
              <span className="mr-3 text-muted-foreground">{clock}</span>
              <strong>render aborted — the interface crashed</strong>
            </h1>
            <p className="mb-6 max-w-[56ch] pl-[22px] text-[13px] text-muted-foreground">
              Your reviews and settings are untouched. Retry to reload the screen, or return to the
              start.
            </p>
          </div>
          <div className="mb-2 flex items-center gap-2.5 text-[11px] tracking-widest text-muted-foreground uppercase before:h-px before:w-4 before:shrink-0 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']">
            log tail
          </div>
          {/* Only what is actually known: the route the crash happened on and
              the error's class name. The raw message never renders — [c] copies
              the redacted report instead. */}
          <pre
            role="log"
            aria-label="log tail"
            className="mb-7 text-xs leading-[1.7] whitespace-pre-wrap text-muted-foreground"
          >
            {"         route  "}
            {routePath}
            {"\n"}
            <span className="text-[color-mix(in_oklab,var(--error-text)_70%,var(--muted-foreground))]">
              {clock} error
            </span>
            {"  "}
            {redactSecrets(error.name, [])}
            {" (redacted · [c] copies it)"}
          </pre>
          {/* Roving tabindex keeps the toolbar a single Tab stop per the APG
              toolbar contract; ←/→ movement comes from useActionRowNavigation. */}
          <div role="toolbar" aria-label="Recovery actions" className="flex items-center gap-5">
            <span aria-hidden="true" className="font-bold text-error-text">
              ❯
            </span>
            {actions.map((action, index) => (
              <button
                key={action.key}
                {...prompt.getActionProps(index)}
                tabIndex={prompt.focusedIndex === index ? 0 : -1}
                type="button"
                onClick={action.run}
                className={PROMPT_ACTION_CLASS}
              >
                <span className="font-bold text-error-text">[{action.key}]</span> {action.label}
              </button>
            ))}
            <span
              data-slot="prompt-cursor"
              aria-hidden="true"
              className="inline-block h-[17px] w-2 animate-[erb-cursor-blink_1.1s_steps(1)_infinite] bg-foreground motion-reduce:animate-none"
            />
          </div>
        </div>
        <div aria-hidden className="mt-[76px] grow" />
      </main>
      <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          <Kbd size="sm">←/→</Kbd> move · <Kbd size="sm">enter</Kbd> select
        </span>
        <span>
          <Kbd size="sm">esc</Kbd> home
        </span>
      </footer>
    </div>
  );
}

export function RouteRecoveryPage({
  error,
  reloadDocument = () => window.location.reload(),
  navigateHome = () => window.location.assign("/"),
  clearFooter = true,
}: ErrorComponentProps & {
  reloadDocument?: () => void;
  navigateHome?: () => void;
  clearFooter?: boolean;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const handleRetry = () => {
    if (error instanceof RouteModuleImportError) {
      reloadDocument();
      return;
    }
    void router.invalidate().catch(() => {});
  };

  if (!clearFooter) {
    // The router may be dead at the root, so home is a document-level
    // navigation rather than a router navigate. The root error slot replaces
    // the layout that mounts KeyboardProvider, so the gate brings its own —
    // without it every keys hook on this screen is a silent no-op.
    return (
      <KeyboardProvider>
        <RootRouteRecoveryPage error={error} onRetry={handleRetry} onGoHome={navigateHome} />
      </KeyboardProvider>
    );
  }

  return (
    <FailureView
      title="Something went wrong"
      message={
        import.meta.env.DEV ? error.message : "The page failed to load. Try again or return home."
      }
      scope="route-error"
      primary={{ label: "Try again", onAction: handleRetry }}
      secondary={{ label: "Go to Home", onAction: () => void navigate({ to: "/" }) }}
      footerRightShortcuts={[{ key: "Esc", label: "Home" }]}
    />
  );
}

export function RouteOutletBoundary() {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <Outlet />
    </div>
  );
}
