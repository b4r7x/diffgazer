import type { ProviderDisplayStatus } from "@diffgazer/core/providers";
import { Button } from "@diffgazer/ui/components/button";
import { Logo } from "@diffgazer/ui/components/logo";
import { cn } from "@diffgazer/ui/lib/utils";

interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  onBack?: () => void;
  /** Wordmark size: dense work screens (review, history) render it smaller. */
  wordmark?: "full" | "compact";
}

export function Header({ providerName, providerStatus, onBack, wordmark = "full" }: HeaderProps) {
  return (
    <header className="relative p-4 pb-2 shrink-0">
      {onBack && (
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Button>
        </div>
      )}

      <output
        className="absolute top-4 right-4 text-xs"
        aria-label={`Provider: ${providerName}, Status: ${providerStatus}`}
      >
        <span className="text-muted-foreground">●</span> {providerName}{" "}
        <span className="text-muted-foreground">•</span>{" "}
        <span className="text-muted-foreground capitalize">{providerStatus}</span>
      </output>

      <div className={cn("flex flex-col items-center", wordmark === "full" && "pt-4 md:pt-6")}>
        <DiffgazerWordmark size={wordmark} />

        <div
          className={cn(
            "text-center text-muted-foreground select-none",
            wordmark === "full" ? "text-sm" : "text-xs",
          )}
        >
          ─ ✦ ─ ✧ ─
        </div>
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

function DiffgazerWordmark({ size }: { size: "full" | "compact" }) {
  return (
    <Logo
      text={WORDMARK_TEXT.toUpperCase()}
      asciiText={WORDMARK_ASCII}
      className={cn(
        "text-info-text font-bold",
        size === "full"
          ? "text-3xs md:text-2xs lg:text-xs [zoom:0.8] md:[zoom:1] lg:[zoom:1.2]"
          : "text-3xs md:text-3xs lg:text-2xs",
      )}
    />
  );
}
