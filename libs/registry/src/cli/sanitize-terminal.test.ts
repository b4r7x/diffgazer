import { describe, expect, it } from "vitest";
import { sanitizeTerminalText } from "./sanitize-terminal.js";

describe("sanitizeTerminalText", () => {
  it("strips OSC sequences before terminal output", () => {
    expect(sanitizeTerminalText(`before\x1b]0;evil-title\x1b\\after`)).toBe("beforeafter");
  });

  it("strips CSI color sequences from untrusted diff lines", () => {
    expect(sanitizeTerminalText("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("keeps newlines and tabs in diff output", () => {
    expect(sanitizeTerminalText("line1\nline2\tcol")).toBe("line1\nline2\tcol");
  });

  it("escapes U+202E right-to-left override as a visible escape", () => {
    const payload = `safe\u202Eevil`;
    expect(sanitizeTerminalText(payload)).toBe("safe\\u202eevil");
    expect(sanitizeTerminalText(payload)).not.toContain("\u202E");
  });

  it("keeps astral characters whole instead of emitting half a surrogate pair", () => {
    expect(sanitizeTerminalText("a\uD83D\uDE00b")).toBe("a\uD83D\uDE00b");
    expect(sanitizeTerminalText("\uD834\uDD1E score \uD800\uDF48")).toBe(
      "\uD834\uDD1E score \uD800\uDF48",
    );
  });

  it("passes an unpaired surrogate through unchanged", () => {
    expect(sanitizeTerminalText("half\ud83d")).toBe("half\ud83d");
  });
});
