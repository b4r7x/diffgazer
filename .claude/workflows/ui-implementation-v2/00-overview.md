# UI Implementation Workflow v2

## Overview

This workflow fixes critical issues with the current UI implementation and adds missing functionality based on the original design specification.

## Current Problems

### 1. Settings Not Connected to Keyring/Config
- `SettingsView` receives only partial props in `app.tsx`
- `configuredProviders` is empty array → shows "[Not Configured]" for all providers
- Theme/Controls changes don't save (callbacks are undefined)
- No endpoint to get provider configuration status

### 2. Missing Onboarding Flow
- Trust step not implemented
- Wizard flow incomplete before first use
- No proper transition: TRUST → SETUP → HOME

### 3. Missing Split-Pane Review UI
- No two-column layout for issues
- No issue tabs (Details/Explain/Trace/Patch)
- No keyboard navigation between panels

### 4. Main Menu Doesn't Match Spec
- Current: `[g] Git Status [d] Git Diff [r] AI Review...`
- Should be: `r/R/f/l/h/s/?/q` + status card

### 5. No Unified Settings Feature Module
- Settings logic scattered across 4 locations
- Should be in `features/settings/` with unified state

---

## Phase Structure

| Phase | Description | Priority |
|-------|-------------|----------|
| Phase 1 | API Layer - Provider Status | Critical |
| Phase 2 | Wire SettingsView Props | Critical |
| Phase 3 | Complete Onboarding Flow | High |
| Phase 4 | Split-Pane Review UI | High |
| Phase 5 | Main Menu Redesign | Medium |
| Phase 6 | Settings Feature Refactor | Medium |

---

## Dependency Graph

```
Phase 1: API Layer
    ↓
Phase 2: Wire SettingsView
    ↓
Phase 3: Onboarding Flow ←────┐
    ↓                         │
Phase 4: Split-Pane UI        │ (reuses wizard components)
    ↓                         │
Phase 5: Main Menu ───────────┘
    ↓
Phase 6: Settings Refactor
```

---

## File Changes Summary

### New Files
- `packages/schemas/src/provider-status.ts`
- `apps/cli/src/features/review/components/review-split-screen.tsx`
- `apps/cli/src/features/review/components/issue-list-pane.tsx`
- `apps/cli/src/features/review/components/issue-details-pane.tsx`

### Modified Files
- `apps/server/src/api/routes/config.ts` - add /config/providers endpoint
- `apps/cli/src/hooks/use-config.ts` - add loadProviderStatus
- `apps/cli/src/app/app.tsx` - wire all SettingsView props
- `apps/cli/src/features/app/hooks/use-screen-handlers.ts` - add settings handlers
- `apps/cli/src/app/screens/onboarding-screen.tsx` - complete wizard flow
- `apps/cli/src/app/views/main-menu-view.tsx` - redesign with status card

---

## Component Reuse Strategy

Per Bulletproof React, wizard components in `components/wizard/` are correctly placed as shared UI:

```
components/wizard/           ← SHARED (used by onboarding AND settings)
├── wizard-frame.tsx
├── trust-step.tsx
├── theme-step.tsx
├── provider-step.tsx
├── credentials-step.tsx
├── controls-step.tsx
└── summary-step.tsx

app/screens/                 ← ORCHESTRATION
├── onboarding-screen.tsx    (uses wizard/* in mode="onboarding")
└── settings-screen.tsx      (uses wizard/* in mode="settings")
```

This follows the rule: "Keep things close to where they're used, extract when reused."
