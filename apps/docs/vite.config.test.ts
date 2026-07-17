import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { build, copyPublicAssets, createNitro, prepare, prerender } from "nitro/builder";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOCS_BASE_SECURITY_HEADERS } from "./src/security-headers";

const REQUEST_TIMEOUT_MS = 10_000;
const SERVER_READY_TIMEOUT_MS = 30_000;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

let fixtureRoot: string;
let server: ChildProcess;
let serverExit: Promise<void>;
let origin: string;

function findAvailablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Failed to allocate a port for the Nitro fixture"));
        return;
      }
      probe.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
}

async function waitUntilServerReady(child: ChildProcess): Promise<void> {
  const deadline = performance.now() + SERVER_READY_TIMEOUT_MS;
  while (performance.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("Nitro fixture exited before accepting requests");
    }
    try {
      const response = await fetch(new URL("/assets/conditional.txt", origin), {
        method: "HEAD",
        signal: AbortSignal.timeout(500),
      });
      if (response.status === 200) return;
    } catch {
      // The process has not bound the reserved port yet.
    }
    await delay(25);
  }
  throw new Error("Timed out waiting for the Nitro fixture server");
}

async function stopServer(): Promise<void> {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  server.kill("SIGTERM");
  const stopped = await Promise.race([serverExit.then(() => true), delay(2_000).then(() => false)]);
  if (stopped) return;
  server.kill("SIGKILL");
  await Promise.race([serverExit, delay(2_000)]);
}

async function request(
  path: string,
  method: "GET" | "HEAD",
  acceptEncoding: "identity" | "br",
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(new URL(path, origin), {
    method,
    headers: { "Accept-Encoding": acceptEncoding, ...headers },
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "diffgazer-nitro-conditionals-"));
  const publicDir = join(fixtureRoot, "public");
  const outputDir = join(fixtureRoot, ".output");
  await mkdir(join(publicDir, "assets"), { recursive: true });
  await mkdir(join(publicDir, "r/ui"), { recursive: true });
  const compressiblePayload = "conditional-response-body\n".repeat(512);
  await writeFile(join(publicDir, "assets/conditional.txt"), compressiblePayload, "utf8");
  await writeFile(
    join(publicDir, "r/ui/registry.json"),
    JSON.stringify({ items: Array.from({ length: 256 }, (_, index) => `item-${index}`) }),
    "utf8",
  );

  const nitro = await createNitro({
    rootDir: fixtureRoot,
    dev: false,
    minify: false,
    preset: "node-server",
    serverDir: false,
    renderer: false,
    output: { dir: outputDir },
    publicAssets: [{ dir: publicDir, maxAge: 0 }],
    compressPublicAssets: { gzip: true, brotli: true },
    routeRules: {
      "/assets/**": { headers: { "Cache-Control": IMMUTABLE_CACHE_CONTROL } },
      "/r/ui/registry.json": { headers: DOCS_BASE_SECURITY_HEADERS },
    },
  });
  try {
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await prerender(nitro);
    await build(nitro);
  } finally {
    await nitro.close();
  }

  const port = await findAvailablePort();
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [join(outputDir, "server/index.mjs")], {
    cwd: fixtureRoot,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverExit = new Promise((resolveExit) => server.once("exit", () => resolveExit()));
  await waitUntilServerReady(server);
}, 60_000);

afterAll(async () => {
  await stopServer();
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
});

const representations = [
  {
    name: "identity immutable asset",
    path: "/assets/conditional.txt",
    encoding: "identity" as const,
    contentEncoding: null,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  },
  {
    name: "brotli immutable asset",
    path: "/assets/conditional.txt",
    encoding: "br" as const,
    contentEncoding: "br",
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  },
  {
    name: "brotli must-revalidate registry JSON",
    path: "/r/ui/registry.json",
    encoding: "br" as const,
    contentEncoding: "br",
    cacheControl: DOCS_BASE_SECURITY_HEADERS["Cache-Control"],
  },
] as const;

describe.each(representations)("Nitro conditionals: $name", (representation) => {
  it.each([
    "GET",
    "HEAD",
  ] as const)("implements validators and precedence for %s", async (method) => {
    const baseline = await request(representation.path, method, representation.encoding);
    expect(baseline.status).toBe(200);
    expect(baseline.headers.get("cache-control")).toBe(representation.cacheControl);
    expect(baseline.headers.get("content-encoding")).toBe(representation.contentEncoding);
    if (representation.encoding === "br") {
      expect(baseline.headers.get("vary")).toContain("Accept-Encoding");
    }
    if (method === "HEAD") expect(await baseline.text()).toBe("");

    const etag = baseline.headers.get("etag");
    const lastModified = baseline.headers.get("last-modified");
    expect(etag).toMatch(/^".+"$/);
    expect(lastModified).not.toBeNull();
    if (!etag || !lastModified) throw new Error("Nitro fixture omitted validators");

    for (const ifNoneMatch of [etag, `W/${etag}`, `"unrelated", ${etag}`, "*"]) {
      const response = await request(representation.path, method, representation.encoding, {
        "If-None-Match": ifNoneMatch,
      });
      expect(response.status).toBe(304);
      expect(response.headers.get("etag")).toBe(etag);
      expect(response.headers.get("last-modified")).toBe(lastModified);
      expect(response.headers.get("cache-control")).toBe(representation.cacheControl);
      if (representation.encoding === "br") {
        expect(response.headers.get("vary")).toContain("Accept-Encoding");
      }
    }

    const precedence = await request(representation.path, method, representation.encoding, {
      "If-None-Match": '"unrelated"',
      "If-Modified-Since": "Wed, 21 Oct 2099 07:28:00 GMT",
    });
    expect(precedence.status).toBe(200);

    const dateMatch = await request(representation.path, method, representation.encoding, {
      "If-Modified-Since": lastModified,
    });
    expect(dateMatch.status).toBe(304);
    expect(dateMatch.headers.get("etag")).toBe(etag);
    expect(dateMatch.headers.get("last-modified")).toBe(lastModified);
  });
});
