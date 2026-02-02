import type { ApiClient } from "./types.js";

export async function deleteConfig(client: ApiClient): Promise<void> {
  await client.delete("/config");
}
