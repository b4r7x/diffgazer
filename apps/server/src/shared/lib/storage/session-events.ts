import { appendFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import type { AppError } from "../errors.js";
import { createError, getErrorMessage, isNodeError } from "../errors.js";
import { SessionEventSchema, type SessionEvent } from "@stargazer/schemas";
import {
  ensureDirectory as genericEnsureDirectory,
  createMappedErrorFactory,
} from "../fs/operations.js";
import { getGlobalStargazerDir } from "../paths.js";

export type SessionEventErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR";

export type SessionEventError = AppError<SessionEventErrorCode>;

export const createSessionEventError = createError<SessionEventErrorCode>;

const errorFactory = createMappedErrorFactory<SessionEventErrorCode>(
  {
    NOT_FOUND: "NOT_FOUND",
    PERMISSION_DENIED: "PERMISSION_ERROR",
    READ_ERROR: "PARSE_ERROR",
    WRITE_ERROR: "WRITE_ERROR",
  },
  createError
);

const DATA_DIR = getGlobalStargazerDir();

function getSessionsDir(projectId?: string): string {
  if (projectId) {
    return join(DATA_DIR, "projects", projectId, "sessions");
  }
  return join(DATA_DIR, "sessions");
}

function getSessionFilePath(sessionId: string, projectId?: string): string {
  return join(getSessionsDir(projectId), `${sessionId}.jsonl`);
}

function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

export interface SessionMetadataInfo {
  sessionId: string;
  createdAt: number;
  eventCount: number;
}

export async function createSessionFile(
  sessionId: string,
  projectId?: string
): Promise<Result<string, SessionEventError>> {
  const sessionsDir = getSessionsDir(projectId);
  const dirResult = await genericEnsureDirectory(sessionsDir, "sessions", errorFactory);
  if (!dirResult.ok) return dirResult;

  const filePath = getSessionFilePath(sessionId, projectId);
  return ok(filePath);
}

export async function createEventSession(
  projectId?: string
): Promise<Result<string, SessionEventError>> {
  const sessionId = generateSessionId();
  const fileResult = await createSessionFile(sessionId, projectId);
  if (!fileResult.ok) return fileResult;
  return ok(sessionId);
}

export async function appendEvent(
  sessionId: string,
  event: SessionEvent,
  projectId?: string
): Promise<Result<void, SessionEventError>> {
  const sessionsDir = getSessionsDir(projectId);
  const dirResult = await genericEnsureDirectory(sessionsDir, "sessions", errorFactory);
  if (!dirResult.ok) return dirResult;

  const filePath = getSessionFilePath(sessionId, projectId);
  const line = JSON.stringify(event) + "\n";

  try {
    await appendFile(filePath, line, { mode: 0o600 });
    return ok(undefined);
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(createSessionEventError("PERMISSION_ERROR", `Permission denied: ${filePath}`));
    }
    return err(
      createSessionEventError("WRITE_ERROR", "Failed to append event", getErrorMessage(error))
    );
  }
}

export async function loadEvents(
  sessionId: string,
  projectId?: string
): Promise<Result<SessionEvent[], SessionEventError>> {
  const filePath = getSessionFilePath(sessionId, projectId);

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return err(createSessionEventError("NOT_FOUND", `Session not found: ${sessionId}`));
    }
    if (isNodeError(error, "EACCES")) {
      return err(createSessionEventError("PERMISSION_ERROR", `Permission denied: ${filePath}`));
    }
    return err(
      createSessionEventError("PARSE_ERROR", "Failed to read session", getErrorMessage(error))
    );
  }

  const events: SessionEvent[] = [];
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const validated = SessionEventSchema.safeParse(parsed);
      if (validated.success) {
        events.push(validated.data);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return ok(events);
}

export async function listEventSessions(
  projectId?: string
): Promise<Result<SessionMetadataInfo[], SessionEventError>> {
  const sessionsDir = getSessionsDir(projectId);

  let files: string[];
  try {
    files = await readdir(sessionsDir);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return ok([]);
    }
    if (isNodeError(error, "EACCES")) {
      return err(createSessionEventError("PERMISSION_ERROR", `Permission denied: ${sessionsDir}`));
    }
    return err(
      createSessionEventError("PARSE_ERROR", "Failed to list sessions", getErrorMessage(error))
    );
  }

  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
  const sessions: SessionMetadataInfo[] = [];

  for (const file of jsonlFiles) {
    const sessionId = file.replace(".jsonl", "");
    const timestampPart = sessionId.split("-")[0];
    const createdAt = timestampPart ? parseInt(timestampPart, 10) : NaN;

    if (isNaN(createdAt)) continue;

    const eventsResult = await loadEvents(sessionId, projectId);
    const eventCount = eventsResult.ok ? eventsResult.value.length : 0;

    sessions.push({
      sessionId,
      createdAt,
      eventCount,
    });
  }

  sessions.sort((a, b) => b.createdAt - a.createdAt);

  return ok(sessions);
}

export async function getLatestSession(
  projectId: string
): Promise<Result<string | null, SessionEventError>> {
  const sessionsDir = getSessionsDir(projectId);

  let files: string[];
  try {
    files = await readdir(sessionsDir);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return ok(null);
    }
    if (isNodeError(error, "EACCES")) {
      return err(createSessionEventError("PERMISSION_ERROR", `Permission denied: ${sessionsDir}`));
    }
    return err(
      createSessionEventError("PARSE_ERROR", "Failed to list sessions", getErrorMessage(error))
    );
  }

  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
  if (jsonlFiles.length === 0) {
    return ok(null);
  }

  let latestSession: { sessionId: string; mtime: number } | null = null;

  for (const file of jsonlFiles) {
    const filePath = join(sessionsDir, file);
    try {
      const stats = await stat(filePath);
      const mtime = stats.mtimeMs;
      if (!latestSession || mtime > latestSession.mtime) {
        latestSession = {
          sessionId: file.replace(".jsonl", ""),
          mtime,
        };
      }
    } catch {
      // Skip files we can't stat
    }
  }

  return ok(latestSession?.sessionId ?? null);
}
