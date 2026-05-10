# Web Composition Primitives Implementation Spec

Date: 2026-05-10

Scope:

- Product app: `apps/web`
- Public UI primitives and registry: `libs/ui`
- Keyboard and focus primitives: `libs/keys`
- Registry/install/docs handoff surfaces that make `libs/ui` and `libs/keys` usable by other consumers

This spec is the implementation plan for the primitives-first migration. It intentionally avoids extracting product components such as `ProgressList`, `SeverityBreakdown`, `TrustPermissionsContent`, or route/page workflows. The goal is to strengthen reusable primitives, then apply them consistently throughout `apps/web`.

## Current Spec Status

This file is implementation-ready enough to split work across agents. It should be updated if the implementation discovers a better primitive boundary.

There is no local `superpowers` or Spec Kit folder in this repository. The project already uses `libs/ui/specs/*` for multi-agent implementation plans, so this spec follows that local convention.

## SOTA References

- shadcn/ui frames itself as open code for building your component library through composition and distribution: https://ui.shadcn.com/docs
- shadcn registry items distribute explicit components, hooks, utilities, pages, and config files: https://ui.shadcn.com/docs/registry
- shadcn component composition docs were added so agents can build valid component trees and avoid invalid nesting: https://ui.shadcn.com/docs/changelog/2026-04-component-composition
- WAI APG keyboard guidance says composite widgets should usually expose one Tab stop, then use internal arrow/navigation keys via roving tabindex or `aria-activedescendant`: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- React 19 supports `ref` as a normal prop for function components; new public APIs should not introduce new `inputRef`-style public props: https://react.dev/blog/2024/12/05/react-19

## Product Decision

Prefer primitives over product components.

Library code must be:

- domain-neutral: no `ReviewSeverity`, provider IDs, secrets storage, trust policy, route state, API hooks, or Diffgazer product copy;
- composable: built as small primitives or compound components with explicit valid trees;
- accessible: owns APG-style roles, focus management, ARIA relationships, and keyboard behavior when it creates a widget;
- registry-ready: source, docs, examples, tests, registry metadata, public `/r` files, package exports, and generated artifacts stay truthful;
- stable as public API: value controls use `value`, `defaultValue`, `onChange(value)`; native wrappers keep native event handlers; non-value state uses semantic callbacks such as `open/onOpenChange`, `highlighted/onHighlightChange`, `selectedId/onSelect`, and `onNavigate`.

Product adapters may remain in `apps/web` even if they are reused by multiple product screens. Reuse inside one app is not enough to make a public library API.

## Dependency Boundaries

Allowed:

- `apps/web -> @diffgazer/core | @diffgazer/ui | @diffgazer/keys`
- `libs/ui -> @diffgazer/keys` when a UI primitive needs keyboard behavior
- `libs/keys -> React and small external runtime dependencies only`

Forbidden:

- `libs/ui` or `libs/keys` importing `apps/web`, `@/features`, `@/app`, app-local hooks, or app route state
- `libs/keys` importing `libs/ui` or product/domain types
- `libs/ui` importing product/domain schemas such as `ReviewSeverity`, `SeverityCounts`, `SecretsStorage`, `TrustCapabilities`, provider config, or route state
- product consumers importing library source internals not declared in package exports

If a component needs domain data, keep a small adapter in `apps/web` and pass generic props to a library primitive.

## Required Outcome

The migration is done when:

- `libs/keys` exposes the low-level focus/navigation primitives required by web and UI without product concepts.
- `libs/ui` primitives own APG widget behavior instead of app code reimplementing radiogroups, listboxes, tabs, dialogs, focus restore, or combobox semantics.
- `apps/web` uses existing or improved primitives consistently for history, providers, onboarding, review, settings, and shared selectors.
- Local duplicate UI such as app-local review `DiffView`, `CodeSnippet`, `MetricItem`, and `WizardProgress` is removed or replaced by library primitives.
- Product-specific assemblies remain in `apps/web`.
- Docs/registry/package surfaces are updated for any public primitive change.
- Behavior and accessibility tests cover the new contracts.

## Non-Goals

- Do not move `ProgressList`, `SeverityBreakdown`, `StorageSelectorContent`, `TrustPermissionsContent`, `ApiKeyMethodSelector`, `CardLayout`, route state, app shell layout, or page keyboard workflows into `libs/ui`.
- Do not move `useHistoryKeyboard`, `useReviewResultsKeyboard`, `useTrustFormKeyboard`, `useProvidersKeyboard`, `useModelDialogKeyboard`, or router/back-navigation workflows into `libs/keys`.
- Do not add a generic `PaneGroup`, `Item`, `CredentialSourceSelector`, `BreakdownBars`, or `ActionRowNavigation` unless the current implementation proves the extraction gates are met.
- Do not add deprecated aliases before the first customer-facing release.
- Do not assert Tailwind class names in tests unless a class is explicitly public API.

## Implementation Order

1. Keys primitives: extract reusable focus/navigation mechanics first.
2. UI primitive hardening: make `NavigationList`, `RadioGroup`, `Tabs`, `Dialog`, `Select`, `Field`, `CodeBlock`, and display primitives capable enough for web.
3. Web adoption wave A: history and providers/model dialogs.
4. Web adoption wave B: onboarding, review, settings/home shared selectors.
5. Docs/registry/artifacts: update all public surfaces after source changes.
6. Verification: focused package tests, web tests, artifact validation, root gates.

Do not start broad web rewrites before keys/UI behavior is stable. Otherwise app code will need temporary local workarounds that later become dead code.

## Agent Briefs

Agents are not alone in the codebase. They must not revert edits made by other agents or by the user. They must keep changes inside their ownership unless they explicitly coordinate a handoff.

- [Agent 01: Keys Focus Primitives](agents/01-keys-focus-primitives.md)
- [Agent 02: UI APG Primitives](agents/02-ui-apg-primitives.md)
- [Agent 03: Web History and Providers Adoption](agents/03-web-history-providers.md)
- [Agent 04: Web Review, Onboarding, and Settings Adoption](agents/04-web-review-onboarding-settings.md)
- [Agent 05: Registry, Docs, and Artifacts](agents/05-registry-docs-artifacts.md)
- [Agent 06: Verification and Accessibility](agents/06-verification-a11y.md)

## Primitive Backlog

P0 keys:

- Extract role-agnostic navigation item DOM utilities from `libs/keys/src/hooks/use-navigation.ts`.
- Centralize focus restore mechanics that can be used by Dialog, Popover, Select, and CommandPalette.
- Document and test `useFocusZone` tab behavior so it does not silently hijack native Tab focus.

P0 UI:

- `NavigationList`: expose boundary handoff, `onEnter(id, event)`, and optional `autoFocus`; remove app-level first/last item edge checks.
- `RadioGroup`: ensure one Tab stop, manual activation, `highlighted/onHighlightChange`, Enter/Space semantics, and boundary handoff are correct. Remove pre-release `labelledBy` alias and standardize on `aria-labelledby`.
- `Tabs`: manual tabs must activate with Enter/Space.
- `Dialog`: predictable focus restore even without `DialogTrigger`; consider `initialFocusRef`, `finalFocusRef`, `onOpenAutoFocus`, and `onCloseAutoFocus`.
- `Select` or future `Combobox`: searchable mode must announce active option correctly.
- `Field`: complete docs and keep label/control/description/error ARIA ownership centralized.
- `HorizontalStepper`: rename public `step` prop to `value` before release.
- `BlockBar`: add `valueText` or `formatValueText(value, max)` so app severity labels can stay app-owned.
- `KeyValue`: add label/value class slots only if needed for web replacement; keep `<dl>/<dt>/<dd>` semantics.

P0 web adoption:

- Replace app-local review `DiffView` with public `DiffView`.
- Replace or fold `CodeSnippet` into public `CodeBlock`.
- Replace `MetricItem` with `KeyValue` or simple app markup.
- Replace `WizardProgress` with `HorizontalStepper`.
- Make model picker and API key method selector compose `RadioGroup` instead of standalone custom radios.

P1 web adoption:

- Replace `TimelineList` with app-local composition over `NavigationList` after boundary support exists.
- Replace provider list boundary key logic with `NavigationList` boundary callback.
- Build severity displays from app-local adapters over `BlockBar`, not a public `SeverityBreakdown`.
- Keep review progress as app-local adapter over `Stepper`; improve `Stepper` only if its primitive contract is insufficient.

P2 only after repeated demand:

- `useRovingFocusGroup` or `useActionRowNavigation`
- `PaneGroup`/`Pane`
- neutral `Item`
- generic event log primitive
- generic breakdown list

## Composition Map For Web

| Web area | Current shape | Target composition | Ownership |
| --- | --- | --- | --- |
| History timeline sections | `TimelineList` custom listbox | app-local `HistoryTimelineNav` using `NavigationList` | app adapter after UI boundary support |
| History review runs | already `NavigationList` | keep domain mapping into `NavigationList.Item` slots | app |
| History insights | `SeverityBreakdown`, issue rows | `ScrollArea`, `SectionHeader`, app severity rows over `BlockBar`, `Button` | app |
| Provider list | search, toggles, selectable providers | `InputGroup`, `ToggleGroup`, `NavigationList` with boundary callback | app + UI primitive |
| Model picker dialog | custom radiogroup + standalone `Radio` | `RadioGroup` with manual activation/highlight | app + UI primitive |
| API key method selector | two custom radios + input | `Field`, `RadioGroup`, `Input`/`InputGroup` | app |
| Onboarding progress | `WizardProgress` | `HorizontalStepper` | app replacement |
| Onboarding choices | `RadioGroup` plus local highlight hook | prefer `RadioGroup` highlight APIs; retire `useOptionHighlight` if redundant | app + UI primitive |
| Review progress | `ProgressList` wrapping `Stepper` | keep adapter over `Stepper`; no public progress list | app |
| Review issue list | `NavigationList` + severity filter | keep `ToggleGroup` + `NavigationList` | app |
| Review evidence | local `DiffView`, `CodeSnippet` | public `DiffView`, `CodeBlock` | app replacement + possible UI adapter |
| Review metrics | `MetricItem` | `KeyValue` or plain markup | app replacement |
| Review lens stats | raw table | keep raw table until a real `Table`/`DataTable` primitive exists | app |
| Activity log | domain tags + auto-scroll | keep app-local | app |
| Settings storage/theme/execution | domain selectors | `Field`, `RadioGroup`, `ToggleGroup`, `Input` as needed | app |
| Home/trust panels | product trust/storage flows | existing primitives only; keep workflow local | app |

## History Three-Column Decision

There are two separate concerns.

Page panes: timeline, runs, insights. Keep this layout in `apps/web`. Do not extract `HistoryLayout` or `ThreeColumnHistoryLayout`.

Rows with multiple visual columns: use `NavigationList` compound slots for selectable rows. Do not create data-driven `HistoryRunList`.

Good:

```tsx
<NavigationList selectedId={selectedId} onSelect={setSelectedId}>
  <NavigationList.Item id={run.id}>
    <NavigationList.Title>{run.displayId}</NavigationList.Title>
    <NavigationList.Status>{run.timestamp}</NavigationList.Status>
    <NavigationList.Meta>
      <NavigationList.Badge>{run.branch}</NavigationList.Badge>
      <NavigationList.Subtitle>{run.provider}</NavigationList.Subtitle>
    </NavigationList.Meta>
  </NavigationList.Item>
</NavigationList>
```

Avoid:

```tsx
<HistoryRunList runs={runs} selectedRunId={id} onRunSelect={setId} />
```

If the UI needs real tabular behavior with headers, sorting, resizing, or comparison, add/use a `Table` or `DataTable` primitive. Do not stretch `NavigationList` into a table.

## Public API Rules

- New public function components should accept `ref` as a prop.
- Do not add `inputRef`, `buttonRef`, or deprecated alias props for new public APIs.
- Rename inconsistent pre-release props instead of adding aliases.
- Native input wrappers keep native `onChange(event)`.
- Value controls use `onChange(value)`.
- Non-value state uses semantic names: `open/onOpenChange`, `highlighted/onHighlightChange`, `selectedId/onSelect`, `onNavigate`, `onNavigationBoundaryReached`.
- Compound components must document valid composition trees.
- Library APIs must not expose product values such as `"save"`, `"revoke"`, `"provider"`, `"review"`, `"severity"`, `"run"`, `"trust"`, or route names.

## Handoff Blockers

These are not optional polish if the libraries are meant to be handed to other users:

- `field` is public but authored docs are missing at `libs/ui/docs/content/components/field.mdx`.
- Package-mode docs artifact sync is structurally blocked for UI unless the artifact packaging decision is resolved. The docs loader expects `dist/artifacts/artifact-manifest.json`, while `@diffgazer/ui` package files currently exclude `dist/artifacts`.
- `libs/keys` docs describe more hooks than copy-mode registry exposes. Docs must clearly say which APIs are package-only and which are installable through registry copy mode.
- Examples for public primitives should avoid Diffgazer-specific copy when the example is teaching a generic component.
- Hosted shadcn registry remains future work unless product direction changes; do not document hosted commands as supported until smoke-tested.

## Validation Commands

Use narrow commands while developing, then run broader gates.

Keys:

- `pnpm --filter @diffgazer/keys test`
- `pnpm --filter @diffgazer/keys type-check`
- `pnpm --filter @diffgazer/keys validate:registry`
- `pnpm --filter @diffgazer/keys verify:rsc`

UI:

- `pnpm --filter @diffgazer/ui test`
- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/ui validate:registry`

Web:

- `pnpm --filter @diffgazer/web test`
- `pnpm --filter @diffgazer/web type-check`
- `pnpm --filter @diffgazer/web build`

Artifacts and root:

- `pnpm run prepare:artifacts`
- `pnpm run validate:artifacts:check`
- `pnpm run verify:monorepo`
- `pnpm run verify`

Run `pnpm run prepare:artifacts` before artifact validation, docs sync, root type-check, root tests, or release checks when generated files are missing or stale.

## Definition Of Done

- No app-local duplicate remains where an existing UI primitive is sufficient.
- No new product abstractions are exposed from `libs/ui` or `libs/keys`.
- `apps/web` composes product UI from primitives and keeps domain adapters local.
- Keyboard behavior is predictable with Tab, Shift+Tab, Arrow keys, Home/End where applicable, Enter, Space, Escape, and typeahead/search handoff where applicable.
- Screen reader contracts are covered through roles, names, `aria-selected`, `aria-activedescendant`, `aria-controls`, `aria-expanded`, descriptions, errors, and live/status regions where relevant.
- Docs and examples are neutral enough for external consumers.
- Public registry files under `libs/ui/public/r` and `libs/keys/public/r` are regenerated and committed when registry contracts change.
- Deterministic generated data under docs generated directories and `cli/add/src/generated` is not committed.
