# Design Token & Color System Audit

Comprehensive audit of Stargazer's design token system for extraction into `@stargazer/ui`.

---

## 1. Token Inventory

### 1.1 Palette Layer (`--tui-*`)

Core design primitives. These are the source-of-truth colors.

| Token | Dark Value | Light Value | Category | Status |
|-------|-----------|-------------|----------|--------|
| `--tui-bg` | `#0d1117` | `#ffffff` | palette | KEEP |
| `--tui-fg` | `#c9d1d9` | `#24292f` | palette | KEEP |
| `--tui-blue` | `#58a6ff` | `#0969da` | palette | KEEP |
| `--tui-violet` | `#bc8cff` | `#8250df` | palette | KEEP |
| `--tui-green` | `#3fb950` | `#1a7f37` | palette | KEEP |
| `--tui-red` | `#ff7b72` | `#cf222e` | palette | KEEP |
| `--tui-yellow` | `#d29922` | `#9a6700` | palette | KEEP |
| `--tui-border` | `#30363d` | `#d0d7de` | palette | KEEP |
| `--tui-selection` | `#1f2428` | `#ddf4ff` | palette | KEEP |
| `--tui-muted` | `#6e7681` | `#57606a` | palette | KEEP |
| `--tui-input-bg` | `#010409` | `#f6f8fa` | palette | KEEP |
| `--tui-font-mono` | JetBrains Mono stack | (same) | font | KEEP |

### 1.2 Semantic Layer (shadcn-compatible bare names)

These map palette tokens to semantic roles.

| Token | Dark Value | Light Value | Category | Status |
|-------|-----------|-------------|----------|--------|
| `--background` | `var(--tui-bg)` | `var(--tui-bg)` | semantic | KEEP |
| `--foreground` | `var(--tui-fg)` | `var(--tui-fg)` | semantic | KEEP |
| `--background0` | `var(--tui-bg)` | `var(--tui-bg)` | semantic | DEAD - identical to --background |
| `--foreground0` | `var(--tui-fg)` | `var(--tui-fg)` | semantic | DEAD - identical to --foreground |
| `--primary` | `var(--tui-blue)` | `var(--tui-blue)` | semantic | KEEP |
| `--primary-foreground` | `var(--tui-bg)` | `#ffffff` | semantic | KEEP |
| `--secondary` | `var(--tui-selection)` | `var(--tui-selection)` | semantic | KEEP |
| `--secondary-foreground` | `var(--tui-fg)` | `var(--tui-fg)` | semantic | KEEP |
| `--muted` | `#6e7681` | `#57606a` | semantic | KEEP (but should ref --tui-muted) |
| `--muted-foreground` | `#484f58` | `#8c959f` | semantic | KEEP |
| `--border` | `var(--tui-border)` | `var(--tui-border)` | semantic | KEEP |
| `--input` | `var(--tui-selection)` | `#f6f8fa` | semantic | KEEP |
| `--destructive` | `var(--tui-red)` | `var(--tui-red)` | semantic | KEEP |
| `--destructive-foreground` | `var(--tui-bg)` | `#ffffff` | semantic | KEEP |

### 1.3 Domain Tokens

| Token | Dark Value | Light Value | Category | Status |
|-------|-----------|-------------|----------|--------|
| `--severity-blocker` | `var(--tui-red)` | `var(--tui-red)` | severity | KEEP |
| `--severity-high` | `var(--tui-yellow)` | `var(--tui-yellow)` | severity | KEEP |
| `--severity-medium` | `#6e7681` | `#57606a` | severity | KEEP |
| `--severity-low` | `var(--tui-blue)` | `var(--tui-blue)` | severity | KEEP |
| `--tui-severity-blocker` | `var(--tui-red)` | `var(--tui-red)` | severity | DUPLICATE of --severity-blocker |
| `--tui-severity-high` | `var(--tui-yellow)` | `var(--tui-yellow)` | severity | DUPLICATE of --severity-high |
| `--tui-severity-medium` | `#6e7681` | `#57606a` | severity | DUPLICATE of --severity-medium |
| `--tui-severity-low` | `#484f58` | `#8c959f` | severity | DUPLICATE + DIFFERENT values |
| `--status-running` | `var(--tui-blue)` | `var(--tui-blue)` | status | KEEP |
| `--status-complete` | `var(--tui-green)` | `var(--tui-green)` | status | KEEP |
| `--status-pending` | `#6e7681` | `#57606a` | status | KEEP |

### 1.4 Utility Tokens

| Token | Value | Category | Status |
|-------|-------|----------|--------|
| `--trans-fast` | `0.15s ease` | animation | KEEP |
| `--radius` | `0.25rem` (4px) | radius | KEEP |

### 1.5 Tailwind @theme Bridge (`--color-*`)

Defined in both `theme.css` (`:root` + `[data-theme="light"]`) AND `index.css` (`@theme`).

| @theme Token | Source | Status |
|---|---|---|
| `--color-tui-bg` | `var(--tui-bg)` | KEEP - palette bridge |
| `--color-tui-fg` | `var(--tui-fg)` | KEEP - palette bridge |
| `--color-tui-blue` | `var(--tui-blue)` | KEEP - palette bridge |
| `--color-tui-violet` | `var(--tui-violet)` | KEEP - palette bridge |
| `--color-tui-green` | `var(--tui-green)` | KEEP - palette bridge |
| `--color-tui-red` | `var(--tui-red)` | KEEP - palette bridge |
| `--color-tui-yellow` | `var(--tui-yellow)` | KEEP - palette bridge |
| `--color-tui-border` | `var(--tui-border)` | KEEP - palette bridge |
| `--color-tui-selection` | `var(--tui-selection)` | KEEP - palette bridge |
| `--color-tui-muted` | `var(--tui-muted)` | DUPLICATE - in theme.css AND index.css |
| `--color-tui-input-bg` | `var(--tui-input-bg)` | DUPLICATE - in theme.css AND index.css (not in @theme) |
| `--color-background` | `var(--background)` | KEEP - semantic bridge |
| `--color-foreground` | `var(--foreground)` | KEEP - semantic bridge |
| `--color-card` | `var(--secondary)` | KEEP - shadcn compat |
| `--color-card-foreground` | `var(--secondary-foreground)` | KEEP - shadcn compat |
| `--color-popover` | `var(--secondary)` | KEEP - shadcn compat |
| `--color-popover-foreground` | `var(--secondary-foreground)` | KEEP - shadcn compat |
| `--color-primary` | `var(--primary)` | KEEP - semantic bridge |
| `--color-primary-foreground` | `var(--primary-foreground)` | KEEP - semantic bridge |
| `--color-secondary` | `var(--secondary)` | KEEP - semantic bridge |
| `--color-secondary-foreground` | `var(--secondary-foreground)` | KEEP - semantic bridge |
| `--color-muted` | `var(--muted)` | KEEP - semantic bridge |
| `--color-muted-foreground` | `var(--muted-foreground)` | KEEP - semantic bridge |
| `--color-accent` | `var(--tui-blue)` | KEEP - semantic bridge |
| `--color-accent-foreground` | `var(--primary-foreground)` | KEEP - semantic bridge |
| `--color-destructive` | `var(--destructive)` | KEEP - semantic bridge |
| `--color-destructive-foreground` | `var(--destructive-foreground)` | KEEP - semantic bridge |
| `--color-border` | `var(--border)` | DUPLICATE - in theme.css AND index.css |
| `--color-input` | `var(--input)` | KEEP - semantic bridge |
| `--color-ring` | `var(--tui-blue)` | KEEP - semantic bridge |
| `--color-severity-blocker` | `var(--severity-blocker)` | KEEP - domain bridge |
| `--color-severity-high` | `var(--severity-high)` | KEEP - domain bridge |
| `--color-severity-medium` | `var(--severity-medium)` | KEEP - domain bridge |
| `--color-severity-low` | `var(--severity-low)` | KEEP - domain bridge |
| `--color-status-running` | `var(--status-running)` | KEEP - domain bridge |
| `--color-status-complete` | `var(--status-complete)` | KEEP - domain bridge |
| `--color-status-pending` | `var(--status-pending)` | KEEP - domain bridge |

### 1.6 Radius Tokens (@theme)

| Token | Value | Status |
|-------|-------|--------|
| `--radius-lg` | `var(--radius)` = 4px | KEEP |
| `--radius-md` | `calc(var(--radius) - 2px)` = 2px | KEEP |
| `--radius-sm` | `calc(var(--radius) - 4px)` = **0px** | BUG - evaluates to 0 |

### 1.7 Animation Tokens (@theme)

| Token | Value | Status |
|-------|-------|--------|
| `--animate-fade-in` | `fade-in 0.2s ease-out` | KEEP |
| `--animate-slide-in` | `slide-in 0.2s ease-out` | KEEP |
| `--animate-slide-in-right` | `slide-in-right 0.2s ease-out` | KEEP |
| `--animate-slide-out-right` | `slide-out-right 0.15s ease-in forwards` | KEEP |

---

## 2. Known Bugs

### BUG-1: `--radius-sm` evaluates to 0px

```css
--radius: 0.25rem;           /* = 4px */
--radius-sm: calc(var(--radius) - 4px);  /* = 4px - 4px = 0px */
```

**Fix:** Change `--radius` base to `0.5rem` (8px) to match shadcn convention, or change `--radius-sm` to `max(calc(var(--radius) - 4px), 2px)`.

### BUG-2: Duplicate severity token systems with conflicting values

Two parallel severity systems exist:

| Severity | `--severity-*` | `--tui-severity-*` | Match? |
|----------|---------------|---------------------|--------|
| blocker | `var(--tui-red)` | `var(--tui-red)` | YES |
| high | `var(--tui-yellow)` | `var(--tui-yellow)` | YES |
| medium | `#6e7681` | `#6e7681` | YES |
| low | `var(--tui-blue)` | `#484f58` | **NO** |

`--tui-severity-low` uses `#484f58` (very dark gray) while `--severity-low` uses `var(--tui-blue)`. The `--severity-*` system is the one bridged to Tailwind via `@theme`. The `--tui-severity-*` system is unused in component code.

**Fix:** Remove entire `--tui-severity-*` system. Only `--severity-*` is needed.

### BUG-3: `--color-tui-*` bridge tokens defined in TWO places

The `--color-tui-*` tokens are defined in BOTH:
1. `theme.css` inside `:root` and `[data-theme="light"]` blocks
2. `index.css` inside `@theme` block

The `@theme` block is what Tailwind 4 reads. The `:root`/`[data-theme]` definitions are redundant CSS custom properties that serve no purpose since Tailwind reads from `@theme`.

**Fix:** Remove `--color-*` definitions from `theme.css` `:root` and `[data-theme="light"]` blocks. Keep only in `@theme`.

### BUG-4: `--muted` uses hardcoded hex instead of `var(--tui-muted)`

```css
/* In :root */
--muted: #6e7681;          /* Should be var(--tui-muted) */
--tui-muted: #6e7681;      /* Same value, not referenced */
```

Same in light theme. The values happen to match, but the semantic token should reference the palette token for consistency.

**Fix:** `--muted: var(--tui-muted);`

### BUG-5: Dead tokens `--background0` and `--foreground0`

These are identical to `--background` and `--foreground`. Zero usage in any component file.

**Fix:** Remove `--background0` and `--foreground0` from both theme blocks.

---

## 3. Hardcoded Color Audit

### 3.1 Summary Statistics

| Pattern | Occurrences | Files | Theme-safe? |
|---------|-------------|-------|-------------|
| `text-gray-*` | 69 | 36 | NO - breaks light theme |
| `border-gray-*` | ~8 | 5 | NO - breaks light theme |
| `bg-gray-*` | 0 | 0 | N/A |
| `text-black` | ~25 | 13 | MIXED - some intentional (inverted bg), some problematic |
| `bg-black` | ~4 | 3 | NO - should use semantic token |
| `text-white` | ~8 | 5 | MIXED - some intentional (inverted bg), some problematic |
| `bg-black/60` | 1 | 1 | OK - overlay backdrop |
| `bg-white/5` | 1 | 1 | NO - should use tui-selection |
| `text-red-400` | 1 | 1 | NO - should use tui-red |
| `text-white/70` | 1 | 1 | NO - breaks light theme |
| tui-* tokens (correct) | 189 | 69 | YES |

### 3.2 Detailed Hardcoded Color Instances

#### `text-gray-300` (should be `text-tui-fg` or `text-tui-fg/80`)

| File | Line | Exact Class | Replacement | Breaks Light? |
|------|------|-------------|-------------|---------------|
| `features/review/components/issue-details-pane.tsx` | 60 | `text-gray-300` | `text-tui-fg/80` | YES |
| `features/review/components/issue-details-pane.tsx` | 106 | `text-gray-300` | `text-tui-fg/80` | YES |
| `features/review/components/issue-details-pane.tsx` | 116 | `text-gray-300` | `text-tui-fg/80` | YES |
| `features/review/components/issue-header.tsx` | 14 | `text-gray-300` (fallback) | `text-tui-muted` | YES |
| `features/review/components/lens-stats-table.tsx` | 20 | `text-gray-300` | `text-tui-fg/80` | YES |

#### `text-gray-400` (should be `text-tui-muted`)

| File | Line | Exact Class | Replacement | Breaks Light? |
|------|------|-------------|-------------|---------------|
| `components/ui/severity/constants.ts` | 13 | `text-gray-400` (medium severity) | `text-severity-medium` | YES |
| `features/review/components/analysis-summary.tsx` | 36 | `text-gray-400` | `text-tui-muted` | YES |
| `features/review/components/api-key-missing-view.tsx` | 35 | `text-gray-400` | `text-tui-muted` | YES |
| `features/review/components/no-changes-view.tsx` | 49 | `text-gray-400` | `text-tui-muted` | YES |
| `features/review/components/review-progress-view.tsx` | 84 | `text-gray-400` | `text-tui-muted` | YES |
| `features/review/components/code-snippet.tsx` | 13 | `text-gray-400` | `text-tui-muted` | YES |
| `features/review/components/metric-item.tsx` | 19 | `text-gray-400` | `text-tui-muted` | YES |
| `features/review/components/fix-plan-checklist.tsx` | 27 | `text-gray-400` (strikethrough) | `text-tui-muted` | YES |
| `features/history/components/timeline-list.tsx` | 50 | `text-gray-400` | `text-tui-muted` | YES |
| `features/home/components/info-field.tsx` | 21 | `text-gray-400` (muted variant) | `text-tui-muted` | YES |
| `features/providers/components/model-select-dialog/model-list-item.tsx` | 33 | `text-gray-400` | `text-tui-muted` | YES |

#### `text-gray-500` (should be `text-tui-muted` or `text-muted-foreground`)

| File | Line | Exact Class | Replacement | Breaks Light? |
|------|------|-------------|-------------|---------------|
| `app/routes/__root.tsx` | 25 | `text-gray-500` | `text-tui-muted` | YES |
| `app/routes/__root.tsx` | 50 | `text-gray-500` | `text-tui-muted` | YES |
| `app/routes/help.tsx` | 9 | `text-gray-500` | `text-tui-muted` | YES |
| `components/ui/toast/toast.tsx` | 89 | `text-gray-500` | `text-tui-muted` | YES |
| `components/ui/severity/constants.ts` | 15 | `text-gray-500` (nit severity) | `text-muted-foreground` | YES |
| `components/ui/empty-state.tsx` | 13 | `text-gray-500` | `text-tui-muted` | YES |
| `components/shared/api-key-method-selector.tsx` | 55 | `text-gray-500` | `text-tui-muted` | YES |
| `components/shared/api-key-method-selector.tsx` | 88 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/agent-board.tsx` | 37 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/analysis-summary.tsx` | 92 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/context-snapshot-preview.tsx` | 20 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/context-snapshot-preview.tsx` | 23 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/issue-details-pane.tsx` | 143 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/issue-header.tsx` | 21 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/issue-preview-item.tsx` | 45 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/issue-preview-item.tsx` | 51 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/review-progress-view.tsx` | 50 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/review-progress-view.tsx` | 62 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/review-progress-view.tsx` | 86 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/review-container.tsx` | 65 | `text-gray-500` | `text-tui-muted` | YES |
| `features/review/components/issue-list-pane.tsx` | 63 | `text-gray-500` | `text-tui-muted` | YES |
| `features/settings/components/storage/page.tsx` | 66 | `text-gray-500` | `text-tui-muted` | YES |
| `features/settings/components/analysis/page.tsx` | 90, 101, 133, 149, 154 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/provider-details.tsx` | 42, 51, 105, 115 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/capability-card.tsx` | 12 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/api-key-dialog/api-key-footer.tsx` | 29, 40 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/model-select-dialog/model-list.tsx` | 35 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/model-select-dialog/model-select-dialog.tsx` | 126, 152 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/model-select-dialog/model-search-input.tsx` | 70 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/model-select-dialog/dialog-footer-actions.tsx` | 28, 41 | `text-gray-500` | `text-tui-muted` | YES |
| `features/providers/components/model-select-dialog/model-list-item.tsx` | 55 | `text-gray-500` | `text-tui-muted` | YES |
| `features/history/components/search-input.tsx` | 44 | `placeholder:text-gray-500` | `placeholder:text-tui-muted` | YES |

#### `text-gray-600` (should be `text-muted-foreground`)

| File | Line | Exact Class | Replacement | Breaks Light? |
|------|------|-------------|-------------|---------------|
| `components/shared/api-key-method-selector.tsx` | 89 | `text-gray-600` | `text-muted-foreground` | YES |
| `features/review/components/code-snippet.tsx` | 16 | `text-gray-600` | `text-muted-foreground` | YES |
| `features/review/components/review-progress-view.tsx` | 199 | `text-gray-600` | `text-muted-foreground` | YES |
| `features/history/components/timeline-list.tsx` | 54 | `text-gray-600` | `text-muted-foreground` | YES |
| `features/settings/components/hub/page.tsx` | 104 | `text-gray-600` | `text-muted-foreground` | YES |
| `features/providers/components/api-key-dialog/api-key-dialog.tsx` | 142 | `text-gray-600` | `text-muted-foreground` | YES |
| `features/providers/components/model-select-dialog/model-search-input.tsx` | 54 | `placeholder:text-gray-600` | `placeholder:text-muted-foreground` | YES |
| `features/providers/components/model-select-dialog/model-list-item.tsx` | 39 | `text-gray-600` | `text-muted-foreground` | YES |

#### `border-gray-*` (should use border-tui-border)

| File | Line | Exact Class | Replacement | Breaks Light? |
|------|------|-------------|-------------|---------------|
| `components/ui/severity/constants.ts` | 13 | `border-gray-400` (medium) | `border-severity-medium` | YES |
| `components/ui/severity/constants.ts` | 15 | `border-gray-500` (nit) | `border-muted-foreground` | YES |
| `features/review/components/code-snippet.tsx` | 16 | `border-gray-700` | `border-tui-border` | YES |
| `features/review/components/issue-preview-item.tsx` | 32 | `border-gray-800` | `border-tui-border` | YES |
| `features/review/components/lens-stats-table.tsx` | 15 | `border-gray-800` | `border-tui-border` | YES |
| `features/review/components/lens-stats-table.tsx` | 26 | `border-gray-800/50` | `border-tui-border/50` | YES |
| `features/settings/components/hub/page.tsx` | 106 | `text-gray-700` | `text-muted-foreground` | YES |

#### `bg-black` (should use `bg-tui-bg` or semantic token)

| File | Line | Exact Class | Replacement | Breaks Light? |
|------|------|-------------|-------------|---------------|
| `features/review/components/code-snippet.tsx` | 13 | `bg-black` | `bg-tui-bg` | YES |
| `features/review/components/diff-view.tsx` | 10 | `bg-black` | `bg-tui-bg` | YES |
| `components/ui/dialog/dialog-content.tsx` | 75 | `bg-black/60` | OK - overlay backdrop (intentional) | NO |

#### `text-black` usage analysis

Most `text-black` usage is INTENTIONAL - used on inverted backgrounds (e.g., `bg-tui-blue text-black`, `bg-tui-fg text-black`). These represent the "foreground color on colored backgrounds" pattern.

**Intentional (KEEP as-is or migrate to `text-primary-foreground` etc.):**
- `button.tsx:10` - `bg-tui-blue text-black` (primary variant) -> should use `text-primary-foreground`
- `button.tsx:12` - `hover:bg-tui-red hover:text-black` (destructive hover) -> `hover:text-destructive-foreground`
- `button.tsx:13` - `bg-tui-green text-black` (success variant) -> needs `--success-foreground` token
- `tabs-trigger.tsx:36` - `bg-tui-blue text-black` (active tab) -> `text-primary-foreground`
- `callout.tsx:24-27` - `text-black` on colored bg -> needs foreground tokens per variant
- `navigation-list-item.tsx:45,59,64` - `text-black` on `bg-tui-fg` -> intentional inversion
- `footer.tsx:22` - `bg-tui-fg text-black` -> intentional status bar inversion
- `issue-list-item.tsx:21,27,32` - `bg-tui-blue text-black` -> `text-primary-foreground`
- `menu-item.tsx:55,86` - selected item inversion -> intentional
- `wizard-progress.tsx:36` - `bg-tui-blue text-black` -> `text-primary-foreground`
- `severity-filter-button.tsx:37` - on colored bg -> intentional
- `provider-list.tsx:82` - `bg-tui-blue text-black` -> `text-primary-foreground`

**Recommendation:** Replace `text-black` with `text-primary-foreground` where paired with `bg-tui-blue`, and add `--success-foreground` for green bg patterns. The footer/navigation inversion pattern needs a dedicated `--foreground-inverse` token.

#### `text-white` usage analysis

| File | Line | Exact Class | Context | Replacement |
|------|------|-------------|---------|-------------|
| `components/shared/api-key-method-selector.tsx` | 70 | `text-white` | input text | `text-tui-fg` |
| `components/ui/menu/menu-item.tsx` | 92, 116 | `group-hover:text-white` | hover state | `group-hover:text-tui-fg` |
| `components/ui/form/selectable-item.ts` | 8 | `text-white` | selected state | `text-tui-fg` (or `text-foreground`) |
| `components/ui/form/selectable-item.ts` | 69 | `text-white/70` | detail text | `text-tui-fg/70` |
| `features/settings/components/diagnostics/page.tsx` | 118 | `hover:text-white` | hover state | `hover:text-tui-fg` |

#### `text-red-400` (should use tui-red)

| File | Line | Exact Class | Replacement |
|------|------|-------------|-------------|
| `app/routes/__root.tsx` | 24 | `text-red-400` | `text-tui-red` |

#### `bg-white/5` (should use tui-selection)

| File | Line | Exact Class | Replacement |
|------|------|-------------|-------------|
| `features/history/components/timeline-list.tsx` | 50 | `hover:bg-white/5` | `hover:bg-tui-selection/30` |

---

## 4. shadcn Standard Token Comparison

### Present

| shadcn Token | Stargazer Token | In @theme? |
|---|---|---|
| `background` | `--background` -> `--color-background` | YES |
| `foreground` | `--foreground` -> `--color-foreground` | YES |
| `card` | `--color-card` (= `--secondary`) | YES (@theme only) |
| `card-foreground` | `--color-card-foreground` (= `--secondary-foreground`) | YES (@theme only) |
| `popover` | `--color-popover` (= `--secondary`) | YES (@theme only) |
| `popover-foreground` | `--color-popover-foreground` (= `--secondary-foreground`) | YES (@theme only) |
| `primary` | `--primary` -> `--color-primary` | YES |
| `primary-foreground` | `--primary-foreground` -> `--color-primary-foreground` | YES |
| `secondary` | `--secondary` -> `--color-secondary` | YES |
| `secondary-foreground` | `--secondary-foreground` -> `--color-secondary-foreground` | YES |
| `muted` | `--muted` -> `--color-muted` | YES |
| `muted-foreground` | `--muted-foreground` -> `--color-muted-foreground` | YES |
| `accent` | `--color-accent` (= `--tui-blue`) | YES (@theme only) |
| `accent-foreground` | `--color-accent-foreground` (= `--primary-foreground`) | YES (@theme only) |
| `destructive` | `--destructive` -> `--color-destructive` | YES |
| `destructive-foreground` | `--destructive-foreground` -> `--color-destructive-foreground` | YES |
| `border` | `--border` -> `--color-border` | YES |
| `input` | `--input` -> `--color-input` | YES |
| `ring` | `--color-ring` (= `--tui-blue`) | YES (@theme only) |
| `radius` | `--radius` | YES (via --radius-lg/md/sm) |

### Missing from shadcn standard

| shadcn Token | Status | Notes |
|---|---|---|
| `chart-1` through `chart-5` | NOT NEEDED | No chart components |
| `sidebar-*` | NOT NEEDED | No sidebar component (has NavigationList instead) |

### Stargazer-specific tokens NOT in shadcn

| Token | Purpose | Keep in @stargazer/ui? |
|---|---|---|
| `--tui-violet` | Agent/AI accent color | YES - brand color |
| `--tui-selection` | Selected/hover background | YES - core to TUI aesthetic |
| `--tui-input-bg` | Distinct input background | YES - darker than bg for depth |
| `--tui-muted` | Muted text color (palette) | YES - maps to shadcn muted |
| `--severity-*` | Code review severity | YES - domain-specific |
| `--status-*` | Agent/process status | YES - domain-specific |
| `--tui-font-mono` | Monospace font stack | YES - core to TUI aesthetic |
| `--trans-fast` | Transition speed | YES - consistent animations |

### Tokens that should be added

| Token | Value (dark) | Value (light) | Reason |
|---|---|---|---|
| `--accent` (bare name) | `var(--tui-blue)` | `var(--tui-blue)` | shadcn compat - only exists as @theme bridge |
| `--accent-foreground` (bare name) | `var(--tui-bg)` | `#ffffff` | shadcn compat - only exists as @theme bridge |
| `--card` (bare name) | `var(--tui-selection)` | `var(--tui-selection)` | shadcn compat - only exists as @theme bridge |
| `--card-foreground` (bare name) | `var(--tui-fg)` | `var(--tui-fg)` | shadcn compat - only exists as @theme bridge |
| `--popover` (bare name) | `var(--tui-selection)` | `var(--tui-selection)` | shadcn compat - only exists as @theme bridge |
| `--popover-foreground` (bare name) | `var(--tui-fg)` | `var(--tui-fg)` | shadcn compat - only exists as @theme bridge |
| `--ring` (bare name) | `var(--tui-blue)` | `var(--tui-blue)` | shadcn compat - only exists as @theme bridge |
| `--success` | `var(--tui-green)` | `var(--tui-green)` | Used in button success variant, callout |
| `--success-foreground` | `var(--tui-bg)` | `#ffffff` | Foreground on green backgrounds |
| `--warning` | `var(--tui-yellow)` | `var(--tui-yellow)` | Used in callout warning |
| `--warning-foreground` | `var(--tui-bg)` | `#ffffff` | Foreground on yellow backgrounds |
| `--severity-nit` | `var(--muted-foreground)` | `var(--muted-foreground)` | Missing - nit uses hardcoded gray |

---

## 5. Usage Pattern Analysis

### Token adoption breakdown

| Layer | Usage Count | Percentage |
|-------|-------------|------------|
| `tui-*` palette tokens (correct) | 189 occurrences / 69 files | ~73% |
| Hardcoded `gray-*` (incorrect) | 69 occurrences / 36 files | ~27% |
| shadcn semantic classes (`bg-primary`, etc.) | 0 occurrences | 0% |

**Key finding:** Components use `tui-*` palette classes directly (e.g., `text-tui-muted`, `bg-tui-selection`) rather than shadcn semantic classes (e.g., `text-muted`, `bg-secondary`). The semantic @theme bridge exists but is UNUSED in component code.

### Implications for @stargazer/ui

1. **Components currently depend on `tui-*` Tailwind classes**, not shadcn semantic classes
2. The @theme bridge makes both available, but adoption is inconsistent
3. Migrating to shadcn semantic classes would require updating ~189 occurrences
4. Keeping `tui-*` classes is simpler and more expressive for this codebase

**Recommendation:** Keep `tui-*` as the primary component API. The shadcn semantic bridge is useful for interop but not the primary usage pattern.

---

## 6. Clean Token Specification

### Layer 1: Palette (`--tui-*`)

Defined in `:root` (dark default) and `[data-theme="light"]`.

```css
:root, [data-theme="dark"] {
  /* Palette */
  --tui-bg: #0d1117;
  --tui-fg: #c9d1d9;
  --tui-blue: #58a6ff;
  --tui-violet: #bc8cff;
  --tui-green: #3fb950;
  --tui-red: #ff7b72;
  --tui-yellow: #d29922;
  --tui-border: #30363d;
  --tui-selection: #1f2428;
  --tui-muted: #6e7681;
  --tui-input-bg: #010409;

  /* Font */
  --tui-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular,
    "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}

[data-theme="light"] {
  --tui-bg: #ffffff;
  --tui-fg: #24292f;
  --tui-blue: #0969da;
  --tui-violet: #8250df;
  --tui-green: #1a7f37;
  --tui-red: #cf222e;
  --tui-yellow: #9a6700;
  --tui-border: #d0d7de;
  --tui-selection: #ddf4ff;
  --tui-muted: #57606a;
  --tui-input-bg: #f6f8fa;
}
```

### Layer 2: Semantic (shadcn-compatible bare names)

```css
:root, [data-theme="dark"] {
  --background: var(--tui-bg);
  --foreground: var(--tui-fg);
  --primary: var(--tui-blue);
  --primary-foreground: var(--tui-bg);
  --secondary: var(--tui-selection);
  --secondary-foreground: var(--tui-fg);
  --muted: var(--tui-muted);
  --muted-foreground: #484f58;
  --accent: var(--tui-blue);
  --accent-foreground: var(--tui-bg);
  --destructive: var(--tui-red);
  --destructive-foreground: var(--tui-bg);
  --success: var(--tui-green);
  --success-foreground: var(--tui-bg);
  --warning: var(--tui-yellow);
  --warning-foreground: var(--tui-bg);
  --card: var(--tui-selection);
  --card-foreground: var(--tui-fg);
  --popover: var(--tui-selection);
  --popover-foreground: var(--tui-fg);
  --border: var(--tui-border);
  --input: var(--tui-selection);
  --ring: var(--tui-blue);
  --radius: 0.25rem;
  --trans-fast: 0.15s ease;
}

[data-theme="light"] {
  --primary-foreground: #ffffff;
  --muted-foreground: #8c959f;
  --accent-foreground: #ffffff;
  --destructive-foreground: #ffffff;
  --success-foreground: #ffffff;
  --warning-foreground: #ffffff;
  --input: #f6f8fa;
  /* All others cascade from palette changes */
}
```

### Layer 3: Domain tokens

```css
:root, [data-theme="dark"] {
  --severity-blocker: var(--tui-red);
  --severity-high: var(--tui-yellow);
  --severity-medium: var(--tui-muted);
  --severity-low: var(--tui-blue);
  --severity-nit: var(--muted-foreground);

  --status-running: var(--tui-blue);
  --status-complete: var(--tui-green);
  --status-pending: var(--tui-muted);
}

[data-theme="light"] {
  /* All cascade from palette changes except: */
  --status-pending: #57606a;
}
```

### Layer 4: Tailwind @theme bridge

```css
@theme {
  /* Palette */
  --color-tui-bg: var(--tui-bg);
  --color-tui-fg: var(--tui-fg);
  --color-tui-blue: var(--tui-blue);
  --color-tui-violet: var(--tui-violet);
  --color-tui-green: var(--tui-green);
  --color-tui-red: var(--tui-red);
  --color-tui-yellow: var(--tui-yellow);
  --color-tui-border: var(--tui-border);
  --color-tui-selection: var(--tui-selection);
  --color-tui-muted: var(--tui-muted);
  --color-tui-input-bg: var(--tui-input-bg);

  /* Semantic (shadcn-compatible) */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Domain */
  --color-severity-blocker: var(--severity-blocker);
  --color-severity-high: var(--severity-high);
  --color-severity-medium: var(--severity-medium);
  --color-severity-low: var(--severity-low);
  --color-severity-nit: var(--severity-nit);
  --color-status-running: var(--status-running);
  --color-status-complete: var(--status-complete);
  --color-status-pending: var(--status-pending);

  /* Radius */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: max(calc(var(--radius) - 4px), 1px);

  /* Animations */
  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-slide-in: slide-in 0.2s ease-out;
  --animate-slide-in-right: slide-in-right 0.2s ease-out;
  --animate-slide-out-right: slide-out-right 0.15s ease-in forwards;
}
```

---

## 7. Action Items Summary

### Remove (dead/duplicate tokens)

| Token | Reason |
|-------|--------|
| `--background0` | Identical to `--background`, 0 usage |
| `--foreground0` | Identical to `--foreground`, 0 usage |
| `--tui-severity-blocker` | Duplicate of `--severity-blocker` |
| `--tui-severity-high` | Duplicate of `--severity-high` |
| `--tui-severity-medium` | Duplicate of `--severity-medium` |
| `--tui-severity-low` | Duplicate + different value from `--severity-low` |
| `--color-*` in theme.css `:root`/`[data-theme]` | Redundant with @theme block |

### Fix

| Issue | Fix |
|-------|-----|
| `--radius-sm` = 0px | `max(calc(var(--radius) - 4px), 1px)` |
| `--muted` uses hardcoded hex | `--muted: var(--tui-muted)` |
| `--severity-medium` uses hardcoded hex | `--severity-medium: var(--tui-muted)` |

### Add

| Token | Purpose |
|-------|---------|
| `--accent` (bare name) | shadcn compat |
| `--accent-foreground` (bare name) | shadcn compat |
| `--card` (bare name) | shadcn compat |
| `--card-foreground` (bare name) | shadcn compat |
| `--popover` (bare name) | shadcn compat |
| `--popover-foreground` (bare name) | shadcn compat |
| `--ring` (bare name) | shadcn compat |
| `--success` | Green semantic token |
| `--success-foreground` | Foreground on green |
| `--warning` | Yellow semantic token |
| `--warning-foreground` | Foreground on yellow |
| `--severity-nit` | Missing severity level |
| `--color-severity-nit` | @theme bridge for nit |
| `--color-success` | @theme bridge |
| `--color-success-foreground` | @theme bridge |
| `--color-warning` | @theme bridge |
| `--color-warning-foreground` | @theme bridge |

### Migrate (69 hardcoded instances across 36 files)

| From | To | Count |
|------|-----|-------|
| `text-gray-300` | `text-tui-fg/80` | 5 |
| `text-gray-400` | `text-tui-muted` | 11 |
| `text-gray-500` | `text-tui-muted` | ~35 |
| `text-gray-600` | `text-muted-foreground` | 8 |
| `text-gray-700` | `text-muted-foreground` | 1 |
| `border-gray-400` | `border-severity-medium` | 1 |
| `border-gray-500` | `border-muted-foreground` | 1 |
| `border-gray-700` | `border-tui-border` | 1 |
| `border-gray-800` | `border-tui-border` | 3 |
| `bg-black` (non-overlay) | `bg-tui-bg` | 2 |
| `text-red-400` | `text-tui-red` | 1 |
| `text-white` (non-inverted) | `text-tui-fg` | 5 |
| `hover:bg-white/5` | `hover:bg-tui-selection/30` | 1 |

**Total: ~75 class replacements across 36 files**
