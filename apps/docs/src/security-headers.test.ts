import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocsContentSecurityPolicy } from "./security-headers";

const repoRoot = resolve(import.meta.dirname, "../../..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("docs typography security contract", () => {
  it("allows only same-origin and embedded fonts", () => {
    const policy = buildDocsContentSecurityPolicy("test-nonce");

    expect(policy).toContain("font-src 'self' data:");
    expect(policy).not.toContain("fonts.googleapis.com");
    expect(policy).not.toContain("fonts.gstatic.com");
  });

  it("keeps the CSS asset and both setup guides aligned with the self-hosted policy", () => {
    const css = readRepoFile("apps/docs/src/index.css");
    const typography = readRepoFile("libs/ui/docs/content/theme/typography.mdx");
    const tailwindSetup = readRepoFile("libs/ui/docs/content/getting-started/tailwind-setup.mdx");
    const fontPath = resolve(import.meta.dirname, "assets/fonts/jetbrains-mono.woff2");

    expect(css).toContain('url("./assets/fonts/jetbrains-mono.woff2")');
    expect(existsSync(fontPath)).toBe(true);
    const font = readFileSync(fontPath);
    expect(font.subarray(0, 4).toString("ascii")).toBe("wOF2");
    expect(font.byteLength).toBeGreaterThan(1024);

    for (const guide of [typography, tailwindSetup]) {
      expect(guide).toMatch(/self-host/i);
      expect(guide).toContain("font-src 'self'");
      expect(guide).not.toContain("fonts.googleapis.com");
      expect(guide).not.toContain("fonts.gstatic.com");
    }
    expect(typography).toContain("@font-face");
    expect(tailwindSetup).toContain('url("/fonts/jetbrains-mono.woff2")');
  });
});
