import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  createNitroReadyWatcher,
  describeExit,
  SERVER_READY_TIMEOUT_MS,
} from "./nitro-server-ready.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");
const SERVER_ENTRY = resolve(DOCS_ROOT, ".output/server/index.mjs");
const REQUEST_TIMEOUT_MS = 10_000;
const PATHS = ["/", "/app/architecture"];

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

const { waitForListeningOrigin } = createNitroReadyWatcher("[verify-csp]");

function nonceAttr(attrs) {
  const match = attrs.match(/\bnonce=(?:"([^"]*)"|'([^']*)')/);
  return match ? (match[1] ?? match[2]) : undefined;
}

function waitForExit(child) {
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
}

function assertPage(path, csp, html) {
  const scriptSrc = csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src"));
  if (!scriptSrc) throw new Error(`[verify-csp] ${path}: no script-src directive`);
  if (scriptSrc.includes("'unsafe-inline'")) {
    throw new Error(`[verify-csp] ${path}: script-src still allows 'unsafe-inline'`);
  }
  const cspNonceMatch = scriptSrc.match(/'nonce-([^']+)'/);
  if (!cspNonceMatch) throw new Error(`[verify-csp] ${path}: script-src carries no nonce`);
  const cspNonce = cspNonceMatch[1];

  for (const match of html.matchAll(INLINE_SCRIPT)) {
    if (match[2].length === 0) continue;
    if (nonceAttr(match[1]) !== cspNonce) {
      throw new Error(
        `[verify-csp] ${path}: an inline <script> is missing the CSP nonce and would be blocked`,
      );
    }
  }
}

async function verifyPages(origin, paths, server, fetchPage, timeoutMs) {
  for (const path of paths) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error("[verify-csp] Docs server exited before CSP requests completed");
    }

    let response;
    try {
      response = await fetchPage(new URL(path, origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new Error(`[verify-csp] ${path}: request failed`, { cause: error });
    }
    if (!response.ok) throw new Error(`[verify-csp] ${path}: returned HTTP ${response.status}`);
    assertPage(path, response.headers.get("content-security-policy") ?? "", await response.text());

    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error("[verify-csp] Docs server exited before CSP requests completed");
    }
  }
}

async function stopServer(server, serverExit) {
  if (server.exitCode !== null || server.signalCode !== null) return;

  server.kill("SIGTERM");
  const stopped = await Promise.race([
    serverExit.then(
      () => true,
      () => true,
    ),
    delay(2_000).then(() => false),
  ]);
  if (stopped) return;

  server.kill("SIGKILL");
  await Promise.race([serverExit.catch(() => undefined), delay(2_000)]);
}

export async function runCspVerification({
  serverEntry = SERVER_ENTRY,
  paths = PATHS,
  fetchPage = fetch,
  readyTimeoutMs = SERVER_READY_TIMEOUT_MS,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  if (!existsSync(serverEntry)) {
    throw new Error("[verify-csp] Built Docs server is missing; run `pnpm build` first");
  }

  const server = spawn(process.execPath, [serverEntry], {
    cwd: DOCS_ROOT,
    env: { ...process.env, HOST: "127.0.0.1", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let capturedStdout = "";
  let capturedStderr = "";
  server.stdout.on("data", (chunk) => {
    capturedStdout += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    capturedStderr += chunk.toString();
  });
  server.stdout.pipe(stdout, { end: false });
  server.stderr.pipe(stderr, { end: false });

  const serverExit = waitForExit(server);
  const serverFailure = serverExit.then(
    (exit) => {
      throw new Error(`[verify-csp] Docs server exited early with ${describeExit(exit)}`);
    },
    (error) => {
      throw new Error("[verify-csp] Docs server failed to start", { cause: error });
    },
  );

  try {
    const origin = await waitForListeningOrigin(server.stdout, serverFailure, readyTimeoutMs);
    await Promise.race([
      verifyPages(origin, paths, server, fetchPage, requestTimeoutMs),
      serverFailure,
    ]);
    console.log(
      `[verify-csp] ${paths.length} pages serve a nonce CSP covering every inline script`,
    );
    return { origin, pageCount: paths.length };
  } catch (error) {
    const diagnostics = [capturedStdout.trim(), capturedStderr.trim()].filter(Boolean).join("\n");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(diagnostics ? `${message}\n${diagnostics}` : message, { cause: error });
  } finally {
    await stopServer(server, serverExit);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCspVerification().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
