---
"@diffgazer/keys": minor
---

Remove pre-release keyboard alias props before public handoff:
`targetRef` -> `containerRef`, `requireFocusWithin` -> `focusWithinOnly`,
`onBoundaryReached` -> `onNavigationBoundaryReached`, and the old focus-zone
helpers `ZoneProps`/`inZone`/`forZone`/`zoneProps` -> the current `getZoneProps` API.
