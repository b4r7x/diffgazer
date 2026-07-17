import { type ChildProcess, spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  LIGHTHOUSE_PAGES,
  parseListeningOrigin,
  runLhci,
  verifyDocsPages,
  waitForListeningOrigin,
} from "./run-lighthouse";

const CSP = "default-src 'self'; script-src 'self' 'nonce-test'";

describe("Docs Lighthouse runner", () => {
  it("parses the dynamic loopback origin from Nitro's listening line", () => {
    expect(
      parseListeningOrigin("\u001b[32m➜ Listening on: http://127.0.0.1:49983/\u001b[39m"),
    ).toBe("http://127.0.0.1:49983");
  });

  it("fails when Nitro exits before reporting its origin", async () => {
    const stdout = new PassThrough();
    const serverFailure = Promise.reject(new Error("Docs server exited early with code 1"));

    await expect(waitForListeningOrigin(stdout, serverFailure, 100)).rejects.toThrow(
      "Docs server exited early with code 1",
    );
  });

  it("rejects an invalid port through the readiness promise", async () => {
    const stdout = new PassThrough();
    const origin = waitForListeningOrigin(stdout, new Promise<never>(() => {}), 100);
    stdout.write("➜ Listening on: http://127.0.0.1:70000/\n");

    await expect(origin).rejects.toThrow("Nitro reported an invalid port: 70000");
  });

  it("rejects a successful response from the wrong site", async () => {
    const fetchPage = vi.fn<typeof fetch>().mockImplementation(async () => {
      return new Response("<title>Unrelated site</title>", {
        status: 200,
        headers: { "content-security-policy": CSP },
      });
    });

    await expect(verifyDocsPages("http://127.0.0.1:40000", fetchPage)).rejects.toThrow(
      "did not return the expected Docs page",
    );
  });

  it.each([
    "default-src 'self'; script-src-elem 'self' 'nonce-test'",
    `${CSP}; script-src-elem 'self' 'unsafe-inline'`,
    `${CSP}; script-src-elem 'self'`,
    `${CSP}; script-src-elem 'nonce-test'`,
    `${CSP}; script-src-elem 'self' 'nonce-test' 'unsafe-eval'`,
  ])("rejects a CSP without an exact safe script-src directive", async (csp) => {
    const fetchPage = vi.fn<typeof fetch>().mockImplementation(async () => {
      return new Response("<title>diffgazer docs</title>", {
        status: 200,
        headers: { "content-security-policy": csp },
      });
    });

    await expect(verifyDocsPages("http://127.0.0.1:40000", fetchPage)).rejects.toThrow(
      "did not return the expected nonce CSP",
    );
  });

  it("aborts stalled preflight requests", async () => {
    const signals: AbortSignal[] = [];
    const fetchPage = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const signal = init?.signal;
      if (!signal) throw new Error("missing abort signal");
      signals.push(signal);
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });

    await expect(verifyDocsPages("http://127.0.0.1:40000", fetchPage, 10)).rejects.toThrow(
      "preflight request failed",
    );
    expect(signals).toHaveLength(2);
    await Promise.all(
      signals.map((signal) => {
        if (signal.aborted) return Promise.resolve();
        return new Promise<void>((resolveAbort) => {
          signal.addEventListener("abort", () => resolveAbort(), { once: true });
        });
      }),
    );
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("terminates and awaits LHCI when the Docs server exits", async () => {
    let child: ChildProcess | undefined;
    const signals: NodeJS.Signals[] = [];
    const launch = () => {
      child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
        stdio: "ignore",
      });
      return {
        child,
        signal(signal: NodeJS.Signals) {
          signals.push(signal);
          child?.kill(signal);
        },
      };
    };

    await expect(
      runLhci(
        "http://127.0.0.1:40000",
        Promise.reject(new Error("Docs server exited early with code 1")),
        launch,
      ),
    ).rejects.toThrow("Docs server exited early with code 1");
    expect(signals).toEqual(["SIGTERM"]);
    expect(child?.signalCode).toBe("SIGTERM");
  });

  it("targets the two canonical routes", () => {
    expect(LIGHTHOUSE_PAGES.map(({ path }) => path)).toEqual(["/", "/ui/getting-started"]);
  });
});
