import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { closeDispatchers, responseTimeoutDispatcher } from "./dispatcher.js";

function errorCode(error: unknown): unknown {
  return error instanceof Error ? (error.cause as { code?: unknown } | undefined)?.code : undefined;
}

describe("responseTimeoutDispatcher", () => {
  it("caps a silent response at the dispatch wall instead of the client's own default", async () => {
    const server = createServer(() => {
      // Never answers: the client's response timeout is the only thing that can end this.
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;

    try {
      const request = fetch(`http://127.0.0.1:${port}/`, {
        dispatcher: responseTimeoutDispatcher(0),
      });
      await expect(request).rejects.toThrow();
      const failure = await request.catch((error: unknown) => error);
      expect(errorCode(failure)).toBe("UND_ERR_HEADERS_TIMEOUT");
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it("pools one agent per wall, so a review does not open a connection pool per request", () => {
    expect(responseTimeoutDispatcher(600_000)).toBe(responseTimeoutDispatcher(600_000));
    expect(responseTimeoutDispatcher(600_000)).not.toBe(responseTimeoutDispatcher(300_000));
  });

  it("closes the pooled agents on shutdown, so their sockets do not outlive the server", async () => {
    const server = createServer((_request, response) => {
      response.end("ok");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;

    try {
      const pooled = responseTimeoutDispatcher(120_000);
      await closeDispatchers();

      await expect(fetch(`http://127.0.0.1:${port}/`, { dispatcher: pooled })).rejects.toThrow();
      expect(responseTimeoutDispatcher(120_000)).not.toBe(pooled);
    } finally {
      await closeDispatchers();
      server.closeAllConnections();
      server.close();
    }
  });
});
