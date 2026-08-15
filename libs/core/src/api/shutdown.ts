import type { ApiClient, ShutdownResponse } from "./types.js";

export function shutdown(client: ApiClient): Promise<ShutdownResponse> {
  return client.post<ShutdownResponse>("/api/shutdown", {});
}

export const bindShutdown = (client: ApiClient) => ({
  shutdown: () => shutdown(client),
});
