# Workflow: Mirror Screen from Web to CLI

## Goal
Refactor a CLI screen to use responsive layout and match its web counterpart visually.

## Pre-requisites (already implemented)
- `packages/hooks/` - shared hooks (`useFiglet`, `useRouteState`)
- `apps/cli/src/hooks/use-terminal-dimensions.ts` - responsive hook with breakpoints
- `apps/cli/src/components/layout/global-layout.tsx` - wrapper with header/content/footer
- `apps/cli/src/components/ui/header-brand.tsx` - responsive header (Big/Small/Compact/Mini)

## Breakpoints (from useTerminalDimensions)
```typescript
columns >= 100  → large (full features)
columns 70-99   → medium (reduced features)
columns 40-69   → small (compact)
columns < 40    → tiny (minimal)
```

---

## Phase 1: Research (parallel agents, model=haiku)

### Agent 1: Web screen analysis
```
subagent_type: feature-dev:code-explorer

Analyze web screen at apps/web/src/app/pages/[SCREEN_NAME].tsx

Focus on:
1. Layout structure (flex direction, alignment, spacing)
2. Panel sizes and proportions
3. Responsive breakpoints used
4. Footer shortcuts for this screen
5. Key components and their arrangement

Return: file:line + description for each finding
```

### Agent 2: CLI current state
```
subagent_type: feature-dev:code-explorer

Analyze CLI screen at apps/cli/src/app/views/[SCREEN_NAME]-view.tsx

Focus on:
1. Current layout structure
2. Does it use GlobalLayout? If not, needs migration
3. Does it use useTerminalDimensions?
4. What shortcuts does it define?
5. How does content adapt to terminal size?

Return: file:line + description + list of changes needed
```

---

## Phase 2: Planning
```
subagent_type: feature-dev:code-architect

Based on research from Phase 1, create implementation plan:

1. List exact changes to make CLI screen match web layout
2. Define shortcuts for footer (export as SCREEN_FOOTER_SHORTCUTS)
3. Plan responsive behavior for each breakpoint
4. Identify components to reuse vs create

Return: Step-by-step implementation plan
```

---

## Phase 3: Implementation
```
subagent_type: react-component-architect

Implement changes:

1. If not using GlobalLayout - migrate:
   - Remove local header/footer
   - Export SCREEN_FOOTER_SHORTCUTS array
   - Update app.tsx to pass shortcuts to GlobalLayout

2. Add useTerminalDimensions() if needed:
   - const { columns, rows, isNarrow, isVeryNarrow, isTiny } = useTerminalDimensions();

3. Match web layout:
   - Use SplitPane for multi-column layouts
   - Pass center={!isNarrow} for horizontal centering
   - Set appropriate widths for left/right panels

4. Add responsive behavior:
   - Conditional content based on breakpoints
   - Adjust widths/heights for narrow terminals
```

---

## Phase 4: Review
```
subagent_type: codebase-cleanup:code-reviewer

Review implementation:
1. Does layout match web visually?
2. Is useTerminalDimensions used correctly?
3. Does resize work live?
4. Are shortcuts exported and passed correctly?
5. Any unused imports or dead code?
```

---

## Usage

Replace `[SCREEN_NAME]` with actual screen name and run workflow:

```
/mirror-screen review
/mirror-screen settings
/mirror-screen history
```

---

## Key Files Reference

### Hooks
- `apps/cli/src/hooks/use-terminal-dimensions.ts` - dimensions + breakpoint flags
- `packages/hooks/src/use-figlet.ts` - ASCII art generation

### Layout
- `apps/cli/src/components/layout/global-layout.tsx` - header/content/footer wrapper
- `apps/cli/src/components/ui/split-pane.tsx` - two-column responsive layout
- `apps/cli/src/components/ui/header-brand.tsx` - responsive header

### Patterns
```typescript
// Screen pattern
export const SCREEN_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "select" },
  { key: "Enter", label: "open" },
  { key: "q", label: "quit" },
];

export function ScreenView(props: ScreenViewProps): ReactElement {
  const { isNarrow, isVeryNarrow } = useTerminalDimensions();

  return (
    <Box>
      <SplitPane
        center={!isNarrow}
        leftWidth={isNarrow ? undefined : 30}
        rightWidth={isNarrow ? undefined : 50}
        gap={3}
      >
        <LeftPanel />
        <RightPanel />
      </SplitPane>
    </Box>
  );
}
```

### App.tsx integration
```typescript
// In getShortcutsForView():
case "screen-name":
  return SCREEN_FOOTER_SHORTCUTS;
```
