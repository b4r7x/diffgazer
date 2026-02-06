# Server API Routes

This document describes the HTTP routes exposed by the server and the payloads they return.

**Base URL**
- Local dev (default): `http://localhost:3000`
- All routes are JSON unless noted otherwise.

**Common Headers**
- `Content-Type: application/json` for request bodies.
- `x-stargazer-project-root` (optional): absolute path to the project root. When provided, the server reads/writes project-scoped `.stargazer` data for that path. If omitted, the server resolves the project root from environment or `process.cwd()`.

**Error Shape**
Most endpoints return:
```json
{ "error": { "message": "Human readable message", "code": "OPTIONAL_CODE" } }
```
Some global errors (403/404/500) may only include `message` without `code`.

---

## Health

### `GET /health`
### `GET /api/health`

**Description**: Health check endpoint. Both routes map to the same handler.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2026-02-04T12:34:56.789Z"
}
```

---

## Config

### `GET /api/config/init`

**Description**: Returns initial configuration data for the UI.

**Response**
```json
{
  "config": { "provider": "gemini", "model": "gemini-2.5-flash" },
  "settings": {
    "theme": "auto",
    "defaultLenses": ["security"],
    "defaultProfile": "default",
    "severityThreshold": "warning",
    "secretsStorage": "file"
  },
  "providers": [
    { "provider": "gemini", "hasApiKey": true, "isActive": true, "model": "gemini-2.5-flash" }
  ],
  "configured": true,
  "project": {
    "path": "/path/to/project",
    "projectId": "uuid",
    "trust": {
      "projectId": "uuid",
      "repoRoot": "/path/to/project",
      "trustedAt": "2026-02-04T12:00:00.000Z",
      "capabilities": { "readFiles": true, "runCommands": false },
      "trustMode": "persistent"
    }
  }
}
```

Notes:
- `config` is `null` when no provider is active.
- `trust` is `null` when the project is not trusted.

---

### `GET /api/config/check`

**Description**: Checks whether an AI provider is configured and active.

**Response**
```json
{
  "configured": true,
  "config": { "provider": "gemini", "model": "gemini-2.5-flash" }
}
```

When not configured:
```json
{ "configured": false }
```

---

### `GET /api/config`

**Description**: Returns the active provider configuration.

**Response**
```json
{ "provider": "gemini", "model": "gemini-2.5-flash" }
```

**Errors**
- `CONFIG_NOT_FOUND` (404) when no provider is active.

---

### `GET /api/config/providers`

**Description**: Returns provider status list + active provider (if any).

**Response**
```json
{
  "providers": [
    { "provider": "gemini", "hasApiKey": true, "isActive": true, "model": "gemini-2.5-flash" },
    { "provider": "openrouter", "hasApiKey": false, "isActive": false }
  ],
  "activeProvider": "gemini"
}
```

---

### `GET /api/config/provider/openrouter/models`

**Description**: Returns available OpenRouter models (cached server-side).

**Response**
```json
{
  "models": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "description": "OpenAI's latest flagship model.",
      "contextLength": 128000,
      "pricing": { "prompt": "0.000005", "completion": "0.000015" },
      "isFree": false
    }
  ],
  "fetchedAt": "2026-02-05T12:00:00.000Z",
  "cached": false
}
```

---

### `POST /api/config`

**Description**: Save API credentials and optionally a model; also activates the provider.

**Request Body**
```json
{
  "provider": "gemini",
  "apiKey": "sk-...",
  "model": "gemini-2.5-flash"
}
```

**Response**
```json
{ "saved": true }
```

**Errors**
- `INVALID_BODY` (400) when body is invalid.
- `PAYLOAD_TOO_LARGE` (413) when body exceeds 50 KB.
- `KEYRING_*` / `SECRET_*` errors (400) from secrets storage.

---

### `POST /api/config/provider/:providerId/activate`

**Description**: Activates a provider and optionally updates its model.

**Route Params**
- `providerId`: string

**Request Body**
```json
{ "model": "gemini-2.5-flash" }
```

**Response**
```json
{ "provider": "gemini", "model": "gemini-2.5-flash" }
```

**Errors**
- `PROVIDER_NOT_FOUND` (404) if the provider does not exist.
- `INVALID_BODY` (400) when body is invalid.
- `PAYLOAD_TOO_LARGE` (413) when body exceeds 50 KB.

---

### `DELETE /api/config/provider/:providerId`

**Description**: Deletes stored credentials for a provider.

**Response**
```json
{ "deleted": true, "provider": "gemini" }
```

**Errors**
- `KEYRING_*` / `SECRET_*` errors (400) from secrets storage.

---

### `DELETE /api/config`

**Description**: Deactivates the current provider and removes its API key.

**Response**
```json
{ "deleted": true }
```

**Errors**
- `CONFIG_NOT_FOUND` (404) when no provider is active.

---

## Git

### `GET /api/git/status`

**Description**: Returns git status for the current project or a relative sub-path.

**Query Params**
- `path` (optional): relative path within the project root.

**Response**
```json
{
  "isGitRepo": true,
  "branch": "main",
  "remoteBranch": "origin/main",
  "ahead": 0,
  "behind": 0,
  "files": {
    "staged": [{ "path": "src/app.ts", "indexStatus": "M", "workTreeStatus": " " }],
    "unstaged": [{ "path": "src/utils.ts", "indexStatus": " ", "workTreeStatus": "M" }],
    "untracked": [{ "path": "new-file.ts", "indexStatus": "?", "workTreeStatus": "?" }]
  },
  "hasChanges": true,
  "conflicted": []
}
```

**Errors**
- `INVALID_PATH` (400) when `path` is not a safe relative path.
- `NOT_GIT_REPO` (400) when the target is not a git repository.
- `GIT_NOT_FOUND` (500) when git is not installed.

---

### `GET /api/git/diff`

**Description**: Returns git diff output.

**Query Params**
- `mode` (optional): `staged` or `unstaged`. Default `unstaged`.
- `staged` (optional): legacy boolean flag, ignored when `mode` is present.
- `path` (optional): relative path within the project root.

**Response**
```json
{
  "diff": "diff --git a/src/app.ts...",
  "mode": "unstaged"
}
```

**Errors**
- `INVALID_PATH` (400) when `path` is not a safe relative path.
- `NOT_GIT_REPO` (400) when the target is not a git repository.
- `GIT_NOT_FOUND` (500) when git is not installed.

---

## Settings

### `GET /api/settings`

**Description**: Returns current settings.

**Response**
```json
{
  "theme": "auto",
  "defaultLenses": ["security"],
  "defaultProfile": "default",
  "severityThreshold": "warning",
  "secretsStorage": "file"
}
```

---

### `POST /api/settings`

**Description**: Updates settings. Partial updates are supported.

**Request Body**
```json
{
  "theme": "dark",
  "secretsStorage": "keyring"
}
```

**Response**
```json
{
  "theme": "dark",
  "defaultLenses": ["security"],
  "defaultProfile": "default",
  "severityThreshold": "warning",
  "secretsStorage": "keyring"
}
```

**Errors**
- `INVALID_BODY` (400) when body is invalid.
- `PAYLOAD_TOO_LARGE` (413) when body exceeds 10 KB.
- `KEYRING_*` / `SECRET_*` errors (400) from secrets storage.

---

### `GET /api/settings/trust`

**Description**: Returns trust configuration for a project.

**Query Params**
- `projectId` (required): project identifier.

**Response**
```json
{
  "trust": {
    "projectId": "uuid",
    "repoRoot": "/path/to/project",
    "trustedAt": "2026-02-04T12:00:00.000Z",
    "capabilities": { "readFiles": true, "runCommands": false },
    "trustMode": "persistent"
  }
}
```

**Errors**
- `VALIDATION_ERROR` (400) when `projectId` is missing.
- `NOT_FOUND` (404) when no trust config exists for the project.

---

### `GET /api/settings/trust/list`

**Description**: Lists all trusted projects.

**Response**
```json
{
  "projects": [
    {
      "projectId": "uuid",
      "repoRoot": "/path/to/project",
      "trustedAt": "2026-02-04T12:00:00.000Z",
      "capabilities": { "readFiles": true, "runCommands": false },
      "trustMode": "persistent"
    }
  ]
}
```

---

### `POST /api/settings/trust`

**Description**: Saves trust configuration for a project.

**Request Body**
```json
{
  "projectId": "uuid",
  "repoRoot": "/path/to/project",
  "trustedAt": "2026-02-04T12:00:00.000Z",
  "capabilities": { "readFiles": true, "runCommands": false },
  "trustMode": "persistent"
}
```

**Response**
```json
{
  "trust": {
    "projectId": "uuid",
    "repoRoot": "/path/to/project",
    "trustedAt": "2026-02-04T12:00:00.000Z",
    "capabilities": { "readFiles": true, "runCommands": false },
    "trustMode": "persistent"
  }
}
```

**Errors**
- `INVALID_BODY` (400) when body is invalid.

---

### `DELETE /api/settings/trust`

**Description**: Removes trust configuration for a project.

**Query Params**
- `projectId` (required): project identifier.

**Response**
```json
{ "removed": true }
```

**Errors**
- `VALIDATION_ERROR` (400) when `projectId` is missing.

---

## Reviews

### `GET /api/reviews`

**Description**: Returns review history metadata.

**Response**
```json
[
  {
    "id": "review-id",
    "issueCount": 12,
    "projectPath": "/path/to/project",
    "createdAt": "2026-02-04T12:00:00.000Z",
    "staged": true,
    "branch": "main",
    "overallScore": 82,
    "criticalCount": 2,
    "warningCount": 5
  }
]
```

---

### `GET /api/reviews/:id`

**Description**: Returns a single review payload.

**Route Params**
- `id`: string

**Response**
```json
{
  "review": {
    "metadata": {
      "id": "review-id",
      "issueCount": 12,
      "projectPath": "/path/to/project",
      "createdAt": "2026-02-04T12:00:00.000Z",
      "staged": true,
      "branch": "main",
      "overallScore": 82,
      "criticalCount": 2,
      "warningCount": 5
    },
    "result": {},
    "gitContext": {}
  }
}
```

**Errors**
- `REVIEW_NOT_FOUND` (404) when the review does not exist.

---

### `DELETE /api/reviews/:id`

**Description**: Deletes a review by id.

**Response**
```json
{ "deleted": true }
```

---

### `GET /api/reviews/:id/stream`

**Description**: Streams triage session events for a review id (SSE).

**Response**: Server-Sent Events

Event types include triage stream events such as:
```
event: review_started
data: {"type":"review_started","reviewId":"...","filesTotal":3,"timestamp":"..."}

event: step_start
data: {"type":"step_start","step":"diff","timestamp":"..."}

event: issue_found
data: {"type":"issue_found","agent":"detective","issue":{...},"timestamp":"..."}

event: complete
data: {"type":"complete","result":{...},"reviewId":"...","durationMs":1234}

event: error
data: {"type":"error","error":{"message":"...","code":"AI_ERROR"}}
```

---

### `GET /api/reviews/:id/status`

**Description**: Returns triage session status for a review id.

**Response**
```json
{
  "sessionActive": true,
  "reviewSaved": false,
  "isComplete": false,
  "startedAt": "2026-02-04T12:00:00.000Z"
}
```

When no session exists and no saved review is found:
```json
{
  "sessionActive": false,
  "reviewSaved": false,
  "isComplete": false
}
```

---

## Review Stream

### `GET /api/review/stream`

**Description**: Streams a legacy AI review (SSE).

**Query Params**
- `staged` (optional): `true` or `false`. Default `true`.

**Response**: Server-Sent Events

Event types:
```
event: chunk
data: {"type":"chunk","content":"Analyzing..."}

event: complete
data: {"type":"complete","result":{...}}

event: error
data: {"type":"error","error":{"code":"AI_ERROR","message":"..."}}
```

