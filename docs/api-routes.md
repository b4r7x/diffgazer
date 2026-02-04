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
  "config": { "provider": "openai", "model": "gpt-4o" },
  "settings": {
    "theme": "auto",
    "defaultLenses": ["security"],
    "defaultProfile": "default",
    "severityThreshold": "warning",
    "secretsStorage": "file"
  },
  "providers": [
    { "provider": "openai", "hasApiKey": true, "isActive": true, "model": "gpt-4o" }
  ],
  "configured": true,
  "project": {
    "path": "/path/to/project",
    "projectId": "uuid",
    "trust": {
      "projectId": "uuid",
      "repoRoot": "/path/to/project",
      "trustedAt": "2026-02-04T12:00:00.000Z",
      "capabilities": { "readFiles": true, "readGit": true, "runCommands": false },
      "trustMode": "persistent"
    }
  }
}
```

Notes:
- `config` is `null` when no provider is active.
- `trust` is `null` when the project is not trusted.

---

### `GET /api/config/providers`

**Description**: Returns provider status list + active provider (if any).

**Response**
```json
{
  "providers": [
    { "provider": "openai", "hasApiKey": true, "isActive": true, "model": "gpt-4o" },
    { "provider": "anthropic", "hasApiKey": false, "isActive": false }
  ],
  "activeProvider": "openai"
}
```

---

### `POST /api/config`

**Description**: Save API credentials and optionally a model; also activates the provider.

**Request Body**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o"
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
{ "model": "gpt-4o" }
```

**Response**
```json
{ "provider": "openai", "model": "gpt-4o" }
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
{ "deleted": true, "provider": "openai" }
```

**Errors**
- `KEYRING_*` / `SECRET_*` errors (400) from secrets storage.

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
