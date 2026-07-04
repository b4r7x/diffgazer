// Neutralizes terminal-escape injection (CWE-150) in model/repo-derived review
// text before it is stored, streamed, or rendered. Ink's text sanitizer strips
// dangerous CSI sequences but PRESERVES OSC sequences (clipboard/title/hyperlink),
// so a malicious repo can drive OSC-52 clipboard writes, title spoofing, and
// hyperlink phishing through AI output. This strips:
//   - C0 control bytes except \n and \t
//   - C1 control bytes (incl. 0x9b CSI, 0x9d OSC)
//   - every ESC-introduced sequence EXCEPT inert SGR color (`ESC [ ... m`)
// SGR color is preserved because it has no side effects and is used for
// legitimate styling; OSC (`ESC ]` … BEL/ST), other CSI, single ESC, and C1
// controls are removed.

const ESC = 0x1b;
const BEL = 0x07;
const CSI_FINAL_MIN = 0x40; // '@'
const CSI_FINAL_MAX = 0x7e; // '~'

function isCsiSequenceByte(code: number): boolean {
  // params (0x30-0x3f) and intermediates (0x20-0x2f) of a CSI sequence
  return (code >= 0x30 && code <= 0x3f) || (code >= 0x20 && code <= 0x2f);
}

function isSgrParamByte(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || code === 0x3a || code === 0x3b;
}

function isStrippedControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a) return false; // keep \t and \n
  // C0 (0x00-0x1f), DEL (0x7f), and C1 (0x80-0x9f)
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/**
 * Strips terminal escape/control sequences from untrusted text, preserving plain
 * SGR color and the harmless `\n`/`\t` whitespace.
 */
export function sanitizeTerminalText(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const code = input.charCodeAt(i);

    if (code === ESC) {
      const next = input.charCodeAt(i + 1);
      // OSC: ESC ] ... terminated by BEL or ST (ESC \). Drop the whole sequence.
      if (next === 0x5d) {
        i += 2;
        while (i < input.length) {
          const c = input.charCodeAt(i);
          if (c === BEL) {
            i += 1;
            break;
          }
          if (c === ESC && input.charCodeAt(i + 1) === 0x5c) {
            i += 2;
            break;
          }
          i += 1;
        }
        continue;
      }
      // CSI: ESC [ params final. Keep only the SGR form (final byte 'm').
      if (next === 0x5b) {
        let j = i + 2;
        let hasOnlySgrParams = true;
        while (j < input.length && isCsiSequenceByte(input.charCodeAt(j))) {
          if (!isSgrParamByte(input.charCodeAt(j))) {
            hasOnlySgrParams = false;
          }
          j++;
        }
        const finalByte = input.charCodeAt(j);
        if (finalByte >= CSI_FINAL_MIN && finalByte <= CSI_FINAL_MAX) {
          if (finalByte === 0x6d && hasOnlySgrParams) {
            out += input.slice(i, j + 1); // preserve inert SGR
          }
          i = j + 1;
          continue;
        }
        // Malformed CSI: drop the introducer and continue.
        i += 2;
        continue;
      }
      // Any other ESC-introduced sequence (single ESC, ESC P/X/^/_, ...): drop
      // the introducer; remaining bytes are handled by the control-byte filter.
      i += 1;
      continue;
    }

    // C1 OSC introducer (0x9d) ... terminated by BEL or ST.
    if (code === 0x9d) {
      i += 1;
      while (i < input.length) {
        const c = input.charCodeAt(i);
        if (c === BEL) {
          i += 1;
          break;
        }
        if (c === ESC && input.charCodeAt(i + 1) === 0x5c) {
          i += 2;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (isStrippedControl(code)) {
      i += 1;
      continue;
    }

    out += input[i];
    i += 1;
  }
  return out;
}
