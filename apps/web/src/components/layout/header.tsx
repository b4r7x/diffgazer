import { cn } from "@diffgazer/ui/lib/utils";
import { getFigletText } from "@diffgazer/core/get-figlet";
import { Logo } from "@diffgazer/ui/components/logo";
import { Button } from "@diffgazer/ui/components/button";

/** @see diffgazer/apps/cli/src/components/layout/header.tsx ProviderDisplayStatus (identical CLI variant) */
type ProviderDisplayStatus = "active" | "idle";

interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  onBack?: () => void;
}

export function Header({
  providerName,
  providerStatus,
  onBack,
}: HeaderProps) {
  return (
    <header className="relative p-4 pb-2 shrink-0">
      {onBack && (
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-tui-muted hover:text-tui-fg">
            ← Back
          </Button>
        </div>
      )}

      <div className="absolute top-4 right-4 text-xs" aria-label={`Provider: ${providerName}, Status: ${providerStatus}`}>
        <span className="text-tui-muted">●</span> {providerName} <span className="text-tui-muted">•</span>{" "}
        <span className="text-tui-muted capitalize">{providerStatus}</span>
      </div>

      <div className="flex flex-col items-center pt-4 md:pt-6">
        <DiffgazerWordmark />

        <div className="text-center text-tui-muted text-sm select-none">─ ✦ ─ ✧ ─</div>
      </div>
    </header>
  );
}

const WORDMARK_TEXT = "diffgazer";
const WORDMARK_ASCII = getFigletText(WORDMARK_TEXT);

function DiffgazerWordmark() {
  return (
    <Logo
      text={WORDMARK_TEXT.toUpperCase()}
      asciiText={WORDMARK_ASCII ?? undefined}
      className={cn(
        "text-tui-blue font-bold",
        WORDMARK_ASCII ? undefined : "opacity-50",
        "text-[8px] md:text-[10px] lg:text-xs",
        "[zoom:0.8] md:[zoom:1] lg:[zoom:1.2]",
      )}
    />
  );
}
