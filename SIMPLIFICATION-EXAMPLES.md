# Code Simplification Examples

This document shows concrete before/after examples for the highest priority simplifications.

---

## Example 1: Inline Generic Entity System

### Before (Current - 3 files, 150+ lines)

**File 1: `/apps/cli/src/hooks/use-entity-list.ts` (97 lines)**
```typescript
import { useState } from "react";
import type { ListState } from "../types/index.js";

export interface EntityListConfig<T, M> {
  fetchList: (projectPath: string) => Promise<{ items: M[]; warnings: string[] }>;
  fetchOne: (id: string) => Promise<T>;
  deleteOne: (id: string) => Promise<{ existed: boolean }>;
  getId: (item: M) => string;
}

export interface EntityListState<T, M> {
  items: M[];
  warnings: string[];
  current: T | null;
  listState: ListState;
  error: { message: string } | null;
}

export interface EntityListActions<T, M> {
  loadList: (projectPath: string) => Promise<M[]>;
  loadOne: (id: string) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  clearCurrent: () => void;
  reset: () => void;
}

export function useEntityList<T, M>(
  config: EntityListConfig<T, M>
): [EntityListState<T, M>, EntityListActions<T, M>] {
  const [items, setItems] = useState<M[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [current, setCurrent] = useState<T | null>(null);
  const [listState, setListState] = useState<ListState>("idle");
  const [error, setError] = useState<{ message: string } | null>(null);

  async function loadList(projectPath: string): Promise<M[]> {
    setListState("loading");
    setError(null);
    try {
      const result = await config.fetchList(projectPath);
      setItems(result.items);
      setWarnings(result.warnings);
      setListState("success");
      return result.items;
    } catch (e) {
      setListState("error");
      setError({ message: e instanceof Error ? e.message : String(e) });
      return [];
    }
  }

  async function loadOne(id: string): Promise<T | null> {
    setListState("loading");
    setError(null);
    try {
      const entity = await config.fetchOne(id);
      setCurrent(entity);
      setListState("success");
      return entity;
    } catch (e) {
      setListState("error");
      setError({ message: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      const result = await config.deleteOne(id);
      if (result.existed) {
        setItems((prev) => prev.filter((item) => config.getId(item) !== id));
      }
      return result.existed;
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : String(e) });
      return false;
    }
  }

  function clearCurrent(): void {
    setCurrent(null);
  }

  function reset(): void {
    setItems([]);
    setWarnings([]);
    setCurrent(null);
    setListState("idle");
    setError(null);
  }

  return [
    { items, warnings, current, listState, error },
    { loadList, loadOne, remove, clearCurrent, reset },
  ];
}
```

**File 2: `/apps/cli/src/hooks/use-entity-api.ts` (54 lines)**
```typescript
import { useEntityList } from "./use-entity-list.js";
import { api } from "../lib/api.js";

export interface EntityApiConfig {
  endpoint: string;
  listKey: string;
  singleKey: string;
}

export function useEntityApi<
  TEntity,
  TMetadata extends { id: string },
>(config: EntityApiConfig) {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<TEntity, TMetadata>({
    fetchList: async (path) => {
      const res = await api().get<Record<string, unknown>>(
        `${config.endpoint}?projectPath=${encodeURIComponent(path)}`
      );
      return {
        items: res[config.listKey] as TMetadata[],
        warnings: (res.warnings as string[] | undefined) || [],
      };
    },
    fetchOne: async (id) => {
      const res = await api().get<Record<string, unknown>>(
        `${config.endpoint}/${id}`
      );
      return res[config.singleKey] as TEntity;
    },
    deleteOne: async (id) => {
      const res = await api().delete<{ existed: boolean }>(
        `${config.endpoint}/${id}`
      );
      return { existed: res.existed };
    },
    getId: (item) => item.id,
  });

  return {
    items: state.items,
    warnings: state.warnings,
    current: state.current,
    listState: state.listState,
    error: state.error,
    loadList: () => actions.loadList(projectPath),
    loadOne: actions.loadOne,
    remove: actions.remove,
    clearCurrent: actions.clearCurrent,
    reset: actions.reset,
  };
}
```

**File 3: `/apps/cli/src/features/sessions/hooks/use-session-list.ts` (22 lines)**
```typescript
import { useEntityApi } from "../../../hooks/use-entity-api.js";
import type { Session, SessionMetadata } from "@repo/schemas/session";

export function useSessionList() {
  const entity = useEntityApi<Session, SessionMetadata>({
    endpoint: "/sessions",
    listKey: "sessions",
    singleKey: "session",
  });

  return {
    sessions: entity.items,
    warnings: entity.warnings,
    listState: entity.listState,
    error: entity.error,
    listSessions: entity.loadList,
    loadSession: entity.loadOne,
    deleteSession: entity.remove,
    reset: entity.reset,
  };
}
```

### After (Simplified - 1 file, 65 lines)

**File: `/apps/cli/src/features/sessions/hooks/use-session-list.ts`**
```typescript
import { useState } from "react";
import { api } from "../../../lib/api.js";
import type { Session, SessionMetadata } from "@repo/schemas/session";

type ListState = "idle" | "loading" | "success" | "error";

export function useSessionList() {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [listState, setListState] = useState<ListState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function listSessions(): Promise<void> {
    setListState("loading");
    setError(null);

    try {
      const data = await api().get<{
        sessions: SessionMetadata[];
        warnings?: string[]
      }>(`/sessions?projectPath=${encodeURIComponent(process.cwd())}`);

      setSessions(data.sessions);
      setWarnings(data.warnings || []);
      setListState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setListState("error");
    }
  }

  async function loadSession(id: string): Promise<Session | null> {
    setListState("loading");
    setError(null);

    try {
      const data = await api().get<{ session: Session }>(`/sessions/${id}`);
      setListState("success");
      return data.session;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setListState("error");
      return null;
    }
  }

  async function deleteSession(id: string): Promise<boolean> {
    try {
      await api().delete(`/sessions/${id}`);
      setSessions(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  function reset(): void {
    setSessions([]);
    setWarnings([]);
    setListState("idle");
    setError(null);
  }

  return {
    sessions,
    warnings,
    listState,
    error,
    listSessions,
    loadSession,
    deleteSession,
    reset,
  };
}
```

### Benefits
- **173 lines → 65 lines** (62% reduction)
- **3 files → 1 file**
- No generic types to understand
- No abstraction layers to trace through
- Clear, debuggable implementation
- Easy to customize for session-specific needs
- Reduced cognitive load

**Repeat similar simplification for `useReviewHistory()`**

---

## Example 2: Simplify Persistence Layer

### Before (Current - Generic abstraction)

**File: `/packages/core/src/storage/persistence.ts` (partial, 303 lines total)**
```typescript
export interface CollectionConfig<T, M> {
  name: string;
  dir: () => string;
  filePath: (id: string) => string;
  schema: ZodSchema<T>;
  getMetadata: (item: T) => M;
  getId: (item: T) => string;
}

export interface Collection<T, M> {
  ensureDir(): Promise<Result<void, StoreError>>;
  read(id: string): Promise<Result<T, StoreError>>;
  write(item: T): Promise<Result<void, StoreError>>;
  list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>>;
  remove(id: string): Promise<Result<{ existed: boolean }, StoreError>>;
}

export function createCollection<T, M>(config: CollectionConfig<T, M>): Collection<T, M> {
  const { name, dir, filePath, schema, getMetadata, getId } = config;

  async function ensureDir(): Promise<Result<void, StoreError>> {
    return ensureDirectory(dir(), name);
  }

  async function read(id: string): Promise<Result<T, StoreError>> {
    const path = filePath(id);
    const readResult = await safeReadFile(path, name);
    if (!readResult.ok) {
      if (readResult.error.code === "NOT_FOUND") {
        return err(createStoreError("NOT_FOUND", `${name} not found: ${id}`));
      }
      return readResult;
    }

    const parseResult = parseAndValidate(readResult.value, schema, name);
    if (!parseResult.ok) {
      if (parseResult.error.code === "PARSE_ERROR") {
        return err(createStoreError("PARSE_ERROR", "Invalid JSON", parseResult.error.details));
      }
      if (parseResult.error.code === "VALIDATION_ERROR") {
        return err(createStoreError("VALIDATION_ERROR", "Schema validation failed", parseResult.error.details));
      }
      return parseResult;
    }

    return parseResult;
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    const ensureResult = await ensureDir();
    if (!ensureResult.ok) return ensureResult;

    const validation = schema.safeParse(item);
    if (!validation.success) {
      return err(createStoreError("VALIDATION_ERROR", `Invalid ${name}`, validation.error.message));
    }

    const id = getId(item);
    const path = filePath(id);
    const content = JSON.stringify(item, null, 2) + "\n";

    return atomicWriteFile(path, content, name);
  }

  async function list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>> {
    const dirPath = dir();
    const warnings: string[] = [];

    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok({ items: [], warnings });
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${dirPath}`));
      }
      return err(createStoreError("PARSE_ERROR", `Failed to read ${name} directory`, getErrorMessage(error)));
    }

    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const ids = jsonFiles
      .map((f) => f.replace(".json", ""))
      .filter(isValidUuid);
    const results = await Promise.all(ids.map(read));

    const items: M[] = [];
    results.forEach((result, i) => {
      if (result.ok) {
        items.push(getMetadata(result.value));
      } else {
        warnings.push(`[${name}] Failed to read ${ids[i]}: ${result.error.message}`);
      }
    });

    return ok({ items, warnings });
  }

  async function remove(id: string): Promise<Result<{ existed: boolean }, StoreError>> {
    const path = filePath(id);

    try {
      await unlink(path);
      return ok({ existed: true });
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok({ existed: false });
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("WRITE_ERROR", `Failed to delete ${name}`, getErrorMessage(error)));
    }
  }

  return { ensureDir, read, write, list, remove };
}

// Usage
export const sessionStore = createCollection<Session, SessionMetadata>({
  name: "session",
  dir: paths.sessions,
  filePath: paths.sessionFile,
  schema: SessionSchema,
  getMetadata: (s) => s.metadata,
  getId: (s) => s.metadata.id,
});
```

### After (Simplified - Specific implementation)

**File: `/packages/core/src/storage/json-file.ts` (shared utilities, 60 lines)**
```typescript
import { readFile, writeFile, rename, unlink, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ZodSchema } from "zod";

export class FileNotFoundError extends Error {
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = "FileNotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export async function readJsonFile<T>(
  path: string,
  schema: ZodSchema<T>
): Promise<T> {
  const content = await readFile(path, "utf-8");
  const parsed = JSON.parse(content);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new ValidationError(
      `Invalid data in ${path}: ${result.error.message}`
    );
  }

  return result.data;
}

export async function writeJsonFile(
  path: string,
  data: unknown,
  schema?: ZodSchema
): Promise<void> {
  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(`Invalid data: ${result.error.message}`);
    }
  }

  // Ensure directory exists
  await mkdir(dirname(path), { recursive: true });

  // Atomic write with temp file
  const tempPath = `${path}.${Date.now()}.tmp`;
  const content = JSON.stringify(data, null, 2) + "\n";

  await writeFile(tempPath, content, { mode: 0o600 });
  await rename(tempPath, path);
}

export async function deleteJsonFile(path: string): Promise<boolean> {
  try {
    await unlink(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
```

**File: `/packages/core/src/storage/sessions.ts` (specific logic, 80 lines)**
```typescript
import { readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { paths } from "./paths.js";
import { readJsonFile, writeJsonFile, deleteJsonFile, FileNotFoundError } from "./json-file.js";
import { SessionSchema, type Session, type SessionMetadata } from "@repo/schemas/session";

export async function saveSession(session: Session): Promise<void> {
  const path = paths.sessionFile(session.metadata.id);
  await writeJsonFile(path, session, SessionSchema);
}

export async function loadSession(id: string): Promise<Session> {
  const path = paths.sessionFile(id);
  return readJsonFile(path, SessionSchema);
}

export async function listSessions(projectPath?: string): Promise<SessionMetadata[]> {
  const dirPath = paths.sessions();

  let files: string[];
  try {
    files = await readdir(dirPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const jsonFiles = files.filter(f => f.endsWith(".json"));
  const sessions: SessionMetadata[] = [];

  for (const file of jsonFiles) {
    const id = file.replace(".json", "");
    try {
      const session = await loadSession(id);
      if (!projectPath || session.metadata.projectPath === projectPath) {
        sessions.push(session.metadata);
      }
    } catch (error) {
      // Skip invalid files, optionally log warning
      console.warn(`Skipping invalid session file: ${file}`);
    }
  }

  // Sort by most recent
  sessions.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return sessions;
}

export async function deleteSession(id: string): Promise<boolean> {
  const path = paths.sessionFile(id);
  return deleteJsonFile(path);
}

export async function createSession(
  projectPath: string,
  title?: string
): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    metadata: {
      id: randomUUID(),
      projectPath,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      relatedReviewIds: [],
    },
    messages: [],
  };

  await saveSession(session);
  return session;
}

export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<Session> {
  const session = await loadSession(sessionId);

  session.messages.push({
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  });

  session.metadata.updatedAt = new Date().toISOString();
  session.metadata.messageCount = session.messages.length;

  if (!session.metadata.title && role === "user") {
    session.metadata.title = content.slice(0, 50) +
      (content.length > 50 ? "..." : "");
  }

  await saveSession(session);
  return session;
}
```

### Benefits
- **303 lines → 140 lines** (60 shared utils + 80 sessions)
- No generic types `<T, M>`
- No Result type wrapping
- Clear error types (extends Error)
- Easy to add session-specific logic
- Shared utilities, not abstraction
- Can customize per entity (sessions vs reviews)

**Key Insight**: Shared utilities (`readJsonFile`, `writeJsonFile`) provide code reuse without forcing all entities through a generic abstraction.

---

## Example 3: Remove Result Type

### Before (Current)

**Storage Layer:**
```typescript
export async function listSessions(
  projectPath?: string
): Promise<Result<{ items: SessionMetadata[]; warnings: string[] }, SessionError>> {
  const result = await sessionStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "updatedAt");
  return ok({ items, warnings: result.value.warnings });
}
```

**Server Route:**
```typescript
sessions.get("/", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listSessions(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);

  return successResponse(c, {
    sessions: result.value.items,
    warnings: result.value.warnings.length > 0 ? result.value.warnings : undefined,
  });
});
```

**Error Handler:**
```typescript
export function handleStoreError(c: Context, error: StoreError) {
  const status = errorCodeToStatus(error.code);
  return errorResponse(c, error.message, error.code, status);
}
```

### After (Simplified)

**Storage Layer:**
```typescript
export async function listSessions(
  projectPath?: string
): Promise<SessionMetadata[]> {
  const dirPath = paths.sessions();

  let files: string[];
  try {
    files = await readdir(dirPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw new StorageError("Failed to read sessions directory", error);
  }

  // ... load and filter sessions

  return sessions.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
```

**Server Route:**
```typescript
sessions.get("/", async (c) => {
  const projectPath = c.req.query("projectPath");
  const sessions = await listSessions(projectPath);

  return c.json({
    success: true,
    data: { sessions }
  });
});
```

**Error Middleware (Hono):**
```typescript
app.onError((err, c) => {
  const status = err instanceof HTTPException ? err.status : 500;
  const code = err.code || "INTERNAL_ERROR";

  return c.json({
    success: false,
    error: {
      message: err.message,
      code,
    }
  }, status);
});
```

### Benefits
- **Simpler flow**: Storage throws → Route catches → Middleware formats
- **Less boilerplate**: No `if (!result.ok) return result`
- **Standard pattern**: Aligns with JavaScript ecosystem
- **Better stack traces**: Errors propagate naturally
- **Easier debugging**: Exceptions show in debugger automatically

---

## Example 4: Simplify review-utils.ts

### Before (Current - Mixed concerns)

```typescript
// apps/server/src/lib/review-utils.ts (147 lines)
export function extractJson(text: string): string { /* ... */ }
export function normalizeSeverity(s: string): string { /* 15 lines */ }
export function normalizeCategory(c: string): string { /* 10 lines */ }
export function normalizeReviewResponse(parsed: unknown): unknown { /* ... */ }
export function sanitizeUnicode(s: string): string { /* ... */ }
export function escapeXml(str: string): string { /* ... */ }
export async function initializeAIClient(c: Context): Promise<...> { /* ... */ }
export async function saveReviewWithSession(...): Promise<string | null> { /* ... */ }
export function createSSEErrorHandler(stream: SSEStreamingApi) { /* ... */ }
```

### After (Simplified - Split into focused modules)

**File: `/apps/server/src/lib/json-utils.ts` (20 lines)**
```typescript
export function extractJson(text: string): string {
  const trimmed = text.trim();

  // Remove markdown code fences
  if (trimmed.startsWith("```")) {
    const firstNewline = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("\n```");
    if (lastFence > firstNewline) {
      return trimmed.slice(firstNewline + 1, lastFence).trim();
    }
  }

  // Extract JSON object
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] || text;
}
```

**File: `/apps/server/src/lib/ai-client.ts` (30 lines)**
```typescript
import { createAIClient } from "@repo/core/ai";
import { configStore, getApiKey } from "@repo/core";

export class AIClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIClientError";
  }
}

export async function initializeAIClient() {
  const config = await configStore.read();
  if (!config) {
    throw new AIClientError(
      "AI provider not configured. Please configure in settings."
    );
  }

  const apiKey = await getApiKey(config.provider);
  if (!apiKey) {
    throw new AIClientError(
      `API key not found for provider '${config.provider}'`
    );
  }

  const client = createAIClient(config.provider, {
    apiKey,
    model: config.model,
    maxTokens: config.maxTokens,
  });

  if (!client) {
    throw new AIClientError("Failed to create AI client");
  }

  return client;
}
```

**File: `/apps/server/src/lib/sse-utils.ts` (15 lines)**
```typescript
import type { SSEStreamingApi } from "hono/streaming";

export function createSSEErrorHandler(stream: SSEStreamingApi) {
  return async (error: Error) => {
    await stream.writeSSE({
      event: "error",
      data: JSON.stringify({
        type: "error",
        error: {
          message: error.message,
          code: "AI_ERROR",
        },
      }),
    });
    stream.close();
  };
}
```

**Removed: normalizeSeverity, normalizeCategory, normalizeReviewResponse**
- Gemini schema enforcement ensures data already matches schema
- If normalization needed, add to schema refinements
- Simpler to debug when AI returns invalid data (fail fast)

### Benefits
- **147 lines → 65 lines** (56% reduction)
- **1 file → 3 focused files**
- Each file has single responsibility
- Easier to test individual functions
- Removed unnecessary normalization logic
- Simpler AI client initialization

---

## Summary

These examples demonstrate the core principle: **Replace generic abstractions with specific, direct implementations**.

### Key Patterns
1. **Inline Generic Abstractions** → Direct implementations
2. **Result<T, E> Monad** → Standard exceptions
3. **Generic Collection** → Specific storage modules
4. **Mixed Utilities** → Focused modules

### Benefits Across All Examples
- 40-60% reduction in lines of code
- Elimination of generic type parameters
- Simpler mental models
- Better debugging experience
- Easier onboarding for new developers
- More maintainable code

### Implementation Strategy
1. Start with useSessionList (isolated, high impact)
2. Apply same pattern to useReviewHistory
3. Simplify persistence layer (enables other changes)
4. Remove Result type (requires coordination)
5. Split utility files (cleanup)

Each simplification builds on the previous, making the codebase progressively simpler and more maintainable.
