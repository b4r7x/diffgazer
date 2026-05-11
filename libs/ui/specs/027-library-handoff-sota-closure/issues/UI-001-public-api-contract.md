# UI-001: Public UI API Contract Drift

Priority: P0

## Problem

Several public UI APIs still violate repository public API rules.

Known gaps:

- `NavigationList`, `Menu`, `useListbox`, and `CommandPalette` expose `highlightedId/defaultHighlightedId` instead of `highlighted/defaultHighlighted`.
- `Callout` exposes `visible/defaultVisible/onVisibleChange` instead of `open/defaultOpen/onOpenChange`.
- Standalone `Checkbox` and `Radio` expose `checked/defaultChecked`, though they are custom value controls rather than native wrappers.
- `Input`, `Textarea`, and `InputGroup` expose `error`/`invalid` form-state props, overlapping `Field` ownership and introducing alias-like API before release.

Evidence:

- `libs/ui/registry/ui/navigation-list/navigation-list.tsx`
- `libs/ui/registry/ui/menu/menu.tsx`
- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts`
- `libs/ui/registry/ui/callout/callout.tsx`
- `libs/ui/registry/ui/checkbox/checkbox.tsx`
- `libs/ui/registry/ui/radio/radio.tsx`
- `libs/ui/registry/ui/input/input.tsx`
- `libs/ui/registry/ui/input/input-group.tsx`
- `libs/ui/registry/ui/textarea/textarea.tsx`

## Required Fix

- Rename public APIs before release. Do not add deprecated aliases.
- Update app consumers, tests, docs, examples, registry metadata, public registry JSON, generated docs data, and package declarations.
- Decide whether standalone `Checkbox` and `Radio` should:
  - adopt `value/defaultValue/onChange(value)`, or
  - be treated as native-like wrappers with a written exception in docs and AGENTS.md. Prefer the former unless implementation proves otherwise.
- Keep native `Input` and `Textarea` native event contracts.
- Move form-state docs and examples toward `Field`.

## Tests

Update tests to assert new public API behavior and remove stale names.

Add greps in final verification:

```bash
rg -n "highlightedId|defaultHighlightedId|visible|defaultVisible|onVisibleChange|checked=|defaultChecked=|onCheckedChange|onValueChange" libs/ui/registry apps/web/src
```

The grep may still find internal implementation variables only if they are not public props and are clearly scoped.
