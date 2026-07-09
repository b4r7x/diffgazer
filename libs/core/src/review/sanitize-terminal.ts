// Neutralizes terminal-escape injection (CWE-150) in model/repo-derived review text.
// Ink's sanitizer strips CSI but PRESERVES OSC, so untrusted OSC-52 clipboard writes,
// title spoofing, and hyperlink phishing get through — this strips ALL escape-introduced
// bytes (C0 except \n/\t, C1 incl. CSI/OSC, and every ESC sequence). SGR is dropped too:
// even inert-looking color can conceal or spoof; style trusted text via Ink <Text> props.

const ESC = 0x1b;
const BEL = 0x07;
const CSI_FINAL_MIN = 0x40; // '@'
const CSI_FINAL_MAX = 0x7e; // '~'

function isCsiSequenceByte(code: number): boolean {
  // CSI params (0x30-0x3f) and intermediates (0x20-0x2f)
  return (code >= 0x30 && code <= 0x3f) || (code >= 0x20 && code <= 0x2f);
}

function isStrippedControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a) return false; // keep \t and \n
  // C0 (0x00-0x1f), DEL (0x7f), and C1 (0x80-0x9f)
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/** Strips every terminal escape/control sequence from untrusted text, keeping only `\n`/`\t`. */
export function sanitizeTerminalText(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const code = input.charCodeAt(i);

    if (code === ESC) {
      const next = input.charCodeAt(i + 1);
      // OSC (ESC ]): drop through BEL or ST (ESC \).
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
      // CSI (ESC [): drop params through the final byte, SGR included.
      if (next === 0x5b) {
        let j = i + 2;
        while (j < input.length && isCsiSequenceByte(input.charCodeAt(j))) {
          j++;
        }
        const finalByte = input.charCodeAt(j);
        if (finalByte >= CSI_FINAL_MIN && finalByte <= CSI_FINAL_MAX) {
          i = j + 1;
          continue;
        }
        // Malformed CSI: drop the introducer and continue.
        i += 2;
        continue;
      }
      // Other ESC sequences: drop the introducer; the control-byte filter handles the rest.
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
