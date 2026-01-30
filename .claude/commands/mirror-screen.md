# Mirror Screen from Web to CLI

Refactor CLI screen `$ARGUMENTS` to use responsive layout and match its web counterpart.

## Existing Infrastructure (use these)
- `useTerminalDimensions()` - hook with breakpoints (isNarrow, isVeryNarrow, isTiny)
- `GlobalLayout` - wrapper with header/content/footer at full height
- `SplitPane` - two-column layout with center prop
- `HeaderBrand` - responsive header (auto-scales)

## Execute

### 1. Parallel Research (2 haiku agents)

**Agent 1 - Web analysis:**
```
Task(feature-dev:code-explorer, model=haiku)
Analyze apps/web/src/app/pages/$ARGUMENTS.tsx OR apps/web/src/features/$ARGUMENTS/
- Layout structure, panel sizes, responsive breakpoints
- Footer shortcuts
- Return: file:line + summary
```

**Agent 2 - CLI current state:**
```
Task(feature-dev:code-explorer, model=haiku)
Analyze apps/cli/src/app/views/$ARGUMENTS-view.tsx
- Does it use GlobalLayout? useTerminalDimensions?
- What needs changing?
- Return: file:line + changes needed
```

### 2. Implement (react-component-architect)

Changes to make:
1. Use `useTerminalDimensions()` for responsiveness
2. Use `SplitPane` with `center={!isNarrow}` for layout
3. Export `SCREEN_FOOTER_SHORTCUTS` for footer
4. Adjust panel widths to match web

### 3. Review (code-reviewer)
- Does layout match web?
- Does resize work live?
- Are shortcuts correct?

## Pattern to Use

```typescript
import { useTerminalDimensions } from "../../hooks/index.js";
import { SplitPane } from "../../components/ui/split-pane.js";
import type { Shortcut } from "@repo/schemas/ui";

export const SCREEN_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "select" },
  { key: "Enter", label: "confirm" },
  { key: "Esc", label: "back" },
];

export function ScreenView(props): ReactElement {
  const { isNarrow } = useTerminalDimensions();

  return (
    <SplitPane
      center={!isNarrow}
      leftWidth={isNarrow ? undefined : 30}
      rightWidth={isNarrow ? undefined : 50}
    >
      <LeftPanel />
      <RightPanel />
    </SplitPane>
  );
}
```
