# Agent 02: UI APG Primitives

Ownership:

- `libs/ui/registry/ui/navigation-list/**`
- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/ui/radio/**`
- `libs/ui/registry/ui/tabs/**`
- `libs/ui/registry/ui/dialog/**`
- `libs/ui/registry/ui/command-palette/**` only when centralizing focus restore
- `libs/ui/registry/ui/select/**`
- `libs/ui/registry/ui/field/**`
- `libs/ui/registry/ui/code-block/**`
- tests adjacent to those primitives
- handoff notes for docs/registry to Agent 05

Do not edit app feature workflows unless required to prove the primitive API. Coordinate with Agents 03 and 04 for adoption.

## Goal

Make UI primitives strong enough that app code composes product UI from them instead of reimplementing listbox, radiogroup, tabs, dialog, combobox, and form semantics.

## Tasks

1. `NavigationList`
   - Add public `onNavigationBoundaryReached?: (direction: "previous" | "next") => void`.
   - Add `onEnter?: (id: string, event: KeyboardEvent) => void` so apps do not wrap listbox Enter handling.
   - Add optional `autoFocus` if app lists need focus on zone entry.
   - Thread it through `useListbox` and navigation handling.
   - Test first/last item boundary with `wrap={false}`.
   - Keep selectable row layout slot-based: `Item`, `Title`, `Status`, `Meta`, `Badge`, `Subtitle`.
   - Do not create `HistoryRunList`, `TimelineList`, or data-driven product props.

2. `useListbox`
   - Accept and forward boundary callback.
   - Preserve `selectedId/defaultSelectedId/onSelect` and `highlightedId/defaultHighlightedId/onHighlightChange`.
   - Keep valid `aria-activedescendant` only when the target item exists and is enabled.
   - Prefer encoded item IDs over raw data IDs.

3. `RadioGroup`
   - Verify and fix one-tab-stop composite behavior.
   - Manual activation must move highlight/focus without changing `value` until Space/Enter or explicit commit behavior.
   - `onHighlightChange`, `onNavigate`, `onEnter`, and `onNavigationBoundaryReached` must be reliable.
   - Remove the pre-release `labelledBy` alias and standardize on native `aria-labelledby`.
   - Test with app-like model picker and API key method selector shapes.
   - Do not expose app terms such as provider, model, api key, save, revoke.

4. `Tabs`
   - Manual tabs must activate with Enter/Space.
   - Ensure focus vs selected state remains clear.
   - Add behavior tests for automatic and manual modes.

5. `Dialog` and focus restore
   - Restore focus predictably when opened without `DialogTrigger`.
   - Centralize previous-focus capture between Dialog and CommandPalette if possible.
   - Preserve modal trap and Escape behavior.
   - Test app-controlled dialog open/close.

6. `Select` / future `Combobox`
   - Searchable mode must keep active-option announcement correct.
   - Fix `aria-activedescendant` target ownership for search input/listbox state.
   - If this is too large, write a clear follow-up blocker instead of making a partial inaccessible combobox.

7. `Field`
   - Ensure `Field` remains the owner of label/control id, required, disabled, invalid, description, error, and ARIA relationships.
   - Do not push form wiring into `InputGroup`.
   - Add docs/tests for `Field.Control` with `InputGroup`, including propagation to the internal input.
   - Document decorative prefix/suffix as `aria-hidden`; interactive suffixes need explicit labels.
   - Coordinate with Agent 05 to add missing docs page.

8. `Stepper` / `HorizontalStepper`
   - Rename `HorizontalStepper step` to `value` before release.
   - Consider renaming `Stepper.Step stepId` to `value` if it can be done cleanly before release.
   - Keep `expandedIds/defaultExpandedIds/onExpandedChange(ids)`.
   - Preserve ordered-list semantics, `aria-current="step"`, button expansion state, and hidden/inert collapsed panels.

9. `BlockBar`
   - Add `valueText` or `formatValueText(value, max)` for app-owned labels.
   - Add label/value class slots only if web cannot replace local severity markup without them.
   - Do not add severity variants to `libs/ui`.

10. `KeyValue`
   - Add `labelClassName`, `valueClassName`, or `valueProps` only if needed for web replacement.
   - Keep semantic `<dl>/<dt>/<dd>`.
   - Do not make it clickable.

11. `CodeBlock` / `DiffView`
   - Ensure existing primitives can replace app-local `CodeSnippet` and `DiffView`.
   - Consider `CodeBlock.Content startLineNumber`, `showLineNumbers`, `wrap`, or `maxHeight` if app replacement would otherwise recreate those primitives.
   - Add a tiny generic `CodeBlock` lines adapter only if app replacement would otherwise duplicate boilerplate in multiple places.
   - Do not add review-specific evidence props.

## Tests

Add focused behavior/a11y tests for:

- `NavigationList` boundary callbacks and disabled item skipping
- `RadioGroup` one-tab-stop, manual activation, boundary, Enter/Space
- `Tabs` manual Enter/Space activation
- `Dialog` focus restore without trigger
- searchable `Select` active option announcement/idrefs
- `Field` idref relationships and invalid/error ownership
- `HorizontalStepper value` and current-step semantics
- `BlockBar valueText` if added
- `KeyValue` class/value slots if added
- `CodeBlock` adapter if added

## Validation

- `pnpm --filter @diffgazer/ui test -- navigation-list radio tabs dialog select field code-block`
- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/ui validate:registry`
