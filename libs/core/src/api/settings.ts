import type { SaveTrustRequest, SettingsConfig } from "../schemas/config/index.js";
import {
  DeleteTrustResponseSchema,
  SettingsConfigSchema,
  TrustResponseSchema,
} from "../schemas/config/index.js";
import type { ApiClient, TrustResponse } from "./types.js";

function getSettings(client: ApiClient, signal?: AbortSignal): Promise<SettingsConfig> {
  return client.get<SettingsConfig>("/api/settings", {
    signal,
    schema: (body) => SettingsConfigSchema.parse(body),
  });
}

async function saveSettings(client: ApiClient, settings: Partial<SettingsConfig>): Promise<void> {
  await client.post("/api/settings", settings);
}

export function getTrust(client: ApiClient): Promise<TrustResponse> {
  // The server resolves project identity from the request's project root; no
  // projectId is sent.
  return client.get<TrustResponse>("/api/settings/trust", {
    schema: (body) => TrustResponseSchema.parse(body),
  });
}

function saveTrust(client: ApiClient, trust: SaveTrustRequest): Promise<TrustResponse> {
  return client.post<TrustResponse>("/api/settings/trust", trust, {
    schema: (body) => TrustResponseSchema.parse(body),
  });
}

export function deleteTrust(client: ApiClient): Promise<{ removed: boolean }> {
  // Identity resolves from the request's project root; no projectId is sent.
  return client.delete<{ removed: boolean }>("/api/settings/trust", {
    schema: (body) => DeleteTrustResponseSchema.parse(body),
  });
}

export const bindSettings = (client: ApiClient) => ({
  getSettings: (signal?: AbortSignal) => getSettings(client, signal),
  saveSettings: (settings: Partial<SettingsConfig>) => saveSettings(client, settings),
  getTrust: () => getTrust(client),
  saveTrust: (trust: SaveTrustRequest) => saveTrust(client, trust),
  deleteTrust: () => deleteTrust(client),
});
