import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { runCspVerification } from "./verify-csp.mjs";

const tempDirs = [];
const servers = [];
const CSP = "default-src 'self'; script-src 'self' 'nonce-test'";
const HTML = '<!doctype html><title>Fixture</title><script nonce="test">0</script>';

function writeChild(source) {
  const directory = mkdtempSync(join(tmpdir(), "diffgazer-csp-"));
  tempDirs.push(directory);
  const entry = join(directory, "server.mjs");
  writeFileSync(entry, source);
  return entry;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close));
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("verify-csp", () => {
  it("verifies pages at the dynamic origin emitted by its child", async () => {
    const entry = writeChild(`
      import { createServer } from "node:http";
      const server = createServer((_request, response) => {
        response.writeHead(200, { "content-security-policy": ${JSON.stringify(CSP)} });
        response.end(${JSON.stringify(HTML)});
      });
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        console.log(\`➜ Listening on: http://127.0.0.1:\${address.port}/\`);
      });
      process.on("SIGTERM", () => server.close(() => process.exit(0)));
    `);

    const result = await runCspVerification({
      serverEntry: entry,
      paths: ["/", "/app/architecture"],
      readyTimeoutMs: 2_000,
      requestTimeoutMs: 1_000,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
    });

    expect(new URL(result.origin).hostname).toBe("127.0.0.1");
    expect(Number(new URL(result.origin).port)).toBeGreaterThan(0);
    expect(result.pageCount).toBe(2);
  });

  it("rejects a nonempty inline script whose nonce does not match the CSP nonce", async () => {
    const entry = writeChild(`
      import { createServer } from "node:http";
      const server = createServer((_request, response) => {
        response.writeHead(200, { "content-security-policy": ${JSON.stringify(CSP)} });
        response.end(${JSON.stringify('<!doctype html><title>Fixture</title><script nonce="different">0</script>')});
      });
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        console.log(\`➜ Listening on: http://127.0.0.1:\${address.port}/\`);
      });
      process.on("SIGTERM", () => server.close(() => process.exit(0)));
    `);

    await expect(
      runCspVerification({
        serverEntry: entry,
        paths: ["/"],
        readyTimeoutMs: 2_000,
        requestTimeoutMs: 1_000,
        stdout: new PassThrough(),
        stderr: new PassThrough(),
      }),
    ).rejects.toThrow("/: an inline <script> is missing the CSP nonce and would be blocked");
  });

  it("fails when Nitro exits even if a CSP-valid foreign site owns the legacy port", async () => {
    const foreign = createServer((_request, response) => {
      response.writeHead(200, { "content-security-policy": CSP });
      response.end(HTML);
    });
    servers.push(foreign);
    await listen(foreign, 4321);
    const entry = writeChild("process.exit(23);\n");

    await expect(
      runCspVerification({
        serverEntry: entry,
        readyTimeoutMs: 2_000,
        requestTimeoutMs: 1_000,
        stdout: new PassThrough(),
        stderr: new PassThrough(),
      }),
    ).rejects.toThrow("Docs server exited early with code 23");
  });
});
