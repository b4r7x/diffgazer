import { Button } from "@diffgazer/ui/components/button";
import { Logo } from "@diffgazer/ui/components/logo";
import { cn } from "@diffgazer/ui/lib/utils";

/** @see diffgazer/apps/cli/src/components/layout/header.tsx ProviderDisplayStatus (identical CLI variant) */
type ProviderDisplayStatus = "active" | "idle";

interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  onBack?: () => void;
}

export function Header({ providerName, providerStatus, onBack }: HeaderProps) {
  return (
    <header className="relative p-4 pb-2 shrink-0">
      {onBack && (
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-tui-muted hover:text-tui-fg"
          >
            ← Back
          </Button>
        </div>
      )}

      <output
        className="absolute top-4 right-4 text-xs"
        aria-label={`Provider: ${providerName}, Status: ${providerStatus}`}
      >
        <span className="text-tui-muted">●</span> {providerName}{" "}
        <span className="text-tui-muted">•</span>{" "}
        <span className="text-tui-muted capitalize">{providerStatus}</span>
      </output>

      <div className="flex flex-col items-center pt-4 md:pt-6">
        <DiffgazerWordmark />

        <div className="text-center text-tui-muted text-sm select-none">─ ✦ ─ ✧ ─</div>
      </div>
    </header>
  );
}

const WORDMARK_TEXT = "diffgazer";

// Precomputed figlet "Big" rendering of WORDMARK_TEXT (uppercased). The wordmark
// is fixed, so this constant keeps figlet + Big.js out of the browser bundle.
const WORDMARK_ASCII = [
  "  _____ _____ ______ ______ _____           ____________ _____  ",
  " |  __ \\_   _|  ____|  ____/ ____|   /\\    |___  /  ____|  __ \\ ",
  " | |  | || | | |__  | |__ | |  __   /  \\      / /| |__  | |__) |",
  " | |  | || | |  __| |  __|| | |_ | / /\\ \\    / / |  __| |  _  / ",
  " | |__| || |_| |    | |   | |__| |/ ____ \\  / /__| |____| | \\ \\ ",
  " |_____/_____|_|    |_|    \\_____/_/    \\_\\/_____|______|_|  \\_\\",
  "                                                                ",
  "                                                                ",
].join("\n");

function DiffgazerWordmark() {
  return (
    <Logo
      text={WORDMARK_TEXT.toUpperCase()}
      asciiText={WORDMARK_ASCII}
      className={cn(
        "text-tui-blue font-bold",
        "text-3xs md:text-2xs lg:text-xs",
        "[zoom:0.8] md:[zoom:1] lg:[zoom:1.2]",
      )}
    />
  );
}
