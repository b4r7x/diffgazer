import { api } from "@/lib/api";
import type { Session, SessionMetadata } from "@repo/schemas";

export async function getSessions(): Promise<SessionMetadata[]> {
  return api.get<SessionMetadata[]>("/sessions");
}

export async function getSession(id: string): Promise<{ session: Session }> {
  return api.get<{ session: Session }>(`/sessions/${id}`);
}

export async function deleteSession(id: string): Promise<{ existed: boolean }> {
  return api.delete<{ existed: boolean }>(`/sessions/${id}`);
}
