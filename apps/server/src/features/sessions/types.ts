import type { Session, SessionMessage, SessionMetadata } from "@stargazer/schemas/session";

export interface SessionsListResponse {
  sessions: SessionMetadata[];
  warnings?: string[];
}

export interface SessionResponse {
  session: Session;
}

export interface SessionMessageResponse {
  message: SessionMessage;
}
