# UI Implementation v2 - Multi-Agent Orchestrator

## Overview

This orchestrator coordinates multiple agents to fix UI implementation issues.

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────┐
│                     CRITICAL PATH                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: API Layer ──────────────────────────────────────────► │
│     Agent: backend-architect                                     │
│     Files: packages/schemas/src/config.ts                        │
│            apps/server/src/api/routes/config.ts                  │
│            apps/cli/src/hooks/use-config.ts                      │
│                                                                  │
│            ↓                                                     │
│                                                                  │
│  Phase 2: Wire Settings Props ────────────────────────────────► │
│     Agent: react-component-architect                             │
│     Files: apps/cli/src/app/app.tsx                              │
│            apps/cli/src/features/app/hooks/use-screen-handlers.ts│
│            apps/cli/src/features/app/hooks/use-app-state.ts      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     PARALLEL WORK                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┐    ┌────────────────────┐               │
│  │ Phase 3: Onboarding│    │ Phase 4: Split-Pane│               │
│  │                    │    │                    │               │
│  │ Agent:             │    │ Agent:             │               │
│  │ react-component-   │    │ react-component-   │               │
│  │ architect          │    │ architect          │               │
│  │                    │    │                    │               │
│  │ Files:             │    │ Files:             │               │
│  │ - onboarding-      │    │ - split-pane.tsx   │               │
│  │   screen.tsx       │    │ - issue-list-      │               │
│  │ - use-navigation.ts│    │   pane.tsx         │               │
│  │ - trust-wizard-    │    │ - issue-details-   │               │
│  │   screen.tsx       │    │   pane.tsx         │               │
│  │ - summary-step.tsx │    │ - review-split-    │               │
│  │                    │    │   screen.tsx       │               │
│  └────────┬───────────┘    └────────┬───────────┘               │
│           │                         │                            │
│           └──────────┬──────────────┘                            │
│                      ↓                                           │
│                                                                  │
│  Phase 5: Main Menu ─────────────────────────────────────────►  │
│     Agent: react-component-architect                             │
│     Files: apps/cli/src/app/views/main-menu-view.tsx             │
│            apps/cli/src/components/ui/status-card.tsx            │
│            apps/cli/src/components/ui/header-brand.tsx           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     REFACTORING                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 6: Settings Feature Refactor ─────────────────────────►  │
│     Agent: code-architect                                        │
│     Files: apps/cli/src/features/settings/                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Assignments

### Phase 1: backend-architect
```
Task: Create /config/providers endpoint

1. Add ProviderStatusSchema to packages/schemas/src/config.ts
2. Add /config/providers route to apps/server/src/api/routes/config.ts
3. Add loadProviderStatus to apps/cli/src/hooks/use-config.ts

Validation:
- npm run type-check
- GET /config/providers returns provider status with hasApiKey
```

### Phase 2: react-component-architect
```
Task: Wire all SettingsView props

1. Update apps/cli/src/app/app.tsx:
   - Add effect to load provider status when entering settings
   - Pass all required props to SettingsView

2. Update apps/cli/src/features/app/hooks/use-screen-handlers.ts:
   - Add settings handlers (onSaveTheme, onSaveControls, etc.)

3. Update apps/cli/src/features/app/hooks/use-app-state.ts:
   - Include trust state

Validation:
- Theme changes persist
- Provider status shows correctly
```

### Phase 3: react-component-architect
```
Task: Complete onboarding flow

1. Update use-navigation.ts:
   - Add "trust-wizard" view type
   - Update determineInitialScreen logic

2. Create trust-wizard-screen.tsx
3. Update onboarding-screen.tsx for proper step sequence
4. Create summary-step.tsx
5. Update app.tsx for trust flow

Validation:
- Fresh start shows trust wizard
- After trust → setup wizard
- After setup → main menu
```

### Phase 4: react-component-architect
```
Task: Create split-pane review UI

1. Create components/ui/split-pane.tsx
2. Create features/review/components/issue-list-pane.tsx
3. Create features/review/components/issue-list-header.tsx
4. Create features/review/components/issue-details-pane.tsx
5. Create features/review/components/issue-tabs.tsx
6. Create features/review/components/review-split-screen.tsx
7. Create features/review/hooks/use-review-keyboard.ts
8. Update review-view.tsx

Validation:
- Two-column layout works
- Keyboard navigation works
- Tab switching works
```

### Phase 5: react-component-architect
```
Task: Redesign main menu

1. Create components/ui/status-card.tsx
2. Create components/ui/header-brand.tsx
3. Update main-menu-view.tsx
4. Add menu handlers to use-screen-handlers.ts

Validation:
- Status card shows provider/trust/last review
- Menu shortcuts work (r, R, f, l, h, s, ?, q)
```

### Phase 6: code-architect
```
Task: Refactor settings into feature module

1. Create features/settings/api/settings-api.ts
2. Create features/settings/hooks/use-settings-state.ts
3. Create features/settings/index.ts
4. Update app.tsx to use unified hook
5. Deprecate old hooks

Validation:
- All settings work through unified hook
- No import cycles
```

---

## Execution Commands

### Sequential (critical path):
```bash
# Phase 1
claude-code task --agent backend-architect --workflow 01-api-provider-status.md

# Phase 2 (depends on Phase 1)
claude-code task --agent react-component-architect --workflow 02-wire-settings-props.md
```

### Parallel (after Phase 2):
```bash
# Phase 3 & 4 can run in parallel
claude-code task --agent react-component-architect --workflow 03-onboarding-flow.md &
claude-code task --agent react-component-architect --workflow 04-split-pane-review.md &
wait
```

### Sequential (after parallel):
```bash
# Phase 5 (after 3 & 4)
claude-code task --agent react-component-architect --workflow 05-main-menu-redesign.md

# Phase 6 (optional refactor)
claude-code task --agent code-architect --workflow 06-settings-feature-refactor.md
```

---

## Validation Checklist

After all phases:

- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] Fresh start → Trust wizard → Setup → Main menu
- [ ] Settings → Theme change persists
- [ ] Settings → Provider shows "Current"/"Configured" badges
- [ ] Settings → Credentials save to keyring
- [ ] Main menu → Status card shows provider
- [ ] Review → Two-column layout
- [ ] Review → Keyboard navigation (j/k, Tab, 1-4)
- [ ] Review → Apply/Ignore work
