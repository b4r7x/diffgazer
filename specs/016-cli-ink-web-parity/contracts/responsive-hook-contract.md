# Contract: Responsive Dimensions Hook

## Interface

Both CLI and web expose a responsive hook returning the same shape:

```typescript
interface ResponsiveDimensions {
  columns: number;    // Raw dimension (chars for CLI, px for web)
  rows: number;       // Raw dimension (chars for CLI, px for web)
  tier: BreakpointTier;  // "narrow" | "medium" | "wide"
  isNarrow: boolean;
  isMedium: boolean;
  isWide: boolean;
}
```

## CLI Implementation

- Source: `stdout.columns` / `stdout.rows` from Ink's `useStdout()`
- Reactivity: `useState` + `stdout.on('resize', handler)` (NOT one-time read)
- Breakpoint: `getBreakpointTier(columns)` from `@diffgazer/core`

## Web Implementation

- Source: `window.innerWidth` via `matchMedia` + `useSyncExternalStore`
- Reactivity: Built-in via `matchMedia` listener
- Breakpoint: `getBreakpointTierFromPx(px)` from `@diffgazer/core`

## Shared Contract

- `BreakpointTier` type from `@diffgazer/core`
- Thresholds: narrow < 80 cols, medium 80-119, wide 120+
- Both hooks produce identical `ResponsiveDimensions` shape
- Components consuming the hook can be written platform-agnostically for layout logic (only rendering differs)
