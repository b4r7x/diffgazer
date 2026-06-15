import type { SaveTrustRequest, SettingsConfig } from "../schemas/config/index.js";
import { SettingsConfigSchema } from "../schemas/config/index.js";
import type { ApiClient, TrustResponse } from "./types.js";

export async function getSettings(client: ApiClient): Promise<SettingsConfig> {
  return client.get<SettingsConfig>("/api/settings", undefined, (body) =>
    SettingsConfigSchema.parse(body),
  );
}

export async function saveSettings(
  client: ApiClient,
  settings: Partial<SettingsConfig>,
): Promise<void> {
  await client.post("/api/settings", settings);
}

export async function getTrust(client: ApiClient): Promise<TrustResponse> {
  // The server resolves project identity from the request's project root; no
  // projectId is sent.
  return client.get<TrustResponse>("/api/settings/trust");
}

export async function saveTrust(
  client: ApiClient,
  trust: SaveTrustRequest,
): Promise<TrustResponse> {
  return client.post<TrustResponse>("/api/settings/trust", trust);
}

export async function deleteTrust(client: ApiClient): Promise<{ removed: boolean }> {
  // Identity resolves from the request's project root; no projectId is sent.
  return client.delete<{ removed: boolean }>("/api/settings/trust");
}

export const bindSettings = (client: ApiClient) => ({
  getSettings: () => getSettings(client),
  saveSettings: (settings: Partial<SettingsConfig>) => saveSettings(client, settings),
  getTrust: () => getTrust(client),
  saveTrust: (trust: SaveTrustRequest) => saveTrust(client, trust),
  deleteTrust: () => deleteTrust(client),
});
