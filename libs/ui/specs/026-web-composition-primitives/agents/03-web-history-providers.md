# Agent 03: Web History And Providers Adoption

Ownership:

- `apps/web/src/features/history/**`
- `apps/web/src/features/providers/**`
- relevant tests under those folders
- app-local adapters needed for those features

Do not edit `libs/ui` or `libs/keys` except to consume completed public APIs. If a primitive is missing, stop and hand off to Agents 01/02.

## Goal

Apply the primitives-first direction to history and providers without extracting product components.

## History Tasks

1. Replace custom `TimelineList` behavior after `NavigationList` boundary support exists.
   - Current files:
     - `apps/web/src/features/history/components/timeline-list.tsx`
     - `apps/web/src/features/history/components/timeline-list.test.tsx`
     - `apps/web/src/features/history/components/page.tsx`
   - Target: app-local `HistoryTimelineNav` or rewritten `TimelineList` composed from `NavigationList`.
   - Keep `TimelineItem` mapping and labels in app.
   - Remove direct `useNavigation` usage from `TimelineList` if `NavigationList` can cover it.
   - Preserve `selectedId`, `onSelect`, focus-zone integration, and boundary handoff.

2. Simplify runs list boundary logic.
   - Current file: `apps/web/src/features/history/components/page.tsx`
   - Replace manual ArrowUp first-item edge detection with `NavigationList onNavigationBoundaryReached`.
   - Keep `handleRunActivate` and route/product state local.

3. Keep history three-pane layout app-local.
   - Do not introduce `PaneGroup`.
   - Keep timeline/runs/insights layout in `page.tsx` unless later repeated in at least two unrelated workspaces.

4. History insights.
   - Keep `HistoryInsightsPane` app-local.
   - If touching severity display, compose app severity rows from `BlockBar` or keep current local wrapper.
   - Do not move `SeverityBreakdown` to `libs/ui`.
   - Use `EmptyState` for empty/no-selection/loading states where it fits existing behavior.

## Providers Tasks

1. Provider list.
   - Current file: `apps/web/src/features/providers/components/provider-list.tsx`
   - Keep `InputGroup`, `ToggleGroup`, `NavigationList`.
   - Replace manual provider boundary key handling with `NavigationList onNavigationBoundaryReached`.
   - Keep provider status, tier, capabilities, filters, and product copy local.
   - Keep capability cards local unless they can be replaced cleanly by existing display primitives.

2. Model picker dialog.
   - Current files:
     - `apps/web/src/features/providers/components/model-select-dialog/model-list.tsx`
     - `apps/web/src/features/providers/components/model-select-dialog/model-list-item.tsx`
     - `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
     - `apps/web/src/features/providers/components/model-select-dialog/model-list.test.tsx`
   - Replace custom `role="radiogroup"` + standalone `Radio` items with `RadioGroup` and `RadioGroupItem` composition.
   - Use manual activation/highlight if arrowing previews a model without committing.
   - Keep model data, filtering, custom model flow, and confirm behavior local.
   - Refactor dialog keyboard hooks away from direct `[role="radio"][data-value]` queries after `RadioGroup` owns the composite behavior.
   - If a first-class `Combobox` exists by then, evaluate `Dialog + Combobox`; otherwise use `RadioGroup` plus existing search input.

3. API key dialog and method selector.
   - Current files:
     - `apps/web/src/components/shared/api-key-method-selector.tsx`
     - `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx`
     - `apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts`
   - Compose from `Field`, `RadioGroup`, `Input` or `InputGroup`.
   - Keep provider/env copy and submit behavior local.
   - Do not create `CredentialSourceSelector`.

## Tests

Update/add tests for:

- history timeline and runs keyboard selection/boundary handoff
- provider list boundary handoff
- model picker one-tab-stop radiogroup behavior
- API key method selector radiogroup semantics and input labeling
- existing provider keyboard hooks after primitive adoption
- custom OpenRouter model path and async focus repair

## Validation

- `pnpm --filter @diffgazer/web test -- history providers`
- `pnpm --filter @diffgazer/web type-check`
