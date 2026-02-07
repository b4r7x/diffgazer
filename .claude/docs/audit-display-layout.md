# Display & Layout Components Audit

Auditor: display-auditor
Date: 2026-02-07
Scope: Panel, Progress/Stepper, ScrollArea, FocusablePane, WizardLayout, SeverityBar, SectionHeader, and secondary candidates.

---

## 1. Panel (`containers/panel.tsx`)

**Decision: EXTRACT (as-is) -- highest-value extraction**

The Panel is a compound component (Panel + PanelHeader + PanelContent) used pervasively as the TUI-themed card/section container. Direct equivalent of shadcn Card but with TUI styling and unique header variants.

### Props

```typescript
// Panel (root container)
interface PanelProps {
  children: ReactNode;
  className?: string;
  borderless?: boolean;        // Removes border (default: false)
}

// PanelHeader (title bar)
interface PanelHeaderProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "floating" | "section" | "section-bordered";
  value?: ReactNode;           // Right-aligned value display
  valueVariant?: "default" | "success" | "success-badge" | "muted";
}

// PanelContent (body area)
interface PanelContentProps {
  children: ReactNode;
  className?: string;
  spacing?: "none" | "sm" | "md";   // Vertical spacing (default: "md")
}
```

### Header Variants (5)

| Variant | Style | Use Case |
|---------|-------|----------|
| `default` | Blue-tinted bg bar, bold uppercase, border-bottom | Primary panel title |
| `subtle` | Lighter bg, centered text, widest tracking | Secondary/decorative header |
| `floating` | Positioned -top-3, over border, blue text | Fieldset-like label |
| `section` | No bg, muted text, bold uppercase, mb-4 | In-content section divider |
| `section-bordered` | Like section + border-bottom + pb-2 mb-2 | Bordered section divider |

### Value Display Variants (4)

| Variant | Style | Use Case |
|---------|-------|----------|
| `default` | `text-tui-muted` | Plain metadata |
| `success` | `text-tui-green` | Positive status text |
| `success-badge` | Green bg/border/text badge pill | Strong positive indicator |
| `muted` | `text-tui-muted` | De-emphasized info |

### Spacing Levels (3)

| Level | Class | Pixels |
|-------|-------|--------|
| `none` | (empty) | 0 |
| `sm` | `space-y-2` | 8px |
| `md` | `space-y-4` (default) | 16px |

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L32 | `bg-tui-selection`, `text-tui-muted`, `border-tui-border` | Already semantic (tui- tokens) |
| L34 | `bg-tui-selection/30`, `text-tui-muted`, `border-tui-border` | Already semantic |
| L35 | `bg-tui-bg`, `text-tui-blue` | Already semantic |
| L36 | `text-tui-muted`, `border-tui-border` | Already semantic |
| L38 | `text-tui-muted`, `border-tui-border` | Already semantic |
| L42 | `text-tui-muted` | Already semantic |
| L43 | `text-tui-green` | Already semantic |
| L44-45 | `bg-tui-green/10`, `text-tui-green`, `border-tui-green` | Already semantic |
| L46 | `text-tui-muted` | Already semantic |

All colors use `tui-*` semantic tokens. No raw Tailwind colors. Ready for extraction.

### Keyboard Coupling

None. Panel is purely visual, no interactive behavior.

### Comparison with shadcn Card

shadcn Card has: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
Panel has: Panel, PanelHeader (with value display), PanelContent. Missing: PanelFooter, PanelTitle, PanelDescription.

**Recommendation:** Panel is more compact than shadcn Card but the header variant system + value display is a unique differentiator. Consider adding PanelFooter for completeness. The floating variant is particularly novel (fieldset-label pattern). Extract as-is, document variants thoroughly.

---

## 2. ProgressList (`progress/progress-list.tsx`)

**Decision: EXTRACT (as-is) -- unique differentiator**

Thin orchestrator that maps step data to ProgressStep components. Manages expand/collapse state externally (controlled component pattern).

### Props

```typescript
interface ProgressStepData extends BaseProgressStepData {
  content?: ReactNode;          // Extended from schema type to allow React content
}

interface ProgressListProps {
  steps: ProgressStepData[];
  expandedIds?: string[];       // Controlled: which steps are expanded
  onToggle?: (id: string) => void;  // Callback when step toggled
  className?: string;
}
```

### Schema Dependency

Extends `ProgressStepData` from `@stargazer/schemas/ui`:

```typescript
// From packages/schemas/src/ui/ui.ts
ProgressStepData = {
  id: string;
  label: string;
  status: "completed" | "active" | "pending";
  substeps?: ProgressSubstepData[];
}
```

### Hardcoded Colors

None. Only `space-y-4` spacing. All color logic delegated to ProgressStep/ProgressSubstep.

### Keyboard Coupling

None directly. Delegates to ProgressStep which has its own keyboard handling (Enter/Space).

### Comparison with MUI Stepper

MUI Stepper has: Stepper, Step, StepLabel, StepContent, StepButton, StepConnector, StepIcon.
Our Progress has: ProgressList, ProgressStep, ProgressSubstep.

Key differences:
- MUI is linear/horizontal by default; ours is vertical-only
- MUI has connector lines between steps; ours uses spacing
- Ours has expand/collapse with animation (grid-template-rows trick)
- Ours has substeps with nested badges
- Ours uses status badges (DONE/RUN/WAIT) instead of step numbers/icons

**Recommendation:** Extract the full Progress trio as a Stepper compound component. The expand/collapse animation and substep nesting are unique value. Consider renaming to `Stepper` / `StepperStep` / `StepperSubstep` for library consumers, or keep Progress* naming.

---

## 3. ProgressStep (`progress/progress-step.tsx`)

**Decision: EXTRACT (rework minor) -- core of stepper**

The main step component with CVA variants, status badges, expand/collapse animation, and keyboard interaction.

### Props

```typescript
interface ProgressStepProps extends VariantProps<typeof progressStepVariants> {
  label: string;
  status: ProgressStatus;               // "completed" | "active" | "pending"
  substeps?: ProgressSubstepData[];
  children?: ReactNode;                  // Arbitrary content when expanded
  isExpanded?: boolean;                  // Controlled expand state
  stepId?: string;                       // ID for toggle callback
  onToggle?: ((id: string) => void) | (() => void);  // Toggle callback
  className?: string;
}
```

### CVA Variants

**Step container (`progressStepVariants`):**

| Status | Style |
|--------|-------|
| `completed` | (no additional styles) |
| `active` | `bg-tui-selection py-2 -mx-3 px-3 rounded border-l-2 border-tui-blue` |
| `pending` | (no additional styles) |

**Label text (`labelVariants`):**

| Status | Style |
|--------|-------|
| `completed` | `text-tui-fg` |
| `active` | `font-bold text-tui-blue` |
| `pending` | `text-tui-muted` |

### Status Badges

```typescript
const STATUS_BADGES: Record<ProgressStatus, { label: string; variant: BadgeVariant }> = {
  completed: { label: "DONE", variant: "success" },
  active:    { label: "RUN",  variant: "info" },
  pending:   { label: "WAIT", variant: "neutral" },
};
```

Badge labels are hardcoded strings. For library extraction, these should be configurable or the badge rendering should accept a render prop.

### Expand/Collapse Mechanism

Uses CSS Grid animation trick (lines 100-116):

```tsx
<div
  className="grid transition-[grid-template-rows] duration-200 ease-in-out"
  style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
>
  <div className="overflow-hidden">
    <div className="pt-2 pl-7">
      {/* substeps + children */}
    </div>
  </div>
</div>
```

This is the `grid-template-rows: 0fr -> 1fr` animation pattern for smooth expand/collapse without JS height calculation. The outer div transitions grid rows, the inner div clips overflow.

- Duration: 200ms
- Easing: ease-in-out
- Content offset: pt-2 pl-7 (indented under badge)

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L14 | `bg-tui-selection`, `border-tui-blue` | Semantic -- OK |
| L27 | `text-tui-fg` | Semantic -- OK |
| L28 | `text-tui-blue` | Semantic -- OK |
| L29 | `text-tui-muted` | Semantic -- OK |

All semantic `tui-*` tokens. No raw colors.

### Keyboard Coupling

Lines 72-77: Built-in keyboard handler for Enter and Space:

```typescript
const handleKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleClick();
  }
};
```

Also sets `tabIndex={0}`, `role="button"`, `aria-expanded` when interactive. This is basic toggle accessibility, appropriate to keep in the component (not extract to keyboard package). It's self-contained disclosure pattern.

### Rework Needed

1. **Badge labels**: Make `STATUS_BADGES` configurable via prop or context (allow i18n or custom labels)
2. **onToggle type**: The union type `((id: string) => void) | (() => void)` with cast on L67-68 is brittle. Simplify to `(id: string) => void` only.

---

## 4. ProgressSubstep (`progress/progress-substep.tsx`)

**Decision: EXTRACT (rework minor)**

Nested substep with status-based CVA styling and inline detail/status text.

### Props

```typescript
interface ProgressSubstepProps extends ProgressSubstepData {
  className?: string;
}

// From schema:
// ProgressSubstepData = {
//   id: string;
//   tag: string;        // Badge text (e.g., "FILE", "LINT")
//   label: string;      // Substep description
//   status: "pending" | "active" | "completed" | "error";
//   detail?: string;    // Custom detail text
//   progress?: number;  // 0-100 (not used in component)
// }
```

Note: `progress` field exists in schema but is NOT rendered. Could be used for a mini progress bar.

### CVA Variants

```typescript
const substepVariants = cva("flex items-center gap-2 py-1 text-sm", {
  variants: {
    status: {
      pending:   "text-tui-muted",
      active:    "text-tui-blue font-medium animate-pulse",
      completed: "text-tui-fg",
      error:     "text-tui-red font-medium",
    },
  },
  defaultVariants: { status: "pending" },
});
```

Note: Substep has 4 statuses (adds `error`) vs ProgressStep's 3 statuses.

### Status Detail Logic (lines 46-54)

| Condition | Display |
|-----------|---------|
| `detail` provided | Shows custom detail text |
| No detail + active | Shows "analyzing..." |
| No detail + completed | Shows "done" (green) |
| No detail + error | Shows "failed" (red) |
| No detail + pending | Shows nothing |

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L9 | `text-tui-muted` | Semantic -- OK |
| L10 | `text-tui-blue`, `animate-pulse` | Semantic -- OK |
| L11 | `text-tui-fg` | Semantic -- OK |
| L12 | `text-tui-red` | Semantic -- OK |
| L47 | `text-tui-muted` | Semantic -- OK |
| L50 | `text-tui-green` | Semantic -- OK |
| L52 | `text-tui-red` | Semantic -- OK |

All semantic tokens. No raw colors.

### Rework Needed

1. **Hardcoded status text**: "analyzing...", "done", "failed" on lines 49-53 should be configurable (i18n, custom status messages). Accept a `statusLabel` prop or use a map prop.
2. **Badge variant mapping**: The if/else chain (lines 31-38) duplicates logic from ProgressStep's STATUS_BADGES. Extract to shared utility or accept badge variant directly.

### Keyboard Coupling

None. Substep is non-interactive (display only).

---

## 5. ScrollArea (`scroll-area.tsx`)

**Decision: EXTRACT (as-is)**

Lightweight scroll container with custom scrollbar styling.

### Props

```typescript
interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  orientation?: 'vertical' | 'horizontal' | 'both';   // Default: 'vertical'
  ref?: React.Ref<HTMLDivElement>;
}
```

### Implementation

Simple div wrapper with `scrollbar-thin` utility class and overflow control based on orientation. Passes through all HTML div attributes via `...props`.

### Hardcoded Colors

None. Uses only `scrollbar-thin` which depends on Tailwind scrollbar plugin/custom CSS.

### Keyboard Coupling

None. Browser-native scroll behavior.

### Comparison with shadcn/Radix ScrollArea

Radix ScrollArea provides custom scrollbar rendering (thumb, track), auto-hide behavior, and cross-browser consistency. This is much simpler -- just overflow + thin scrollbar CSS. Adequate for TUI theme where native scrollbar appearance is acceptable.

**Recommendation:** Extract as-is. It's simple but useful as a named component for consistent scroll behavior. Could be enhanced later with custom scrollbar rendering if needed.

---

## 6. FocusablePane (`focusable-pane.tsx`)

**Decision: EXTRACT (as-is)**

Visual focus indicator wrapper. Does NOT manage focus -- purely visual ring highlight.

### Props

```typescript
interface FocusablePaneProps {
  isFocused?: boolean;
  children: ReactNode;
  className?: string;
}
```

### Implementation

Renders a div with conditional `ring-1 ring-tui-blue ring-inset` when `isFocused` is true.

### Usage

Used in 3 places:
- `features/history/components/page.tsx`
- `features/review/components/issue-details-pane.tsx`
- `features/review/components/issue-list-pane.tsx`

All usages are for pane-focus indication in split-pane layouts (keyboard-driven pane switching).

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L13 | `ring-tui-blue` | Semantic -- OK. Could use `ring-tui-focus` or `ring-tui-ring` for more generic naming. |

### Keyboard Coupling

Interesting case: The component itself has NO keyboard handling, but it's the visual counterpart of keyboard navigation (used with pane focus management). This is the correct separation -- the `@stargazer/keyboard` package would drive `isFocused` state, and this component just renders the visual indicator.

**Recommendation:** Extract as-is. Clean separation of visual indicator from keyboard logic. Consider adding a `ring` color variant prop for different focus colors.

---

## 7. WizardLayout (`shared/wizard-layout.tsx`)

**Decision: REWORK -- generalize as DialogLayout or CardLayout**

Centered card with header/content/footer sections. Used for onboarding, settings pages, and trust dialogs.

### Props

```typescript
interface WizardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}
```

### Structure

```
[centered flex container]
  [max-w-lg card with border + shadow]
    [header: border-b, bg-tui-selection/30, title + subtitle]
    [content: px-6 py-6, max-h-[60vh], overflow-y-auto]
    [footer: border-t, flex justify-end gap-3]
```

### Usage

Used in 5 places:
- `features/onboarding/components/onboarding-wizard.tsx`
- `features/settings/components/storage/page.tsx`
- `features/settings/components/analysis/page.tsx`
- `features/home/components/trust-panel.tsx`
- `features/home/components/storage-wizard.tsx`

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L21 | `border-tui-border`, `bg-tui-bg` | Semantic -- OK |
| L23 | `border-tui-border`, `bg-tui-selection/30` | Semantic -- OK |
| L24 | `text-tui-blue` | Semantic -- OK. Could be `text-tui-accent` for library. |
| L28 | `text-tui-muted` | Semantic -- OK |
| L37 | `border-tui-border`, `bg-tui-bg/50` | Semantic -- OK |

### Hardcoded Layout Values

- `max-w-lg` (line 21): Fixed width. Should be a `size` variant (`sm`, `md`, `lg`).
- `max-h-[60vh]` (line 33): Fixed content height. Should be configurable.
- `shadow-2xl` (line 21): Fixed shadow. Could be a variant.
- `px-6 py-6` / `px-6 py-4`: Fixed padding.

### Keyboard Coupling

None.

### Rework Needed

1. **Rename**: `WizardLayout` implies wizard-specific usage. It's really a `CardLayout` or `DialogCard` pattern.
2. **Size variant**: Add `size?: "sm" | "md" | "lg"` controlling max-width.
3. **Header customization**: Accept `header?: ReactNode` for fully custom headers instead of just `title`/`subtitle`.
4. **Content max-height**: Make configurable or remove (let parent control).

---

## 8. SeverityBar (`severity/severity-bar.tsx`)

**Decision: REWORK -> generalize to BlockBar**

ASCII-style bar chart using Unicode block characters. Currently coupled to severity via color prop.

### Props

```typescript
interface SeverityBarProps {
  label: string;
  count: number;
  max: number;
  severity: ReviewSeverity;     // Coupled to domain type
  className?: string;
}
```

### Implementation

Renders a row: `[label (80px)] [filled blocks + empty blocks] [count]`

Uses constants from `./constants.ts`:
- `BAR_FILLED_CHAR` = U+2588 (full block)
- `BAR_EMPTY_CHAR` = U+2591 (light shade)
- `DEFAULT_BAR_WIDTH` = 20 characters
- `SEVERITY_CONFIG[severity].color` for color class

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L20 | `text-tui-muted` | Semantic -- OK |
| L23 | `{color}` from SEVERITY_CONFIG | Domain-coupled -- needs generalization |
| L23 | `text-tui-border` | Semantic -- OK (empty bar color) |
| L25 | `{color}` from SEVERITY_CONFIG | Domain-coupled |

### Generalization to BlockBar

```typescript
// Proposed generic API:
interface BlockBarProps {
  label: string;
  count: number;
  max: number;
  color: string;            // Tailwind text color class (e.g., "text-tui-red")
  barWidth?: number;        // Default: 20
  filledChar?: string;      // Default: U+2588
  emptyChar?: string;       // Default: U+2591
  className?: string;
}
```

Changes needed:
1. Replace `severity: ReviewSeverity` with `color: string`
2. Remove dependency on `SEVERITY_CONFIG`
3. Make `barWidth`, `filledChar`, `emptyChar` configurable with defaults
4. Keep label width as className customization (currently hardcoded `w-20`)

### Keyboard Coupling

None. Display only, has `aria-label` for accessibility.

---

## 9. SeverityBreakdown (`severity/severity-breakdown.tsx`)

**Decision: SKIP -- app-specific composition**

This is a thin composition component that maps `SeverityCounts` to a list of `SeverityBar` components. It's domain-specific (uses `SEVERITY_ORDER`, `ReviewSeverity`, `SEVERITY_LABELS`).

### Props

```typescript
interface SeverityBreakdownProps {
  counts: SeverityCounts;    // { blocker, high, medium, low, nit }
  className?: string;
}
```

### Rationale for Skipping

- Tightly coupled to `ReviewSeverity` domain type
- Just a loop over `SEVERITY_ORDER` with label mapping
- App can compose `BlockBar` (generalized SeverityBar) easily
- 17 lines of code, trivial to recreate

---

## 10. Severity Constants (`severity/constants.ts`)

**Decision: SKIP -- app-specific configuration**

Maps `ReviewSeverity` to display properties (icon, color, label, borderColor).

### Content

```typescript
const SEVERITY_CONFIG: Record<ReviewSeverity, SeverityConfig> = {
  blocker: { icon: "\u2716", color: "text-tui-red",    label: "BLOCKER", borderColor: "border-tui-red" },
  high:    { icon: "\u25B2", color: "text-tui-yellow",  label: "HIGH",    borderColor: "border-tui-yellow" },
  medium:  { icon: "\u25CF", color: "text-gray-400",    label: "MED",     borderColor: "border-gray-400" },
  low:     { icon: "\u25CB", color: "text-tui-blue",    label: "LOW",     borderColor: "border-tui-blue" },
  nit:     { icon: "\u00B7", color: "text-gray-500",    label: "NIT",     borderColor: "border-gray-500" },
};
```

### Hardcoded Colors (non-semantic)

| Line | Color | Issue |
|------|-------|-------|
| L13 | `text-gray-400`, `border-gray-400` | Raw Tailwind -- should be `text-tui-muted` or new `text-tui-severity-medium` |
| L15 | `text-gray-500`, `border-gray-500` | Raw Tailwind -- should be `text-tui-dim` or `text-tui-severity-nit` |

These are the only non-semantic raw Tailwind color references found in the display/layout component set.

### Rationale for Skipping

Domain-specific (ReviewSeverity). Should stay in app layer. The generalized BlockBar won't need this.

---

## 11. SectionHeader (`section-header.tsx`)

**Decision: REWORK -> merge into Panel or keep standalone with variants**

Simple styled heading component.

### Props

```typescript
interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
}
```

### Implementation

Single `<h3>` with: `text-tui-blue font-bold mb-2 uppercase text-xs tracking-wider`.

### Usage

Used in 3 places across providers, history, and review features.

### Overlap with Panel

PanelHeader's `section` variant is: `text-tui-muted font-bold uppercase text-xs tracking-wider mb-4`.
SectionHeader is: `text-tui-blue font-bold mb-2 uppercase text-xs tracking-wider`.

Key differences:
- SectionHeader uses `text-tui-blue`; PanelHeader section uses `text-tui-muted`
- SectionHeader has `mb-2`; PanelHeader section has `mb-4`
- SectionHeader renders `<h3>`; PanelHeader renders `<div>`

### Recommendation

Two options:
1. **Merge into PanelHeader**: Add a `section-blue` variant (or `accent` variant) to PanelHeader. Change PanelHeader to render semantic heading element when using section variants.
2. **Keep standalone with variants**: Add `variant?: "default" | "muted"` where default = blue, muted = tui-muted. Add `as?: "h2" | "h3" | "h4"` prop for semantic heading level.

**Recommendation: Option 2** -- keep standalone. SectionHeader is used outside of Panel contexts, and forcing PanelHeader into non-Panel contexts is awkward. Add variant and heading level props.

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L11 | `text-tui-blue` | Semantic -- OK, but should be variant-driven |

### Keyboard Coupling

None.

---

## 12. EmptyState (`empty-state.tsx`)

**Decision: EXTRACT (rework minor) -- worth expanding**

Simple empty state indicator. Useful utility but too minimal for a good library component.

### Props

```typescript
interface EmptyStateProps {
  message: string;
  variant?: "centered" | "inline";    // Default: "centered"
  className?: string;
}
```

### Hardcoded Colors

| Line | Color | Issue |
|------|-------|-------|
| L13 | `text-gray-500` | **Raw Tailwind color**. Should be `text-tui-muted`. |

### Rework Needed

1. **Fix color**: `text-gray-500` -> `text-tui-muted`
2. **Add icon/illustration slot**: `icon?: ReactNode` for empty state imagery
3. **Add action slot**: `action?: ReactNode` for CTA button
4. **Accept ReactNode message**: Change `message: string` to `message: ReactNode` (or add `description` slot)

Enhanced API:
```typescript
interface EmptyStateProps {
  message: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "centered" | "inline";
  className?: string;
}
```

This aligns with the web design guidelines requirement for empty states: "Explain why it's empty, provide clear call-to-action, use illustration if appropriate, guide user to next step."

---

## 13. StatusRow (`status-row.tsx`)

**Decision: EXTRACT (as-is) -- generic key-value row**

Label-value row for displaying status/metadata. Generic enough for library use.

### Props

```typescript
interface StatusRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}
```

### Implementation

Flex row with label (left, muted) and value (right), separated by border-bottom.

### Usage

Only 1 import currently (provider-details.tsx) but the pattern is universally useful for any key-value display (settings, details panels, metadata).

### Hardcoded Colors

| Line | Color | Recommendation |
|------|-------|----------------|
| L12 | `border-tui-border/30` | Semantic -- OK |
| L13 | `text-tui-muted` | Semantic -- OK |

### Recommendation

Extract as-is. Consider renaming to `KeyValueRow` or `DescriptionRow` for clarity. The pattern maps well to an HTML `<dl>` semantically.

---

## 14. AsciiLogo (`ascii-logo.tsx`)

**Decision: SKIP -- app branding**

Renders ASCII art text using `getFigletText` from `@stargazer/hooks`.

### Rationale

- Depends on `@stargazer/hooks` (app-specific figlet integration)
- App branding component
- No generic value for library consumers

---

## 15. PathList (`path-list.tsx`)

**Decision: SKIP -- too app-specific**

Grid display of label:path pairs using CSS Grid.

### Props

```typescript
interface PathListProps {
  title: string;
  paths: Record<string, string>;
  labelWidth?: string;            // Default: "80px"
}
```

### Hardcoded Colors

| Line | Color | Issue |
|------|-------|-------|
| L13 | `text-tui-violet` | Semantic -- but violet is unusual, only used here |
| L18 | `text-tui-muted` | Semantic -- OK |
| L19 | `text-tui-fg` | Semantic -- OK |

### Rationale for Skipping

- Very specific layout (title + key-value grid with inline style)
- Uses `Record<string, string>` which is limiting (no ReactNode values)
- Only useful for file path display scenarios
- 16 lines, trivial to recreate
- If needed, StatusRow could serve a similar purpose

---

## 16. IssueListItem (`issue/issue-list-item.tsx`)

**Decision: SKIP -- domain-coupled**

Interactive list item for review issues with severity icons and selection state.

### Props

```typescript
interface IssueListItemProps {
  issue: ReviewIssue;           // Domain type
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}
```

### Hardcoded Colors

| Line | Color | Issue |
|------|-------|-------|
| L21 | `bg-tui-blue text-black` | Selected state -- `text-black` is raw |
| L22 | `hover:bg-tui-selection` | Semantic -- OK |
| L27 | `text-black` | Raw color for selected state |
| L32 | `config.color` from SEVERITY_CONFIG | Domain-coupled |
| L37 | `text-tui-muted` | Semantic -- OK |

### Rationale for Skipping

- Tightly coupled to `ReviewIssue` domain type
- References `SEVERITY_CONFIG` constants
- Selected state uses `text-black` which assumes dark theme (should be `text-tui-bg` or similar inverse token)
- Would need significant rework to generalize (becomes a ListItem + color config)

### Note on Color Issue

`text-black` on lines 21, 27 is a theme-breaking raw color. In light mode this would be invisible against a blue background. Should use a semantic inverse token like `text-tui-bg` or `text-tui-selection-fg`.

---

## Summary Table

| # | Component | Decision | Notes |
|---|-----------|----------|-------|
| 1 | Panel | **EXTRACT** | Highest value. 5 header + 4 value + 3 spacing variants. All semantic colors. |
| 2 | ProgressList | **EXTRACT** | Orchestrator. Clean controlled component pattern. |
| 3 | ProgressStep | **EXTRACT (minor rework)** | Fix onToggle type union. Make badge labels configurable. |
| 4 | ProgressSubstep | **EXTRACT (minor rework)** | Make status text configurable. Fix badge variant mapping duplication. |
| 5 | ScrollArea | **EXTRACT** | Simple but useful. Ready as-is. |
| 6 | FocusablePane | **EXTRACT** | Clean visual-only focus indicator. Pairs with keyboard package. |
| 7 | WizardLayout | **REWORK** | Generalize: rename, add size variant, flexible header. |
| 8 | SeverityBar | **REWORK -> BlockBar** | Replace `severity` prop with `color` prop. Make bar chars configurable. |
| 9 | SeverityBreakdown | **SKIP** | Domain composition, trivial to recreate. |
| 10 | Severity Constants | **SKIP** | Domain config. Has 2 raw color issues (gray-400, gray-500). |
| 11 | SectionHeader | **REWORK** | Add variant + heading level props. Keep standalone. |
| 12 | EmptyState | **REWORK** | Fix raw gray-500. Add icon/action/description slots. |
| 13 | StatusRow | **EXTRACT** | Generic key-value row. Rename to KeyValueRow. |
| 14 | AsciiLogo | **SKIP** | App branding, depends on figlet. |
| 15 | PathList | **SKIP** | Too specific, trivial to recreate. |
| 16 | IssueListItem | **SKIP** | Domain-coupled. Has `text-black` theme-breaking color. |

---

## Raw/Non-Semantic Color Issues Found

| File | Line | Color | Fix |
|------|------|-------|-----|
| `severity/constants.ts` | L13 | `text-gray-400` / `border-gray-400` | `text-tui-muted` / `border-tui-muted` |
| `severity/constants.ts` | L15 | `text-gray-500` / `border-gray-500` | `text-tui-dim` (new token) or `text-tui-muted` |
| `empty-state.tsx` | L13 | `text-gray-500` | `text-tui-muted` |
| `issue/issue-list-item.tsx` | L21,27 | `text-black` | `text-tui-bg` or new inverse token |

---

## Keyboard Coupling Summary

| Component | Keyboard Behavior | Extraction Impact |
|-----------|-------------------|-------------------|
| Panel | None | Clean |
| ProgressStep | Enter/Space toggle (lines 72-77) | Self-contained disclosure; keep in component |
| ScrollArea | Browser-native | Clean |
| FocusablePane | None (visual only) | Clean -- keyboard package drives `isFocused` |
| WizardLayout | None | Clean |
| SeverityBar | None | Clean |
| SectionHeader | None | Clean |
| EmptyState | None | Clean |
| StatusRow | None | Clean |

Only ProgressStep has keyboard handling, and it's the standard disclosure pattern (Enter/Space to toggle). This should stay in the component, not move to the keyboard package. The keyboard package would handle higher-level concerns like pane focus management (which drives FocusablePane).

---

## Proposed Library Organization

```
@stargazer/ui/
├── panel/
│   ├── panel.tsx              # Panel, PanelHeader, PanelContent
│   └── index.ts
├── stepper/                   # Renamed from progress/
│   ├── stepper-list.tsx       # ProgressList -> StepperList
│   ├── stepper-step.tsx       # ProgressStep -> StepperStep
│   ├── stepper-substep.tsx    # ProgressSubstep -> StepperSubstep
│   └── index.ts
├── scroll-area/
│   ├── scroll-area.tsx
│   └── index.ts
├── focusable-pane/
│   ├── focusable-pane.tsx
│   └── index.ts
├── card-layout/               # Renamed from wizard-layout
│   ├── card-layout.tsx
│   └── index.ts
├── block-bar/                 # Renamed from severity-bar
│   ├── block-bar.tsx
│   └── index.ts
├── section-header/
│   ├── section-header.tsx
│   └── index.ts
├── empty-state/
│   ├── empty-state.tsx
│   └── index.ts
├── key-value-row/             # Renamed from status-row
│   ├── key-value-row.tsx
│   └── index.ts
```

Total: 9 components (12 sub-components) for extraction from this audit category.
