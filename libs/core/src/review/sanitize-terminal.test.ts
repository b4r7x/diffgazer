import { describe, expect, it } from "vitest";
import { sanitizeTerminalText } from "./sanitize-terminal.js";

describe("sanitizeTerminalText", () => {
  it("strips an OSC-52 clipboard-write sequence (BEL-terminated)", () => {
    const payload = `before\x1b]52;c;ZXZpbA==\x07after`;
    const result = sanitizeTerminalText(payload);
    expect(result).toBe("beforeafter");
    expect(result).not.toContain("\x1b");
    expect(result).not.toContain("\x07");
  });

  it("strips an OSC sequence terminated by ST (ESC backslash)", () => {
    const payload = `a\x1b]0;evil-title\x1b\\b`;
    expect(sanitizeTerminalText(payload)).toBe("ab");
  });

  it("strips an OSC-8 hyperlink sequence", () => {
    const payload = `\x1b]8;;https://evil.example\x07click\x1b]8;;\x07`;
    expect(sanitizeTerminalText(payload)).toBe("click");
  });

  it("strips a C1 OSC introducer (0x9d)", () => {
    const payload = `x\x9d52;c;ZXZpbA==\x07y`;
    expect(sanitizeTerminalText(payload)).toBe("xy");
  });

  it("strips C0 control bytes but keeps \\n and \\t", () => {
    const payload = "line1\nline2\tcol\x00\x08bel";
    expect(sanitizeTerminalText(payload)).toBe("line1\nline2\tcolbel");
  });

  it("strips non-SGR CSI sequences (e.g. cursor moves)", () => {
    const payload = "a\x1b[2Jb\x1b[Hc";
    expect(sanitizeTerminalText(payload)).toBe("abc");
  });

  it("preserves inert SGR color sequences", () => {
    const payload = "\x1b[31mred\x1b[0m";
    expect(sanitizeTerminalText(payload)).toBe("\x1b[31mred\x1b[0m");
  });

  it("strips private-prefix CSI sequences ending in m", () => {
    expect(sanitizeTerminalText("a\x1b[>4;2mb")).toBe("ab");
    expect(sanitizeTerminalText("a\x1b[?1mb")).toBe("ab");
  });

  it("leaves plain text unchanged", () => {
    expect(sanitizeTerminalText("plain text with unicode żółć")).toBe(
      "plain text with unicode żółć",
    );
  });
});
