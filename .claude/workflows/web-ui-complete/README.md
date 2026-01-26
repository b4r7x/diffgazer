# Web UI Complete Workflow

Two-phase workflow to create a complete web UI for Stargazer that mirrors CLI functionality.

## Overview

| Workflow | Model | Focus |
|----------|-------|-------|
| `01-gemini-ui.md` | Gemini 3 Pro | Design system, UI components, visual layout |
| `02-opus-integration.md` | Opus 4.5 | Backend integration, state, complex logic |

## Prerequisites

- Server (`apps/server`) running
- Packages built (`pnpm build`)
- Existing `apps/web` scaffolding

## Execution Order

### Phase 1: Gemini UI (Antigravity)

```bash
# In Antigravity with Gemini 3 Pro
# Load workflow: .claude/workflows/web-ui-complete/01-gemini-ui.md
```

Gemini creates:
- WebTUI design system + Stargazer theme
- All UI primitives (buttons, cards, badges, etc.)
- Layout components (header, sidebar, footer)
- Feature components (visual only, mock data)
- Responsive layouts
- Animations and polish

### Phase 2: Opus Integration (Claude Code)

```bash
# In Claude Code with Opus 4.5
# Load workflow: .claude/workflows/web-ui-complete/02-opus-integration.md
```

Opus creates:
- API layer (SSE streams, REST calls)
- State management (Zustand stores)
- Feature hooks (data fetching, real-time)
- Backend wiring
- CLI web command
- Error handling
- Type safety validation

## Architecture

```
apps/web/src/
├── app/
│   ├── routes/           # TanStack Router pages
│   │   ├── __root.tsx    # Layout + providers
│   │   ├── index.tsx     # Main menu
│   │   ├── review/
│   │   │   ├── index.tsx     # New review
│   │   │   └── $reviewId.tsx # View review
│   │   ├── history.tsx   # Review history
│   │   ├── sessions.tsx  # Session management
│   │   └── settings.tsx  # Configuration
│   ├── providers.tsx     # Context providers
│   └── router.tsx        # Router config
│
├── components/
│   ├── ui/               # WebTUI primitives
│   └── layout/           # Header, footer, sidebar
│
├── features/
│   ├── review/           # Review feature
│   │   ├── api/
│   │   ├── components/
│   │   └── hooks/
│   ├── history/          # History feature
│   ├── sessions/         # Sessions feature
│   ├── settings/         # Settings feature
│   └── agents/           # Agent activity
│
├── hooks/                # Shared hooks
├── stores/               # Zustand stores
├── lib/                  # Utilities
├── styles/               # CSS (WebTUI theme)
└── types/                # Shared types
```

## Design System

Based on WebTUI + Catppuccin Mocha:

| Token | Color | Usage |
|-------|-------|-------|
| `--background0` | `#1e1e2e` | Main background |
| `--background1` | `#181825` | Deeper surfaces |
| `--background2` | `#313244` | Cards, panels |
| `--foreground0` | `#cdd6f4` | Primary text |
| `--accent` | `#89dceb` | Stargazer cyan |
| `--blocker` | `#f38ba8` | Blocker severity |
| `--high` | `#fab387` | High severity |
| `--medium` | `#f9e2af` | Medium severity |
| `--low` | `#89b4fa` | Low severity |

## Success Criteria

After both workflows:

- [ ] Main menu matches CLI functionality
- [ ] Review flow works end-to-end with SSE
- [ ] Agent activity shows real-time
- [ ] Split pane layout with issue details
- [ ] History and sessions work
- [ ] Settings/onboarding complete
- [ ] CLI `stargazer web` command works
- [ ] Dark theme with Stargazer accent
- [ ] Keyboard navigation (optional)
- [ ] No TypeScript errors
