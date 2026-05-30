# libs/ui Components — Audit Findings (2026-05-28)

## Summary

| Severity | Count | Statuses |
| --- | --- | --- |
| Critical | 0 | — |
| High | 2 | NEW: 2 |
| Medium | 4 | NEW: 4 |
| Low | 5 | NEW: 5 |
| **Total** | **11** | **NEW: 11** |

---

## High

### [NEW] [error-handling] F8 — Missing dependency array in useLayoutEffect causes effect to run on every render

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/hooks/use-form-reset.ts:23-43`
- **What:** The `useLayoutEffect` hook on line 23 lacks a dependency array, causing it to run on every render instead of only when dependencies change.
- **Why:** error-handling
- **How (fix approach):** Add a dependency array: `}, [ref, enabled, handleReset]);` after the closing brace on line 43. This ensures the effect only runs when the ref, enabled flag, or handler changes. Verify the second `useLayoutEffect` (line 45-52) correctly runs only once on unmount (its empty array is correct).
- **Effort:** low

### [NEW] [error-handling] F113 — CheckboxGroup required validation broken: readOnly input never fires onInvalid

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/checkbox/checkbox-group.tsx:219-227`
- **What:** CheckboxGroup renders hidden `readOnly=true` checkbox expecting `onInvalid` to fire (line 221). HTML spec: readOnly inputs never fire `onInvalid` because users cannot change them.
- **Why:** error-handling
- **How (fix approach):** Remove `readOnly=true` to enable native validation, or replace with custom validation in form submit handler. This is not a cleanup issue; it is a broken validation pattern.
- **Effort:** high

---

## Medium

### [NEW] [type-safety] F9 — Type cast complexity in Select component's state option narrowing

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/select/select.tsx:99-145`
- **What:** The Select component uses multiple sequential `as` casts (lines 105, 107, 108, 128, 130, 131) to narrow generics from the public API to internal string-based state. While type-safe, the dual-casting pattern is verbose and unclear.
- **Why:** type-safety
- **How (fix approach):** Extract a helper type that explicitly narrows `TValue[]` to `string[]`: `type NarrowedSelectProps<T extends string, M extends boolean> = M extends true ? { value: T[] } : { value: T };` Then use conditional logic on the generic rather than post-hoc casting. Alternatively, create a type-safe state options builder function that handles the casting internally.
- **Effort:** medium

### [NEW] [error-handling] F221 — Select component uses onChange() callback for native hidden select elements without readonly handling

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/select/select.tsx:204-217`
- **What:** The native hidden `<select>` element has `onChange={() => {}}` (no-op), but `onChange` is a required prop on `HTMLSelectElement` and should either have a proper handler or be suppressed entirely.
- **Why:** error-handling
- **How (fix approach):** Either remove the `onChange` prop entirely (letting React handle unmatched props), or add a terse comment explaining why the handler is intentionally a no-op. Better: use a `ts-expect-error` comment if the no-op is intentional.
- **Effort:** low

### [NEW] [dry] F222 — Menu-item component has duplicated icon-slot styling between MenuItemIndicator and MenuItemIconSlot

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/menu/menu-item.tsx:12-60`
- **What:** Both `MenuItemIndicator` (lines 12-24) and `MenuItemIconSlot` (lines 26-60) render nearly identical wrapper spans with the same base classes: `'pr-4 shrink-0 inline-flex w-5 items-center justify-center self-center leading-none relative -top-[2px]'`
- **Why:** dry
- **How (fix approach):** Extract the shared base classes to a named constant (e.g., `MENU_ITEM_ICON_SLOT_CLASSES`), or refactor `MenuItemIconSlot` to always use `MenuItemIndicator` for the container and conditionally render the icon/indicator child inside it.
- **Effort:** low

### [NEW] [naming] F224 — Dialog and Tabs export roots with inconsistent naming conventions

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/dialog/dialog.tsx:14`
- **What:** Dialog is exported as a function component name `Dialog`, but Tabs uses the pattern `export { TabsRoot as Tabs }`. This inconsistency means some compound components are named `Root` internally while others use the public name directly, creating cognitive load.
- **Why:** naming
- **How (fix approach):** Adopt a consistent pattern across all compound components: define the implementation as `Root` (e.g., `DialogRoot`), then `export { DialogRoot as Dialog }` at the end. Update all existing files (Dialog, Tabs, Accordion, etc.) to use this uniform pattern.
- **Effort:** medium

---

## Low

### [NEW] [big-file-split] F10 — Stepper variants file exceeds SRP threshold and could benefit from splitting

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/stepper-variants.ts:1-325`
- **What:** The `stepper-variants.ts` file is 325 lines, containing multiple CVA variant definitions (`stepperRootVariants`, `stepperStepVariants`, `stepperIndicatorVariants`, `stepperStatusIndicatorVariants`) plus their referenced types.
- **Why:** big-file-split
- **How (fix approach):** Consider extracting the compound variants logic into a separate constants file or organizing the variant definitions with section comments. Alternatively, define variants closer to their component consumers if not shared. This is a low-priority refactor since all variants are variant-related and the cohesion is clear.
- **Effort:** low

### [NEW] [dry] F111 — usePresence mirrors open prop into prevOpen state

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/hooks/use-presence.ts:34-54`
- **What:** `usePresence` stores `prevOpen` state (line 34) which mirrors the `open` prop to derive phase transitions. This violates DRY by storing a copy of an input value.
- **Why:** dry
- **How (fix approach):** Replace `useState(open)` with `useRef(open)`. Update the ref during render without storing state.
- **Effort:** medium

### [NEW] [anti-slop] F223 — StepperVariants defines empty variant values for 'status' in selectableIndicatorVariants

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/selectable-variants.ts:44-51`
- **What:** The `selectableIndicatorVariants` CVA has `variants.checked` and `variants.highlighted` with all empty string values (`true: ''`, `false: ''`), which serve no purpose and dilute the CVA's intent.
- **Why:** anti-slop
- **How (fix approach):** Remove the `checked` and `highlighted` variant definitions that contain only empty strings. Rely solely on the single `compoundVariant` at line 54 for `'checked: true, highlighted: false'`.
- **Effort:** low

### [NEW] [type-safety] F225 — Button component casts props to ButtonRenderPropProps without type narrowing

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/button/button.tsx:158`
- **What:** Line 158 casts `(props as ButtonRenderPropProps).ref` to extract the ref, but the type check is only on `typeof children === 'function'`. No type guard ensures `props` is actually `ButtonRenderPropProps` at that point.
- **Why:** type-safety
- **How (fix approach):** Introduce a helper function `isRenderPropProps` that checks the children function and returns a type predicate. Or reorganize the three cases into branches with proper type narrowing so casts are unnecessary.
- **Effort:** low

### [NEW] [reusability] F226 — Input component does not export inputSizeClasses constant, preventing external variant reuse

- **file:line:** `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/input/input.tsx:1-22`
- **What:** The `inputVariants` are exported, but `inputSizeClasses` (defined in `input-variants.ts`) is not re-exported from the Input module itself. Consumers must import `input-variants` directly to access size classes.
- **Why:** reusability
- **How (fix approach):** Add to `libs/ui/registry/ui/input/index.ts`: `export { inputSizeClasses } from '@/lib/input-variants'`. Update the typedoc/registry to reference the re-export.
- **Effort:** low
