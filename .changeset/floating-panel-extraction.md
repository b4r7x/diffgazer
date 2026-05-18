---
"@diffgazer/ui": minor
---

Extract the floating-surface primitive shared by `Popover`, `Select`, and other
anchored UI as the new public `FloatingPanel`. `Popover` and `Select` now
compose `FloatingPanel` internally and their public registry trees collapse to
the same transitive dependency set.

Additions:

- New public primitive `FloatingPanel` exported from `@diffgazer/ui` with
  `useFloatingPanelContext()` for descendants that need positioning state
  (`positioned`, `side`, `align`). Includes `FloatingPanelProps` and
  `FloatingPanelContextValue` types.
- New public CSS variables on the `.ui-floating-panel` cascade:
  `--ui-floating-z`, `--ui-content-enter-from-{top|bottom|left|right}`,
  `--ui-content-exit-to-{top|bottom|left|right}`,
  `--ui-content-enter-duration`, `--ui-content-exit-duration`,
  `--ui-content-transform-origin` (auto-set, readable from transform-based
  keyframe overrides), and `--ui-floating-trigger-width` (set when
  `matchTriggerWidth` is true).

Removals:

- `PopoverContent.externalOnAnimationEnd` — was a leaked internal prop. Native
  `onAnimationEnd` continues to flow through via spread props.
- `.animate-slide-in` / `.animate-slide-out` className-driven animation on
  `PopoverContent` and `SelectContent`. The `.ui-floating-panel` cascade
  replaces them and is overridable per side without className escalation.

Changes:

- `Select` `sideOffset` default changes from `0` to `4` so the menu reads as a
  distinct surface anchored to the trigger.
- Reduced-motion behavior is now token-driven: under
  `prefers-reduced-motion: reduce`, all eight `--ui-content-{enter-from,exit-to}-*`
  tokens collapse to the fade-only keyframes. Per-instance overrides win.
