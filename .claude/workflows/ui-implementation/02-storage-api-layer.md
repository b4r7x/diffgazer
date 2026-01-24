# Workflow 02: Storage & API Layer

## Overview

Implement storage and API routes for settings, trust, and session events.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo.

### Storage Patterns
- Use `Result<T, E>` from `@repo/core/result` for all operations
- Storage locations:
  - User config: `~/.config/stargazer/`
  - Project data: `~/.local/share/stargazer/projects/<projectId>/`
- Use Node.js `fs` with proper error handling
- JSON files for config, JSONL for event logs

### API Patterns
- Hono routes in `apps/server/src/api/routes/`
- Thin routes - business logic in services
- Return proper HTTP status codes
- Use Zod for request validation

---

## Task 1: Settings Storage

**Agent:** `backend-development:backend-architect`

**File:** `packages/core/src/storage/settings-storage.ts`

```typescript
import { Result, ok, err } from "../result";
import { TrustConfig, SettingsConfig } from "@repo/schemas";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CONFIG_DIR = path.join(os.homedir(), ".config", "stargazer");
const TRUSTED_FILE = path.join(CONFIG_DIR, "trusted.json");
const SETTINGS_FILE = path.join(CONFIG_DIR, "config.json");

// Ensure config directory exists
function ensureConfigDir(): Result<void, Error> {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

// Trust operations
export function saveTrust(config: TrustConfig): Result<void, Error>;
export function loadTrust(projectId: string): Result<TrustConfig | null, Error>;
export function listTrustedProjects(): Result<TrustConfig[], Error>;
export function removeTrust(projectId: string): Result<void, Error>;

// Settings operations
export function saveSettings(settings: SettingsConfig): Result<void, Error>;
export function loadSettings(): Result<SettingsConfig, Error>;
export function getDefaultSettings(): SettingsConfig;
```

**Implementation notes:**
- `saveTrust`: Read existing trusted.json, add/update entry, write back
- `loadTrust`: Read trusted.json, find entry by projectId
- `listTrustedProjects`: Read trusted.json, return all entries
- `removeTrust`: Read trusted.json, remove entry, write back
- `saveSettings`: Write config.json
- `loadSettings`: Read config.json, merge with defaults
- `getDefaultSettings`: Return default SettingsConfig

---

## Task 2: Session Event Storage

**Agent:** `backend-development:backend-architect`

**File:** `packages/core/src/storage/session-events.ts`

```typescript
import { Result, ok, err } from "../result";
import { Session, SessionEvent } from "@repo/schemas";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const DATA_DIR = path.join(os.homedir(), ".local", "share", "stargazer");

function getSessionPath(projectId: string, sessionId: string): string {
  return path.join(DATA_DIR, "projects", projectId, "sessions", `${sessionId}.jsonl`);
}

// Create new session
export function createSession(projectId: string): Result<Session, Error>;

// Append event to session (JSONL format)
export function appendEvent(
  projectId: string,
  sessionId: string,
  event: SessionEvent
): Result<void, Error>;

// Load all events from session
export function loadEvents(
  projectId: string,
  sessionId: string
): Result<SessionEvent[], Error>;

// List sessions for project
export function listSessions(projectId: string): Result<Session[], Error>;

// Get session metadata
export function getSession(
  projectId: string,
  sessionId: string
): Result<Session | null, Error>;
```

**Implementation notes:**
- JSONL format: one JSON object per line
- `appendEvent`: Append JSON line to file, create if not exists
- `loadEvents`: Read file line by line, parse each as JSON
- Handle file not found gracefully (return empty array)

---

## Task 3: Settings API Routes

**Agent:** `backend-development:backend-architect`

**File:** `apps/server/src/api/routes/settings.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  settingsConfigSchema,
  trustConfigSchema
} from "@repo/schemas";
import {
  saveSettings,
  loadSettings,
  saveTrust,
  loadTrust,
  removeTrust,
  listTrustedProjects,
} from "@repo/core/storage";

const settings = new Hono();

// GET /settings - Load current settings
settings.get("/", async (c) => {
  const result = loadSettings();
  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.value);
});

// POST /settings - Save settings
settings.post(
  "/",
  zValidator("json", settingsConfigSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = saveSettings(body);
    if (!result.ok) {
      return c.json({ error: result.error.message }, 500);
    }
    return c.json({ success: true });
  }
);

// GET /trust - Check trust status (query: projectId)
settings.get("/trust", async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json({ error: "projectId required" }, 400);
  }
  const result = loadTrust(projectId);
  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json({ trusted: result.value !== null, config: result.value });
});

// GET /trust/list - List all trusted projects
settings.get("/trust/list", async (c) => {
  const result = listTrustedProjects();
  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.value);
});

// POST /trust - Save trust config
settings.post(
  "/trust",
  zValidator("json", trustConfigSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = saveTrust(body);
    if (!result.ok) {
      return c.json({ error: result.error.message }, 500);
    }
    return c.json({ success: true });
  }
);

// DELETE /trust - Remove trust (query: projectId)
settings.delete("/trust", async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return c.json({ error: "projectId required" }, 400);
  }
  const result = removeTrust(projectId);
  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json({ success: true });
});

export default settings;
```

**Update:** `apps/server/src/app.ts` - mount settings routes:
```typescript
import settings from "./api/routes/settings";
app.route("/settings", settings);
```

---

## Task 4: Update Core Exports

**Agent:** `backend-development:backend-architect`

**File:** `packages/core/src/storage/index.ts`

Add exports for new storage functions:
```typescript
export * from "./settings-storage";
export * from "./session-events";
```

---

## Validation

After completing all tasks:

```bash
npm run type-check
npx vitest run packages/core/src/storage/
```

Test API routes manually or with integration tests.
