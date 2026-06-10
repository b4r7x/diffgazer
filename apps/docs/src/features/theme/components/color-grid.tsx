import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { THEME_DOCS_COLOR_GROUPS, type ThemeDocsToken } from "@diffgazer/ui/theme";
import { useCopyFeedback } from "@/lib/use-copy-feedback";

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
  const { copied, failed, showCopied, showFailed } = useCopyFeedback();

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(`var(${swatch.name})`);
      showCopied();
    } catch {
      showFailed();
    }
  };

  const valueLabel =
    swatch.darkValue === swatch.lightValue
      ? swatch.darkValue
      : `${swatch.darkValue} / ${swatch.lightValue}`;

  const statusLabel = copied
    ? "Copied"
    : failed
      ? "Copy failed"
      : `Copy ${swatch.name} CSS variable`;

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
        <div className="text-[11px] font-mono text-foreground truncate">{swatch.name}</div>
        <div
          className="text-[10px] font-mono text-muted-foreground truncate"
          aria-live={copied || failed ? "polite" : undefined}
        >
          {copied ? "Copied!" : failed ? "Copy failed" : valueLabel}
        </div>
      </div>
    </button>
  );
}
