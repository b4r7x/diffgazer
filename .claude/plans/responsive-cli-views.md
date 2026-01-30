# Plan: Responsive CLI Views (Mirror Web Layout)

## Cel
Zrobić responsywne widoki w CLI, które wyglądają jak w wersji webowej.

---

## Architektura

### Nowy package: `packages/hooks/`
```
packages/hooks/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── use-figlet.ts         # shared między web i CLI
    └── use-route-state.ts    # przeniesiony z core
```

### CLI-specific hook (zostaje w CLI)
```
apps/cli/src/hooks/use-terminal-dimensions.ts   # wraps Ink useStdout
```

### Core cleanup
- Usunąć `packages/core/src/hooks/` folder
- Usunąć React deps z `packages/core/package.json`

---

## Fazy implementacji

### Faza 0: Migrate hooks from core to packages/hooks
**Cel:** Wyciągnąć React hooks z core, usunąć React dependency z core

**Pliki:**
- `packages/hooks/package.json` - CREATE
- `packages/hooks/tsconfig.json` - CREATE
- `packages/hooks/src/index.ts` - CREATE
- `packages/hooks/src/use-route-state.ts` - MOVE from core
- `packages/core/src/hooks/use-route-state.ts` - DELETE
- `packages/core/src/index.ts` - MODIFY (remove useRouteState export)
- `packages/core/package.json` - MODIFY (remove React peerDep & @types/react)

**Core package.json changes:**
```diff
- "peerDependencies": {
-   "react": "^18.0.0 || ^19.0.0"
- },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@types/node": "^22.0.0",
-   "@types/react": "^19.0.0",
    "typescript": "^5.7.0"
  },
```

**Agent:** `code-simplifier:code-simplifier`

---

### Faza 1: Add useFiglet to packages/hooks
**Pliki:**
- `packages/hooks/src/use-figlet.ts` - CREATE (copy + adapt from web)
- `packages/hooks/src/index.ts` - MODIFY (add export)
- `packages/hooks/package.json` - MODIFY (add figlet dep)

**Agent:** `code-simplifier:code-simplifier`

---

### Faza 2: CLI hook - useTerminalDimensions
**Plik:** `apps/cli/src/hooks/use-terminal-dimensions.ts` - CREATE

```typescript
interface TerminalDimensions {
  columns: number;
  rows: number;
  isNarrow: boolean;      // columns < 90
  isVeryNarrow: boolean;  // columns < 60
}

export function useTerminalDimensions(options?: {
  narrowBreakpoint?: number;  // default 90
}): TerminalDimensions
```

**Agent:** `react-component-architect`

---

### Faza 3: Web migration
**Pliki:**
- `apps/web/src/hooks/use-figlet.ts` - DELETE lub przekieruj do @repo/hooks
- `apps/web/src/components/ui/ascii-logo.tsx` - MODIFY import
- `apps/web/package.json` - MODIFY (add @repo/hooks dep)

**Agent:** `react-component-architect`

---

### Faza 4: CLI Header responsive
**Plik:** `apps/cli/src/components/ui/header-brand.tsx` - MODIFY

Zmiany:
- Import `useFiglet` from `@repo/hooks`
- Import `useTerminalDimensions` from local hooks
- Add `compact` prop
- Render figlet lub CompactBrand based on dimensions
- Keep hardcoded BANNER_LINES as fallback during load

**Agent:** `react-component-architect`

---

### Faza 5: CLI SplitPane centering
**Plik:** `apps/cli/src/components/ui/split-pane.tsx` - MODIFY

Zmiany:
- Add `center` prop
- Add `justifyContent="center"` when center=true and not narrow

**Agent:** `react-component-architect`

---

### Faza 6: CLI MainMenuView integration
**Plik:** `apps/cli/src/app/views/main-menu-view.tsx` - MODIFY

Zmiany:
- Import `useTerminalDimensions`
- Pass `compact={isVeryNarrow}` to HeaderBrand
- Pass `center={!isNarrow}`, `leftWidth={isNarrow ? undefined : 35}` to SplitPane
- Hide stars on very narrow: `showStars={!isVeryNarrow}`

**Agent:** `react-component-architect`

---

### Faza 7: Testing
**Pliki:**
- `packages/hooks/src/use-figlet.test.ts` - CREATE
- `packages/hooks/src/use-route-state.test.ts` - CREATE (if not exists)
- `apps/cli/src/hooks/use-terminal-dimensions.test.ts` - CREATE

**Agent:** `pr-review-toolkit:pr-test-analyzer`

---

### Faza 8: Code review & cleanup
**Agent:** `codebase-cleanup:code-reviewer`

---

## Breakpoints

| Terminal width | Layout |
|----------------|--------|
| < 60 cols | CompactBrand (text-only), vertical stack |
| < 90 cols | Full header, vertical stack |
| >= 90 cols | Full header + stars, horizontal centered |

---

## Interfejsy hooków

### useFiglet (shared)
```typescript
interface UseFigletResult {
  text: string | null;
  isLoading: boolean;
  error: Error | null;
}

function useFiglet(inputText: string, font?: string): UseFigletResult
```

### useRouteState (shared, moved from core)
```typescript
function useRouteState<T>(key: string, defaultValue: T): [T, SetState<T>]
function clearRouteState(key?: string): void
function getRouteStateSize(): number
```

### useTerminalDimensions (CLI only)
```typescript
interface TerminalDimensions {
  columns: number;
  rows: number;
  isNarrow: boolean;
  isVeryNarrow: boolean;
}

function useTerminalDimensions(options?: {
  narrowBreakpoint?: number;
  veryNarrowBreakpoint?: number;
}): TerminalDimensions
```

---

## Kolejność agentów

1. `code-simplifier:code-simplifier` - Faza 0-1 (packages/hooks + core cleanup)
2. `react-component-architect` - Fazy 2-6 (hooks + components)
3. `pr-review-toolkit:pr-test-analyzer` - Faza 7 (testy)
4. `codebase-cleanup:code-reviewer` - Faza 8 (cleanup)

---

## Success Criteria

- [ ] React deps removed from @repo/core
- [ ] useRouteState works from @repo/hooks
- [ ] CLI header renders figlet ASCII art dynamically
- [ ] Terminal resize → automatic re-render
- [ ] Narrow (<90) → vertical stacked
- [ ] Very narrow (<60) → CompactBrand
- [ ] Wide (>=90) → horizontal centered
- [ ] Left panel narrower than right
- [ ] Web unaffected - imports from @repo/hooks
- [ ] All type-check passes
- [ ] Tests cover dimension transitions
