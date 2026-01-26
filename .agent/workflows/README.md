# Antigravity Workflows

Workflows for executing in Antigravity AI assistant.

## Web UI Workflows

Create the Stargazer web UI in two phases:

### Phase 1: Gemini UI (Visual)

**File:** `web-ui-gemini.md`
**Model:** Gemini 3 Pro

Creates all visual components:
- WebTUI design system + Stargazer theme
- UI primitives (button, badge, card, etc.)
- Layout components (header, footer, split-pane)
- Feature components (main menu, agent panel, issue list)
- Routes with mock data
- Animations and polish

**Run first** - produces visual UI with placeholder data.

### Phase 2: Opus Integration (Backend)

**File:** `web-ui-opus.md`
**Model:** Opus 4.5

Wires UI to real backend:
- API layer (config, review, history, git)
- Zustand stores (config, review state)
- Feature hooks (triage stream, config, history)
- Route integration with real data
- CLI web command
- Type safety validation

**Run after Gemini** - connects UI to working backend.

## Execution Order

```
1. Load web-ui-gemini.md in Antigravity (Gemini 3 Pro)
   → Creates visual UI with mock data

2. Load web-ui-opus.md in Antigravity (Opus 4.5) or Claude Code
   → Wires to backend, adds state management
```

## Prerequisites

Before running workflows:

```bash
# Build packages
pnpm build

# Verify server works
cd apps/server && pnpm dev

# Verify existing web scaffold
ls apps/web/src/
```

## Output

After both workflows complete:

```
apps/web/src/
├── styles/theme.css          # Stargazer theme
├── components/
│   ├── ui/                   # WebTUI primitives
│   └── layout/               # Header, footer, split-pane
├── features/
│   ├── menu/                 # Main menu
│   ├── agents/               # Agent activity
│   ├── review/               # Review feature
│   ├── history/              # History feature
│   └── settings/             # Settings feature
├── hooks/                    # Shared hooks
├── stores/                   # Zustand stores
├── lib/                      # API client, utils
└── app/routes/               # All pages
```

## Validation

After completion:

```bash
pnpm type-check
pnpm build

# Test full flow
pnpm --filter server dev &
pnpm --filter web dev
# Open http://localhost:5173
```
