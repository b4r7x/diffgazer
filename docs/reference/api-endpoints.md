# API Endpoints Reference

Complete reference for all Stargazer server API endpoints.

## Base URL

```
http://localhost:3000
```

Server binds to `127.0.0.1` only for security.

## Routes Overview

| Route | Purpose |
|-------|---------|
| `/health` | Health check |
| `/git` | Git operations |
| `/config` | AI provider configuration |
| `/settings` | User settings and trust |
| `/sessions` | Session management |
| `/sessions/:id/chat` | Chat streaming |
| `/reviews` | Review history (legacy) |
| `/triage` | Triage operations |
| `/pr-review` | PR review for CI integration |
| `/review` | Review streaming (legacy) |

## Health

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-24T10:00:00.000Z"
}
```

## Git

### GET /git/status

Get git repository status.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | string | cwd | Repository path |

**Response:**
```json
{
  "branch": "feature/review",
  "staged": ["src/app.ts"],
  "unstaged": ["src/utils.ts"],
  "untracked": ["new-file.ts"]
}
```

### GET /git/diff

Get git diff content.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `staged` | boolean | true | Diff staged or unstaged |
| `files` | string | - | Comma-separated file paths |

**Response:**
```json
{
  "diff": "diff --git a/src/app.ts...",
  "fileCount": 3,
  "stats": {
    "additions": 42,
    "deletions": 15
  }
}
```

## Config

### GET /config/check

Check if AI provider is configured.

**Response:**
```json
{
  "configured": true,
  "config": {
    "provider": "gemini",
    "model": "gemini-2.5-flash"
  }
}
```

### GET /config

Get current configuration.

**Response:**
```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

### POST /config

Save AI provider configuration.

**Request:**
```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "apiKey": "sk-..."
}
```

**Response:**
```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

### DELETE /config

Delete configuration and API key.

**Response:**
```json
{
  "deleted": true
}
```

### GET /config/providers

List available providers and their status.

**Response:**
```json
{
  "providers": [
    {
      "provider": "gemini",
      "hasApiKey": true,
      "model": "gemini-2.5-flash",
      "isActive": true
    },
    {
      "provider": "openai",
      "hasApiKey": false,
      "isActive": false
    }
  ],
  "activeProvider": "gemini"
}
```

### DELETE /config/provider/:providerId

Delete API key for a specific provider.

**Response:**
```json
{
  "deleted": true,
  "provider": "openai"
}
```

## Settings

### GET /settings

Get user settings.

**Response:**
```json
{
  "settings": {
    "theme": "auto",
    "controlsMode": "keys",
    "defaultLenses": ["correctness"],
    "defaultProfile": null,
    "severityThreshold": "medium"
  }
}
```

### POST /settings

Save user settings.

**Request:**
```json
{
  "theme": "dark",
  "controlsMode": "menu",
  "defaultLenses": ["correctness", "security"],
  "defaultProfile": "strict",
  "severityThreshold": "low"
}
```

**Response:**
```json
{
  "settings": { ... }
}
```

### GET /settings/trust

Get trust configuration for a project.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project identifier |

**Response:**
```json
{
  "trust": {
    "projectId": "abc123",
    "repoRoot": "/path/to/repo",
    "trustedAt": "2024-01-24T10:00:00.000Z",
    "capabilities": {
      "readFiles": true,
      "readGit": true,
      "runCommands": false
    },
    "trustMode": "persistent"
  }
}
```

### GET /settings/trust/list

List all trusted projects.

**Response:**
```json
{
  "projects": [
    {
      "projectId": "abc123",
      "repoRoot": "/path/to/repo",
      "trustedAt": "2024-01-24T10:00:00.000Z",
      "capabilities": { ... },
      "trustMode": "persistent"
    }
  ]
}
```

### POST /settings/trust

Save trust configuration.

**Request:**
```json
{
  "projectId": "abc123",
  "repoRoot": "/path/to/repo",
  "trustedAt": "2024-01-24T10:00:00.000Z",
  "capabilities": {
    "readFiles": true,
    "readGit": true,
    "runCommands": false
  },
  "trustMode": "persistent"
}
```

**Response:**
```json
{
  "trust": { ... }
}
```

### DELETE /settings/trust

Remove trust for a project.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project identifier |

**Response:**
```json
{
  "removed": true
}
```

## Sessions

### GET /sessions

List all sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "projectPath": "/path/to/repo",
      "title": "Review session",
      "createdAt": "2024-01-24T10:00:00.000Z",
      "updatedAt": "2024-01-24T11:00:00.000Z",
      "messageCount": 5
    }
  ]
}
```

### POST /sessions

Create new session.

**Request:**
```json
{
  "projectPath": "/path/to/repo",
  "title": "Review session"
}
```

**Response:**
```json
{
  "session": {
    "metadata": { ... },
    "messages": []
  }
}
```

### GET /sessions/:id

Get session by ID.

**Response:**
```json
{
  "session": {
    "metadata": { ... },
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "Review this code",
        "createdAt": "2024-01-24T10:00:00.000Z"
      }
    ]
  }
}
```

### DELETE /sessions/:id

Delete session.

**Response:**
```json
{
  "deleted": true
}
```

### POST /sessions/:id/chat

Stream chat response for a session (SSE).

**Request:**
```json
{
  "message": "Why is this code vulnerable?"
}
```

**Response:** Server-Sent Events

Event types:
```
event: chunk
data: {"content": "The code is vulnerable because..."}

event: complete
data: {"content": "...", "truncated": false}

event: error
data: {"code": "AI_ERROR", "message": "..."}
```

## Triage

### GET /triage/stream

Stream a triage review (SSE).

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `staged` | boolean | true | Review staged changes |
| `lenses` | string | correctness | Comma-separated lens IDs |
| `profile` | string | - | Profile ID (overrides lenses) |
| `files` | string | - | Comma-separated file paths |

**Response:** Server-Sent Events

Event types:
```
event: agent_start
data: {"type": "agent_start", "agent": {...}, "timestamp": "..."}

event: agent_thinking
data: {"type": "agent_thinking", "agent": "detective", "thought": "...", "timestamp": "..."}

event: tool_call
data: {"type": "tool_call", "agent": "detective", "tool": "readFile", "input": "...", "timestamp": "..."}

event: tool_result
data: {"type": "tool_result", "agent": "detective", "tool": "readFile", "summary": "...", "timestamp": "..."}

event: issue_found
data: {"type": "issue_found", "agent": "detective", "issue": {...}, "timestamp": "..."}

event: agent_complete
data: {"type": "agent_complete", "agent": "detective", "issueCount": 3, "timestamp": "..."}

event: orchestrator_complete
data: {"type": "orchestrator_complete", "summary": "...", "totalIssues": 5, "timestamp": "..."}

event: chunk
data: {"content": "Analyzing..."}

event: issue
data: {"issue": {...}}

event: complete
data: {"result": {...}}

event: error
data: {"error": {...}}
```

### GET /triage/reviews

List triage reviews.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `projectPath` | string | - | Filter by project |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "projectPath": "/path/to/repo",
      "staged": true,
      "issueCount": 3,
      "lenses": ["correctness", "security"],
      "profile": "strict",
      "createdAt": "2024-01-24T10:00:00.000Z"
    }
  ],
  "warnings": []
}
```

### GET /triage/reviews/:id

Get triage review by ID.

**Response:**
```json
{
  "review": {
    "id": "uuid",
    "metadata": { ... },
    "result": {
      "issues": [...],
      "summary": "..."
    },
    "drilldowns": [...]
  }
}
```

### DELETE /triage/reviews/:id

Delete triage review.

**Response:**
```json
{
  "existed": true
}
```

### POST /triage/reviews/:id/drilldown

Run drilldown analysis on an issue.

**Request:**
```json
{
  "issueId": "issue-uuid"
}
```

**Response:** Server-Sent Events

```
event: tool_call
data: {"type": "tool_call", "agent": "detective", "tool": "readFileContext", "input": "...", "timestamp": "..."}

event: tool_result
data: {"type": "tool_result", "agent": "detective", "tool": "readFileContext", "summary": "...", "timestamp": "..."}

event: chunk
data: {"content": "Analyzing root cause..."}

event: complete
data: {"result": {...}}

event: error
data: {"error": {...}}
```

## PR Review

### POST /pr-review

Run a review on a PR diff for CI integration. Returns structured output suitable for GitHub annotations and inline comments.

**Request:**
```json
{
  "diff": "diff --git a/src/app.ts...",
  "lenses": ["correctness", "security"],
  "profile": "strict",
  "baseRef": "main",
  "headRef": "feature/new-feature"
}
```

**Response:**
```json
{
  "summary": "Found 3 issues: 1 high, 2 medium...",
  "issues": [
    {
      "severity": "high",
      "title": "SQL injection vulnerability",
      "file": "src/db.ts",
      "line": 42,
      "message": "User input is not sanitized...",
      "suggestion": "Use parameterized queries..."
    }
  ],
  "annotations": [
    {
      "path": "src/db.ts",
      "start_line": 42,
      "end_line": 42,
      "annotation_level": "failure",
      "message": "User input is not sanitized...\n\nRecommendation: Use parameterized queries...",
      "title": "[HIGH] SQL injection vulnerability"
    }
  ],
  "inlineComments": [
    {
      "path": "src/db.ts",
      "line": 42,
      "side": "RIGHT",
      "body": "**HIGH**: SQL injection vulnerability\n\n..."
    }
  ]
}
```

**Annotation Levels:**
| Severity | Annotation Level |
|----------|------------------|
| blocker, high | failure |
| medium | warning |
| low, nit | notice |

## Error Responses

All endpoints return errors in consistent format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `NOT_FOUND` | 404 | Resource not found |
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `INTERNAL_ERROR` | 500 | Server error |
| `RATE_LIMITED` | 429 | Too many requests |
| `API_KEY_MISSING` | 401 | AI provider not configured |
| `NO_DIFF` | 400 | No changes to review |
| `AI_ERROR` | 500 | AI provider error |
| `STREAM_ERROR` | 500 | SSE streaming error |

## CORS

Server only accepts requests from:
- `http://localhost:*`
- `http://127.0.0.1:*`

This is a security measure (CVE-2024-28224).

## Cross-References

- [Apps: Server](../apps/server.md) - Server implementation
- [Reference: CLI Commands](./cli-commands.md) - CLI usage
- [Features: Review Flow](../features/review-flow.md) - Review process
