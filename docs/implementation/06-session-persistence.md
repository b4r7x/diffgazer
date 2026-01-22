# Session Persistence Implementation

## Overview

Session persistence allows users to save and restore CLI sessions, enabling:
- Continuing work from where you left off
- Reviewing past sessions
- Managing session history

## Storage Location

Sessions are stored in `~/.stargazer/sessions/` as individual JSON files.

```
~/.stargazer/
├── config.json          # User configuration
├── secrets/             # API keys (encrypted)
└── sessions/
    └── {uuid}.json      # Individual session files
```

## Session File Format

Each session file contains:

```json
{
  "metadata": {
    "id": "uuid",
    "projectPath": "/path/to/project",
    "title": "Auto-generated from first message",
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T11:00:00.000Z",
    "messageCount": 5
  },
  "messages": [
    {
      "id": "uuid",
      "role": "user|assistant|system",
      "content": "...",
      "createdAt": "2026-01-20T10:00:00.000Z"
    }
  ]
}
```

## CLI Usage

### Start New Session
```bash
stargazer run
```

### Continue Last Session
```bash
stargazer run -c
# or
stargazer run --continue
```

### Resume Specific Session
```bash
stargazer run -r <session-id>
# or
stargazer run --resume <session-id>
```

### Show Session Picker
```bash
stargazer run -r
# or
stargazer run --resume
```

## TUI Keyboard Shortcuts

### Main View
- `h` - Open session history

### Sessions View
- Up/Down arrows - Navigate sessions
- `Enter` - Resume selected session
- `n` - Create new session
- `d` - Delete selected session
- `b` - Back to main
- `q` - Quit

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions` | List sessions (optional `?projectPath=`) |
| GET | `/sessions/last` | Get last session (`?projectPath=` required) |
| GET | `/sessions/:id` | Get specific session |
| POST | `/sessions` | Create session |
| POST | `/sessions/:id/messages` | Add message |
| DELETE | `/sessions/:id` | Delete session |

## Architecture

### Packages Involved

1. **@repo/schemas** (`packages/schemas/src/session.ts`)
   - Zod schemas for Session, SessionMessage, SessionMetadata
   - API request/response types

2. **@repo/core** (`packages/core/src/storage/sessions.ts`)
   - File-based CRUD operations
   - Result type error handling

3. **@repo/server** (`apps/server/src/api/routes/sessions.ts`)
   - Hono REST API routes

4. **CLI** (`apps/cli/src/hooks/use-session.ts`)
   - React hook for session state management

## Security

- Session files stored with `0o600` permissions (owner read/write only)
- Sessions filtered by project path to prevent cross-project leakage
- No sensitive data stored in sessions (API keys remain in secrets/)
