import { Logo } from "@diffgazer/ui/components/logo";
import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { DOT_GRID_CLASS } from "@/components/shared/dot-grid";
import { WORDMARK_ASCII, WORDMARK_TEXT } from "@/generated/logo-ascii";
import { DOCS_CHROME_VERSION, DOCS_REGISTRY_HOST } from "@/lib/docs-chrome";
import type { HomeLibrary } from "../data";
import { RegistryDirectory } from "./registry-directory";

// The sub-`sm` vertical rhythm here is load-bearing, not taste: the hero's height
// decides where the SessionPanel below it lands, and the panel has to peek above
// the footer on a 375x667 phone or the page reads as a dead end. Every `py`/`mt`
// value without an `sm:` sibling is part of that budget; testing/e2e/home-fold.e2e.ts
// pins the outcome.
export function HeroPanel({ libraries }: { libraries: HomeLibrary[] }) {
  return (
    <Panel frame="hairline" className="@container flex min-w-0 flex-1 flex-col">
      <div
        className={cn("shrink-0 border-b border-border px-4 py-2 sm:px-5 sm:py-5", DOT_GRID_CLASS)}
      >
        <div className="dg-wordmark-boot">
          <Logo
            text={WORDMARK_TEXT}
            asciiText={WORDMARK_ASCII}
            className="text-[clamp(0.5rem,2.1cqw,1rem)]/[1] font-bold text-foreground"
          />
        </div>
        {/* The app's brand rule under its wordmark (apps/web header). It sits
            outside .dg-wordmark-boot on purpose: the boot reveal is stepped to
            the six ascii rows, and a seventh row would misalign the bands. It
            steps down to the muted tone so the rule reads as a divider under the
            wordmark rather than competing with it at the same weight. */}
        <div
          aria-hidden="true"
          className="mt-1 font-mono text-2xs tracking-widest text-muted-foreground select-none sm:text-xs"
        >
          ─ ✦ ─ ✧ ─
        </div>
        <p className="mt-1.5 font-mono text-xs text-muted-foreground sm:mt-3">
          local-first code review · the React TUI kit behind it
        </p>
      </div>
      <div
        aria-hidden="true"
        className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-1 font-mono text-sm sm:py-2"
      >
        <span className="font-bold text-foreground">❯</span>
        <span className="text-muted-foreground">ls registry/</span>
        <span className="dg-caret ml-px inline-block h-3.5 w-2 bg-foreground" />
      </div>
      <RegistryDirectory libraries={libraries} />
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-4 border-t border-dashed border-border px-4 py-1.5 sm:py-2",
          CHROME_LABEL_CLASS,
        )}
      >
        <span>version {DOCS_CHROME_VERSION}</span>
        <span>registry {DOCS_REGISTRY_HOST}</span>
      </div>
    </Panel>
  );
}
