import { spawn } from "node:child_process";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Drift guard: boot the built Nitro server and prove the production CSP actually
// covers every inline script. The CSP carries a per-request nonce instead of
// 'unsafe-inline'; if a future inline <script> ships without that nonce it would
// be CSP-blocked at runtime, so this fails the build before deploy.
const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");
const SERVER_ENTRY = resolve(DOCS_ROOT, ".output/server/index.mjs");
const PORT = 4321;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PATHS = ["/", "/app/architecture"];

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

function nonceAttr(attrs) {
  const match = attrs.match(/\bnonce=(?:"([^"]*)"|'([^']*)')/);
  return match ? (match[1] ?? match[2]) : undefined;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) return;
    } catch {
      // server not up yet
    }
    await delay(500);
  }
  throw new Error("[verify-csp] server did not become ready");
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

const server = spawn("node", [SERVER_ENTRY], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(PORT) },
  stdio: ["ignore", "ignore", "inherit"],
});

try {
  await waitForServer();
  for (const path of PATHS) {
    const response = await fetch(`${ORIGIN}${path}`);
    const csp = response.headers.get("content-security-policy") ?? "";
    assertPage(path, csp, await response.text());
  }
  console.log(`[verify-csp] ${PATHS.length} pages serve a nonce CSP covering every inline script`);
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), delay(2000)]);
}
