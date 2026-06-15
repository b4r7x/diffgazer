---
"@diffgazer/ui": minor
"@diffgazer/keys": minor
---

Audit pass across the component and keyboard libraries. `@diffgazer/keys` adds the `moveHighlight` list-navigation helper (with `HighlightNavigationItem` / `MoveHighlightResult` types) to its public entry and ships correctness/accessibility fixes across its hooks and utilities, preserving the existing `KeyboardProvider`, hooks, navigation/focus utilities, and types. `@diffgazer/ui` ships correctness, accessibility, and convention fixes across the component, hook, and lib surfaces and refreshes the base theme tokens. The two packages are linked and version together.

Reconstructed retroactively from the post-0.2.0 history; these changes predate the changeset-based flow.
