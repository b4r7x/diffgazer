# Feature Component Extraction Audit

**Date:** 2026-02-07
**Scope:** 23 feature components across review, providers, home, onboarding, history, settings
**Goal:** Identify generic, reusable UI patterns worth extracting to `@stargazer/ui`

---

## Executive Summary

Of 23 feature components audited:

| Verdict | Count | Components |
|---------|-------|------------|
| **EXTRACT** | 4 | CodeBlock, DiffView, KeyValue, LabeledField |
| **GENERALIZE** | 5 | Timer, SearchInput (unified), ToggleGroup (unified), HorizontalStepper, Checklist |
| **SKIP** | 14 | Domain-coupled or too app-specific |

### Duplicate Patterns Found

| Pattern | Implementations | Recommendation |
|---------|----------------|----------------|
| **SearchInput** | history/search-input.tsx + providers/model-search-input.tsx | Unify into one `SearchInput` component |
| **Filter/Toggle Group** | severity-filter-group + model-filter-tabs | Unify into one `ToggleGroup` component |
| **Label-Value Display** | metric-item + capability-card + info-field | 3 different patterns; extract `KeyValue` + `LabeledField` |

---

## Component-by-Component Audit

### 1. code-snippet.tsx (Review)

**What it does:** Renders numbered code lines with syntax highlighting for highlight/added/removed line types. Uses `CodeLine` type from `@stargazer/schemas/ui`.

**VERDICT: EXTRACT as `CodeBlock`**

- **Library name:** `CodeBlock`
- **Reason:** Pure rendering component. Line numbering + color-coded line types is a standard code display pattern. Zero business logic.
- **Domain coupling:** Only `CodeLine` type (trivially genericized: `{ number: number; content: string; type?: string }`)
- **Generic props API:**
  ```typescript
  interface CodeBlockProps {
    lines: { number: number; content: string; type?: "highlight" | "added" | "removed" }[];
    className?: string;
  }
  ```
- **What changes:** Replace `CodeLine` import with inline type. Replace `bg-black` with `bg-background`. Replace `text-gray-600`/`text-gray-400`/`border-gray-700` with semantic tokens.
- **shadcn equivalent:** None (shadcn has no code block component)

---

### 2. diff-view.tsx (Review)

**What it does:** Renders a unified diff patch string with line-by-line coloring (red for deletions, green for additions, blue for hunks, muted for file headers).

**VERDICT: EXTRACT as `DiffView`**

- **Library name:** `DiffView`
- **Reason:** Pure rendering, zero domain coupling. Takes a raw `patch: string` and renders colored diff. Universal utility for any code review/git UI.
- **Generic props API:**
  ```typescript
  interface DiffViewProps {
    patch: string;
    className?: string;
  }
  ```
- **What changes:** Replace `bg-black` with `bg-background`. Token abstraction only, logic is already generic.
- **shadcn equivalent:** None

---

### 3. metric-item.tsx (Review)

**What it does:** Horizontal label-value pair with color variants (default, warning, info). Flexbox with justify-between.

**VERDICT: EXTRACT as `KeyValue`**

- **Library name:** `KeyValue`
- **Reason:** Pure UI pattern used across dashboards. Zero domain coupling. Generic label + value display.
- **Generic props API:**
  ```typescript
  interface KeyValueProps {
    label: React.ReactNode;
    value: React.ReactNode;
    variant?: "default" | "warning" | "info" | "success" | "error";
    layout?: "horizontal" | "vertical";
    className?: string;
  }
  ```
- **What changes:** Replace `text-gray-400` with `text-muted-foreground`. Add `layout` prop for vertical stacking. Add `success` and `error` variants.
- **shadcn equivalent:** None (shadcn relies on custom compositions)
- **Related:** See also capability-card (#13) and info-field (#18) -- different enough to be separate components

---

### 4. timer.tsx (Review)

**What it does:** Displays elapsed time with auto-updating via `useTimer` hook from `@stargazer/hooks`. Depends on `formatTime` from `@stargazer/core/format`.

**VERDICT: GENERALIZE as `Timer`**

- **Library name:** `Timer`
- **Reason:** Useful TUI pattern (elapsed time displays), but depends on external hooks package (`@stargazer/hooks`) and utility (`@stargazer/core/format`).
- **Domain coupling:** Low, but has 2 cross-package dependencies
- **Generic props API:**
  ```typescript
  interface TimerProps {
    startTime?: Date;
    elapsedMs?: number;
    running?: boolean;
    format?: "short" | "long";
    formatter?: (ms: number) => string;
    className?: string;
  }
  ```
- **What changes:** Either (a) inline a simple `useTimer` + `formatTime` into the library, or (b) accept a `formatter` prop and let consumers bring their own formatting. Option (b) is cleaner -- keeps the library dependency-free.
- **shadcn equivalent:** None. Ark UI has a `Timer` component.

---

### 5. severity-filter-group.tsx (Review)

**What it does:** Row of toggle buttons for filtering by severity level. Tied to `ReviewSeverity` type, `SEVERITY_ORDER` constant, and `UISeverityFilter` type from schemas.

**VERDICT: GENERALIZE -- merge with #16 into `ToggleGroup`**

- **Library name:** `ToggleGroup` (see unified API in Duplicate Patterns section below)
- **Reason:** The UI pattern (row of toggle buttons with active/inactive state) is generic. But this specific implementation is deeply coupled to severity domain types.
- **Domain coupling:** HIGH -- `ReviewSeverity`, `SEVERITY_ORDER`, `UISeverityFilter`, `SEVERITY_CONFIG` colors
- **What changes:** Strip all severity types. Accept generic `items` array with `{ value, label, count?, color? }`. See unified API below.
- **shadcn equivalent:** Radix `ToggleGroup`

---

### 6. severity-filter-button.tsx (Review)

**What it does:** Individual toggle button within severity filter group. Uses bracket notation `[LABEL count]`, severity-specific colors, `aria-pressed`.

**VERDICT: GENERALIZE -- becomes `ToggleGroupItem` (internal to `ToggleGroup`)**

- **Reason:** Part of the severity filter group pattern. The bracket-wrapped toggle with active background is a TUI signature pattern worth extracting, but the severity color mapping is domain-specific.
- **Domain coupling:** HIGH -- `ReviewSeverity`, `SEVERITY_CONFIG`
- **What changes:** Becomes internal to `ToggleGroup`. Color passed as prop instead of looked up from severity config.

---

### 7. fix-plan-checklist.tsx (Review)

**What it does:** Clickable checklist with TUI-style `[x]`/`[ ]` indicators and strikethrough on completion. Uses `FixPlanStep` type from schemas.

**VERDICT: GENERALIZE as `Checklist`**

- **Library name:** `Checklist`
- **Reason:** The TUI `[x]`/`[ ]` toggle-list pattern is a library-worthy interaction. Only domain coupling is the `FixPlanStep` type which is trivially genericized.
- **Domain coupling:** LOW -- only `FixPlanStep` type `{ step: number; action: string }`
- **Generic props API:**
  ```typescript
  interface ChecklistItem {
    id: string | number;
    label: React.ReactNode;
  }
  interface ChecklistProps {
    items: ChecklistItem[];
    checked: Set<string | number>;
    onToggle: (id: string | number) => void;
    className?: string;
  }
  ```
- **What changes:** Replace `FixPlanStep` with generic `ChecklistItem`. Replace `text-gray-400` with `text-muted-foreground`. Keep `[x]`/`[ ]` indicators and `line-through` styling.
- **shadcn equivalent:** None (Checkbox exists but not as a checklist pattern)

---

### 8. lens-stats-table.tsx (Review)

**What it does:** Simple 2-column table (Lens name with icon, Count) with hover highlighting. Uses `LensStats` type from schemas.

**VERDICT: SKIP**

- **Reason:** While a generic `Table` component would be valuable, this specific implementation is too simple (2 hardcoded columns, no sorting, no pagination) to serve as the basis. A proper Table component should support dynamic columns, sorting, and row selection. Better to build a Table from scratch following TanStack Table patterns, or skip entirely per ui-library-patterns.md ("Complex data grids -- use TanStack Table").
- **Domain coupling:** MEDIUM -- `LensStats` type, `lens.icon`/`lens.iconColor` rendering

---

### 9. activity-log.tsx (Review)

**What it does:** Auto-scrolling log container with blinking cursor. Renders `LogEntry` items in a `ScrollArea`. Manages scroll-near-bottom detection for auto-scroll behavior.

**VERDICT: SKIP**

- **Reason:** The auto-scroll-to-bottom behavior is useful but tightly coupled to the `LogEntry` rendering pattern. The component is essentially `ScrollArea` + domain-specific `LogEntry` list + auto-scroll logic. The auto-scroll behavior would be better extracted as a `useAutoScroll` hook rather than a component.
- **Domain coupling:** HIGH -- `LogEntryData` type, renders `LogEntry` children, cursor blink animation

---

### 10. log-entry.tsx (Review)

**What it does:** Single log line with timestamp, colored tag badge, optional source, and message. Uses `LogTagType` mapping to Badge variants.

**VERDICT: SKIP**

- **Reason:** Domain-specific composition of Badge + timestamp + tag styling. The `TAG_VARIANTS` mapping to badge variants is review-specific (system, tool, lens, warning, error, agent, thinking). Not a generic pattern.
- **Domain coupling:** HIGH -- `LogTagType`, `TAG_VARIANTS` mapping, `formatTimestamp` from core

---

### 11. issue-header.tsx (Review)

**What it does:** Issue title with severity-colored heading and file:line location display.

**VERDICT: SKIP**

- **Reason:** Deeply domain-specific. Tied to `ReviewSeverity`, `SEVERITY_CONFIG` color lookup, and the concept of file:line locations. Only 26 lines -- too simple and too domain-coupled to warrant extraction.
- **Domain coupling:** HIGH -- `ReviewSeverity`, `SEVERITY_CONFIG`

---

### 12. analysis-summary.tsx (Review)

**What it does:** Full analysis results page with severity breakdown, lens stats, top issues preview, and action buttons. Composed of Panel, SeverityBreakdown, LensStatsTable, IssuePreviewItem.

**VERDICT: SKIP**

- **Reason:** Page-level composition component. Deeply domain-specific -- every element is review/analysis specific. This is a "block" (page section), not a reusable component. Per ui-library-patterns.md: "Page templates -- too specific."
- **Domain coupling:** VERY HIGH -- `AnalysisStats`, `SeverityCounts`, `IssuePreview`, `LensStats`, review-specific text content

---

### 13. capability-card.tsx (Providers)

**What it does:** Bordered card showing a label (tiny italic text) above a value. Used for model capabilities display.

**VERDICT: SKIP (covered by KeyValue)**

- **Reason:** This is essentially a vertical `KeyValue` with border styling. Only 16 lines. Rather than extracting as a separate `StatCard`, the `KeyValue` component (#3) with `layout="vertical"` and optional border styling covers this use case.
- **What to do instead:** After `KeyValue` is extracted, refactor this to use `<KeyValue layout="vertical" className="p-3 border border-border" />`.

---

### 14. dialog-footer-actions.tsx (Providers)

**What it does:** Cancel/Confirm button pair with keyboard hints display. Shows `[Esc] Cancel` and `[Enter] Confirm` buttons with focus ring states.

**VERDICT: SKIP**

- **Reason:** While dialog footer actions are common, this implementation is too opinionated to be a generic component:
  - Hardcoded `[Esc] Cancel` and `[Enter] Confirm` text
  - Keyboard hints display is specific to TUI keyboard navigation
  - `cancelFocused`/`confirmFocused` props tie it to a specific focus management pattern
  - The Dialog component already has `DialogFooter` for layout -- action buttons should be composed by consumers
- **Better approach:** Document this as a "Dialog footer pattern" in usage examples rather than extracting as a component.

---

### 15. model-search-input.tsx (Providers)

**What it does:** Search input with `/` prefix icon, custom model ID action button, keyboard handlers for Escape/ArrowDown/Enter.

**VERDICT: GENERALIZE -- merge with #20 into unified `SearchInput`**

- **Library name:** `SearchInput` (see unified API in Duplicate Patterns section below)
- **Reason:** Near-duplicate of history/search-input.tsx (#20). Both have `/` prefix, escape handling, arrow key handling.
- **Domain coupling:** MEDIUM -- `showCustomAction`/`onUseCustom` props are model-dialog-specific
- **What changes:** Extract core search input pattern. Domain-specific extras (`showCustomAction`, `onUseCustom`, "Use ID" button) stay in the feature as composition around the library `SearchInput`.

---

### 16. model-filter-tabs.tsx (Providers)

**What it does:** Row of toggle buttons for filtering models by tier (all/free/paid). Uses Button with `variant="toggle"`.

**VERDICT: GENERALIZE -- merge with #5 into unified `ToggleGroup`**

- **Library name:** `ToggleGroup` (see unified API in Duplicate Patterns section below)
- **Reason:** Same UI pattern as severity-filter-group: row of toggle buttons with active state. This one uses Button toggle variant instead of custom implementation.
- **Domain coupling:** MEDIUM -- `TierFilter` type, `TIER_FILTERS` constant
- **What changes:** See unified ToggleGroup API below.
- **shadcn equivalent:** Radix `ToggleGroup`

---

### 17. model-list-item.tsx (Providers)

**What it does:** Selectable list item for model selection dialog. Shows radio-style `[ . ]`/`[   ]` indicator, model name, tier badge, description.

**VERDICT: SKIP**

- **Reason:** Domain-specific list item for model selection. Tied to `ModelInfo` type with model-specific rendering (name, tier badge, description). The radio-style indicator pattern already exists in the RadioGroup library component.
- **Domain coupling:** HIGH -- `ModelInfo` type, tier-specific badge coloring

---

### 18. info-field.tsx (Home)

**What it does:** Colored label above value with optional click handler. Supports 6 color variants. Handles keyboard events for accessible clicking.

**VERDICT: EXTRACT as `LabeledField`**

- **Library name:** `LabeledField`
- **Reason:** Pure UI component with zero domain coupling. Generic label-above-value pattern with color variants and optional interactivity. Well-implemented accessibility (role="button", tabIndex, keyboard handler). Different enough from `KeyValue` (vertical layout is default, colored labels, click support) to warrant its own component.
- **Generic props API:**
  ```typescript
  type LabeledFieldColor = "blue" | "violet" | "green" | "yellow" | "red" | "muted";
  interface LabeledFieldProps {
    label: string;
    color?: LabeledFieldColor;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    ariaLabel?: string;
  }
  ```
- **What changes:** Replace `text-gray-400` with `text-muted-foreground` in the muted color variant. Otherwise extract as-is -- it's already generic.
- **shadcn equivalent:** None

---

### 19. wizard-progress.tsx (Onboarding)

**What it does:** Horizontal step indicator with TUI-style `---` connectors. Steps show as active (blue background), completed (green text), or pending (muted text).

**VERDICT: GENERALIZE as `HorizontalStepper`**

- **Library name:** `HorizontalStepper`
- **Reason:** The TUI-style horizontal stepper with `---` connectors is a distinctive pattern. Multi-step wizards are common. But it's coupled to `OnboardingStep` type and hardcoded `STEP_LABELS`.
- **Domain coupling:** MEDIUM -- `OnboardingStep` type, `STEP_LABELS` mapping
- **Generic props API:**
  ```typescript
  interface StepperStep {
    value: string;
    label: string;
  }
  interface HorizontalStepperProps {
    steps: StepperStep[];
    currentStep: string;
    className?: string;
  }
  ```
- **What changes:** Replace `OnboardingStep` with generic string value. Accept `steps` as array of `{ value, label }` instead of separate `steps` + `STEP_LABELS` lookup. Replace `text-black` with `text-primary-foreground`. Keep `---` connector and blue/green/muted coloring.
- **shadcn equivalent:** None (no horizontal stepper in shadcn)
- **Note:** The existing `ProgressList`/`Step`/`Substep` in `ui/progress/` is a vertical stepper with expand/collapse. This horizontal variant serves a different use case (wizard progress bars).

---

### 20. search-input.tsx (History)

**What it does:** Search input with `/` prefix icon, escape/arrow key handlers, animated cursor indicator when value is present.

**VERDICT: GENERALIZE -- merge with #15 into unified `SearchInput`**

- **Library name:** `SearchInput` (see unified API in Duplicate Patterns section below)
- **Reason:** Near-duplicate of providers/model-search-input.tsx (#15). Cleaner implementation -- no domain-specific extras.
- **Domain coupling:** NONE -- already fully generic
- **What changes:** This is the better base for the unified component. Add the `/` prefix from the model variant as a configurable prop.

---

### 21. run-accordion-item.tsx (History)

**What it does:** Selectable list item with selection indicator bar, click/double-click/keyboard handlers. Shows run metadata (displayId, branch badge, provider, timestamp, summary).

**VERDICT: SKIP**

- **Reason:** Domain-specific list item for run history. Deeply coupled to `Run` type with run-specific rendering. The selection indicator pattern (left bar) exists in NavigationList. The accordion naming is misleading -- it doesn't expand/collapse; it's just a selectable list item.
- **Domain coupling:** HIGH -- `Run` type destructuring, run-specific display layout

---

### 22. timeline-list.tsx (History)

**What it does:** Vertical list with circular indicators (`●`/`○`), counts, and keyboard navigation via `useGroupNavigation`. Renders `TimelineItem` items.

**VERDICT: SKIP**

- **Reason:** This is essentially a styled `NavigationList` usage. It uses `useGroupNavigation` directly and renders `role="option"` items -- the same pattern as NavigationList. Rather than extracting this as a separate component, refactor to use NavigationList with custom item rendering.
- **Domain coupling:** MEDIUM -- `TimelineItem` type from schemas
- **What to do instead:** Refactor to use `<NavigationList>` with custom `<NavigationListItem>` styling.

---

### 23. theme-preview-card.tsx (Settings)

**What it does:** Renders a preview of a theme (dark/light) by wrapping UI library components (Panel, Menu, Badge) in a `data-theme` container. Shows how components look under different themes.

**VERDICT: SKIP**

- **Reason:** App-specific settings component. Its purpose is to preview the app's theme -- it's a composition of library components, not itself a library component. Tightly coupled to the specific set of components being previewed.
- **Domain coupling:** HIGH -- imports Panel, Menu, Badge, uses `ResolvedTheme` type, renders app-specific preview content

---

## Duplicate Patterns & Unified APIs

### Pattern 1: SearchInput (2 implementations)

**Sources:**
- `features/history/components/search-input.tsx` -- cleaner, more generic
- `features/providers/components/model-select-dialog/model-search-input.tsx` -- has extras (custom action button, tip text)

**Differences:**

| Feature | history | providers |
|---------|---------|-----------|
| `/` prefix | Blue bold `<span>` | Absolute-positioned muted `<span>` |
| Escape handler | `onEscape()` | `onEscape()` + `e.stopPropagation()` |
| Arrow handlers | Up + Down | Down only |
| Enter handler | None | Custom action trigger |
| Extra action | None | "Use ID" button |
| Active indicator | Animated pulse block | None |
| Styling | Transparent bg, border-x + border-b | `bg-tui-input-bg`, full border |

**Unified `SearchInput` API:**

```typescript
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onEscape: () => void;
  onFocus?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  prefix?: React.ReactNode;      // default: "/" in blue
  showActiveIndicator?: boolean;  // animated cursor when value present
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
}
```

The providers version's extras (`showCustomAction`, `onUseCustom`, "Use ID" button, tip text) should remain as composition around the library SearchInput in the feature code:

```tsx
// In feature: providers/model-search-input.tsx
<div>
  <div className="flex gap-2 items-center">
    <SearchInput value={value} onChange={onChange} ... />
    {showCustomAction && <Button onClick={onUseCustom}>Use ID</Button>}
  </div>
  {showCustomAction && <div className="text-[10px]">Tip: enter a custom model ID</div>}
</div>
```

---

### Pattern 2: ToggleGroup / FilterChips (2+ implementations)

**Sources:**
- `features/review/components/severity-filter-group.tsx` + `severity-filter-button.tsx` -- custom buttons with bracket notation
- `features/providers/components/model-select-dialog/model-filter-tabs.tsx` -- uses Button toggle variant

**Differences:**

| Feature | severity-filter | model-filter |
|---------|----------------|--------------|
| Item rendering | Custom `<button>` with `[LABEL count]` | `<Button variant="toggle">` |
| Active style | `backgroundColor: currentColor` + inverted text | `data-active` toggle variant |
| Focus ring | `ring-1 ring-tui-blue` | `ring-2 ring-tui-blue ring-offset-*` |
| Selection mode | Single (deselect = "all") | Single |
| Item data | severity + count | filter label only |
| Domain coupling | HIGH (severity types) | MEDIUM (tier filter type) |

**Unified `ToggleGroup` API:**

```typescript
interface ToggleGroupItem {
  value: string;
  label: React.ReactNode;
  count?: number;
}

interface ToggleGroupProps {
  items: ToggleGroupItem[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  allowDeselect?: boolean;      // clicking active item sets value to null
  size?: "sm" | "md";
  className?: string;
}
```

- Uses Button `variant="toggle"` internally
- Shows `[{label} {count}]` when count is provided (TUI bracket notation)
- Shows just `{label}` when no count
- `allowDeselect` enables clicking active item to deselect (severity filter behavior)
- Focus/keyboard navigation via index props left to consumer (not built into ToggleGroup since it's a simple button row)
- **shadcn/Radix equivalent:** `ToggleGroup` from Radix Primitives

---

### Pattern 3: Label-Value Display (3 implementations)

**Sources:**
- `features/review/components/metric-item.tsx` -- horizontal, variant-colored value
- `features/providers/components/capability-card.tsx` -- vertical, bordered, tiny italic label
- `features/home/components/info-field.tsx` -- vertical, colored label, clickable

**Analysis:**

These look similar but serve different purposes:

| Component | Layout | Label Style | Value Style | Interactive |
|-----------|--------|-------------|-------------|-------------|
| metric-item | Horizontal (space-between) | Small muted | Bold, color variants | No |
| capability-card | Vertical, bordered | Tiny italic | Normal | No |
| info-field | Vertical | Bold uppercase, colored | Normal with opacity | Optional click |

**Recommendation:** Extract 2 components, not 3:

1. **`KeyValue`** (from metric-item) -- horizontal label-value pair with color variants. Use for inline stats/metrics.
2. **`LabeledField`** (from info-field) -- vertical label-above-value with colored label and optional click. Use for form-like displays.

capability-card is too simple (16 lines) and can be replaced by `KeyValue` with `layout="vertical"` + border className, or just left as inline JSX in the feature.

---

## Summary Table

| # | Component | Feature | Verdict | Library Name | Notes |
|---|-----------|---------|---------|-------------|-------|
| 1 | code-snippet.tsx | review | **EXTRACT** | `CodeBlock` | Pure rendering, genericize `CodeLine` type |
| 2 | diff-view.tsx | review | **EXTRACT** | `DiffView` | Already fully generic, token migration only |
| 3 | metric-item.tsx | review | **EXTRACT** | `KeyValue` | Add layout prop, token migration |
| 4 | timer.tsx | review | **GENERALIZE** | `Timer` | Add `formatter` prop, decouple from hooks pkg |
| 5 | severity-filter-group.tsx | review | **GENERALIZE** | `ToggleGroup` | Unify with #16, strip severity types |
| 6 | severity-filter-button.tsx | review | **GENERALIZE** | (part of ToggleGroup) | Becomes internal to ToggleGroup |
| 7 | fix-plan-checklist.tsx | review | **GENERALIZE** | `Checklist` | Genericize item type, keep `[x]` TUI style |
| 8 | lens-stats-table.tsx | review | **SKIP** | -- | Too simple for generic Table; use TanStack |
| 9 | activity-log.tsx | review | **SKIP** | -- | Extract `useAutoScroll` hook instead |
| 10 | log-entry.tsx | review | **SKIP** | -- | Domain-specific Badge composition |
| 11 | issue-header.tsx | review | **SKIP** | -- | Severity-coupled, trivially small |
| 12 | analysis-summary.tsx | review | **SKIP** | -- | Page-level composition, deeply domain-specific |
| 13 | capability-card.tsx | providers | **SKIP** | -- | Covered by KeyValue with vertical layout |
| 14 | dialog-footer-actions.tsx | providers | **SKIP** | -- | Too opinionated; document as pattern instead |
| 15 | model-search-input.tsx | providers | **GENERALIZE** | `SearchInput` | Unify with #20, extras stay in feature |
| 16 | model-filter-tabs.tsx | providers | **GENERALIZE** | `ToggleGroup` | Unify with #5, strip tier types |
| 17 | model-list-item.tsx | providers | **SKIP** | -- | Domain-specific, RadioGroup covers pattern |
| 18 | info-field.tsx | home | **EXTRACT** | `LabeledField` | Already generic, token migration only |
| 19 | wizard-progress.tsx | onboarding | **GENERALIZE** | `HorizontalStepper` | Genericize step type, keep `---` connectors |
| 20 | search-input.tsx | history | **GENERALIZE** | `SearchInput` | Best base for unified component |
| 21 | run-accordion-item.tsx | history | **SKIP** | -- | Domain-specific list item |
| 22 | timeline-list.tsx | history | **SKIP** | -- | Refactor to use NavigationList instead |
| 23 | theme-preview-card.tsx | settings | **SKIP** | -- | App-specific theme preview |

---

## New Library Components Recommended

Based on this audit, these components should be added to the `@stargazer/ui` library:

### From Direct Extraction (minimal changes)

| Component | Source | Effort | Priority |
|-----------|--------|--------|----------|
| `CodeBlock` | review/code-snippet.tsx | Low | P2 |
| `DiffView` | review/diff-view.tsx | Low | P2 |
| `KeyValue` | review/metric-item.tsx | Low | P2 |
| `LabeledField` | home/info-field.tsx | Low | P2 |

### From Generalization (needs rework)

| Component | Source(s) | Effort | Priority |
|-----------|-----------|--------|----------|
| `SearchInput` | history/search-input + providers/model-search-input | Medium | P1 |
| `ToggleGroup` | severity-filter-group + model-filter-tabs | Medium | P1 |
| `Checklist` | review/fix-plan-checklist | Low | P2 |
| `HorizontalStepper` | onboarding/wizard-progress | Low | P2 |
| `Timer` | review/timer | Low | P3 |

### Priority Rationale

- **P1 (SearchInput, ToggleGroup):** Multiple existing duplicates in the codebase. Unifying reduces maintenance burden and inconsistency.
- **P2 (CodeBlock, DiffView, KeyValue, LabeledField, Checklist, HorizontalStepper):** Clean extractions with clear reuse potential but only one usage site currently.
- **P3 (Timer):** Cross-package dependency makes extraction more involved. Lower reuse potential outside review feature.

---

## Token Migration Notes

Components marked for extraction need these hardcoded class replacements:

| Hardcoded Class | Semantic Replacement |
|----------------|---------------------|
| `bg-black` | `bg-background` |
| `text-gray-300` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `text-gray-500` | `text-muted` |
| `text-gray-600` | `text-muted` |
| `border-gray-700` | `border-border` |
| `border-gray-800` | `border-border` |
| `text-black` | `text-primary-foreground` |
| `text-white` | `text-primary-foreground` |
| `bg-white/5` | `bg-muted/5` |

This affects: CodeBlock (3 instances), DiffView (1), KeyValue (1), LabeledField (1), Checklist (1), SearchInput (1-2), ToggleGroup (1).
