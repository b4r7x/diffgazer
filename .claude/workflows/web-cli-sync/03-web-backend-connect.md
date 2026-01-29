# Web Backend Connect

## Purpose
CLI has proper backend connections. Web uses mock data. Connect web to the same backend APIs as CLI.

## Agents Used
| Agent | Purpose |
|-------|---------|
| `feature-dev:code-explorer` | Analyze CLI API usage patterns |
| `api-architect` | Design web API layer |
| `backend-developer` | Implement API connections |
| `javascript-typescript:typescript-pro` | TypeScript hooks and types |
| `pr-review-toolkit:type-design-analyzer` | Type consistency |
| `pr-review-toolkit:pr-test-analyzer` | Test coverage |

## Execution Steps

### Phase 1: CLI API Analysis
```
Agent: feature-dev:code-explorer (opus)
Task: Analyze apps/cli/src/features/*/api/ and apps/cli/src/lib/*-api.ts
Output:
- All API functions
- Endpoints called
- Request/response types
- Error handling patterns
```

### Phase 2: Web API Analysis
```
Agent: feature-dev:code-explorer (opus)
Task: Analyze apps/web/src/lib/api.ts and apps/web/src/features/*/api/
Output:
- Current API functions
- What's connected vs mock
- Missing connections
```

### Phase 3: API Layer Design
```
Agent: api-architect (opus)
Task: Design web API layer matching CLI patterns
Output:
- Shared API types (move to @repo/core or @repo/api)
- Web-specific hooks
- Error handling approach
```

### Phase 4: Implementation
```
Agent: backend-developer (opus) + javascript-typescript:typescript-pro (opus)
Task: For each missing connection:
1. Create API function in apps/web/src/features/{feature}/api/
2. Create React hook in apps/web/src/features/{feature}/hooks/
3. Replace mock data with real API calls
4. Handle loading/error states
```

### Phase 5: Type Safety Check
```
Agent: pr-review-toolkit:type-design-analyzer (opus)
Task: Verify types match between CLI, web, and server
```

### Phase 6: Test Coverage
```
Agent: pr-review-toolkit:pr-test-analyzer (opus)
Task: Identify missing tests for new API connections
```

## API Connection Checklist

| Endpoint | CLI Uses | Web Uses | Action |
|----------|----------|----------|--------|
| GET /settings | ✓ | ✗ | Connect |
| POST /settings | ✓ | ✗ | Connect |
| GET /settings/trust | ✓ | ✗ | Connect |
| POST /settings/trust | ✓ | ✗ | Connect |
| GET /triage/reviews | ✓ | ✗ | Connect |
| GET /triage/reviews/:id | ✓ | ✗ | Connect |
| POST /triage/reviews/:id/drilldown | ✓ | ✗ | Connect |
| GET /review/stream (SSE) | ✓ | ✗ | Connect |
| GET /sessions | ✓ | ✓ | - |
| POST /sessions | ✓ | ✗ | Connect |
| ... | ... | ... | ... |

## Expected Output

### Files Created
- apps/web/src/features/settings/api/settings-api.ts
- apps/web/src/features/settings/hooks/use-settings.ts
- apps/web/src/features/review/api/triage-api.ts
- apps/web/src/features/review/hooks/use-triage.ts
- ...

### Pages Updated
- Remove mock data from: review.tsx, history.tsx, settings-*.tsx
- Add real API hooks
