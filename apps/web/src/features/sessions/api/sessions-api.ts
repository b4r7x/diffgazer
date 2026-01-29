import { api } from "@/lib/api";
import type { SessionMetadata } from "@repo/schemas";
import {
  getSession as sharedGetSession,
  deleteSession as sharedDeleteSession,
} from "@repo/api";

export async function getSessions(): Promise<SessionMetadata[]> {
  return api.get<SessionMetadata[]>("/sessions");
}

export async function getSession(id: string) {
  return sharedGetSession(api, id);
}

export async function deleteSession(id: string) {
  return sharedDeleteSession(api, id);
}
