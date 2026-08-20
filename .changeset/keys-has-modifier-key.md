---
"@diffgazer/keys": minor
---

Adds `hasModifierKey(event)` to the public entry.

Returns `true` when any of `altKey`, `ctrlKey`, `metaKey`, or `shiftKey` is
held — the "this key is unmodified, so the widget owns it" guard that list and
scroll handlers write inline. It takes anything with the four flags, so React
synthetic and native keyboard events both pass.

It is not the right guard for letter hotkeys: printable keys already encode
Shift in `event.key`, so `?` and `R` must be matched by key, not by rejecting
`shiftKey`. `useNavigation` uses it internally for the same rule it already
applied; behavior is unchanged.
