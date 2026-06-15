import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useCopyToClipboard } from "@diffgazer/ui/hooks/copy-to-clipboard";
import { THEME_DOCS_COLOR_GROUPS, type ThemeDocsToken } from "@diffgazer/ui/theme";
import { useTheme } from "@/hooks/theme-context";

export function ColorGrid() {
  const { theme } = useTheme();
  return (
    <div data-demo-preview data-theme={theme} className="space-y-8">
      {THEME_DOCS_COLOR_GROUPS.map((group) => (
        <SwatchGroup key={group.title} title={group.title} swatches={group.tokens} />
      ))}
    </div>
  );
}

function SwatchGroup({ title, swatches }: { title: string; swatches: readonly ThemeDocsToken[] }) {
  return (
    <div>
      <SectionHeader as="h3" className="mb-3">
        {title}
      </SectionHeader>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {swatches.map((swatch) => (
          <SwatchCard key={swatch.name} swatch={swatch} />
        ))}
      </div>
    </div>
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

  let statusLabel = `Copy ${swatch.name} CSS variable`;
  if (copied) {
    statusLabel = "Copied";
  } else if (failed) {
    statusLabel = "Copy failed";
  }

  let displayValue = valueLabel;
  if (copied) {
    displayValue = "Copied!";
  } else if (failed) {
    displayValue = "Copy failed";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-left group border border-border hover:border-foreground transition-colors duration-150"
      aria-label={statusLabel}
    >
      <div
        className="w-full h-12 border-b border-border"
        style={{ backgroundColor: `var(${swatch.name})` }}
      />
      <div className="p-2">
        <div className="text-2xs font-mono text-foreground truncate">{swatch.name}</div>
        <div
          className="text-2xs font-mono text-muted-foreground truncate"
          aria-live={copied || failed ? "polite" : undefined}
        >
          {displayValue}
        </div>
      </div>
    </button>
  );
}
