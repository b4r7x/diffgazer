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
    <header className="shrink-0 p-4 pb-2">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
        <div className="col-start-1 row-start-2 sm:row-start-1 sm:justify-self-start">
          {onBack ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Back
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            "col-span-2 col-start-1 row-start-1 flex flex-col items-center sm:col-span-1 sm:col-start-2",
            wordmark === "full" && "sm:pt-4 md:pt-6",
          )}
        >
          <Logo text={WORDMARK_TEXT.toUpperCase()} className="text-info-text sm:hidden" />
          <div className="hidden sm:block">
            <DiffgazerWordmark size={wordmark} />
          </div>

          <div
            className={cn(
              "text-center text-muted-foreground select-none",
              wordmark === "full" ? "text-sm" : "text-xs",
            )}
          >
            ─ ✦ ─ ✧ ─
          </div>
        </div>

        <output
          className="col-start-2 row-start-2 block min-w-0 truncate text-right text-xs sm:col-start-3 sm:row-start-1 sm:justify-self-end"
          aria-label={`Provider: ${providerName}, Status: ${providerStatus}`}
        >
          <span className="text-muted-foreground">●</span> {providerName}{" "}
          <span className="text-muted-foreground">•</span>{" "}
          <span className="text-muted-foreground capitalize">{providerStatus}</span>
        </output>
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
