---
"@diffgazer/ui": minor
---

Rename the decorated text input wrapper from `InputField` to `InputGroup`, and
add a separate `Field` primitive for label/control/description/error wiring.

Command palette highlight state now uses `highlighted`/`onHighlightChange` only,
following the `@diffgazer/keys` rename to the semantic navigation callback API.
