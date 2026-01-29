import { api } from "../../../lib/api.js";
import type { Session, SessionMetadata, SessionMessage, MessageRole } from "@repo/schemas/session";
import {
  getSession as sharedGetSession,
  deleteSession as sharedDeleteSession,
} from "@repo/api";

export interface GetSessionListRequest {
  projectPath: string;
}

export interface SessionListResponse {
  sessions: SessionMetadata[];
  warnings?: string[];
}

export async function getSessionList({ projectPath }: GetSessionListRequest): Promise<SessionListResponse> {
  return api().get<SessionListResponse>(`/sessions?projectPath=${encodeURIComponent(projectPath)}`);
}

export async function getSession(id: string): Promise<{ session: Session }> {
  return sharedGetSession(api(), id);
}

export async function deleteSession(id: string): Promise<{ existed: boolean }> {
  return sharedDeleteSession(api(), id);
}

export interface CreateSessionRequest {
  projectPath: string;
  title?: string;
}

export async function createSession({ projectPath, title }: CreateSessionRequest): Promise<{ session: Session }> {
  return api().post<{ session: Session }>("/sessions", { projectPath, title });
}

export async function getLastSession(projectPath: string): Promise<{ session: Session }> {
  return api().get<{ session: Session }>(`/sessions/last?projectPath=${encodeURIComponent(projectPath)}`);
}

export interface AddMessageRequest {
  sessionId: string;
  role: MessageRole;
  content: string;
}

export async function addSessionMessage({ sessionId, role, content }: AddMessageRequest): Promise<{ message: SessionMessage }> {
  return api().post<{ message: SessionMessage }>(`/sessions/${sessionId}/messages`, { role, content });
}
