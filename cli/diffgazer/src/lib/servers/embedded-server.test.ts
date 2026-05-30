import { describe, expect, it } from "vitest";
import { buildHtmlShell } from "./embedded-server";

const MINIMAL_HTML = "<!DOCTYPE html><html><head></head><body></body></html>";

describe("buildHtmlShell", () => {
  it("injects the shutdown token script with a nonce before </head>", () => {
    const { body } = buildHtmlShell(MINIMAL_HTML, "test-token-123");

    expect(body).toContain("window.__DIFFGAZER_SHUTDOWN_TOKEN__=");
    expect(body).toContain('"test-token-123"');
    expect(body).toMatch(/<script nonce="[A-Za-z0-9+/=]+">/);
    expect(body).toContain("</head>");
  });

  it("returns a CSP header string with a nonce matching the script tag", () => {
    const { body, csp } = buildHtmlShell(MINIMAL_HTML, "tok");

    const nonceMatch = body.match(/nonce="([A-Za-z0-9+/=]+)"/);
    expect(nonceMatch).not.toBeNull();
    const nonce = nonceMatch![1];

    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("generates a unique nonce per call", () => {
    const a = buildHtmlShell(MINIMAL_HTML, "tok");
    const b = buildHtmlShell(MINIMAL_HTML, "tok");

    const nonceA = a.body.match(/nonce="([A-Za-z0-9+/=]+)"/)?.[1];
    const nonceB = b.body.match(/nonce="([A-Za-z0-9+/=]+)"/)?.[1];

    expect(nonceA).toBeTruthy();
    expect(nonceB).toBeTruthy();
    expect(nonceA).not.toBe(nonceB);
  });

  it("JSON-escapes the token to prevent script injection", () => {
    const { body } = buildHtmlShell(MINIMAL_HTML, '</script><script>alert("xss")');

    // The token value must be JSON-encoded, which escapes the angle brackets
    expect(body).not.toContain('</script><script>alert("xss")');
    expect(body).toContain("window.__DIFFGAZER_SHUTDOWN_TOKEN__=");
  });
});
