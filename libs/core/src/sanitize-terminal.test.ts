import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sanitizeTerminalText } from "./sanitize-terminal.js";

function collectPackageImports(entry: string): Set<string> {
  const visited = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];

  while (pending.length > 0) {
    const current = pending.pop() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    const source = readFileSync(current, "utf8");
    for (const [, specifier] of source.matchAll(/\bfrom\s+"([^"]+)"/g)) {
      if (specifier?.startsWith(".")) {
        pending.push(resolve(dirname(current), specifier.replace(/\.js$/, ".ts")));
      } else if (specifier) {
        packages.add(specifier);
      }
    }
  }

  return packages;
}

describe("sanitizeTerminalText", () => {
  it("strips an OSC-52 clipboard-write sequence (BEL-terminated)", () => {
    const payload = `before\x1b]52;c;ZXZpbA==\x07after`;
    const result = sanitizeTerminalText(payload);
    expect(result).toBe("beforeafter");
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

  it.each([
    ["7-bit OSC", `x\x1b]0;evil-title\x9cy`],
    ["C1 OSC", `x\x9d0;evil-title\x9cy`],
  ])("strips %s terminated by C1 ST without consuming trailing text", (_label, payload) => {
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

  it("strips SGR color sequences (styling is applied via Ink props, not text)", () => {
    const payload = "\x1b[31mred\x1b[0m";
    const result = sanitizeTerminalText(payload);
    expect(result).toBe("red");
  });

  it("strips the conceal SGR sequence so hidden text stays visible", () => {
    const payload = "\x1b[8msecret\x1b[28m tail";
    expect(sanitizeTerminalText(payload)).toBe("secret tail");
  });

  it("strips private-prefix CSI sequences ending in m", () => {
    expect(sanitizeTerminalText("a\x1b[>4;2mb")).toBe("ab");
    expect(sanitizeTerminalText("a\x1b[?1mb")).toBe("ab");
  });

  it("strips complete C1 cursor-control sequences without consuming surrounding text", () => {
    expect(sanitizeTerminalText("before\x9b2Jmiddle\x9bHafter")).toBe("beforemiddleafter");
  });

  it("strips complete C1 SGR sequences without leaving parameter residue", () => {
    expect(sanitizeTerminalText("before\x9b31mred\x9b0mafter")).toBe("beforeredafter");
  });

  it("leaves plain text unchanged", () => {
    expect(sanitizeTerminalText("plain text with unicode żółć")).toBe(
      "plain text with unicode żółć",
    );
  });

  it("preserves ordinary RTL letters while escaping bidi formatting controls", () => {
    expect(sanitizeTerminalText("مرحبا")).toBe("مرحبا");
    expect(sanitizeTerminalText("שלום")).toBe("שלום");
  });

  it("escapes U+202E right-to-left override as a visible escape", () => {
    const payload = `safe\u202Eevil`;
    expect(sanitizeTerminalText(payload)).toBe("safe\\u202eevil");
  });

  it.each([
    ["left-to-right isolate", "\u2066"],
    ["right-to-left isolate", "\u2067"],
    ["first strong isolate", "\u2068"],
    ["pop directional isolate", "\u2069"],
  ])("escapes %s controls in repository evidence", (_label, control) => {
    const payload = `token${control}.ts`;
    const codePoint = control.codePointAt(0) ?? 0;
    expect(sanitizeTerminalText(payload)).toBe(
      `token\\u${codePoint.toString(16).padStart(4, "0")}.ts`,
    );
  });

  it("keeps astral characters whole instead of emitting half a surrogate pair", () => {
    expect(sanitizeTerminalText("claude😀")).toBe("claude😀");
    expect(sanitizeTerminalText("𝄞 score 𐍈")).toBe("𝄞 score 𐍈");
  });

  it("passes an unpaired surrogate through unchanged", () => {
    expect(sanitizeTerminalText("half\ud83d")).toBe("half\ud83d");
  });
});

// cli/server declares no react dependency, so the sanitizer it consumes must be
// reachable without loading the React review graph.
describe("@diffgazer/core/sanitize-terminal entry", () => {
  it("is published as its own subpath", () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    ) as { exports: Record<string, { types: string; import: string }> };

    expect(manifest.exports["./sanitize-terminal"]).toEqual({
      types: "./dist/sanitize-terminal.d.ts",
      import: "./dist/sanitize-terminal.js",
    });
  });

  it("pulls no package into a consumer that imports it", () => {
    const entry = fileURLToPath(new URL("./sanitize-terminal.ts", import.meta.url));

    expect([...collectPackageImports(entry)]).toEqual([]);
  });

  // The barrel's first dynamic import transforms the whole review tree; under
  // a full parallel turbo run that can exceed the default 5s.
  it("is not reachable through the React review barrel", { timeout: 20_000 }, async () => {
    const reviewBarrel = await import("./review/index.js");

    expect(Object.keys(reviewBarrel)).not.toContain("sanitizeTerminalText");
  });
});
