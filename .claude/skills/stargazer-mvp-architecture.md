# Stargazer MVP Architecture

Target structure for the slim MVP.

## What We're Building

```
User runs CLI → CLI shows logo → Starts server → Opens web UI
                                      ↓
                              Web UI triggers review
                                      ↓
                              Server streams SSE events
                                      ↓
                              Issues displayed in real-time
```

## Target Structure

```
stargazer/
├── apps/
│   ├── cli/                    # Minimal - just logo + server launcher
│   │   ├── src/
│   │   │   └── index.ts        # figlet logo, spawn server, open browser
│   │   └── package.json
│   │
│   ├── server/                 # Hono API
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── routes/         # API routes
│   │   │   ├── services/       # Business logic
│   │   │   ├── lenses/         # All 5 lenses
│   │   │   └── storage/        # Per-project .stargazer/
│   │   └── package.json
│   │
│   └── web/                    # React SPA (main UI)
│       ├── src/
│       │   ├── app/            # Pages
│       │   ├── components/     # UI components
│       │   ├── features/       # Feature modules
│       │   └── hooks/          # Shared hooks
│       └── package.json
│
├── packages/
│   ├── schemas/                # Zod schemas (migrate mostly as-is)
│   └── core/                   # Shared utilities (Result, SSE parser)
│
└── .stargazer/                 # Per-project storage (gitignored)
    └── reviews/
        └── {review-id}.json
```

## Key Endpoints

```
GET  /health
GET  /triage/stream?mode=staged&lenses=all    # Main review endpoint (SSE)
GET  /triage/reviews                           # List saved reviews
GET  /triage/reviews/:id                       # Get review detail
POST /triage/drilldown/:issueId                # Deep-dive analysis
```

## Data Flow

```
1. CLI starts server on localhost:3001
2. CLI opens browser to localhost:3001
3. User clicks "Start Review"
4. Web fetches GET /triage/stream (SSE)
5. Server:
   - Gets git diff
   - Runs each lens (parallel where possible)
   - Streams events: agent_start, issue_found, agent_complete
6. Web updates UI in real-time
7. Review saved to .stargazer/reviews/
```

## What's Different from .depracated/

| Aspect | Before | After |
|--------|--------|-------|
| CLI | Full TUI with React Ink | Just logo + launcher |
| Storage | Global ~/.config/stargazer/ | Per-project .stargazer/ |
| Complexity | Many abstractions | Flat, simple |
| React | useMemo/useCallback everywhere | None, trust compiler |
