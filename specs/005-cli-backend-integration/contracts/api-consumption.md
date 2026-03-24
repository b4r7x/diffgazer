# API Consumption Contract: CLI → Backend

**Branch**: `005-cli-backend-integration` | **Date**: 2026-03-24

The CLI consumes the same backend API as the web app. This contract documents which endpoints each CLI screen uses and the expected request/response shapes (all defined in `@diffgazer/schemas`).

## Client Configuration

```
Base URL: http://127.0.0.1:3000
Header: x-diffgazer-project-root = process.cwd()
```

## Endpoint Usage by Screen

### App Bootstrap (before any screen renders)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Server readiness check |
| `/api/config/check` | GET | Config guard (redirect to onboarding if not configured) |

### Home Screen
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config/init` | GET | Provider, model, trust, project, setup status |
| `/api/settings/trust` | POST | Save trust grant from trust panel |
| `/api/review/sessions/active` | GET | Check for resumable review session |
| `/api/review/reviews` | GET | Last review for "Resume" menu item |

### Onboarding Wizard (on completion)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | POST | Save secretsStorage, defaultLenses, agentExecution |
| `/api/config` | POST | Save provider, apiKey, model |
| `/api/config/providers` | GET | List available providers (for provider step) |

### Review Screen
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/review/stream` | GET (SSE) | Start new review stream |
| `/api/review/reviews/:id/stream` | GET (SSE) | Resume existing review stream |
| `/api/review/sessions/active` | GET | Check for active session before starting |
| `/api/review/reviews/:id` | GET | Load saved review results |
| `/api/config/init` | GET | Check if provider is configured |

### History Screen
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/review/reviews` | GET | List all reviews (with optional projectPath filter) |
| `/api/review/reviews/:id` | GET | Load full review for detail view |

### Settings Hub
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config/init` | GET | Provider, trust status for display |
| `/api/settings` | GET | Current settings values for display |

### Settings: Providers
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config/providers` | GET | All providers with status |
| `/api/config` | POST | Save provider credentials |
| `/api/config/provider/:id/activate` | POST | Activate provider + optional model |
| `/api/config/provider/:id` | DELETE | Remove provider credentials |
| `/api/config/provider/openrouter/models` | GET | Fetch OpenRouter model list |

### Settings: Storage
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | GET | Current secretsStorage value |
| `/api/settings` | POST | Save secretsStorage |

### Settings: Analysis
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | GET | Current defaultLenses |
| `/api/settings` | POST | Save defaultLenses |

### Settings: Agent Execution
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | GET | Current agentExecution |
| `/api/settings` | POST | Save agentExecution |

### Settings: Trust & Permissions
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config/init` | GET | Current trust state |
| `/api/settings/trust` | POST | Save trust config |
| `/api/settings/trust` | DELETE | Revoke trust |

### Settings: Theme
No API calls. Theme is client-side only (web uses localStorage, CLI uses in-memory + --theme flag).

### Settings: Diagnostics
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Server health |
| `/api/config/init` | GET | Setup status, provider info |
| `/api/review/context` | GET | Context snapshot status |
| `/api/review/context/refresh` | POST | Force-rebuild context snapshot |

### Header (Global Layout)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config/init` | GET | Active provider name for display |

### Shutdown (Quit from Home)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/shutdown` | POST | Terminate server process |

## Error Response Contract

All API errors return:
```json
{
  "error": {
    "message": "Human-readable error description",
    "code": "ERROR_CODE"
  }
}
```

Error codes the CLI must handle:
| Code | HTTP | Meaning | CLI Behavior |
|------|------|---------|-------------|
| `PROVIDER_NOT_CONFIGURED` | 503 | No provider set up | Show "configure provider" message |
| `TRUST_REQUIRED` | 403 | Project not trusted | Show trust panel |
| `INVALID_API_KEY` | 401 | Bad API key | Show "update API key" message |
| `RATE_LIMITED` | 429 | Rate limit hit | Show retry message with backoff |
| `SESSION_NOT_FOUND` | 404 | Review session expired | Start fresh review |
| `SESSION_STALE` | 409 | Repo state changed | Start fresh review |
| Network error | - | Server unreachable | Show "Server Disconnected" + retry |
