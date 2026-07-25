const ESC = String.fromCharCode(27);
const TRUECOLOR = new RegExp(`${ESC}\\[(38|48);2;(\\d+);(\\d+);(\\d+)m`, "g");

function toHex(red: string, green: string, blue: string): string {
  return `#${[red, green, blue].map((value) => Number(value).toString(16).padStart(2, "0")).join("")}`;
}

function collect(frame: string, channel: "38" | "48"): string[] {
  const seen = new Set<string>();
  for (const [, matched, red, green, blue] of frame.matchAll(TRUECOLOR)) {
    if (matched !== channel || red === undefined || green === undefined || blue === undefined) {
      continue;
    }
    seen.add(toHex(red, green, blue));
  }
  return [...seen];
}

/**
 * Ink resolves colour support once, when it first imports chalk, so a frame
 * only carries these codes in a test file that sets `FORCE_COLOR` from a
 * `vi.hoisted` block — before that import runs.
 */
export function frameForegrounds(frame: string): string[] {
  return collect(frame, "38");
}

/** Row fills painted in the frame, in first-seen order. */
export function frameBackgrounds(frame: string): string[] {
  return collect(frame, "48");
}
