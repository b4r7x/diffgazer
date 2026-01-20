import { createApiClient, type ApiClient, type ApiError } from "@repo/api";

let client: ApiClient;

export function setBaseUrl(baseUrl: string): void {
  client = createApiClient({ baseUrl });
}

export function api(): ApiClient {
  if (!client) {
    throw new Error("API client not initialized. Call setBaseUrl() first.");
  }
  return client;
}

export type { ApiClient, ApiError };
