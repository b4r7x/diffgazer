import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHtmlShell } from "./embedded";

// The shell is asserted against the SPA this binary actually embeds, resolved
// through the declared @diffgazer/web dependency rather than a path guess.
const webRoot = dirname(createRequire(import.meta.url).resolve("@diffgazer/web/package.json"));
const indexHtml = readFileSync(resolve(webRoot, "index.html"), "utf8");

const INLINE_SCRIPT_TAG = /<script\b(?![^>]*\bsrc=)[^>]*>/gi;

describe("embedded SPA shell contract", () => {
  it("replaces the CSP nonce placeholder in the real index.html and matches inline script nonces", () => {
    const { body, csp } = buildHtmlShell(indexHtml, "shutdown-token");

    expect(body).not.toContain("{{cspNonce}}");
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();

    const inlineScripts = body.match(INLINE_SCRIPT_TAG) ?? [];
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const openingTag of inlineScripts) {
      expect(openingTag).toContain(`nonce="${nonce}"`);
    }
  });
});
