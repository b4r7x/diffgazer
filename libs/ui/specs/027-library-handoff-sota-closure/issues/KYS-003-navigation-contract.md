# KYS-003: Navigation Primitive Contract Gaps

Priority: P0

## Problem

`@diffgazer/keys` navigation primitives are close but not library-grade for all UI consumers.

Known gaps:

- `useNavigation` handles Arrow/Home/End/Enter/Space from bubbling editable targets and can steal cursor/text editing keys.
- `onNavigationBoundaryReached` does not include the triggering event/key.
- `preventDefault()` can occur before the primitive knows whether movement hit a non-wrapping boundary.
- role-only items without `data-value` can be returned even though navigation later requires a value.
- `NavigationItemType` supports `menuitemradio` but not `menuitemcheckbox`.
- `skipDisabled` defaults may conflict with APG expectations for menus/tabs/options where disabled items can remain discoverable.
- `Enter`/`Space` can be treated as handled with no `onEnter`/`onSelect`, causing no-op prevention.

Evidence:

- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/utils/navigation-items.ts`
- `libs/keys/src/utils/navigation-directions.ts`
- `libs/ui/registry/hooks/use-navigation.ts`
- `libs/ui/registry/hooks/use-listbox.ts`

## Required Fix

- Add editable-target guards using a shared utility such as `isInputElement`/`isEditableElement`.
- Include the `KeyboardEvent` in boundary callbacks, while preserving public naming rules.
- Only prevent default when the primitive actually handles the key, or document and test the boundary behavior if prevention is intentional.
- Ensure discoverable navigation items have valid values or derive a stable safe value.
- Add `menuitemcheckbox` support if menu primitives need it.
- Make disabled behavior configurable by role and documented.

## Tests

Add tests for:

- input, textarea, and contenteditable inside navigation containers keep native Home/End/Arrow behavior;
- boundary callback receives the event and key;
- no-op Enter/Space does not prevent default without a consumer handler;
- role-only items without values cannot trap navigation;
- menuitemcheckbox discovery;
- disabled item behavior by role.
