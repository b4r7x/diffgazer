import type { Session } from "@repo/schemas/session";
import type { ApiClient } from "./types.js";

export async function getSession(client: ApiClient, id: string): Promise<{ session: Session }> {
  return client.get<{ session: Session }>(`/sessions/${id}`);
}

export async function deleteSession(client: ApiClient, id: string): Promise<{ existed: boolean }> {
  return client.delete<{ existed: boolean }>(`/sessions/${id}`);
}
