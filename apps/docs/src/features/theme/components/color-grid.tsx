import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useCopyToClipboard } from "@diffgazer/ui/hooks/copy-to-clipboard";
import type { ThemeDocsToken } from "@diffgazer/ui/theme";
import { useId } from "react";
import { THEME_DOCS_COLOR_GROUPS } from "../lib/token-presentation";

export function ColorGrid() {
  return (
    <div data-demo-preview className="space-y-8">
      {THEME_DOCS_COLOR_GROUPS.map((group) => (
        <SwatchGroup key={group.title} title={group.title} swatches={group.tokens} />
      ))}
    </div>
  );
}

function SwatchGroup({ title, swatches }: { title: string; swatches: readonly ThemeDocsToken[] }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <SectionHeader as="h3" id={headingId} className="mb-3">
        {title}
      </SectionHeader>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {swatches.map((swatch) => (
          <SwatchCard key={swatch.name} swatch={swatch} />
        ))}
      </div>
    </section>
  );
}

function SwatchCard({ swatch }: { swatch: ThemeDocsToken }) {
  const { copied, failed, copy } = useCopyToClipboard();

  const handleClick = () => {
    void copy(`var(${swatch.name})`);
  };

  const valueLabel =
    swatch.darkValue === swatch.lightValue
      ? swatch.darkValue
      : `${swatch.darkValue} / ${swatch.lightValue}`;

  let copyStatus = "";
  if (copied) {
    copyStatus = "Copied!";
  } else if (failed) {
    copyStatus = "Copy failed";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-left group border border-border hover:border-foreground transition-colors duration-150"
      // The button keeps naming its token: swapping the name to "Copied" would
      // cost the control its identity for the rest of the session.
      aria-label={`Copy ${swatch.name} CSS variable`}
    >
      <div
        className="w-full h-12 border-b border-border"
        style={{ backgroundColor: `var(${swatch.name})` }}
      />
      <div className="p-2">
        <div className="text-2xs font-mono text-foreground truncate">{swatch.name}</div>
        <div className="text-2xs font-mono text-muted-foreground truncate">
          {copyStatus || valueLabel}
        </div>
        {/* Mounted from first paint with a constant aria-live: a region that
            gains the attribute in the same commit as its text is not announced. */}
        <span aria-live="polite" className="sr-only">
          {copyStatus}
        </span>
      </div>
    </button>
  );
}
