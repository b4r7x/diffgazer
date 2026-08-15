---
"@diffgazer/ui": minor
"@diffgazer/keys": minor
"@diffgazer/add": minor
"diffgazer": patch
---

UI improvements pass across the published surfaces, with the audit fixes that came with it.

`@diffgazer/keys` now describes its copy targets as `@hooks/...` alias tokens instead of hardcoded
`src/` paths, matching the `@ui/...` form `@diffgazer/ui` already used, so a copied file lands under
the consumer's own configured source root. Its `navigation` item also copies the `hotkey` helper it
depends on. `@diffgazer/ui` moves the shared `stepper.css` out of the `stepper` and
`horizontal-stepper` file lists into the `stepper-variants` item both already depend on, so
installing either surface brings the stylesheet exactly once, and `toast` picks up a `focus-restore`
dependency on `@diffgazer/keys`. Both libraries ship correctness, accessibility, and focus fixes
across their components, hooks, and utilities.

`@diffgazer/add` resolves those alias targets by reading the consumer's Vite and tsconfig alias
configuration, and reworks `remove` so cascade removal and CSS chunk cleanup follow the dependency
edges recorded at install time rather than the live registry.

`diffgazer` restyles the TUI panes, menus, and filters, fixes keyboard navigation and focus escaping
in the onboarding and provider flows, and corrects the review and context colors.

`@diffgazer/ui` public API:

Removals:

- `HorizontalStepperProps.steps` — the run is now derived from the rendered `HorizontalStepper.Step`
  children, which register themselves in document order. Drop the prop; the steps you render are the
  run.
- `CommandPaletteItemMetadata` — folded into `CommandPaletteItemRegistration`, which carries the same
  fields directly.

Changes:

- `ToggleGroupProps` and `CheckboxGroupProps` are no longer generic. For a value-typed toggle group,
  build one with `createToggleGroup(values)`; `CheckboxGroup` values are `string[]`.
- `DialogContentProps` is a discriminated union on `modal`: a modal dialog takes `modal?: true` with
  `role`, `closeIcon`, `closeOnBackdropClick`, `initialFocus`, `onCancel`, and `onEscapeKeyDown`, and
  an inline dialog takes `modal: false` and accepts none of them.
- `DiffViewProps.statusBar` is accepted only with `variant="statusbar"`; on every other variant it is
  now typed `never` instead of being silently ignored.
