# Quickstart: CLI Backend Integration

**Branch**: `005-cli-backend-integration` | **Date**: 2026-03-24

## Prerequisites

- Node.js 20+
- pnpm workspace set up (`pnpm run bootstrap` from workspace root)
- All packages built (`pnpm run build` from workspace root)

## Development

```bash
# Start CLI in dev mode (spawns API server + web server as child processes)
cd /Users/voitz/Projects/diffgazer-workspace/diffgazer
pnpm dev:cli

# Or start just the API server for testing API calls
cd apps/server && npx tsx src/dev.ts

# Build CLI
cd apps/cli && pnpm build

# Type-check
pnpm type-check
```

## Key Files to Modify

### Foundation (create new)
- `apps/cli/src/lib/api.ts` — API client singleton (mirrors `apps/web/src/lib/api.ts`)
- `apps/cli/src/hooks/use-server-status.ts` — Server health polling (mirrors `apps/web/src/hooks/use-server-status.ts`)
- `apps/cli/src/hooks/use-config-guard.ts` — Config check + onboarding redirect
- `apps/cli/src/hooks/use-settings.ts` — Settings fetch helper
- `apps/cli/src/hooks/use-init.ts` — Init data fetch + cache

### Review Flow (rewrite existing)
- `apps/cli/src/features/review/hooks/use-review-stream.ts` — Replace mock with real SSE
- `apps/cli/src/features/review/hooks/use-review-lifecycle.ts` — Replace mock with real state machine

### Screens (modify existing — add API calls)
All screens under `apps/cli/src/app/screens/` and feature components need API integration.

## API Client Setup Pattern

```typescript
// apps/cli/src/lib/api.ts
import { createApi } from "@diffgazer/api";

export const api = createApi({
  baseUrl: "http://127.0.0.1:3000",
  projectRoot: process.cwd(),
});
```

Then import in any hook/screen: `import { api } from "../../lib/api.js";`

## Shared Packages Available

| Import | What it provides |
|--------|-----------------|
| `@diffgazer/api` | `createApi()`, typed HTTP client, 27 bound API methods |
| `@diffgazer/core/review` | `reviewReducer`, `createInitialReviewState`, `processReviewStream`, `convertAgentEventsToLogEntries` |
| `@diffgazer/core/streaming/sse-parser` | `parseSSEStream` for SSE parsing |
| `@diffgazer/schemas` | All Zod schemas and TypeScript types |

## Verification Commands

```bash
# Check all MOCK_ constants are removed
grep -r "MOCK_" apps/cli/src/ --include="*.ts" --include="*.tsx"

# Check all TODO comments are resolved
grep -r "// TODO" apps/cli/src/ --include="*.ts" --include="*.tsx"

# Type-check the CLI
cd apps/cli && pnpm tsc --noEmit

# Build to verify no import errors
cd apps/cli && pnpm build
```
