import { api } from "@/lib/api";
import type { Session, SessionMetadata } from "@repo/schemas";

export async function getSessions(): Promise<SessionMetadata[]> {
  return api.get<SessionMetadata[]>("/sessions");
}

export async function getSession(id: string): Promise<Session> {
  return api.get<Session>(`/sessions/${id}`);
}

export async function deleteSession(id: string): Promise<void> {
  return api.delete(`/sessions/${id}`);
}
