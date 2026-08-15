// MIRROR of libs/core/src/sanitize-terminal.ts, kept as a copy because libs/core already
// devDepends on @diffgazer/registry (scripts/verify-dist-esm-imports.ts), so importing core
// from here would make the package graph cyclic under turbo's `^build`. Fix the escape
// grammar in BOTH files — scripts/monorepo/sanitize-terminal-parity.test.mjs fails when the
// shared declarations drift apart. Core carries extra structural-control helpers this copy
// omits.
//
// Neutralizes terminal-escape injection (CWE-150) in repo-derived CLI text.
// Strips every escape/control sequence, keeping only `\n`/`\t`.

const ESC = 0x1b;
const BEL = 0x07;
const C1_ST = 0x9c;
const CSI_FINAL_MIN = 0x40; // '@'
const CSI_FINAL_MAX = 0x7e; // '~'

function isCsiSequenceByte(code: number): boolean {
  return (code >= 0x30 && code <= 0x3f) || (code >= 0x20 && code <= 0x2f);
}

function consumeCsi(input: string, start: number): number | null {
  let index = start;
  while (index < input.length && isCsiSequenceByte(input.charCodeAt(index))) {
    index += 1;
  }

  const finalByte = input.charCodeAt(index);
  return finalByte >= CSI_FINAL_MIN && finalByte <= CSI_FINAL_MAX ? index + 1 : null;
}

function consumeOsc(input: string, start: number): number {
  let index = start;
  while (index < input.length) {
    const code = input.charCodeAt(index);
    if (code === BEL || code === C1_ST) return index + 1;
    if (code === ESC && input.charCodeAt(index + 1) === 0x5c) return index + 2;
    index += 1;
  }
  return index;
}

function isStrippedControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a) return false;
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

const UNICODE_BIDI_FORMATTING_CONTROLS = new Set([
  0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);

/** Unicode bidi formatting controls that can spoof visual token order in terminals. */
function isUnicodeBidiFormattingControl(codePoint: number): boolean {
  return UNICODE_BIDI_FORMATTING_CONTROLS.has(codePoint);
}

function escapeBidiFormattingControl(codePoint: number): string {
  return `\\u${codePoint.toString(16).padStart(4, "0")}`;
}

/** Strips terminal escape/control sequences from untrusted text, keeping only `\n`/`\t`. */
export function sanitizeTerminalText(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const code = input.charCodeAt(i);

    if (code === ESC) {
      const next = input.charCodeAt(i + 1);
      if (next === 0x5d) {
        i = consumeOsc(input, i + 2);
        continue;
      }
      if (next === 0x5b) {
        const end = consumeCsi(input, i + 2);
        if (end !== null) {
          i = end;
          continue;
        }
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (code === 0x9b) {
      i = consumeCsi(input, i + 1) ?? i + 1;
      continue;
    }

    if (code === 0x9d) {
      i = consumeOsc(input, i + 1);
      continue;
    }

    if (isStrippedControl(code)) {
      i += 1;
      continue;
    }

    // Every in-range index yields a code point; an unpaired surrogate yields
    // itself. Copying the whole character keeps astral text (emoji, CJK
    // extensions) intact instead of emitting half a surrogate pair.
    const codePoint = input.codePointAt(i) ?? code;
    const character = String.fromCodePoint(codePoint);
    out += isUnicodeBidiFormattingControl(codePoint)
      ? escapeBidiFormattingControl(codePoint)
      : character;
    i += character.length;
  }
  return out;
}
