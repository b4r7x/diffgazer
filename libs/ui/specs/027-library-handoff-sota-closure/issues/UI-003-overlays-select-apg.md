# UI-003: Overlays, Dialog, Select, And APG Behavior

Priority: P0

## Problem

Overlay and Select behavior has APG and portal containment blockers.

Known gaps:

- `Select.Content` always portals to `document.body`, ignoring dialog portal container.
- A select inside native `DialogShell` can render operable content outside the modal dialog DOM.
- `Dialog.Content` allows unlabeled modal dialogs.
- Searchable `Select` splits combobox behavior across trigger and search input in a way that conflicts with claimed combobox semantics.
- `Popover` advertises `aria-haspopup="menu"` when content is a menu, but opening does not move focus to the menu or first item.
- `dialog.css` is copied in registry output but not wired through import/target/css metadata for direct shadcn install.

Evidence:

- `libs/ui/registry/ui/select/select-content.tsx`
- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/select/select-search.tsx`
- `libs/ui/registry/ui/dialog/dialog-content.tsx`
- `libs/ui/registry/ui/shared/portal.tsx`
- `libs/ui/registry/ui/shared/dialog-shell.tsx`
- `libs/ui/registry/ui/popover/popover-trigger.tsx`
- `libs/ui/registry/ui/popover/popover-content.tsx`
- `libs/ui/registry/registry.json`
- `libs/ui/registry/ui/shared/dialog.css`

## Required Fix

- Ensure nested portals use the modal/dialog portal container where required.
- Require or enforce an accessible name for modal dialogs.
- Re-evaluate searchable Select semantics:
  - either make it an APG-compatible editable combobox;
  - or document it as a search-in-popup pattern with correct roles and focus behavior.
- Make menu popover focus behavior match the advertised role.
- Wire `dialog.css` for registry/copy/shadcn/package modes consistently.

## Tests

Add tests for:

- select content inside dialog stays inside the dialog/portal container;
- unlabeled dialog fails test or emits no supported public path;
- dialog with `Dialog.Title`, `aria-label`, or `aria-labelledby` is valid;
- searchable select active option is announced on the correct focused element;
- menu popover moves focus appropriately;
- direct registry item includes or imports required CSS.
