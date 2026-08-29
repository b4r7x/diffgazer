---
"@diffgazer/ui": minor
---

ScrollArea gains an `overlay` prop (vertical orientation only — other orientations keep their native bar): the native scrollbar is hidden under the theme's hover-capable guard and a draggable floating thumb renders above the content, so list rows can run border-to-border instead of stopping at a reserved track. The thumb follows the same `--scrollbar-thumb` / `--scrollbar-thumb-active` tokens as the thin scrollbar, hides when content fits, and touch devices keep their native indicator. `scrollAreaVariants` gains a `scrollbar` dimension (`thin` default, `overlay`) carrying the suppression and the gutter reservation.
