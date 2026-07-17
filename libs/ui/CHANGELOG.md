# @diffgazer/ui

## 0.2.0

### Minor Changes

- 8729a01: Extract the floating-surface primitive shared by `Popover`, `Select`, and other
  anchored UI as the new public `FloatingPanel`. `Popover` and `Select` now
  compose `FloatingPanel` internally and their public registry trees collapse to
  the same transitive dependency set.

  Additions:
  - New public primitive `FloatingPanel` exported from
    `@diffgazer/ui/components/floating-panel` with `useFloatingPanelContext()` for descendants
    that need positioning state (`positioned`, `side`, `align`). The same subpath exports the
    `FloatingPanelProps` and `FloatingPanelContextValue` types.

    ```tsx
    import {
      FloatingPanel,
      useFloatingPanelContext,
      type FloatingPanelContextValue,
      type FloatingPanelProps,
    } from "@diffgazer/ui/components/floating-panel"
    ```
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

- 6416350: Raise `@diffgazer/ui`'s `@diffgazer/keys` peer floor to `>=0.2.0` so package
  consumers receive the navigation API used by the current UI primitives.
- 6416350: Rename the decorated text input wrapper from `InputField` to `InputGroup`, and
  add a separate `Field` primitive for label/control/description/error wiring.

  Command palette highlight state now uses `highlighted`/`onHighlightChange` only,
  following the `@diffgazer/keys` rename to the semantic navigation callback API.

- 6416350: Normalize public form-like controls on `value`/`defaultValue`/`onChange(value)`
  instead of `onValueChange`. Native wrappers such as `Input` and `Textarea` keep
  React's native `onChange(event)` contract.

### Patch Changes

- 6416350: Stop tracking deterministic generated docs data and CLI source bundles. Root
  verification and docs preparation now regenerate library artifacts before
  validation/build so local development and deploys do not depend on committed
  generated JSON snapshots.
- 6416350: Document publish-gated install flows, local package validation, shadcn namespace
  setup, keyboard integration contracts, release-readiness governance, and runtime
  package surface validation for public handoff.
