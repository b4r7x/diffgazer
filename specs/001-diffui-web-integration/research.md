# Research: Diff-UI Web Integration

**Branch**: `001-diffui-web-integration` | **Date**: 2026-03-24

## 1. Component Mapping

### Decision: Re-export facade with per-component categorization

All @diffgazer/ui exports were mapped against diff-ui's 60-item registry. Result: 12 direct matches, 10 adaptable, 2 local-only.

### Direct Matches (re-export as-is)

| @diffgazer/ui Export | diff-ui Import Path | Notes |
| -------------------- | ------------------- | ----- |
| Button, ButtonProps, buttonVariants | `diffui/components/button` | Identical API |
| Badge, BadgeProps, badgeVariants | `diffui/components/badge` | Identical API |
| Input, InputProps | `diffui/components/input` | Same API |
| Textarea, TextareaProps | `diffui/components/textarea` | Split from Input in diff-ui |
| inputVariants | `diffui/lib/input-variants` | Shared lib |
| ScrollArea, ScrollAreaProps | `diffui/components/scroll-area` | Identical |
| BlockBar, BlockBarProps | `diffui/components/block-bar` | Identical |
| SectionHeader, SectionHeaderProps | `diffui/components/section-header` | Identical |
| EmptyState, EmptyStateProps | `diffui/components/empty-state` | Identical |
| Tabs, TabsList, TabsTrigger, TabsContent + Props | `diffui/components/tabs` | Identical |
| Menu, MenuItem, MenuDivider + Props | `diffui/components/menu` | Identical |
| SearchInput, SearchInputProps | `diffui/components/search-input` | Identical |
| ToggleGroup, ToggleGroupProps, ToggleGroupItem | `diffui/components/toggle-group` | Identical |
| DiffView, DiffViewProps | `diffui/components/diff-view` | Identical (diff-ui adds extra utility exports) |
| KeyValue, KeyValueProps + subtypes | `diffui/components/key-value` | Identical |
| HorizontalStepper + Props | `diffui/components/horizontal-stepper` | Identical |

### Adaptable (re-export with wrapper or type mapping)

| @diffgazer/ui Export | diff-ui Import Path | Adaptation Needed |
| -------------------- | ------------------- | ----------------- |
| Callout, CalloutProps | `diffui/components/callout` | diff-ui uses compound pattern (Callout.Icon, .Title, .Content, .Dismiss). Wrapper needed to preserve flat API. |
| Checkbox, CheckboxGroup, CheckboxItem + Props | `diffui/components/checkbox` | diff-ui uses Checkbox.Group, Checkbox.Item compound. Wrapper to map named exports. |
| Radio, RadioGroup, RadioGroupItem + Props | `diffui/components/radio` | diff-ui uses RadioGroup.Item compound. Wrapper to map named exports. |
| Panel, PanelHeader, PanelContent + Props | `diffui/components/panel` | diff-ui uses Panel.Header, Panel.Content, Panel.Footer compound. Wrapper to map named exports. |
| Stepper, StepperStep, StepperSubstep + Props | `diffui/components/stepper` | diff-ui adds Stepper.Trigger, Stepper.Content. Wrapper to map existing named exports. |
| Toast, ToastProvider, useToast + Props | `diffui/components/toast` | Different architecture: diffgazer uses context+hooks, diff-ui uses store+function. Needs adapter layer. |
| Dialog + 10 sub-exports | `diffui/components/dialog` | diff-ui adds DialogKeyboardHints, DialogAction; no separate DialogOverlay. Mostly compatible but needs overlay mapping. |
| NavigationList, NavigationListItem + Props | `diffui/components/navigation-list` | diff-ui is a superset with extra sub-components. Direct re-export works for base, extras are bonus. |
| CodeBlock, CodeBlockLine + Props | `diffui/components/code-block` | diff-ui uses CodeBlock.Content, .Header, .Label, .Line compound. Wrapper for CodeBlockLine. |
| CardLayout, CardLayoutProps | `diffui/components/card` | Different purpose: diffgazer's CardLayout is a page layout; diff-ui's Card is a primitive. Keep as LOCAL_ONLY or adapt. |

### Local Only (keep in @diffgazer/ui)

| Export | Reason |
| ------ | ------ |
| cn (utility) | diff-ui has cn internally but @diffgazer/ui can re-export from `diffui/lib/utils` |
| Checklist, ChecklistProps, ChecklistItem | No diff-ui equivalent |
| LabeledField, LabeledFieldProps, LabeledFieldColor | Different use case from diff-ui's Label |
| CardLayout, CardLayoutProps | Page layout component, not a card primitive |
| Severity-related components (SeverityBadge, etc.) | Domain-specific to diffgazer |
| Progress indicators | Domain-specific to diffgazer |
| ASCII logo | Domain-specific to diffgazer |

**Rationale**: The re-export facade approach means `@diffgazer/ui` keeps its full public API. Consumers never know the implementation changed. Direct matches are simple re-exports. Adaptable items need thin wrappers that map the compound component pattern (e.g., `Checkbox.Group` → `CheckboxGroup`).

**Alternatives considered**: Direct replacement (rejected — too many files to touch), page-by-page migration (rejected — user chose all-at-once).

## 2. Token Override Strategy

### Decision: Layer diffgazer's color values over diff-ui's base theme via CSS cascade

Both themes use identical CSS custom property names (`--tui-*`, `--primary`, `--secondary`, etc.) and identical selectors (`:root, [data-theme="dark"]` / `[data-theme="light"]`). The override is straightforward: load diff-ui's theme first, then a diffgazer override sheet that redefines values.

### Key Color Differences (Dark Mode)

| Token | diff-ui | diffgazer | Override needed |
| ----- | ------- | --------- | --------------- |
| `--tui-bg` | `#0a0a0a` | `#0d1117` | Yes |
| `--tui-fg` | `#e5e5e5` | `#c9d1d9` | Yes |
| `--tui-blue` | `#ccccff` | `#58a6ff` | Yes |
| `--tui-violet` | `#787878` | `#bc8cff` | Yes |
| `--tui-green` | `#e5e5e5` | `#3fb950` | Yes |
| `--tui-border` | `#606060` | `#30363d` | Yes |
| `--tui-muted` | `#787878` | `#6e7681` | Yes |
| `--tui-red` | `#ff7b72` | `#ff7b72` | No (same) |
| `--tui-yellow` | `#d29922` | `#d29922` | No (same) |

### Semantic Token Differences

| Token | diff-ui | diffgazer | Override needed |
| ----- | ------- | --------- | --------------- |
| `--primary` | `var(--tui-fg)` (gray) | `var(--tui-blue)` | Yes |
| `--accent` | `var(--tui-highlight)` (white) | `var(--tui-blue)` | Yes |
| `--ring` | `var(--tui-fg)` (gray) | `var(--tui-blue)` | Yes |

### Tokens Only in diffgazer (must preserve)

- `--severity-blocker/high/medium/low/nit` (5 tokens)
- `--status-running/complete/pending` (3 tokens)

### Tokens Only in diff-ui (can adopt)

- `--code-comment/string/number/keyword/function/tag/attr/parameter/operator/variable/type` (11 code syntax tokens)
- `--action`, `--action-foreground` (2 tokens)
- `--tui-dim`, `--tui-highlight`, `--tui-highlight-fg` (3 tokens, new primitives)
- 8 additional animations (slide-out, directional variants)

### CSS Loading Order

Current: `@import "tailwindcss"` → `@import "@diffgazer/ui/sources.css"` → `@import "@diffgazer/ui/theme.css"`

New: `@import "tailwindcss"` → `@import "diffui/theme.css"` (base) → `@import "@diffgazer/ui/theme-overrides.css"` (color overrides + domain tokens) → `@import "@diffgazer/ui/sources.css"`

**Rationale**: CSS cascade ensures later declarations win. diff-ui provides the structural foundation (animations, utilities, base tokens). diffgazer overrides only the color values and adds domain-specific tokens. New diff-ui tokens automatically available as fallback.

**Alternatives considered**: Forking diff-ui's theme entirely (rejected — loses automatic updates), using CSS layers (rejected — adds complexity, cascade order is sufficient).

## 3. Workspace Linking

### Decision: Add `diffui: "workspace:*"` to @diffgazer/ui package.json

Following the established pattern used by keyscope (`keyscope: "workspace:*"`). The dependency lives in `@diffgazer/ui`'s package.json since it's the re-export facade, not in the web app directly.

The pnpm workspace already includes `diff-ui/packages/npm` in its packages list, so no workspace config changes needed.

**Rationale**: Consistent with existing workspace patterns. The npm package at `diff-ui/packages/npm` exports via subpath exports (`diffui/components/*`, `diffui/hooks/*`, `diffui/lib/*`).

## 4. cn() Utility

### Decision: Re-export from diff-ui

Both packages define `cn()` identically (clsx + tailwind-merge). `@diffgazer/ui` should re-export from `diffui/lib/utils` and remove its local copy.

**Rationale**: Single source of truth. diff-ui is the upstream library.
