---
"@diffgazer/add": patch
"@diffgazer/ui": minor
"@diffgazer/keys": minor
"diffgazer": patch
---

Harden the public packages before release. `dgadd` now validates Tailwind v4 and
source aliases before writing files, keeps integration-mode migrations
transactional, and restores package and manifest state after failures.

The UI library fixes form, focus, keyboard, SSR, and accessibility behavior. It
also normalizes an empty single Accordion value to `undefined` and removes the
unused `MenuItemRadio` `value` prop. The keys library fixes focus restoration
and traps across owner documents and shadow roots, and prevents action-row focus
repair from stealing focus.

The `diffgazer` CLI improves startup and shutdown handling, development port
propagation, terminal input routing, TUI navigation, and bundled license
notices.
