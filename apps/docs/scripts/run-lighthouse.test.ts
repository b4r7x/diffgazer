import { type ChildProcess, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { LIGHTHOUSE_PAGES, runLhci, verifyDocsPages } from "./run-lighthouse";

const CSP = "default-src 'self'; script-src 'self' 'nonce-test'";
const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("Docs Lighthouse runner", () => {
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

  it("rejects with the Lighthouse CI exit diagnostic when the LHCI process exits nonzero", async () => {
    const launch = () => {
      const child = spawn(process.execPath, ["-e", "process.exit(2)"], { stdio: "ignore" });
      return {
        child,
        signal(signal: NodeJS.Signals) {
          child.kill(signal);
        },
      };
    };

    await expect(
      runLhci("http://127.0.0.1:40000", new Promise<never>(() => {}), launch),
    ).rejects.toThrow("[lighthouse] Lighthouse CI exited with code 2");
  });

  it("exits 1 with the missing-build diagnostic when the Docs server was never built", async () => {
    const docsLocalRoot = mkdtempSync(resolve(DOCS_ROOT, "docs-local-"));
    try {
      const scriptsDir = resolve(docsLocalRoot, "scripts");
      mkdirSync(scriptsDir, { recursive: true });
      const entry = resolve(scriptsDir, "run-lighthouse.ts");
      copyFileSync(resolve(DOCS_ROOT, "scripts/run-lighthouse.ts"), entry);
      copyFileSync(
        resolve(DOCS_ROOT, "scripts/nitro-server-ready.mjs"),
        resolve(scriptsDir, "nitro-server-ready.mjs"),
      );

      const child = spawn(process.execPath, ["--import", "tsx", entry], {
        cwd: DOCS_ROOT,
        stdio: ["ignore", "ignore", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const exitCode = await new Promise<number | null>((resolveExit) => {
        child.once("exit", (code) => resolveExit(code));
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain("[lighthouse] Built Docs server is missing; run `pnpm build` first");
    } finally {
      rmSync(docsLocalRoot, { recursive: true, force: true });
    }
  });

  it("targets the two canonical routes", () => {
    expect(LIGHTHOUSE_PAGES.map(({ path }) => path)).toEqual(["/", "/ui/getting-started"]);
  });
});
