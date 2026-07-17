import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHtmlShell, createEmbeddedServer, isSpaNavigationRequest } from "./embedded";

const MINIMAL_HTML = "<!DOCTYPE html><html><head></head><body></body></html>";

function requestContext(pathname: string, options: { method?: string; accept?: string } = {}) {
  return {
    req: {
      method: options.method ?? "GET",
      url: `http://localhost:3000${pathname}`,
      header: (name: string) =>
        name.toLowerCase() === "accept" ? (options.accept ?? "text/html") : undefined,
    },
  } as Parameters<typeof isSpaNavigationRequest>[0];
}

interface SessionsModule {
  createSession: (
    reviewId: string,
    options: {
      projectPath: string;
      headCommit: string;
      statusHash: string;
      mode: string;
      monotonicNow?: () => number;
    },
  ) => unknown;
  markReady: (reviewId: string) => void;
  subscribe: (
    reviewId: string,
    callback: (event: FullReviewStreamEvent) => void,
  ) => (() => void) | null;
  getSession: (reviewId: string) => unknown;
  shutdownSessions: () => void;
  startSessionMaintenance: () => void;
}

// The embedded server's stop() reaches the session registry through the
// @diffgazer/server package boundary (import("@diffgazer/server")). Load the
// same session module instance the package re-exports so a session created here
// is the one stop() aborts.
async function loadSessions(): Promise<SessionsModule> {
  const entry = import.meta.resolve("@diffgazer/server");
  return import(
    new URL("./features/review/stream/store.js", entry).href
  ) as Promise<SessionsModule>;
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
    if (nonceMatch === null) throw new Error("expected a nonce in the HTML");
    const nonce = nonceMatch[1];

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

describe("isSpaNavigationRequest", () => {
  it("treats index.html as an injected SPA shell request", () => {
    expect(isSpaNavigationRequest(requestContext("/"), "/")).toBe(true);
    expect(isSpaNavigationRequest(requestContext("/settings"), "/settings")).toBe(true);
    expect(isSpaNavigationRequest(requestContext("/index.html"), "/index.html")).toBe(true);
    expect(isSpaNavigationRequest(requestContext("/assets/app.js"), "/assets/app.js")).toBe(false);
    expect(isSpaNavigationRequest(requestContext("/api/shutdown"), "/api/shutdown")).toBe(false);
    expect(
      isSpaNavigationRequest(
        requestContext("/index.html", { accept: "application/json" }),
        "/index.html",
      ),
    ).toBe(false);
  });
});

describe("createEmbeddedServer startup failures", () => {
  it("reports missing web assets through onFailure", async () => {
    const onFailure = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const server = createEmbeddedServer({ port: 0, onFailure });
    await expect(server.start()).rejects.toThrow("Web assets not found");

    await vi.waitFor(() => {
      expect(onFailure).toHaveBeenCalledWith(expect.stringContaining("Web assets not found"));
    });
  });
});

describe("createEmbeddedServer restart after a failed listen", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("node:fs");
    vi.doUnmock("@hono/node-server");
    vi.doUnmock("@hono/node-server/serve-static");
    vi.doUnmock("@diffgazer/server");
  });

  it("re-invokes listen on a second start() after the first bind fails", async () => {
    // The top-level static import already cached ./embedded with real modules;
    // reset so the dynamic import below resolves against the mocks set here.
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const captured: {
      errorHandler: ((err: NodeJS.ErrnoException) => void) | null;
      readyCallback: ((info: { port: number }) => void) | null;
    } = { errorHandler: null, readyCallback: null };

    const serve = vi.fn((_options: unknown, callback?: (info: { port: number }) => void) => {
      captured.readyCallback = callback ?? null;
      return {
        on: (event: string, handler: (err: NodeJS.ErrnoException) => void) => {
          if (event === "error") captured.errorHandler = handler;
        },
        close: (cb?: () => void) => cb?.(),
      };
    });
    const startSessionMaintenance = vi.fn();

    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();
      return { ...actual, existsSync: () => true, readFileSync: () => MINIMAL_HTML };
    });
    vi.doMock("@hono/node-server", () => ({ serve }));
    vi.doMock("@hono/node-server/serve-static", () => ({ serveStatic: () => () => undefined }));
    vi.doMock("@diffgazer/server", () => ({
      createApp: () => ({ get: () => undefined, use: () => undefined, fetch: () => undefined }),
      shutdownSessions: () => undefined,
      startSessionMaintenance,
    }));

    const { createEmbeddedServer: createServer } = await import("./embedded");
    const onFailure = vi.fn();
    const onReady = vi.fn();
    const server = createServer({ port: 3000, onFailure, onReady });

    const firstStart = server.start();
    await vi.waitFor(() => expect(serve).toHaveBeenCalledTimes(1));

    // Simulate the bind failure the first listen attempt hits (EADDRINUSE).
    expect(captured.errorHandler).not.toBeNull();
    captured.errorHandler?.({
      code: "EADDRINUSE",
      message: "address in use",
    } as NodeJS.ErrnoException);
    expect(onFailure).toHaveBeenCalledWith(expect.stringContaining("already in use"));
    await expect(firstStart).rejects.toThrow("already in use");

    // The port is now free: a second start() must attempt to listen again.
    const secondStart = server.start();
    await vi.waitFor(() => expect(serve).toHaveBeenCalledTimes(2));
    let restartSettled = false;
    void secondStart.finally(() => {
      restartSettled = true;
    });
    await Promise.resolve();
    expect(restartSettled).toBe(false);

    // Once the second listen succeeds, the controller reports ready.
    captured.readyCallback?.({ port: 3000 });
    await expect(secondStart).resolves.toBeUndefined();
    expect(onReady).toHaveBeenCalledWith("http://localhost:3000");

    await server.stop();
    const thirdStart = server.start();
    await vi.waitFor(() => expect(serve).toHaveBeenCalledTimes(3));
    captured.readyCallback?.({ port: 3000 });
    await expect(thirdStart).resolves.toBeUndefined();
    expect(startSessionMaintenance).toHaveBeenCalledTimes(3);
  });
});

describe("embedded session maintenance lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("re-arms one maintenance interval after shutdown and times out one idle session once", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const sessions = await loadSessions();

    expect(vi.getTimerCount()).toBe(1);
    sessions.shutdownSessions();
    expect(vi.getTimerCount()).toBe(0);

    sessions.startSessionMaintenance();
    sessions.startSessionMaintenance();
    expect(vi.getTimerCount()).toBe(1);

    let monotonicNow = 0;
    const reviewId = "post-restart-idle";
    sessions.createSession(reviewId, {
      projectPath: "/tmp/project",
      headCommit: "head",
      statusHash: "status",
      mode: "staged",
      monotonicNow: () => monotonicNow,
    });
    const received: FullReviewStreamEvent[] = [];
    sessions.subscribe(reviewId, (event) => received.push(event));
    monotonicNow = 30 * 60 * 1000 + 1;

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(received).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({ code: ReviewErrorCode.SESSION_TIMEOUT }),
      }),
    ]);
    expect(sessions.getSession(reviewId)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    sessions.shutdownSessions();
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
        error: expect.objectContaining({ code: ReviewErrorCode.SERVER_SHUTDOWN }),
      }),
    );
    expect(sessions.getSession(reviewId)).toBeUndefined();
  });
});
