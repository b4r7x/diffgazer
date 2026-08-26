import { usePageFooter } from "@diffgazer/core/footer";
import { redactSecrets } from "@diffgazer/core/redaction";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId } from "react";

// Precomputed figlet "Big" rendering of 404, same lock rules as the wordmark
// and the crash screen's ERROR art: hard px font and line-height,
// white-space: pre, aria-hidden art behind an accessible name.
const NOT_FOUND_ASCII_ROWS = [
  "  _  _    ___  _  _   ",
  " | || |  / _ \\| || |  ",
  " | || |_| | | | || |_ ",
  " |__   _| | | |__   _|",
  "    | | | |_| |  | |  ",
  "    |_|  \\___/   |_|  ",
] as const;

/**
 * The 404 is not a boxed gate: it renders as a full-width interruption band —
 * two full-bleed hairline rules with a tinted strip between them — because a
 * route-level dead end interrupts the whole framed instrument, not one panel
 * inside it. The band composes inline here (crash-screen precedent: src/app
 * owns its own dead ends) rather than through FailureView; it is the band's
 * only consumer, so no shared variant exists to extract yet.
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  useScope("not-found");
  const titleId = useId();
  const goHome = () => void navigate({ to: "/" });

  // No route matches a not-found render, so head()/HeadContent never fires here;
  // the title is set by hand and restored on unmount unless another screen has
  // already changed it.
  useEffect(() => {
    const previousTitle = document.title;
    const notFoundTitle = "Page not found — Diffgazer";
    document.title = notFoundTitle;

    return () => {
      if (document.title === notFoundTitle) document.title = previousTitle;
    };
  }, []);

  // One way out of a route that does not exist: reloading it only fetches the
  // same missing page again, so Home is both the action and the Esc target.
  // The lone action never disables, so no focus-fallback ref is wired.
  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: 1,
    defaultZone: "actions",
    onAction: goHome,
  });

  useKey("Escape", goHome);

  usePageFooter({
    // A lone action has nowhere to move to, so the row hint stays off this screen.
    shortcuts: [{ key: "Enter/Space", label: "Go to Home" }],
    rightShortcuts: [{ key: "Esc", label: "Home" }],
  });

  // A path segment can be token-shaped, so the route is redacted before it
  // renders (crash-screen precedent); pathname only — the query never shows.
  const routePath = redactSecrets(window.location.pathname, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4 md:py-6 lg:py-8">
      {/* The interruption band keeps the app-wide 1:2 optical band (card.tsx,
          centered-status.tsx) — boxed dead-end gates dead-centre instead, but
          the 404 strip is banded by its own rule (D1), so loading → 404 lands
          without a jump. The spacers collapse once the band outgrows the
          viewport, so a short window scrolls from the top. */}
      <div aria-hidden className="grow" />
      <section aria-labelledby={titleId} className="w-full shrink-0">
        {/* Top rule: full-bleed hairline with the status chip notched into it
            at the content column's left edge — the Panel.Label chip-on-border
            idiom (bg-background + px over the rule), seated on the column so
            chip → art → action share one left edge and the band's flanks stay
            symmetric. */}
        <div className="relative">
          <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-border" />
          <div className="relative mx-auto w-full max-w-3xl px-4 md:px-6 lg:px-8">
            <span
              aria-hidden="true"
              className="-ml-2 inline-flex items-center gap-[7px] bg-background px-2 text-[11px] font-bold tracking-widest whitespace-nowrap text-muted-foreground uppercase"
            >
              <span className="size-[7px] rounded-full bg-error-text" />
              error <span className="text-error-text">· 404</span>
            </span>
          </div>
        </div>
        {/* Sanctioned atmosphere: this 4% tint is the app's ONE full-width
            wash, owned by the interruption band. Nothing else may adopt it. */}
        <div className="bg-[color-mix(in_oklab,var(--error-text)_4%,transparent)] py-9">
          <div className="mx-auto w-full max-w-3xl px-4 font-mono md:px-6 lg:px-8 sm:grid sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-12">
            <div role="img" aria-label="404" className="shrink-0">
              <pre
                aria-hidden="true"
                className="text-[18px] leading-[18px] whitespace-pre text-error-text"
              >
                {NOT_FOUND_ASCII_ROWS.join("\n")}
              </pre>
            </div>
            {/* items-start plus a cap-line nudge: figlet row one is a sparse
                underscore fringe rendered near its row's baseline, so a flush
                cell top leaves the title cap floating above the art's first
                ink — the 6px seats the cap line on that row. */}
            <div className="mt-6 min-w-0 sm:mt-1.5">
              {/* The alert wrapper, not the heading itself: role="alert" on a
                  heading element replaces its heading role, and this screen
                  wants both the announcement and a real h1 in the outline. */}
              <div role="alert">
                <h1 id={titleId} className="mb-2 text-base font-bold">
                  <span aria-hidden="true" className="mr-2 text-error-text">
                    ✖
                  </span>
                  Page Not Found
                </h1>
              </div>
              <p className="max-w-[56ch] break-words pl-[22px] text-[13px] text-muted-foreground">
                No screen exists at this address. It may have been mistyped or removed.
              </p>
              <dl className="mt-4 flex items-baseline gap-3 pl-[22px] text-sm">
                <dt className="shrink-0 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                  route
                </dt>
                <dd className="break-all text-foreground">{routePath}</dd>
              </dl>
              <div className="mt-6 pl-[22px]">
                <Button
                  {...footer.getActionProps(0)}
                  variant="outline"
                  bracket
                  highlighted={footer.inActions && footer.focusedIndex === 0}
                  onClick={goHome}
                >
                  Go to Home
                </Button>
              </div>
            </div>
          </div>
        </div>
        <span aria-hidden="true" className="block h-px w-full bg-border" />
      </section>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
