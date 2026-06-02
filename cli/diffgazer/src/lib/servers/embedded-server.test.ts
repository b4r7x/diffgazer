import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { describe, expect, it } from "vitest";
import { buildHtmlShell, createEmbeddedServer } from "./embedded-server";

const MINIMAL_HTML = "<!DOCTYPE html><html><head></head><body></body></html>";

interface SessionsModule {
  createSession: (
    reviewId: string,
    options: { projectPath: string; headCommit: string; statusHash: string; mode: string },
  ) => unknown;
  markReady: (reviewId: string) => void;
  subscribe: (
    reviewId: string,
    callback: (event: FullReviewStreamEvent) => void,
  ) => (() => void) | null;
  getSession: (reviewId: string) => unknown;
}

// The embedded server's stop() reaches the session registry through the
// @diffgazer/server package boundary (import("@diffgazer/server")). Load the
// same session module instance the package re-exports so a session created here
// is the one stop() aborts.
async function loadSessions(): Promise<SessionsModule> {
  const entry = import.meta.resolve("@diffgazer/server");
  return import(new URL("./features/review/sessions.js", entry).href) as Promise<SessionsModule>;
}

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

  it("escapes angle brackets so the token cannot break out of the inline script", () => {
    const { body } = buildHtmlShell(MINIMAL_HTML, '</script><script>alert("xss")');

    expect(body).not.toContain("</script><script>");
    expect(body).toContain("\\u003c/script\\u003e\\u003cscript\\u003e");
    expect(body).toContain("window.__DIFFGAZER_SHUTDOWN_TOKEN__=");
  });
});

describe("createEmbeddedServer stop", () => {
  it("aborts an active review session and clears its subscriber on shutdown", async () => {
    const sessions = await loadSessions();
    const reviewId = `embedded-stop-${Date.now()}`;
    sessions.createSession(reviewId, {
      projectPath: "/tmp/project",
      headCommit: "head",
      statusHash: "status",
      mode: "staged",
    });
    sessions.markReady(reviewId);

    const received: FullReviewStreamEvent[] = [];
    sessions.subscribe(reviewId, (event) => received.push(event));

    const server = createEmbeddedServer({ port: 0 });
    await server.stop();

    expect(received).toContainEqual(
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({ code: "SESSION_STALE" }),
      }),
    );
    expect(sessions.getSession(reviewId)).toBeUndefined();
  });
});
