# API Reference

All endpoints are served on `127.0.0.1:3000` (configurable via `PORT` env var). Prefix is `/api` unless noted otherwise.

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no `/api` prefix) |
| GET | `/api/health` | Health check |

## Config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config/init` | Full init state (config, settings, providers, project, setup status) |
| GET | `/api/config/check` | Check if configured |
| GET | `/api/config` | Get active config (provider + model) |
| GET | `/api/config/providers` | List all providers with status |
| GET | `/api/config/provider/openrouter/models` | Fetch OpenRouter model catalog |
| POST | `/api/config` | Save provider credentials |
| POST | `/api/config/provider/:providerId/activate` | Switch active provider |
| DELETE | `/api/config/provider/:providerId` | Delete provider credentials |
| DELETE | `/api/config` | Delete active configuration |

## Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get all settings |
| POST | `/api/settings` | Update settings (partial patch) |
| GET | `/api/settings/trust` | Get trust for project (`?projectId=`) |
| GET | `/api/settings/trust/list` | List all trusted projects |
| POST | `/api/settings/trust` | Save trust config |
| DELETE | `/api/settings/trust` | Remove trust (`?projectId=`) |

## Git

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/git/status` | Git repository status |
| GET | `/api/git/diff` | Get git diff (`?mode=unstaged|staged`) |

## Review

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/review/stream` | Start new review (SSE) |
| GET | `/api/review/reviews/:id/stream` | Resume/replay review session (SSE) |
| GET | `/api/review/sessions/active` | Get active session info |
| GET | `/api/review/context` | Get project context snapshot |
| POST | `/api/review/context/refresh` | Rebuild project context |
| GET | `/api/review/reviews` | List saved reviews |
| GET | `/api/review/reviews/:id` | Get specific review |
| DELETE | `/api/review/reviews/:id` | Delete review |
| POST | `/api/review/reviews/:id/drilldown` | Drilldown analysis on issue |

## Shutdown

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/shutdown` | Graceful server shutdown |

---

[Back to README](../README.md)
