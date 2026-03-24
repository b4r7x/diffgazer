# Research: Fix Keyscope Integration with diff-ui Components

## Decision 1: Navigation Event Handling Architecture

**Finding**: keyscope's `useNavigation` returns an `onKeyDown` callback — it does NOT register DOM event listeners. Consumers must manually attach it.

**Current Pattern in Diffgazer**: The consumer creates `useNavigation` but only uses `highlighted` (destructures only that). The consumer's `onKeyDown` is NEVER called. The actual keyboard handling is done by diff-ui's internal `useNavigation` (or `useListbox`).

**Implication**: The consumer's `useNavigation` acts as a state mirror, not an active navigator. There's no true "dual controller" conflict at the keyboard event level, but there IS a redundant hook that adds complexity.

## Decision 2: Component-by-Component a11y State

### Current State Audit

| Component | ARIA Roles | Internal Keyboard Nav | Hook Used | Controlled Mode | Gap Level |
|-----------|-----------|----------------------|-----------|----------------|-----------|
| **Menu** | ✅ role="menu", role="menuitem" | ✅ Arrow, Escape, typeahead | `useListbox` (custom) | ✅ Full | LOW |
| **RadioGroup** | ✅ role="radiogroup", role="radio", aria-checked | ✅ Arrow keys, Space/Enter | `useNavigation` (keyscope) | ✅ Full (useControllableState) | LOW |
| **CheckboxGroup** | ✅ role="group", role="checkbox", aria-checked | ✅ Arrow keys, Space toggle | `useNavigation` (keyscope) | ⚠️ Partial (no useControllableState) | MEDIUM |
| **Tabs** | ✅ role="tablist", role="tab", role="tabpanel" | ✅ Arrow keys, auto/manual | `useNavigation` (keyscope) | ✅ Full + defaultPrevented check | LOW |
| **NavigationList** | ✅ role="option", aria-selected | ✅ Arrow, typeahead | `useListbox` (custom) | ✅ Full | LOW |
| **Dialog** | ✅ role="dialog", aria-labelledby | ⚠️ Escape only, native Tab | None | ✅ Full (open/close) | MEDIUM |
| **Select** | ✅ role="listbox", role="option" | ✅ Arrow, typeahead, aria-activedescendant | `useNavigation` (keyscope) | ✅ Full | LOW |
| **Accordion** | ⚠️ aria-expanded, aria-controls (no container role) | ✅ Arrow keys | `useNavigation` (keyscope) | ⚠️ Partial (no onKeyDown passthrough) | MEDIUM |

### Key Findings

1. **All components already have ARIA roles** — base a11y structure is present
2. **6 components use keyscope's `useNavigation` internally** (always active, no `enabled` flag based on controlled props)
3. **2 components use custom `useListbox`** (Menu, NavigationList) — wraps useNavigation with controllable state
4. **Only Tabs checks `e.defaultPrevented`** before calling internal navKeyDown — the best pattern, others should follow
5. **CheckboxGroup is most fragile** — doesn't use `useControllableState` for highlight, passes prop directly

## Decision 3: Diffgazer Wiring Patterns (21 integration points)

### Pattern A: useNavigation → highlighted prop (Most Common, 12 files)

```
Consumer: useNavigation({ containerRef, role, value, onValueChange })
  └── highlighted → diff-ui component's highlighted/highlightedId prop
  └── onKeyDown: NOT USED (dead code)
diff-ui component: Internal useNavigation handles actual keyboard events
```

**Files**: provider-step, analysis-step, model-step, execution-step, storage-selector-content, trust-permissions-content, theme-selector-content, analysis-selector-content, settings-hub, issue-details-pane, history/page, history/timeline-list

### Pattern B: useKey + useScope (Page-level hotkeys, 8 files)

```
Consumer: useScope("page-name") + useKey("Escape", handler) + useKey("Enter", handler)
diff-ui components: Receive onClick handlers, no keyboard prop passing
```

**Files**: onboarding-wizard, no-changes-view, api-key-missing-view, storage/page, theme/page, analysis/page, diagnostics/page, trust-permissions/page

### Pattern C: useFocusZone (Multi-pane layouts, 3 files)

```
Consumer: useFocusZone({ zones, transitions }) + useNavigation per zone
diff-ui components: Receive highlighted based on active zone
```

**Files**: use-review-results-keyboard, use-history-keyboard, use-providers-keyboard

### Critical Finding

**No actual event-level conflicts detected.** The consumer's `useNavigation` never has its `onKeyDown` called — it's purely a controlled state wrapper. diff-ui components handle all keyboard events internally. The `highlighted` prop flows correctly through controlled state.

**The issue is likely NOT duplicate handlers** but rather one of:
1. diff-ui components not properly supporting controlled mode (state sync issues)
2. Consumer's `onSelect`/`onEnter` callbacks in useNavigation being dead code (never triggered because onKeyDown isn't called)
3. Role mismatch between consumer useNavigation (e.g., `role: "option"`) and diff-ui component items (e.g., `role="menuitem"`)
4. Ref forwarding issues where the consumer's containerRef doesn't properly reach the diff-ui component's root element
5. keyscope module resolution causing separate instances

## Decision 4: Correct Two-Layer Architecture

**Decision**: Simplify the pattern — remove redundant consumer-side `useNavigation` where diff-ui components already handle navigation internally.

**Rationale**: Since the consumer's `useNavigation` is just a state mirror (onKeyDown never used), it adds unnecessary complexity. The consumer should rely on diff-ui's controlled props (`highlighted`, `onHighlightChange`, `onSelect`) directly, using local state. keyscope's `useKey`/`useScope`/`useFocusZone` remain for page-level features.

**Alternative Considered**: Keep dual useNavigation instances but add `enabled: false` on diff-ui's internal hook when external control is present. Rejected because: adds complexity without benefit since the consumer's hook is already inert.

**New Pattern**:
```
Layer 1 (diff-ui): Component handles keyboard nav internally via useNavigation/useListbox
Layer 2 (keyscope): Consumer adds useKey/useScope/useFocusZone for page-level keyboard features
Bridge: highlighted/onHighlightChange props used by consumer to coordinate diff-ui component state with useFocusZone transitions
```

## Decision 5: WAI-ARIA Compliance Gaps

| Widget | WAI-ARIA Requirement | diff-ui Status | Action |
|--------|---------------------|----------------|--------|
| Menu | Roving tabindex, typeahead | ✅ Implemented | None |
| RadioGroup | Roving tabindex, single tab stop | ✅ Implemented | None |
| CheckboxGroup | Space to toggle, arrow nav | ✅ Implemented | Fix useControllableState |
| Tabs | Arrow keys, auto/manual activation | ✅ Implemented | None |
| Listbox/NavigationList | Arrow keys, typeahead | ✅ Implemented | None |
| Dialog | Focus trap, Escape, initial focus | ⚠️ Basic (native Tab) | Verify focus trap works |
| Accordion | Enter/Space toggle, optional arrows | ⚠️ Missing container role | Add role="group" |
| Select/Combobox | aria-activedescendant, arrows | ✅ Implemented | None |

## Decision 6: diff-ui Hooks Facade

**Structure**: 3 pure keyscope re-exports + 1 wrapper (useListbox) + 7 custom hooks

**selectableVariants CVA** (highlighted visual state):
- `highlighted: true` → `bg-secondary text-foreground font-bold` + left accent bar (before pseudo-element)
- `highlighted: false` → `text-foreground hover:bg-secondary/50`

**Build externalization**: Keyscope imports detected via registry.json `@keyscope/*` refs → aliased to external `keyscope` in tsup build. This is correct and should not be changed.

## Decision 7: Diagnostic Approach

**To confirm root cause**, the implementation should start with:
1. Run diffgazer web dev server and test keyboard nav manually
2. Add `console.log` in keyscope's `useNavigation.onKeyDown` to see if consumer's handler is ever called
3. Check if diff-ui components properly forward refs (verify `containerRef.current` matches expected DOM element)
4. Check if `onHighlightChange` callback is properly wired in all integration points
5. Verify module resolution: `import.meta.resolve?.('keyscope')` in both diffgazer and diff-ui contexts
