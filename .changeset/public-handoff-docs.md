---
"@diffgazer/add": patch
"@diffgazer/ui": minor
"@diffgazer/keys": minor
"diffgazer": patch
---

Document publish-gated install flows, local package validation, shadcn namespace setup, keyboard integration contracts, release-readiness governance, and runtime package surface validation for public handoff.

Remove pre-release keyboard alias props from `@diffgazer/keys` and `@diffgazer/ui` before public handoff:
`targetRef` -> `containerRef`, `requireFocusWithin` -> `focusWithinOnly`,
`onBoundaryReached` -> `onNavigationBoundaryReached`, and the old focus-zone helpers
`ZoneProps`/`inZone`/`forZone`/`zoneProps` -> the current `getZoneProps` API.
Command palette highlight state now uses `highlightedId`/`onHighlightChange` only.

Raise `@diffgazer/ui`'s `@diffgazer/keys` peer floor to `>=0.1.1` so package consumers receive the navigation API used by the current UI primitives.

Normalize public `@diffgazer/ui` form-like controls on `value`/`defaultValue`/`onChange(value)` instead of `onValueChange`. Native wrappers such as `Input` and `Textarea` keep React's native `onChange(event)` contract.

Rename the decorated text input wrapper from `InputField` to `InputGroup`, and add a separate `Field` primitive for label/control/description/error wiring.

Stop tracking deterministic generated docs data and CLI source bundles. Root verification and docs preparation now regenerate library artifacts before validation/build so local development and deploys do not depend on committed generated JSON snapshots.
