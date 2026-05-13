import type { ApiClient, ShutdownResponse } from "./types.js";
import { SHUTDOWN_TOKEN_HEADER } from "./protocol.js";

type ShutdownToken = string | (() => string | undefined) | undefined;

function resolveShutdownToken(shutdownToken: ShutdownToken): string | undefined {
  const token = typeof shutdownToken === "function" ? shutdownToken() : shutdownToken;
  const normalizedToken = token?.trim();
  return normalizedToken ? normalizedToken : undefined;
}

export async function shutdown(client: ApiClient, shutdownToken?: ShutdownToken): Promise<ShutdownResponse> {
  const token = resolveShutdownToken(shutdownToken);
  if (!token) {
    return client.post<ShutdownResponse>("/api/shutdown", {});
  }

  return client.post<ShutdownResponse>(
    "/api/shutdown",
    {},
    { headers: { [SHUTDOWN_TOKEN_HEADER]: token } },
  );
}

export const bindShutdown = (client: ApiClient, shutdownToken?: ShutdownToken) => ({
  shutdown: () => shutdown(client, shutdownToken),
});
