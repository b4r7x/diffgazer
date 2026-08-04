import { Logo } from "@diffgazer/ui/components/logo";
import { cva } from "class-variance-authority";

/**
 * Brand weight. `hero` is the full banner the cover screens open with, `dense`
 * the same art shrunk for work-screen headers. Both are the one block under a
 * transform: a single canonical rendering keeps the glyph geometry identical at
 * every size, so the size ladder is scale-only.
 */
export type WordmarkTier = "hero" | "dense";

/**
 * The brand spells itself lowercase, and this string is also the wordmark's
 * accessible name — the ascii art has no readable text of its own, and every
 * surface (web, TUI) announces the same word.
 */
const WORDMARK_TEXT = "diffgazer";

// Precomputed figlet "Big" rendering of WORDMARK_TEXT (uppercased), trailing
// blank rows trimmed. The wordmark is fixed, so this constant keeps figlet +
// Big.js out of the browser bundle. `scripts/monorepo/wordmark-parity.test.mjs`
// reads this file as text and matches the `[...].join("\n")` shape, so keep the
// literal in that form when editing.
const WORDMARK_ASCII = [
  "  _____ _____ ______ ______ _____           ____________ _____  ",
  " |  __ \\_   _|  ____|  ____/ ____|   /\\    |___  /  ____|  __ \\ ",
  " | |  | || | | |__  | |__ | |  __   /  \\      / /| |__  | |__) |",
  " | |  | || | |  __| |  __|| | |_ | / /\\ \\    / / |  __| |  _  / ",
  " | |__| || |_| |    | |   | |__| |/ ____ \\  / /__| |____| | \\ \\ ",
  " |_____/_____|_|    |_|    \\_____/_/    \\_\\/_____|______|_|  \\_\\",
].join("\n");

/**
 * The frame is the layout box. A transform does not take space, so the frame
 * reserves the scaled size itself — 64 monospace cells wide, 6 rows at the
 * canonical 4/3 leading (8em) tall — times the tier scale. `ch` and `em` resolve
 * against the 14px font set right here, which is why the frame carries the font
 * even though the art renders one level down.
 *
 * The steps are geometry, not taste: the block centres in the header while the
 * status chip floats in the same band's right corner, so the hero only reaches
 * its full ~538px once the viewport can seat both (1280px, where they clear each
 * other by a few pixels). Narrower viewports step it down instead of letting the
 * art slide under the chip.
 */
const wordmarkFrameVariants = cva(
  "font-mono text-sm/[1] w-[calc(64ch*var(--wm-scale))] h-[calc(8em*var(--wm-scale))]",
  {
    variants: {
      tier: {
        hero: "[--wm-scale:0.5] lg:[--wm-scale:0.75] xl:[--wm-scale:1]",
        dense: "[--wm-scale:0.4] sm:[--wm-scale:0.55]",
      },
    },
  },
);

/** The app's one ascii wordmark, sized by scaling the single canonical block. */
export function DiffgazerWordmark({ tier }: { tier: WordmarkTier }) {
  return (
    <div className={wordmarkFrameVariants({ tier })}>
      {/* The art is laid out at full size and only the scale brings it back into
          the frame, so `w-max` sizes it to its own 64 cells instead of to the
          already-scaled frame, and `max-w-none overflow-visible` drops Logo's
          clip guard — that guard assumes a component sizing itself to its
          container, and here it would shear off the trailing columns mid-word.
          The 4/3 leading is the canonical figlet presentation the README art
          uses; pinning line-height to 1 squashes the rows into a dashed, squat
          block. */}
      <Logo
        text={WORDMARK_TEXT}
        asciiText={WORDMARK_ASCII}
        className="w-max max-w-none origin-top-left overflow-visible scale-[var(--wm-scale)] text-sm/[1.3333] font-bold text-info-text"
      />
    </div>
  );
}
