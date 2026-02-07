# Stargazer UI Library Implementation - Team Prompt

**Context:** You are implementing a TUI-themed (terminal UI) web component library extracted from the Stargazer monorepo. A full audit has been completed. This prompt contains everything you need.

**Monorepo:** pnpm workspace at `/home/b4r7/Projects/stargazer`
**Existing packages:** `packages/core`, `packages/schemas`, `packages/api`, `packages/hooks`, `packages/tsconfig`
**New packages to create:** `packages/ui` (`@stargazer/ui`) and `packages/keyboard` (`@stargazer/keyboard`)

---

## HIGH-LEVEL ARCHITECTURE

Two new packages:

```
@stargazer/keyboard  (peer dep: react ^19)
    ^  peer dependency
@stargazer/ui        (peer deps: react ^19, @stargazer/keyboard)
```

- `@stargazer/keyboard` is a **scope-based keyboard navigation framework** (~400 LOC). Zero UI, zero styling.
- `@stargazer/ui` is a **TUI-themed component library** using Tailwind 4 + CVA + tailwind-merge. Components use `tui-*` token classes.
- UI components import keyboard hooks from `@stargazer/keyboard` as peer dep (Option A from audit).
- Both packages are independently installable. `@stargazer/keyboard` works without `@stargazer/ui`.

---

## TASK BREAKDOWN

### Phase 0: Package Infrastructure

**Task 0A: Create `packages/keyboard` package**
- Create `packages/keyboard/package.json`:
  ```json
  {
    "name": "@stargazer/keyboard",
    "version": "0.0.1",
    "type": "module",
    "main": "src/index.ts",
    "types": "src/index.ts",
    "peerDependencies": { "react": "^19.0.0" },
    "devDependencies": { "react": "^19.0.0", "vitest": "^3.0.0", "@testing-library/react": "^16.0.0" }
  }
  ```
- Create `packages/keyboard/tsconfig.json` extending `@repo/tsconfig/base.json`
- Copy these files from `apps/web/src/` into `packages/keyboard/src/`:
  - `app/providers/keyboard-provider.tsx` -> `keyboard-provider.tsx`
  - `app/providers/keyboard-utils.ts` -> `keyboard-utils.ts`
  - `app/providers/keyboard-utils.test.ts` -> `keyboard-utils.test.ts`
  - `app/providers/keyboard-provider.test.tsx` -> `keyboard-provider.test.tsx`
  - `hooks/keyboard/use-keyboard-context.ts`
  - `hooks/keyboard/use-key.ts`
  - `hooks/keyboard/use-keys.ts`
  - `hooks/keyboard/use-scope.ts`
  - `hooks/keyboard/use-group-navigation.ts`
  - `hooks/keyboard/use-selectable-list.ts`
  - `hooks/keyboard/use-selectable-list.test.ts`
  - `hooks/keyboard/use-footer-navigation.ts`
- Fix internal imports (e.g., `from "@/app/providers/keyboard-provider"` -> `from "./keyboard-provider"`)
- Create barrel `src/index.ts` exporting all public API
- **DO NOT copy** `use-trust-form-keyboard.ts` (app-specific, stays in app)
- Run `pnpm install` and verify tests pass

**Task 0B: Create `packages/ui` package**
- Create `packages/ui/package.json`:
  ```json
  {
    "name": "@stargazer/ui",
    "version": "0.0.1",
    "type": "module",
    "main": "src/index.ts",
    "types": "src/index.ts",
    "peerDependencies": {
      "react": "^19.0.0",
      "@stargazer/keyboard": "workspace:*"
    },
    "dependencies": {
      "class-variance-authority": "^0.7.0",
      "clsx": "^2.1.0",
      "tailwind-merge": "^3.0.0"
    }
  }
  ```
- Create `packages/ui/tsconfig.json`
- Create `packages/ui/src/lib/cn.ts` (copy from `apps/web/src/lib/utils.ts` or wherever `cn()` lives)
- Create `packages/ui/src/styles/theme.css` and `packages/ui/src/styles/index.css` (copy from `apps/web/src/styles/`, apply token fixes from Phase 0C)
- Create barrel `packages/ui/src/index.ts`

**Task 0C: Fix design tokens** (in the new `packages/ui/src/styles/`)
Apply these fixes to the copied CSS files:

1. **Fix `--radius-sm` bug:** Change `calc(var(--radius) - 4px)` to `max(calc(var(--radius) - 4px), 1px)`
2. **Remove duplicate severity system:** Delete all `--tui-severity-*` tokens (keep only `--severity-*`)
3. **Remove dead tokens:** Delete `--background0` and `--foreground0`
4. **Fix `--muted`:** Change from hardcoded hex to `var(--tui-muted)`
5. **Remove duplicate `--color-*` from `:root`/`[data-theme]`:** Keep only in `@theme` block
6. **Add missing semantic tokens to both `:root` and `[data-theme="light"]`:**
   ```css
   --accent: var(--tui-blue);
   --accent-foreground: var(--tui-bg); /* light: #ffffff */
   --card: var(--tui-selection);
   --card-foreground: var(--tui-fg);
   --popover: var(--tui-selection);
   --popover-foreground: var(--tui-fg);
   --ring: var(--tui-blue);
   --success: var(--tui-green);
   --success-foreground: var(--tui-bg); /* light: #ffffff */
   --warning: var(--tui-yellow);
   --warning-foreground: var(--tui-bg); /* light: #ffffff */
   --severity-nit: var(--muted-foreground);
   ```
7. **Add `@theme` bridges** for new tokens: `--color-success`, `--color-success-foreground`, `--color-warning`, `--color-warning-foreground`, `--color-severity-nit`

**Task 0D: Update `apps/web` to consume new packages**
- Add `@stargazer/keyboard` and `@stargazer/ui` as dependencies in `apps/web/package.json`
- Update ALL keyboard imports across `apps/web/src/` (24 files total):
  - `from "@/hooks/keyboard"` -> `from "@stargazer/keyboard"`
  - `from "@/hooks/keyboard/use-key"` etc -> `from "@stargazer/keyboard"`
  - `from "@/app/providers/keyboard-provider"` -> `from "@stargazer/keyboard"`
- Move `use-trust-form-keyboard.ts` to `apps/web/src/features/settings/hooks/` and update its imports to use `@stargazer/keyboard`
- Delete old files: `apps/web/src/hooks/keyboard/` directory, `apps/web/src/app/providers/keyboard-provider.tsx`, `keyboard-utils.ts` and tests
- **6 UI component files** that import keyboard hooks:
  - `components/ui/dialog/dialog.tsx`: `useScope`, `useKey`
  - `components/ui/menu/menu.tsx`: `useKey`, `useKeys`
  - `components/ui/navigation-list/navigation-list.tsx`: `useGroupNavigation`
  - `components/ui/form/checkbox.tsx`: `useGroupNavigation`
  - `components/ui/form/radio-group.tsx`: `useGroupNavigation`
  - `components/shared/trust-permissions-content.tsx`: `useTrustFormKeyboard` (update to feature hook location)
- **17 feature/app files** that import keyboard hooks (see full list in audit-keyboard-package.md Section 4)
- Verify the app builds and works after migration

---

### Phase 1: Primitive Components

Extract these from `apps/web/src/components/ui/` into `packages/ui/src/components/`.

**Task 1A: Button**
- Source: `apps/web/src/components/ui/button.tsx`
- Target: `packages/ui/src/components/button.tsx`
- Changes:
  - KEEP: all 7 variants (primary, secondary, destructive, success, ghost, outline, link), 3 sizes, `bracket` prop, `font-mono` base
  - REMOVE: `tab` variant (app-specific, move to app), `toggle` variant (becomes ToggleGroup)
  - FIX: Replace 3x `text-black` with `text-primary-foreground` (line 10: primary), `text-destructive-foreground` (destructive hover), `text-success-foreground` (line 13: success) — need to add `--success-foreground` token
  - ADD: `loading` prop (show `[...]` or spinner text, set `aria-busy="true"`, disable pointer events)
  - ADD: `size: "icon"` variant (`h-9 w-9 p-0`)
  - ADD: `aria-pressed` for any toggle usage
  - Export `buttonVariants` for consumer reuse
- No keyboard coupling. Clean extraction.

**Task 1B: Badge**
- Source: `apps/web/src/components/ui/badge/badge.tsx`
- Target: `packages/ui/src/components/badge.tsx`
- Changes:
  - KEEP: 5 variants (success, warning, error, info, neutral), 2 sizes (sm, md), `font-bold tracking-wider`
  - REMOVE: `stored` variant (Stargazer-specific)
  - ADD: `lg` size (`px-4 py-1.5 text-base`) for consistency with Button sm/md/lg
  - ADD: `dot` prop (colored dot before text for status indicators)
  - No hardcoded colors (all `tui-*`). Clean.
- No keyboard coupling.

**Task 1C: Input**
- Source: `apps/web/src/components/ui/form/input.tsx`
- Target: `packages/ui/src/components/input.tsx`
- Changes:
  - KEEP: 3 sizes, `font-mono`, `bg-tui-bg border border-tui-border`
  - ADD: `error` boolean prop -> `border-tui-red focus:ring-tui-red aria-invalid="true"`
  - ADD: `Textarea` component sharing same base variants
  - No hardcoded colors. Clean.
- No keyboard coupling.

**Task 1D: Callout**
- Source: `apps/web/src/components/ui/callout.tsx`
- Target: `packages/ui/src/components/callout.tsx`
- Changes:
  - KEEP: 4 variants (info, warning, error, success), 3 CVA definitions, text-char icons (`"i"`, `"!"`, `"X"`, `"check"`)
  - FIX: Replace 4x `text-black` in iconVariants with `text-primary-foreground` (or per-variant foreground token)
  - ADD: `icon` prop (`ReactNode`) for custom icon override while keeping text-char defaults
  - ADD: `onDismiss` prop for closable callouts with `[x]` button
  - Export `calloutVariants`
- No keyboard coupling.

**Task 1E: Checkbox & CheckboxGroup**
- Source: `apps/web/src/components/ui/form/checkbox.tsx`
- Target: `packages/ui/src/components/checkbox.tsx`
- Also copy: `apps/web/src/components/ui/form/selectable-item.ts` -> `packages/ui/src/internal/selectable-item.ts`
- Changes:
  - KEEP: TUI indicators `[x]`/`[ ]` and `[●]`/`[   ]`, generic typing, selectable-item CVA
  - FIX selectable-item: Replace `text-white` (line 8) with `text-tui-fg` and `text-white/70` (line 69) with `text-tui-fg/70`
  - CheckboxGroup currently imports `useGroupNavigation` from keyboard hooks — KEEP this import but change to `from "@stargazer/keyboard"` (Option A: peer dep)
  - REMOVE from CheckboxGroup: `onEnter` prop (app-specific), rename `wrap` to `loop` (Radix convention)
  - ADD: `indeterminate` state (`checked: boolean | "indeterminate"` -> render `[-]` TUI style)
  - ADD: `name`, `required` props for form integration
- Keyboard coupling: YES via peer dep (useGroupNavigation). This is intentional.

**Task 1F: RadioGroup**
- Source: `apps/web/src/components/ui/form/radio-group.tsx`
- Target: `packages/ui/src/components/radio-group.tsx`
- Changes:
  - KEEP: TUI indicators `[●]`/`[   ]`, generic typing, orientation prop
  - RadioGroup imports `useGroupNavigation` — change to `from "@stargazer/keyboard"`
  - REMOVE: `onFocusZoneEnter` (app-specific), rename `wrap` to `loop`
  - ADD: `name`, `required` props
- Keyboard coupling: YES via peer dep.

---

### Phase 2: Compound Components

**Task 2A: Toast (highest priority — most library-ready)**
- Source: `apps/web/src/components/ui/toast/` (4 files)
- Target: `packages/ui/src/components/toast/`
- Copy: `toast.tsx`, `toast-container.tsx`, `toast-context.tsx`, `index.ts`
- Changes:
  - KEEP: Split data/actions context pattern, imperative `showToast()` API, 4 CVA variants, text-char icons, `motion-safe:` animations
  - FIX: Replace `text-gray-500` (line 89 in toast.tsx) on dismiss button with `text-tui-muted`
  - FIX: Reduced-motion bug — add `setTimeout` fallback alongside `onAnimationEnd` for when `motion-safe:animate-*` doesn't fire
  - REMOVE: Dependency on `@stargazer/schemas/ui` — define Toast type locally in the package
  - ADD: `action` prop on Toast (`ReactNode` for action button slot)
  - ADD: `position` prop on ToastProvider (default: "bottom-right")
- No keyboard coupling. Clean.

**Task 2B: Tabs**
- Source: `apps/web/src/components/ui/tabs/` (6 files)
- Target: `packages/ui/src/components/tabs/`
- Changes:
  - KEEP: Compound API (Tabs, TabsList, TabsTrigger, TabsContent), ref-based registration, controlled+uncontrolled, roving tabindex
  - FIX: `text-black` (line 37 in tabs-trigger.tsx) on active tab -> `text-primary-foreground`
  - FIX A11y bug: Arrow key navigation should SKIP disabled tabs (currently navigates to them)
  - ADD: Home/End key support in TabsList
  - ADD: `orientation` prop ("horizontal" | "vertical") changing arrow keys to Up/Down for vertical
  - ADD: `data-state="active"|"inactive"` on triggers and panels
  - ADD: CVA variants for TabsTrigger
- No keyboard coupling (self-contained onKeyDown). Best pattern.

**Task 2C: Dialog**
- Source: `apps/web/src/components/ui/dialog/` (11 files)
- Target: `packages/ui/src/components/dialog/`
- Changes:
  - KEEP: All 9 sub-components, compound API, `useFocusTrap`, `[x]` default close, `useId()` for ARIA linking
  - Change keyboard imports: `useScope`, `useKey` -> `from "@stargazer/keyboard"` (peer dep)
  - FIX: `bg-black/60` overlay -> use CSS var `--tui-overlay` or keep as-is (intentional dark overlay)
  - FIX: Hardcoded shadow `rgb(48_54_61)` and `rgba(0,0,0,0.9)` -> CSS custom property
  - ADD: Portal rendering (`createPortal` to `document.body`) — create `packages/ui/src/internal/portal.tsx`
  - ADD: CVA size variants: `sm` (max-w-sm), `md` (max-w-2xl, default), `lg` (max-w-4xl), `full` (max-w-full)
  - ADD: `data-state="open"|"closed"` on content for CSS animation hooks
  - ADD: Extract overlay as `DialogOverlay` sub-component
- Keyboard coupling: YES via peer dep (useScope, useKey).

**Task 2D: NavigationList**
- Source: `apps/web/src/components/ui/navigation-list/` (4 files)
- Target: `packages/ui/src/components/navigation-list/`
- Changes:
  - KEEP: Compound API, DOM-based item discovery (`[role="option"]`), `isFocused` prop (unique multi-pane feature), `onBoundaryReached`, `aria-activedescendant`
  - Change: `useGroupNavigation` import -> `from "@stargazer/keyboard"`
  - FIX: 4x `text-black` in navigation-list-item.tsx -> `text-primary-foreground` or new `text-tui-on-accent` token
  - ADD: Uncontrolled mode (`defaultSelectedId`)
  - ADD: CVA variants for density (compact/default/comfortable)
  - ADD: `data-state` attributes
- Keyboard coupling: YES via peer dep.

**Task 2E: Menu (most work needed)**
- Source: `apps/web/src/components/ui/menu/` (5 files)
- Target: `packages/ui/src/components/menu/`
- Changes:
  - KEEP: Compound API, `▌` indicator, `[n]` hotkey display, hub variant, generic `<T extends string>` typing
  - Change: `useKey`, `useKeys` imports -> `from "@stargazer/keyboard"`
  - REWORK: Replace `Children.forEach` item discovery with ref-based registration (like Tabs does)
  - REWORK: Extract 25+ lines of conditional classes in MenuItem into CVA slot variants
  - FIX: `text-black` (line 53-54), `group-hover:text-white` (lines 92, 116) -> semantic tokens
  - ADD: Uncontrolled mode (`defaultIndex` or `defaultValue`)
  - ADD: `aria-activedescendant` support
  - CONSIDER: Rename to `Listbox` (since it uses `role="listbox"`, not `role="menu"`)
- Keyboard coupling: YES via peer dep.

---

### Phase 3: Display & Layout Components

**Task 3A: Panel (highest value extraction)**
- Source: `apps/web/src/components/ui/containers/panel.tsx`
- Target: `packages/ui/src/components/panel.tsx`
- Extract as-is. All colors already semantic `tui-*` tokens. No changes needed.
- 5 header variants (default, subtle, floating, section, section-bordered)
- 4 value display variants (default, success, success-badge, muted)
- 3 content spacing levels (none, sm, md)
- No keyboard coupling.

**Task 3B: Stepper (from Progress)**
- Source: `apps/web/src/components/ui/progress/` (3 files + index)
- Target: `packages/ui/src/components/stepper/`
- Rename: ProgressList -> Stepper, ProgressStep -> StepperStep, ProgressSubstep -> StepperSubstep
- Changes:
  - KEEP: expand/collapse via `grid-template-rows: 0fr -> 1fr` animation, substeps, status badges
  - DECOUPLE: Remove import of `@stargazer/schemas/ui` types — define step types locally:
    ```typescript
    interface StepData { id: string; label: string; status: "completed" | "active" | "pending"; substeps?: SubstepData[]; content?: ReactNode; }
    interface SubstepData { id: string; tag: string; label: string; status: "pending" | "active" | "completed" | "error"; detail?: string; }
    ```
  - FIX: ProgressStep `onToggle` type union — simplify to `(id: string) => void`
  - ADD: Make `STATUS_BADGES` labels configurable (accept `badgeLabels` prop or use context)
  - ADD: Make substep status text configurable (currently hardcoded "analyzing...", "done", "failed")
- Keyboard: Only Enter/Space toggle (self-contained, stays in component). No keyboard package coupling.

**Task 3C: ScrollArea**
- Source: `apps/web/src/components/ui/scroll-area.tsx`
- Target: `packages/ui/src/components/scroll-area.tsx`
- Extract as-is. Zero changes needed.

**Task 3D: FocusablePane**
- Source: `apps/web/src/components/ui/focusable-pane.tsx`
- Target: `packages/ui/src/components/focusable-pane.tsx`
- Extract as-is. Visual-only focus indicator, pairs with keyboard package.

**Task 3E: CardLayout (from WizardLayout)**
- Source: `apps/web/src/components/shared/wizard-layout.tsx`
- Target: `packages/ui/src/components/card-layout.tsx`
- Rename: WizardLayout -> CardLayout
- Changes:
  - ADD: `size` variant prop: `sm` (max-w-sm), `md` (max-w-md), `lg` (max-w-lg, default)
  - ADD: `header` prop (`ReactNode`) for fully custom headers (keep `title`/`subtitle` as convenience)
  - KEEP: All existing styling (already uses semantic tokens)

**Task 3F: BlockBar (from SeverityBar)**
- Source: `apps/web/src/components/ui/severity/severity-bar.tsx`
- Target: `packages/ui/src/components/block-bar.tsx`
- Changes:
  - Replace `severity: ReviewSeverity` prop with `color: string` (Tailwind text color class)
  - Remove dependency on `SEVERITY_CONFIG`
  - ADD: `barWidth`, `filledChar`, `emptyChar` as configurable props with defaults (20, U+2588, U+2591)

**Task 3G: SectionHeader**
- Source: `apps/web/src/components/ui/section-header.tsx`
- Target: `packages/ui/src/components/section-header.tsx`
- Changes:
  - ADD: `variant?: "default" | "muted"` (default = blue, muted = tui-muted)
  - ADD: `as?: "h2" | "h3" | "h4"` prop for semantic heading level (default: h3)

**Task 3H: EmptyState**
- Source: `apps/web/src/components/ui/empty-state.tsx`
- Target: `packages/ui/src/components/empty-state.tsx`
- Changes:
  - FIX: `text-gray-500` -> `text-tui-muted`
  - ADD: `icon?: ReactNode`, `action?: ReactNode`, `description?: ReactNode` slots
  - Change `message: string` to `message: ReactNode`

**Task 3I: KeyValueRow (from StatusRow)**
- Source: `apps/web/src/components/ui/status-row.tsx`
- Target: `packages/ui/src/components/key-value-row.tsx`
- Rename to KeyValueRow. Extract as-is (colors already semantic).

---

### Phase 4: Feature Extractions (new components)

**Task 4A: SearchInput (unify 2 implementations)**
- Sources:
  - `apps/web/src/features/history/components/search-input.tsx` (cleaner, use as base)
  - `apps/web/src/features/providers/components/model-select-dialog/model-search-input.tsx`
- Target: `packages/ui/src/components/search-input.tsx`
- Unified API:
  ```typescript
  interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onEscape?: () => void;
    onArrowUp?: () => void;
    onArrowDown?: () => void;
    onEnter?: () => void;
    placeholder?: string;
    prefix?: React.ReactNode;     // default: "/" in blue
    showActiveIndicator?: boolean; // animated cursor when value present
    className?: string;
    ref?: React.Ref<HTMLInputElement>;
  }
  ```
- FIX: Replace `placeholder:text-gray-500` with `placeholder:text-tui-muted`
- The providers version's extras (custom action button, tip text) stay in the feature as composition.

**Task 4B: ToggleGroup (unify 2 implementations)**
- Sources:
  - `apps/web/src/features/review/components/severity-filter-group.tsx` + `severity-filter-button.tsx`
  - `apps/web/src/features/providers/components/model-select-dialog/model-filter-tabs.tsx`
- Target: `packages/ui/src/components/toggle-group.tsx`
- API:
  ```typescript
  interface ToggleGroupItem { value: string; label: React.ReactNode; count?: number; }
  interface ToggleGroupProps {
    items: ToggleGroupItem[];
    value: string | null;
    onValueChange: (value: string | null) => void;
    allowDeselect?: boolean;
    size?: "sm" | "md";
    className?: string;
  }
  ```
- Uses Button `variant="primary"` / `variant="ghost"` internally for active/inactive items
- Shows `[{label} {count}]` when count provided (TUI bracket notation)

**Task 4C: CodeBlock**
- Source: `apps/web/src/features/review/components/code-snippet.tsx`
- Target: `packages/ui/src/components/code-block.tsx`
- Generic type: `{ number: number; content: string; type?: "highlight" | "added" | "removed" }`
- FIX: `bg-black` -> `bg-tui-bg`, `text-gray-400` -> `text-tui-muted`, `text-gray-600` -> `text-muted-foreground`, `border-gray-700` -> `border-tui-border`

**Task 4D: DiffView**
- Source: `apps/web/src/features/review/components/diff-view.tsx`
- Target: `packages/ui/src/components/diff-view.tsx`
- FIX: `bg-black` -> `bg-tui-bg`
- Already fully generic (takes `patch: string`).

**Task 4E: KeyValue**
- Source: `apps/web/src/features/review/components/metric-item.tsx`
- Target: `packages/ui/src/components/key-value.tsx`
- ADD: `layout?: "horizontal" | "vertical"` prop
- ADD: `success`, `error` variants
- FIX: `text-gray-400` -> `text-tui-muted`

**Task 4F: LabeledField**
- Source: `apps/web/src/features/home/components/info-field.tsx`
- Target: `packages/ui/src/components/labeled-field.tsx`
- FIX: `text-gray-400` in muted variant -> `text-tui-muted`
- Already generic. Clean extraction.

**Task 4G: Checklist**
- Source: `apps/web/src/features/review/components/fix-plan-checklist.tsx`
- Target: `packages/ui/src/components/checklist.tsx`
- Generic API: `items: ChecklistItem[]`, `checked: Set<string|number>`, `onToggle: (id) => void`
- KEEP: `[x]`/`[ ]` indicators, `line-through` on checked items
- FIX: `text-gray-400` -> `text-tui-muted`

**Task 4H: HorizontalStepper**
- Source: `apps/web/src/features/onboarding/components/wizard-progress.tsx`
- Target: `packages/ui/src/components/horizontal-stepper.tsx`
- Generic API: `steps: { value: string; label: string }[]`, `currentStep: string`
- FIX: `text-black` -> `text-primary-foreground`
- KEEP: `---` connectors between steps, blue/green/muted step coloring

---

### Phase 5: Hardcoded Color Migration

**THIS IS THE LARGEST TASK: ~75 class replacements across 36 files in `apps/web/src/`**

This must happen AFTER Phase 0-4 so the library components are already fixed. This phase fixes the remaining hardcoded colors in app code (features, routes, shared components).

Replacement map:
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
| `text-black` (on accent bg) | `text-primary-foreground` | ~25 |

See `audit-design-tokens.md` Section 3.2 for exact file + line numbers for every instance.

---

### Phase 6: Update apps/web to import from packages

After all components are in `packages/ui/`:
- Update `apps/web` to import UI components from `@stargazer/ui` instead of local paths
- Keep feature-specific components in `apps/web/src/features/`
- Keep layout components (GlobalLayout, Header, Footer) in `apps/web/src/components/layout/`
- Refactor feature duplicates (search inputs, filter groups) to use new library components
- Verify build, verify light/dark theme switching works

---

## IMPORTANT RULES

### Code Style
- ESM (`import/export`), never CommonJS
- Tailwind 4 + CVA + tailwind-merge for all styling
- `font-mono` base on everything (this IS a TUI library)
- Use `tui-*` token classes (not shadcn semantic classes like `bg-primary`)
- Components use `tui-*` tokens directly: `bg-tui-bg`, `text-tui-fg`, `border-tui-border`, etc.
- React 19 — no `forwardRef`, use explicit `ref` prop. No manual `useMemo`/`useCallback` (React Compiler handles it)
- `Result<T,E>` for error handling where applicable (see `@repo/core/result`)

### TUI Identity (DO NOT REMOVE)
- `font-mono` on everything — monospace is the only font
- Bracket notation: `[ Submit ]`, `[x]`, `[ ]`, `[●]`
- Text-character icons: `"i"`, `"!"`, `">"`, `"▌"`, `"✕"`, `"✓"`
- Sharp corners: `rounded-sm` (2px max)
- Only 2 themes: dark (default) + light

### What NOT to build
- Layout primitives (Stack, Box, Grid) — use Tailwind utilities
- Page templates — too specific
- Form validation — use Zod
- Data fetching — use TanStack Query
- Icons — TUI uses text characters
- Complex data grids — use TanStack Table

### Testing
- Co-locate tests: `button.test.tsx` next to `button.tsx`
- AAA pattern (Arrange, Act, Assert)
- Mock at boundaries only
- Test observable behavior, not implementation details
- Vitest + @testing-library/react for component tests

### Security
- CORS: localhost/127.0.0.1 only
- XML escape user content in prompts
- Security headers: X-Frame-Options, X-Content-Type-Options

---

## REFERENCE FILES

Read these for detailed component-by-component analysis:
- `/home/b4r7/Projects/stargazer/.claude/docs/audit-primitives.md` — Button, Badge, Input, Callout, Checkbox, RadioGroup (full CVA variants, props, hardcoded colors with line numbers)
- `/home/b4r7/Projects/stargazer/.claude/docs/audit-compound.md` — Dialog, Tabs, Toast, Menu, NavigationList (761 lines, sub-components, context APIs, item discovery patterns, keyboard coupling)
- `/home/b4r7/Projects/stargazer/.claude/docs/audit-display-layout.md` — Panel, Stepper, ScrollArea, etc (16 components, extract/rework/skip decisions)
- `/home/b4r7/Projects/stargazer/.claude/docs/audit-feature-extractions.md` — 23 feature components (duplicate patterns, unified APIs)
- `/home/b4r7/Projects/stargazer/.claude/docs/audit-design-tokens.md` — Full token inventory, 75 hardcoded colors with exact file:line, clean token specification
- `/home/b4r7/Projects/stargazer/.claude/docs/audit-keyboard-package.md` — Keyboard system analysis, hook signatures, import map, Option A recommendation, migration steps
- `/home/b4r7/Projects/stargazer/.claude/docs/ui-library-patterns.md` — shadcn/Radix/Ark/Park UI patterns for reference
- `/home/b4r7/Projects/stargazer/CLAUDE.md` — Project-wide coding standards and architecture rules

---

## TEAM STRUCTURE SUGGESTION

| Teammate | Tasks | Priority |
|----------|-------|----------|
| **infra** | 0A, 0B, 0C, 0D | P0 (everything depends on this) |
| **primitives** | 1A-1F | P1 (after infra) |
| **compound** | 2A-2E | P1 (after infra) |
| **display** | 3A-3I | P1 (after infra) |
| **features** | 4A-4H | P2 (after primitives, can start once Button exists for ToggleGroup) |
| **tokens** | Phase 5 | P3 (after all components migrated) |
| **integration** | Phase 6 | P4 (final wiring) |

Infra must complete first. Then primitives, compound, and display can run in parallel. Features depends on primitives (uses Button). Tokens and integration are final.
