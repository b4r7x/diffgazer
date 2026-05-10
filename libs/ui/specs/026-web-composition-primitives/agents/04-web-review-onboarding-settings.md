# Agent 04: Web Review, Onboarding, And Settings Adoption

Ownership:

- `apps/web/src/features/review/**`
- `apps/web/src/features/onboarding/**`
- `apps/web/src/features/settings/**`
- `apps/web/src/features/home/**` when shared selector composition is affected
- `apps/web/src/components/shared/**`
- `apps/web/src/components/ui/**` app-local wrappers
- relevant web tests

Do not move app components into `libs/ui`. This agent applies existing/improved primitives to web.

## Goal

Remove duplicate local UI and make product screens compose from primitives while keeping domain adapters local.

## Review Tasks

1. Replace app-local `DiffView`.
   - Current:
     - `apps/web/src/features/review/components/diff-view.tsx`
     - `apps/web/src/features/review/components/issue-details-pane.tsx`
   - Target: `@diffgazer/ui/components/diff-view`.
   - Delete local duplicate if no longer used.
   - Preserve patch rendering and tests.

2. Replace or fold `CodeSnippet`.
   - Current:
     - `apps/web/src/features/review/components/code-snippet.tsx`
     - `apps/web/src/features/review/components/issue-details-pane.tsx`
   - Target: public `CodeBlock`/`CodeBlock.Line` or new generic `CodeBlock` adapter from Agent 02.
   - Keep review evidence data shaping in app.

3. Replace `MetricItem`.
   - Current:
     - `apps/web/src/features/review/components/metric-item.tsx`
     - `apps/web/src/features/review/components/review-metrics-footer.tsx`
   - Target: `KeyValue` or simple semantic app markup.
   - Delete local component if unused.

4. Keep review progress app-local.
   - Current:
     - `apps/web/src/components/ui/progress/progress-list.tsx`
     - `apps/web/src/components/ui/progress/progress-step.tsx`
     - review progress consumers
   - Continue composing `Stepper`.
   - Do not move review progress types to `libs/ui`.
   - Only adjust if `Stepper` API changes.
   - If `Stepper.Step stepId` becomes `value`, update this adapter but keep it in app.

5. Keep severity app-local.
   - Current:
     - `apps/web/src/components/ui/severity/**`
     - `apps/web/src/features/review/components/severity-filter-group.tsx`
   - `SeverityFilterGroup` should keep using `ToggleGroup`.
   - `SeverityBreakdown` may use `BlockBar` internally, but it remains app-local.
   - Use `BlockBar valueText` or `formatValueText` if Agent 02 adds it.

6. Keep `LensStatsTable` as raw table unless a real table primitive is introduced.
   - Do not convert tabular comparison data into `NavigationList` or `KeyValue`.

## Onboarding Tasks

1. Replace `WizardProgress`.
   - Current:
     - `apps/web/src/features/onboarding/components/wizard-progress.tsx`
     - `apps/web/src/features/onboarding/components/onboarding-wizard.tsx`
   - Target: `HorizontalStepper value={currentStep}`.
   - Keep `OnboardingStep` and labels in app.
   - Delete local component if unused.

2. Remove redundant highlight helpers if primitives cover them.
   - Current:
     - `apps/web/src/features/onboarding/components/steps/use-option-highlight.ts`
     - provider/model/storage/execution steps
   - Prefer `RadioGroup highlighted/onHighlightChange/onEnter/onNavigationBoundaryReached`.
   - Do not move `useOptionHighlight` to `libs/keys` unless there are multiple unrelated non-UI use cases.

3. Keep provider/model/storage/execution step components app-local.
   - They depend on product provider schemas, settings, and onboarding flow.
   - Keep Enter-advances and Space-selects behavior covered if highlight handling changes.

## Settings And Home Tasks

1. Storage/theme/execution selectors.
   - Compose with `Field`, `RadioGroup`, `ToggleGroup`, `Input`, `InputGroup`.
   - Keep storage/theme/execution option data and copy local.

2. Trust permissions.
   - Keep `TrustPermissionsContent` and model local.
   - Use existing primitives where possible, but do not extract trust policy.

3. Home panels.
   - Keep page/product layout local.
   - Use display primitives such as `KeyValue`, `Panel`, `SectionHeader`, `Button`, `EmptyState` when they fit without wrappers.
   - If `InfoField` is clickable, preserve real button/link semantics instead of using display-only `KeyValue`.

## Tests

Update/add tests for:

- issue details renders public `DiffView`/`CodeBlock` behavior
- review metrics still expose readable labels/values
- onboarding progress state and accessible labels
- onboarding radio choices keyboard behavior
- settings selectors label/value behavior
- trust permissions unchanged behavior after primitive composition

## Validation

- `pnpm --filter @diffgazer/web test -- review onboarding settings`
- `pnpm --filter @diffgazer/web type-check`
