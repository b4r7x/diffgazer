import type { ApiClient, ShutdownResponse } from "./types";

export async function shutdown(client: ApiClient): Promise<ShutdownResponse> {
  return client.post<ShutdownResponse>("/api/shutdown", {});
}

export const bindShutdown = (client: ApiClient) => ({
  shutdown: () => shutdown(client),
});
