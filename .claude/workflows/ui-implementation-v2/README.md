# UI Implementation Workflow v2

## Quick Start

This workflow fixes critical issues identified in the current UI implementation.

## Problems Fixed

1. **Settings not connected to keyring** - Provider shows "[Not Configured]" even when API key is stored
2. **Theme/Controls don't save** - Callbacks are undefined, changes lost
3. **Missing onboarding flow** - No trust wizard, incomplete setup
4. **Missing split-pane review UI** - No two-column layout for issues
5. **Main menu doesn't match spec** - Missing status card, wrong shortcuts

## Workflow Phases

| Phase | File | Description | Priority |
|-------|------|-------------|----------|
| 1 | `01-api-provider-status.md` | Add `/config/providers` endpoint | Critical |
| 2 | `02-wire-settings-props.md` | Wire all SettingsView props | Critical |
| 3 | `03-onboarding-flow.md` | Complete trust → setup → home flow | High |
| 4 | `04-split-pane-review.md` | Two-column issue list/details | High |
| 5 | `05-main-menu-redesign.md` | Status card + proper shortcuts | Medium |
| 6 | `06-settings-feature-refactor.md` | Unified settings feature module | Medium |

## Execution

See `orchestrator.md` for multi-agent execution plan.

### Critical Path (Sequential)
```
Phase 1 → Phase 2 → (Phase 3 || Phase 4) → Phase 5 → Phase 6
```

### Quick Fix (Minimum Viable)
Just run Phases 1-2 to fix the immediate settings issues:
```bash
# Read and execute Phase 1
# Then Phase 2
```

## Component Reuse Strategy

Per [Bulletproof React](https://github.com/alan2207/bulletproof-react):

```
components/wizard/           ← SHARED (onboarding + settings)
├── wizard-frame.tsx
├── trust-step.tsx
├── theme-step.tsx
├── provider-step.tsx
├── credentials-step.tsx
├── controls-step.tsx
└── summary-step.tsx

app/screens/                 ← ORCHESTRATION
├── onboarding-screen.tsx    (mode="onboarding")
└── settings-screen.tsx      (mode="settings")
```

## Reference Documents

- Original spec: `gpt-convo.md` (in project root)
- Old workflow: `.claude/workflows/ui-implementation/`
- Project structure: `.claude/docs/structure-apps.md`
