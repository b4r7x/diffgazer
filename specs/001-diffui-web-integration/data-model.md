# Data Model: Diff-UI Web Integration

**Branch**: `001-diffui-web-integration` | **Date**: 2026-03-24

This feature does not introduce new data entities. It restructures how existing UI components are sourced. The key "data" artifacts are mappings and configuration.

## Entity: Component Re-Export Mapping

Describes the relationship between @diffgazer/ui exports and their diff-ui sources.

| Attribute | Description |
| --------- | ----------- |
| exportName | The public export name from @diffgazer/ui (e.g., `Button`) |
| category | `DIRECT_MATCH`, `ADAPTABLE`, or `LOCAL_ONLY` |
| diffuiSource | Import path in diff-ui (e.g., `diffui/components/button`) or null |
| needsWrapper | Whether a thin adapter wrapper is required for API compatibility |
| wrapperReason | Description of API difference if wrapper needed |

### Category Rules

- **DIRECT_MATCH**: Re-export directly. `export { Button } from 'diffui/components/button'`
- **ADAPTABLE**: Re-export with thin wrapper mapping compound sub-components to named exports (e.g., `Checkbox.Group` → `CheckboxGroup`)
- **LOCAL_ONLY**: Keep existing implementation in @diffgazer/ui source

## Entity: Token Override Layer

The CSS override structure that maps diff-ui base tokens to diffgazer values.

| Attribute | Description |
| --------- | ----------- |
| tokenName | CSS custom property name (e.g., `--tui-bg`) |
| diffuiValue | Value in diff-ui's theme (e.g., `#0a0a0a`) |
| diffgazerValue | Override value for diffgazer (e.g., `#0d1117`) |
| mode | `dark`, `light`, or `both` |
| source | `override` (diffgazer redefines) or `preserve` (diffgazer-only token) |

### Override Structure

```
:root, [data-theme="dark"] {
  /* Primitive overrides (7 tokens) */
  /* Semantic overrides (3 tokens) */
  /* Domain-specific tokens preserved (8 tokens) */
}

[data-theme="light"] {
  /* Light mode overrides */
  /* Light mode domain tokens */
}
```

## Entity: CSS Loading Order

| Position | File | Purpose |
| -------- | ---- | ------- |
| 1 | `tailwindcss` | Base framework |
| 2 | `diffui/theme.css` | diff-ui base tokens, animations, utilities |
| 3 | `@diffgazer/ui/theme-overrides.css` | Color overrides + domain tokens |
| 4 | `@diffgazer/ui/sources.css` | Tailwind @source directives |
