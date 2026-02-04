import { randomUUID } from "node:crypto";
import { paths } from "./paths.js";
import { createCollection, filterByProjectAndSort, type StoreError } from "./persistence.js";
import {
  SessionSchema,
  type Session,
  type SessionMetadata,
  type SessionMessage,
  type MessageRole,
} from "@repo/schemas";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { truncate } from "../strings.js";

const AUTO_TITLE_MAX_LENGTH = 50;

export const sessionStore = createCollection<Session, SessionMetadata>({
  name: "session",
  dir: paths.sessions,
  filePath: paths.sessionFile,
  schema: SessionSchema,
  getMetadata: (session) => session.metadata,
  getId: (session) => session.metadata.id,
});

export async function createSession(
  projectPath: string,
  title?: string
): Promise<Result<Session, StoreError>> {
  const now = new Date().toISOString();
  const session: Session = {
    metadata: {
      id: randomUUID(),
      projectPath,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    },
    messages: [],
  };
  const writeResult = await sessionStore.write(session);
  if (!writeResult.ok) return writeResult;
  return ok(session);
}

export async function addMessage(
  sessionId: string,
  role: MessageRole,
  content: string
): Promise<Result<SessionMessage, StoreError>> {
  const sessionResult = await sessionStore.read(sessionId);
  if (!sessionResult.ok) return sessionResult;

  const session = sessionResult.value;
  const now = new Date().toISOString();
  const message: SessionMessage = { id: randomUUID(), role, content, createdAt: now };

  session.messages.push(message);
  session.metadata.updatedAt = now;
  session.metadata.messageCount = session.messages.length;
  if (!session.metadata.title && role === "user") {
    session.metadata.title = truncate(content, AUTO_TITLE_MAX_LENGTH);
  }

  const writeResult = await sessionStore.write(session);
  if (!writeResult.ok) return writeResult;
  return ok(message);
}

export async function listSessions(
  projectPath?: string
): Promise<Result<{ items: SessionMetadata[]; warnings: string[] }, StoreError>> {
  const result = await sessionStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "updatedAt");
  return ok({ items, warnings: result.value.warnings });
}

export async function getLastSession(
  projectPath: string
): Promise<Result<Session | null, StoreError>> {
  const listResult = await listSessions(projectPath);
  if (!listResult.ok) return listResult;
  const first = listResult.value.items[0];
  if (!first) return ok(null);
  return sessionStore.read(first.id);
}
