import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createNitroReadyWatcher, describeExit } from "./nitro-server-ready.mjs";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENTRY = resolve(DOCS_ROOT, ".output/server/index.mjs");
const LHCI_ENTRY = resolve(
  dirname(fileURLToPath(import.meta.resolve("@lhci/cli/package.json"))),
  "src/cli.js",
);
const PREFLIGHT_TIMEOUT_MS = 10_000;

export const LIGHTHOUSE_PAGES = [
  { path: "/", title: "diffgazer docs" },
  { path: "/ui/getting-started", title: "Getting Started - @diffgazer/ui Docs" },
] as const;

const { waitForListeningOrigin } = createNitroReadyWatcher("[lighthouse]");

interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

interface ManagedProcess {
  child: ChildProcess;
  signal: (signal: NodeJS.Signals) => void;
}

function waitForExit(child: ChildProcess): Promise<ProcessExit> {
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
}

function assertContentSecurityPolicy(path: string, value: string | null): void {
  const directives = value?.split(";").map((directive) => directive.trim()) ?? [];
  const scriptSource = directives.find(
    (directive) => directive.split(/\s+/, 1)[0] === "script-src",
  );
  const scriptElementSource = directives.find(
    (directive) => directive.split(/\s+/, 1)[0] === "script-src-elem",
  );
  const effectiveScriptSource = scriptElementSource ?? scriptSource;

  const isSafeNonceScriptSource = (directive: string | undefined): boolean => {
    const sources = directive?.split(/\s+/).slice(1) ?? [];

    return (
      sources.includes("'self'") &&
      sources.some((source) => /^'nonce-[^']+'$/.test(source)) &&
      !sources.includes("'unsafe-inline'") &&
      !sources.includes("'unsafe-eval'")
    );
  };

  if (
    !directives.includes("default-src 'self'") ||
    !isSafeNonceScriptSource(scriptSource) ||
    !isSafeNonceScriptSource(effectiveScriptSource)
  ) {
    throw new Error(`[lighthouse] ${path} did not return the expected nonce CSP`);
  }
}

export async function verifyDocsPages(
  origin: string,
  fetchPage: typeof fetch = fetch,
  timeoutMs = PREFLIGHT_TIMEOUT_MS,
): Promise<void> {
  await Promise.all(
    LIGHTHOUSE_PAGES.map(async ({ path, title }) => {
      let response: Response;
      try {
        response = await fetchPage(new URL(path, origin), {
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new Error(`[lighthouse] ${path} preflight request failed`, { cause: error });
      }
      if (response.status !== 200) {
        throw new Error(`[lighthouse] ${path} returned HTTP ${response.status}`);
      }

      assertContentSecurityPolicy(path, response.headers.get("content-security-policy"));
      const html = await response.text();
      if (!html.includes(`<title>${title}</title>`)) {
        throw new Error(`[lighthouse] ${path} did not return the expected Docs page`);
      }
    }),
  );
}

function startLhci(urls: readonly string[]): ManagedProcess {
  const usesProcessGroup = process.platform !== "win32";
  const child = spawn(process.execPath, [LHCI_ENTRY, "autorun", ...urls], {
    cwd: DOCS_ROOT,
    detached: usesProcessGroup,
    stdio: "inherit",
  });
  return {
    child,
    signal(signal) {
      if (!usesProcessGroup || !child.pid) {
        child.kill(signal);
        return;
      }

      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ESRCH") return;
        throw error;
      }
    },
  };
}

async function stopProcess(
  processHandle: ManagedProcess,
  processExit: Promise<ProcessExit>,
  signal: NodeJS.Signals,
): Promise<void> {
  if (processHandle.child.exitCode !== null || processHandle.child.signalCode !== null) return;

  processHandle.signal(signal);
  const stopped = await Promise.race([
    processExit.then(
      () => true,
      () => true,
    ),
    delay(2_000).then(() => false),
  ]);
  if (stopped) return;

  processHandle.signal("SIGKILL");
  await Promise.race([processExit.catch(() => undefined), delay(2_000)]);
}

export async function runLhci(
  origin: string,
  serverFailure: Promise<never>,
  launch: (urls: readonly string[]) => ManagedProcess = startLhci,
): Promise<void> {
  const urls = LIGHTHOUSE_PAGES.map(({ path }) => `--collect.url=${new URL(path, origin).href}`);
  const lhci = launch(urls);
  const lhciExit = waitForExit(lhci.child);

  try {
    const exit = await Promise.race([lhciExit, serverFailure]);
    if (exit.code !== 0) {
      throw new Error(`[lighthouse] Lighthouse CI exited with ${describeExit(exit)}`);
    }
  } finally {
    await stopProcess(lhci, lhciExit, "SIGTERM");
  }
}

export async function runDocsLighthouse(): Promise<void> {
  if (!existsSync(SERVER_ENTRY)) {
    throw new Error("[lighthouse] Built Docs server is missing; run `pnpm build` first");
  }

  const server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: DOCS_ROOT,
    env: { ...process.env, HOST: "127.0.0.1", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.pipe(process.stderr);
  const serverHandle: ManagedProcess = {
    child: server,
    signal: (signal) => {
      server.kill(signal);
    },
  };

  const serverExit = waitForExit(server);
  const serverFailure: Promise<never> = serverExit.then(
    (exit) => {
      throw new Error(`[lighthouse] Docs server exited early with ${describeExit(exit)}`);
    },
    (error: unknown) => {
      throw new Error("[lighthouse] Docs server failed to start", { cause: error });
    },
  );

  try {
    const origin = await waitForListeningOrigin(server.stdout, serverFailure);
    await Promise.race([verifyDocsPages(origin), serverFailure]);
    console.log(`[lighthouse] Preflight passed for ${LIGHTHOUSE_PAGES.length} canonical routes`);
    await runLhci(origin, serverFailure);
  } finally {
    await stopProcess(serverHandle, serverExit, "SIGINT");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDocsLighthouse().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
