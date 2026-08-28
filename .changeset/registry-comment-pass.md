---
"@diffgazer/ui": patch
---

Shipped registry source no longer carries comments that narrate how the code changed.
Five copy-mode payloads — `switch`, `field`, `command-palette`, `selectable-glyph` and
`selectable-variants` — pick up comments that state what the code guarantees instead of
what it used to do. Rendered output, props and class names are unchanged.
