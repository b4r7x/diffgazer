import type { ProviderDisplayStatus } from "@diffgazer/core/providers";
import { Button } from "@diffgazer/ui/components/button";
import { Logo } from "@diffgazer/ui/components/logo";
import {
  StatusIndicator,
  type StatusIndicatorStatus,
} from "@diffgazer/ui/components/status-indicator";
import { cn } from "@diffgazer/ui/lib/utils";

/**
 * Brand weight. `banner` is the figlet hero the first-run screens open with;
 * `line` is the terminal one-line wordmark every work screen carries, matching
 * the TUI header row (back · wordmark · provider status).
 */
type WordmarkVariant = "banner" | "line";

/**
 * Transport health as the header tells it. The lamp is the app's only status
 * light, so it reports the server first: a provider cannot be "Active" through
 * a dead connection.
 */
export type HeaderServerState = "live" | "retrying" | "offline";

interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  serverState?: HeaderServerState;
  onBack?: () => void;
  wordmark?: WordmarkVariant;
}

/**
 * Slot placement per variant. The banner keeps the wordmark on its own row at
 * every width — a figlet wide enough to read cannot share a row with the back
 * link and the provider status without one overlapping the other.
 *
 * A Record rather than CVA (variants.mdx rule 1): one variant key resolves four
 * sibling slots at once, so CVA would mean four parallel `cva()` calls sharing a
 * single axis — the record keeps one grid definition readable in one place.
 */
const LAYOUT = {
  banner: {
    grid: "grid-cols-[auto_minmax(0,1fr)]",
    brand: "col-span-2 col-start-1 row-start-1",
    back: "col-start-1 row-start-2",
    status: "col-start-2 row-start-2",
  },
  line: {
    // minmax(0,…) on the side columns, not 1fr: an auto minimum would let the
    // provider status push into the wordmark instead of truncating.
    grid: "grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
    brand: "col-span-2 col-start-1 row-start-1 sm:col-span-1 sm:col-start-2",
    back: "col-start-1 row-start-2 sm:row-start-1",
    // Below sm the status takes its own full-width row: sharing row 2 with the
    // back control left a model name like "gemini-3-flash-preview" clipped
    // against the right edge at 390 instead of ellipsizing.
    status:
      "col-span-2 col-start-1 row-start-3 justify-self-start sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-self-end",
  },
} as const satisfies Record<WordmarkVariant, Record<string, string>>;

/**
 * StatusIndicator has no idle dot. Idle — still loading, or no provider yet —
 * takes the hollow offline dot, the same muted treatment the TUI header gives a
 * non-active provider. Nothing announces "offline": the real provider status is
 * the word the row renders.
 */
const DOT_STATUS: Record<ProviderDisplayStatus, StatusIndicatorStatus> = {
  active: "online",
  idle: "offline",
};

/**
 * What the lamp says when the transport is not healthy. The word replaces the
 * provider status because that is the truth the user needs first, and the dot
 * carries the same state so the row is never colour-only.
 */
const SERVER_STATE: Record<
  HeaderServerState,
  { word: string | null; dot: StatusIndicatorStatus | null; aria: string }
> = {
  live: { word: null, dot: null, aria: "live" },
  retrying: { word: "Reconnecting", dot: "offline", aria: "reconnecting" },
  offline: { word: "Offline", dot: "busy", aria: "offline" },
};

export function Header({
  providerName,
  providerStatus,
  serverState = "live",
  onBack,
  wordmark = "banner",
}: HeaderProps) {
  const layout = LAYOUT[wordmark];
  const server = SERVER_STATE[serverState];
  const statusWord = server.word ?? providerStatus;
  // StatusIndicator ships three statuses and each carries its own shape, so a
  // dead transport takes the filled square and a retry takes the hollow dot -
  // the three states stay apart without relying on colour.
  const dotStatus = server.dot ?? DOT_STATUS[providerStatus];

  return (
    <header className="@container shrink-0 p-4 pb-2">
      <div className={cn("grid min-w-0 items-center gap-x-3 gap-y-2", layout.grid)}>
        <div className={layout.back}>
          {onBack ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
            >
              ← Back
            </Button>
          ) : null}
        </div>

        <div className={cn("flex min-w-0 flex-col items-center", layout.brand)}>
          <DiffgazerWordmark variant={wordmark} />
          <div className="text-center text-2xs text-muted-foreground select-none sm:text-xs">
            ─ ✦ ─ ✧ ─
          </div>
        </div>

        <StatusIndicator
          status={dotStatus}
          pulse={false}
          label={null}
          // An aria-label replaces the children for assistive tech, so the status
          // word has to be part of it; label={null} keeps StatusIndicator from
          // adding a second visible copy.
          aria-label={`Provider: ${providerName}, ${providerStatus}; server ${server.aria}`}
          className={cn(
            "min-w-0 justify-self-end gap-1.5 text-foreground normal-case tracking-normal",
            layout.status,
          )}
        >
          <span className="min-w-0 truncate">{providerName}</span>
          {/* Below sm the dot alone carries the state so the model name keeps the row;
              the row's aria-label carries the word at every width. */}
          <span className="shrink-0 text-muted-foreground sr-only sm:not-sr-only sm:whitespace-nowrap">
            <span aria-hidden="true">• </span>
            <span className={cn("capitalize", serverState === "offline" && "text-error-text")}>
              {statusWord}
            </span>
          </span>
        </StatusIndicator>
      </div>
    </header>
  );
}

const WORDMARK_TEXT = "diffgazer";

// Precomputed figlet "Big" rendering of WORDMARK_TEXT (uppercased), trailing
// blank rows trimmed. The wordmark is fixed, so this constant keeps figlet +
// Big.js out of the browser bundle.
const WORDMARK_ASCII = [
  "  _____ _____ ______ ______ _____           ____________ _____  ",
  " |  __ \\_   _|  ____|  ____/ ____|   /\\    |___  /  ____|  __ \\ ",
  " | |  | || | | |__  | |__ | |  __   /  \\      / /| |__  | |__) |",
  " | |  | || | |  __| |  __|| | |_ | / /\\ \\    / / |  __| |  _  / ",
  " | |__| || |_| |    | |   | |__| |/ ____ \\  / /__| |____| | \\ \\ ",
  " |_____/_____|_|    |_|    \\_____/_/    \\_\\/_____|______|_|  \\_\\",
].join("\n");

function DiffgazerWordmark({ variant }: { variant: WordmarkVariant }) {
  if (variant === "line") {
    return (
      <Logo
        text={WORDMARK_TEXT.toUpperCase()}
        className="text-xs font-bold tracking-[0.35em] text-info-text sm:text-sm"
      />
    );
  }

  /*
   * The art is 64 monospace cells wide (38.4em at a 0.6em advance), so the font
   * size alone decides how much of the header it occupies: 2.2cqw fills ~85% of
   * the header, and the 1rem cap stops it from growing into a billboard on wide
   * screens. The leading modifier is not optional — a font-size utility drops
   * Logo's `leading-none`, and at any looser leading the box-drawing strokes
   * break into dashes instead of letterforms.
   */
  // The ascii art has no readable text of its own, so `text` is purely the
  // accessible name here: the product spells itself lowercase, and that spelling
  // is what every other surface announces.
  return (
    <Logo
      text={WORDMARK_TEXT}
      asciiText={WORDMARK_ASCII}
      className="text-[min(2.2cqw,1rem)]/[1] font-bold text-info-text"
    />
  );
}
