import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { type LocalHttpFetch, localHttpRequest, resolveLocalHttpTransport } from "./request.js";

function listen(host: string, handler: RequestListener): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Expected a TCP listen address"));
        return;
      }
      resolve({ server, port: (address as AddressInfo).port });
    });
  });
}

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.close();
  }
});

describe("loopback-bound local HTTP transport", () => {
  it("bypasses an env-configured HTTP proxy on IPv4 loopback", async () => {
    const proxyConnections: string[] = [];
    const proxy = await listen("127.0.0.1", (req, res) => {
      proxyConnections.push(req.url ?? "");
      res.writeHead(502);
      res.end("proxy");
    });
    servers.push(proxy.server);

    const target = await listen("127.0.0.1", (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    servers.push(target.server);

    const previousProxy = process.env.HTTP_PROXY;
    const previousNodeProxy = process.env.NODE_USE_ENV_PROXY;
    process.env.HTTP_PROXY = `http://127.0.0.1:${proxy.port}`;
    process.env.NODE_USE_ENV_PROXY = "1";

    try {
      const transport = await resolveLocalHttpTransport(`http://127.0.0.1:${target.port}`, {
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
      });
      expect(transport.ok).toBe(true);
      if (!transport.ok) return;

      const response = await localHttpRequest({
        endpoint: transport.value.endpoint,
        pathname: "/",
        method: "GET",
        auth: { authentication: "none" },
        fetcher: transport.value.fetcher,
        maxResponseBytes: 1024,
      });

      expect(response.ok).toBe(true);
      expect(proxyConnections).toEqual([]);
    } finally {
      if (previousProxy === undefined) delete process.env.HTTP_PROXY;
      else process.env.HTTP_PROXY = previousProxy;
      if (previousNodeProxy === undefined) delete process.env.NODE_USE_ENV_PROXY;
      else process.env.NODE_USE_ENV_PROXY = previousNodeProxy;
    }
  });

  it("connects over IPv6 loopback without using the hostname resolver again", async () => {
    const target = await listen("::1", (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ version: "0.6.0" }));
    });
    servers.push(target.server);

    const lookup = async () => [{ address: "::1", family: 6 }];
    const transport = await resolveLocalHttpTransport(`http://[::1]:${target.port}`, { lookup });
    expect(transport.ok).toBe(true);
    if (!transport.ok) return;

    const response = await localHttpRequest({
      endpoint: transport.value.endpoint,
      pathname: "/api/version",
      method: "GET",
      auth: { authentication: "none" },
      fetcher: transport.value.fetcher,
      maxResponseBytes: 1024,
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(JSON.parse(response.value)).toEqual({ version: "0.6.0" });
  });

  it("uses the validated loopback address when the endpoint hostname is localhost", async () => {
    const target = await listen("127.0.0.1", (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    servers.push(target.server);

    let lookupCalls = 0;
    const transport = await resolveLocalHttpTransport(`http://localhost:${target.port}`, {
      lookup: async () => {
        lookupCalls += 1;
        return [{ address: "127.0.0.1", family: 4 }];
      },
    });
    expect(transport.ok).toBe(true);
    if (!transport.ok) return;

    const response = await localHttpRequest({
      endpoint: transport.value.endpoint,
      pathname: "/",
      method: "GET",
      auth: { authentication: "none" },
      fetcher: transport.value.fetcher,
      maxResponseBytes: 1024,
    });

    expect(response.ok).toBe(true);
    expect(lookupCalls).toBe(1);
  });

  it("releases the body of a rejected-status response instead of abandoning it", async () => {
    let bodyCancelled = false;
    const fetcher = (async () => {
      const body = new ReadableStream<Uint8Array>({
        pull() {
          // A hostile local service streams forever; only an explicit cancel ends it.
        },
        cancel() {
          bodyCancelled = true;
        },
      });
      return new Response(body, { status: 500 });
    }) as LocalHttpFetch;

    const response = await localHttpRequest({
      endpoint: "http://127.0.0.1:11434",
      pathname: "/",
      method: "GET",
      auth: { authentication: "none" },
      fetcher,
      maxResponseBytes: 1024,
    });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("api-incompatible");
    expect(bodyCancelled).toBe(true);
  });
});
