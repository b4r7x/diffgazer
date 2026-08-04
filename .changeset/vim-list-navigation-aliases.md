---
"@diffgazer/ui": minor
"@diffgazer/keys": minor
---

Vim j/k aliases for list navigation, and a default Dialog close control.

`Menu` and `NavigationList` (through `useListbox`) and `RadioGroup` now accept
`k` wherever they accept `ArrowUp` and `j` wherever they accept `ArrowDown`.
Roving focus, `aria-activedescendant`, disabled skipping, and boundary callbacks
are unchanged; only the accepted key set grew.

`isListNavigationKey` from `@diffgazer/keys` returns `true` for `"j"` and `"k"`,
and `getVerticalArrowDirection` maps `k` to `"up"` and `j` to `"down"`.
Uppercase `J`/`K` are unaffected. If you call `isListNavigationKey` to ask
whether a key belongs to a list, nothing changes. If you call it as a
suppression guard — `if (isListNavigationKey(event.key)) event.preventDefault()`
while a list is inactive, which the Diffgazer history timeline does in three
places — it now swallows those two characters too, so re-check guards of that
shape against any text entry they sit near.

Typeahead reserves j/k rather than consuming them. `useTypeaheadBuffer` takes an
`extendOnly` option and `useListbox({ typeahead: true })` passes it for `j`/`k`:
on an empty query buffer they move the highlight, and while a query is in
progress they extend it instead of navigating. They never start a query. This is
the rule `Space` already followed.

Modal `DialogContent` now renders `dialog-close-icon.tsx` by default, last in the
DOM so the `[x]` stays the final tab stop. Pass `closeIcon={false}` to opt out;
inline dialogs still compose `Dialog.CloseIcon` explicitly. `dialog.css` drops
the CSS-only `body:has(dialog[open])` scroll lock, leaving the reference-counted
`useScrollLock` inside `DialogContent` as the single owner — the two locks
compensated for the same scrollbar twice and the page jumped on every open — and
the modal entrance duration is now a literal `150ms` instead of the anchored
tier's `--ui-content-enter-duration`.
