# Contract: Layout Centering

## Screen Classification

Each screen is classified as `centered` or `full-width`:

| Screen | Type | Max Width (cols) | Centering |
|--------|------|-----------------|-----------|
| Home | centered | 90 | Horizontal + vertical center |
| Settings Hub | centered | 70 | Horizontal + vertical center |
| Settings/* (single-panel) | centered | 60 | Horizontal center |
| Review Summary | centered | 80 | Horizontal center |
| Help | centered | 80 | Horizontal center |
| Onboarding | centered | 70 | Horizontal center |
| Review Results | full-width | terminal width | 2-pane split (40/60) |
| Review Progress | full-width | terminal width | 2-pane split (40/60 or 50/50 on wide) |
| History | full-width | terminal width | 2-pane split (35-40/60-65) |
| Providers | full-width | terminal width | 2-pane split (25-30/70-75) |

## CLI Centering Pattern

```tsx
// Centered screen
<Box justifyContent="center" alignItems="center" flexGrow={1}>
  <Box width={Math.min(columns, MAX_WIDTH)}>
    {content}
  </Box>
</Box>

// Full-width screen
<Box flexGrow={1} flexDirection={isNarrow ? "column" : "row"}>
  <Box width={isNarrow ? undefined : calculatedWidth}>{leftPane}</Box>
  <Box flexGrow={1}>{rightPane}</Box>
</Box>
```

## Web Equivalent

```tsx
// Centered screen
<div className="flex-1 flex flex-col items-center justify-center">
  <div className="w-full max-w-3xl">{content}</div>
</div>

// Full-width screen
<div className="flex flex-1 overflow-hidden">
  <div className="w-2/5">{leftPane}</div>
  <div className="w-3/5">{rightPane}</div>
</div>
```

## Narrow Terminal Behavior

When terminal < 40 columns: show "Terminal too small" message centered in the viewport.
When terminal is narrow tier (< 80 cols): all two-pane layouts collapse to single column.
