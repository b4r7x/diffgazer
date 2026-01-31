import { api } from "@/lib/api";
import type { SessionMetadata } from "@repo/schemas";
import { deleteSession as sharedDeleteSession } from "@repo/api";

export async function getSessions(): Promise<SessionMetadata[]> {
  return api.get<SessionMetadata[]>("/sessions");
}

export async function deleteSession(id: string) {
  return sharedDeleteSession(api, id);
}
