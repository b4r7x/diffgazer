import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerType } from "@hono/node-server";
import { DEFAULT_DEV_SERVER_PORT, formatListenError, parsePortEnv, startDevServer } from "./dev-server.js";

const openServers: Array<Server | ServerType> = [];

function listen(server: Server, port: number, hostname = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Expected TCP server address"));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server: Server | ServerType): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe("dev server startup", () => {
  afterEach(async () => {
    await Promise.all(openServers.splice(0).map((server) => closeServer(server)));
  });

  it("parses PORT strictly", () => {
    expect(parsePortEnv(undefined)).toBe(DEFAULT_DEV_SERVER_PORT);
    expect(parsePortEnv(" 3002 ")).toBe(3002);

    for (const value of ["", "0", "65536", "abc", "3.14"]) {
      expect(() => parsePortEnv(value)).toThrow(
        `Invalid PORT "${value}": expected an integer from 1 to 65535.`,
      );
    }
  });

  it("formats EADDRINUSE as an actionable message", () => {
    const error = Object.assign(new Error("listen EADDRINUSE"), { code: "EADDRINUSE" });

    expect(formatListenError(error, "127.0.0.1", 3000)).toBe([
      "Port 3000 is already in use on 127.0.0.1.",
      "Stop the existing process or choose another API port:",
      "  PORT=3002 pnpm --filter @diffgazer/server dev",
      "If running apps/web against that port:",
      "  VITE_API_URL=http://127.0.0.1:3002 pnpm --filter @diffgazer/web dev",
    ].join("\n"));
  });

  it("handles listen errors without an unhandled server error", async () => {
    const blocker = createServer();
    openServers.push(blocker);
    const port = await listen(blocker, 0);

    const message = await new Promise<string>((resolve) => {
      const server = startDevServer({
        fetch: () => new Response("ok"),
        port,
        onError: resolve,
        exitOnError: false,
      });
      openServers.push(server);
    });

    expect(message).toContain(`Port ${port} is already in use on 127.0.0.1.`);
  });

  it("reports the actual assigned port when listening on port 0", async () => {
    const readyPort = await new Promise<number>((resolve) => {
      const server = startDevServer({
        fetch: () => new Response("ok"),
        port: 0,
        onReady: (info) => resolve(info.port),
        exitOnError: false,
      });
      openServers.push(server);
    });

    expect(readyPort).toBeGreaterThan(0);
  });
});
