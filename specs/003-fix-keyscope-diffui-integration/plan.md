# Implementation Plan: Fix Keyscope + diff-ui Integration

**Branch**: `003-fix-keyscope-diffui-integration` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-fix-keyscope-diffui-integration/spec.md`

## Summary

Fix broken keyboard navigation in diffgazer web UI after migration from local components to diff-ui package components. The correct architecture is two layers: diff-ui provides standalone a11y as the base, keyscope hooks are plugged in on top by diffgazer for enhanced keyboard UX. Research found no true dual-controller event conflict, but identified controlled mode inconsistencies in diff-ui components, redundant `useNavigation` instances in diffgazer, and potential role mismatches between layers.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only
**Primary Dependencies**: React 19, keyscope (workspace:*), diffui (workspace:*), Tailwind CSS v4, CVA + tailwind-merge
**Storage**: N/A (client-side UI state only)
**Testing**: Vitest + @testing-library/react + @testing-library/user-event
**Target Platform**: Browser (Vite dev server, bundled web app)
**Project Type**: Web application (React 19 SPA) + component library
**Performance Goals**: Keyboard input response < 16ms (60fps)
**Constraints**: keyscope source must NOT be modified; diff-ui and diffgazer sources both modifiable
**Scale/Scope**: 21 integration points across ~80 TSX files, 8 interactive diff-ui component types, ~15 diffgazer pages

## Constitution Check

*No project constitution configured (template only). No gates to evaluate.*

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-keyscope-diffui-integration/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Entity and state model
├── quickstart.md        # Quick reference for implementers
├── contracts/
│   └── two-layer-keyboard.md  # Integration contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (affected areas)

```text
# diff-ui (Layer 1 fixes)
/Users/voitz/Projects/diffgazer-workspace/diff-ui/
├── registry/ui/
│   ├── checkbox/          # Fix: add useControllableState, defaultPrevented check
│   ├── radio/             # Fix: add defaultPrevented check
│   ├── menu/              # Fix: verify controlled mode, add defaultPrevented check
│   ├── tabs/              # Reference: already has correct pattern
│   ├── navigation-list/   # Verify: controlled mode works
│   ├── dialog/            # Verify: focus trap works standalone
│   ├── select/            # Verify: controlled mode works
│   └── accordion/         # Fix: add container role, verify controlled mode
├── registry/hooks/
│   ├── use-listbox.ts     # Verify: controlled mode passthrough
│   └── use-navigation.ts  # Pure re-export, no changes
└── registry/lib/
    └── selectable-variants.ts  # Reference: highlighted visual styling

# diffgazer (Layer 2 fixes)
/Users/voitz/Projects/diffgazer-workspace/diffgazer/apps/web/src/
├── app/providers/index.tsx            # Verify: KeyboardProvider at root
├── features/home/components/
│   ├── page.tsx                       # Fix: remove redundant useNavigation, use direct state
│   └── home-menu.tsx                  # Verify: props forwarding
├── features/settings/components/
│   ├── hub/page.tsx                   # Fix: remove redundant useNavigation
│   ├── theme-selector-content.tsx     # Fix: simplify wiring
│   └── analysis/analysis-selector-content.tsx  # Fix: simplify wiring
├── features/onboarding/components/steps/
│   ├── provider-step.tsx              # Fix: remove redundant useNavigation
│   ├── analysis-step.tsx              # Fix: remove redundant useNavigation
│   ├── model-step.tsx                 # Fix: remove redundant useNavigation
│   └── execution-step.tsx             # Fix: remove redundant useNavigation
├── features/providers/components/
│   └── page.tsx                       # Fix: simplify wiring
├── features/history/components/
│   ├── page.tsx                       # Fix: simplify wiring
│   └── timeline-list.tsx              # Fix: simplify wiring
├── features/review/
│   ├── hooks/use-review-results-keyboard.ts  # Complex: useFocusZone, needs careful refactor
│   └── components/issue-details-pane.tsx      # Fix: simplify tabs wiring
├── components/shared/
│   ├── trust-permissions-content.tsx           # Fix: simplify wiring
│   ├── storage-selector-content.tsx            # Fix: simplify wiring
│   └── keyboard-navigation.integration.test.tsx  # Update: match new patterns
└── styles/
    ├── index.css                      # Verify: CSS cascade order
    └── theme-overrides.css            # Verify: token overrides
```

**Structure Decision**: Cross-repo fix touching diff-ui component library (Layer 1 a11y) and diffgazer web app (Layer 2 wiring). No new files created — only modifications to existing components and tests.

## Implementation Phases

### Phase 1: Diagnose (verify root cause)

**Goal**: Confirm which specific interactions are broken and why.

1. Start diffgazer web dev server (`pnpm dev:web`)
2. Manually test keyboard navigation on each page
3. Add diagnostic logging to trace event flow
4. Identify exact failure points

### Phase 2: Fix diff-ui Component Controlled Mode

**Goal**: Ensure diff-ui components properly support the two-layer model.

**2a. Standardize defaultPrevented check** (all components except Tabs which already has it):
- RadioGroup: `if (!e.defaultPrevented) navKeyDown(e)` in handleKeyDown
- CheckboxGroup: same pattern
- Menu (via useListbox): same pattern
- Accordion: same pattern

**2b. CheckboxGroup: add useControllableState**:
- Currently passes external `highlighted` directly to useNavigation
- Should wrap in `useControllableState` like RadioGroup does

**2c. Accordion: add container role**:
- Add `role="group"` to accordion root

**2d. Verify Dialog focus trap works standalone**:
- Test without keyscope, confirm Tab cycling and Escape work

### Phase 3: Fix Diffgazer Wiring

**Goal**: Remove redundant `useNavigation` instances, simplify to direct state management.

**Pattern A files (12 integration points)** — replace redundant useNavigation with direct state:

Before:
```tsx
const { highlighted: focusedValue } = useNavigation({
  containerRef, role: "radio", value: focused, onValueChange: setFocused, ...
});
<RadioGroup ref={containerRef} highlighted={focusedValue} ... />
```

After:
```tsx
const [focusedValue, setFocusedValue] = useState<string | null>(initialValue);
<RadioGroup highlighted={focusedValue} onHighlightChange={setFocusedValue} ... />
```

Key: the diff-ui component handles keyboard nav internally. Consumer only manages state.

**Pattern C files (3 complex integrations)** — useFocusZone coordination:
- `use-review-results-keyboard.ts`: Keep useFocusZone + useKey for zone transitions and hotkeys. Remove useNavigation for the issue list (NavigationList handles it). Bridge via `highlighted` prop + `onHighlightChange` callback.
- `use-history-keyboard.ts`: Similar simplification
- `use-providers-keyboard.ts`: Similar simplification

**Pattern B files (8 page-level hotkey files)** — no changes needed (useKey + useScope work correctly).

### Phase 4: Update Tests

**Goal**: Ensure test suite passes and covers the new two-layer pattern.

1. Update `keyboard-navigation.integration.test.tsx` to match simplified wiring
2. Run full test suite: `pnpm --filter @diffgazer/web test`
3. Run type-check: `pnpm --filter @diffgazer/web exec tsc --noEmit`
4. Add test verifying diff-ui component works standalone (no KeyboardProvider)

### Phase 5: Verify Theme & Visual

**Goal**: Confirm visual focus indicators and theme tokens work correctly.

1. Verify `selectableVariants` highlight styling works in diffgazer
2. Verify CSS cascade: `diffui/theme.css` → `theme-overrides.css`
3. Test both dark and light themes
4. Check `[data-focused]` CSS rule in diffgazer aligns with diff-ui highlight mechanism

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| diff-ui controlled mode doesn't suppress internal nav | HIGH | Phase 2 adds defaultPrevented check to all components |
| Removing consumer useNavigation breaks onBoundaryReached for useFocusZone transitions | MEDIUM | Keep boundary detection via diff-ui component callbacks or useKey handlers |
| Role mismatches cause DOM queries to fail | MEDIUM | Audit all role= values in both layers during Phase 3 |
| Test suite relies on specific useNavigation behavior | LOW | Update tests in Phase 4 to match new patterns |
| Module resolution creates duplicate keyscope instances | LOW | Already verified single instance via symlinks |
