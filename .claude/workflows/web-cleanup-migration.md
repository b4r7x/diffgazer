# Web UI Cleanup Migration Workflow

> **Multi-agent orchestration workflow for cleaning up legacy UI and standardizing TUI components**
> Run this in empty AI context. Uses multiple specialized agents in parallel where possible.

## Goals

1. **Remove old UI components** - Delete all non-TUI components
2. **Remove `tui-` prefix** - Rename all `tui-*.tsx` to `*.tsx`
3. **Remove WebTUI library** - Delete `@webtui/*` dependencies
4. **Consolidate CSS** - Merge `tui-theme.css` into single `theme.css`
5. **Bulletproof React structure** - Reorganize to `pages/` pattern for routes
6. **Move `index.css`** - Relocate to `styles/` folder

---

## Pre-Migration State

**Current Structure:**
```
apps/web/src/
├── index.css                    # Entry CSS (to move)
├── styles/
│   ├── theme.css               # WebTUI + Catppuccin (to replace)
│   └── tui-theme.css           # TUI tokens (to merge)
├── components/
│   ├── ui/
│   │   ├── button.tsx          # OLD - remove
│   │   ├── card.tsx            # OLD - remove
│   │   ├── badge.tsx           # OLD - remove
│   │   ├── tui-button.tsx      # KEEP - rename
│   │   ├── tui-checkbox.tsx    # KEEP - rename
│   │   ├── tui-menu.tsx        # KEEP - rename
│   │   ├── tui-modal.tsx       # KEEP - rename
│   │   ├── tui-table.tsx       # KEEP - rename
│   │   └── index.ts            # OLD - recreate
│   └── layout/
│       ├── header.tsx          # OLD - remove
│       ├── footer-bar.tsx      # OLD - remove
│       ├── split-pane.tsx      # OLD - remove
│       ├── tui-header.tsx      # KEEP - rename
│       └── tui-footer.tsx      # KEEP - rename
├── features/
│   ├── review/components/
│   │   ├── review-screen.tsx       # OLD - remove
│   │   ├── review-screen-tui.tsx   # KEEP - rename to review-screen.tsx
│   │   └── ...other old files      # OLD - remove
│   ├── menu/components/
│   │   ├── main-menu.tsx           # OLD - remove
│   │   └── home-menu-tui.tsx       # KEEP - rename to home-menu.tsx
│   ├── history/components/
│   │   ├── history-list.tsx        # OLD - remove
│   │   └── history-screen-tui.tsx  # KEEP - rename
│   └── settings/components/
│       ├── theme-selector.tsx      # OLD - remove
│       └── settings-screen-tui.tsx # KEEP - rename
└── app/
    ├── routes/                 # OLD route files - remove
    ├── pages/                  # NEW - create for bulletproof-react
    └── router.tsx              # Update imports
```

---

## Phase 1: Analysis (Parallel Agents)

### 1.1 Dependency Analysis Agent

```
Task(subagent_type="Explore", model="haiku")

Prompt:
Analyze /Users/voitz/Projects/stargazer/apps/web/src/ for migration dependencies.

Find ALL files that import from:
1. @/components/ui/* (non-tui files)
2. @/components/layout/* (non-tui files)
3. @/features/*/components/* (non-tui files)
4. Any @webtui/* packages

For each import found, return:
- File path
- Import statement
- What component is imported

This will help us understand the dependency graph for safe deletion.
```

### 1.2 TUI Component Inventory Agent

```
Task(subagent_type="Explore", model="haiku")

Prompt:
List ALL tui-* prefixed files in /Users/voitz/Projects/stargazer/apps/web/src/

For each file:
1. Current path
2. New path (without tui- prefix)
3. Exported component names (that need renaming)
4. Files that import this component

Format as JSON array for programmatic processing.
```

---

## Phase 2: File Cleanup (Sequential - Must Complete Before Phase 3)

### 2.1 Delete Old UI Components Agent

```
Task(subagent_type="Bash")

Prompt:
Delete old UI components that are being replaced by TUI versions.

Commands:
cd /Users/voitz/Projects/stargazer/apps/web/src

# Delete old UI components
rm -f components/ui/button.tsx
rm -f components/ui/card.tsx
rm -f components/ui/badge.tsx
rm -f components/ui/input.tsx
rm -f components/ui/textarea.tsx
rm -f components/ui/select.tsx
rm -f components/ui/dialog.tsx
rm -f components/ui/tabs.tsx
rm -f components/ui/spinner.tsx
rm -f components/ui/progress.tsx
rm -f components/ui/skeleton.tsx
rm -f components/ui/separator.tsx
rm -f components/ui/code-block.tsx
rm -f components/ui/index.ts

# Delete old layout components
rm -f components/layout/header.tsx
rm -f components/layout/footer-bar.tsx
rm -f components/layout/split-pane.tsx

# Verify deletions
ls -la components/ui/
ls -la components/layout/
```

### 2.2 Delete Old Feature Components Agent

```
Task(subagent_type="Bash")

Prompt:
Delete old feature components that are being replaced by TUI versions.

Commands:
cd /Users/voitz/Projects/stargazer/apps/web/src

# Delete old review components
rm -f features/review/components/review-screen.tsx
rm -f features/review/components/review-panel.tsx
rm -f features/review/components/review-header.tsx
rm -f features/review/components/issue-list.tsx
rm -f features/review/components/issue-details.tsx
rm -f features/review/components/issue-card.tsx
rm -f features/review/components/diff-view.tsx
rm -f features/review/components/severity-badge.tsx

# Delete old menu components
rm -f features/menu/components/main-menu.tsx

# Delete old history components
rm -f features/history/components/history-list.tsx

# Delete old settings components
rm -f features/settings/components/theme-selector.tsx

# Delete old agents components (root level duplicate)
rm -f components/agent-activity-panel.tsx
rm -f features/agents/components/agent-activity-panel.tsx
rm -f features/agents/components/agent-status.tsx

# Verify
find features -name "*.tsx" -type f | head -20
```

### 2.3 Delete Old Route Files Agent

```
Task(subagent_type="Bash")

Prompt:
Delete old route files that are replaced by TUI screens in router.tsx.

Commands:
cd /Users/voitz/Projects/stargazer/apps/web/src

# Delete old route files
rm -f app/routes/history.tsx
rm -f app/routes/sessions.tsx
rm -f app/routes/settings.tsx
rm -f app/routes/review/index.tsx
rm -f app/routes/review/\$reviewId.tsx
rm -rf app/routes/review  # Remove empty directory

# Keep __root.tsx and index.tsx (will be updated)
ls -la app/routes/
```

---

## Phase 3: Rename TUI Components (Parallel Agents)

### 3.1 Rename UI Components Agent

```
Task(subagent_type="typescript-pro")

Prompt:
Rename TUI UI components by removing the "tui-" prefix.

For each file in /Users/voitz/Projects/stargazer/apps/web/src/components/ui/:

1. tui-button.tsx → button.tsx
   - Rename export `TuiButton` → `Button`
   - Update displayName

2. tui-checkbox.tsx → checkbox.tsx
   - Rename export `TuiCheckbox` → `Checkbox`
   - Rename interface `TuiCheckboxProps` → `CheckboxProps`

3. tui-menu.tsx → menu.tsx
   - Rename export `TuiMenu` → `Menu`
   - Rename interfaces `TuiMenuItem` → `MenuItem`, `TuiMenuProps` → `MenuProps`

4. tui-modal.tsx → modal.tsx
   - Rename export `TuiModal` → `Modal`
   - Rename interface `TuiModalProps` → `ModalProps`

5. tui-table.tsx → table.tsx
   - Rename export `TuiTable` → `Table`
   - Rename types `TuiTableColumn` → `TableColumn`, `TuiTableProps` → `TableProps`

Use git mv for renames to preserve history. Update all internal references.
```

### 3.2 Rename Layout Components Agent

```
Task(subagent_type="typescript-pro")

Prompt:
Rename TUI layout components by removing the "tui-" prefix.

For each file in /Users/voitz/Projects/stargazer/apps/web/src/components/layout/:

1. tui-header.tsx → header.tsx
   - Rename export `TuiHeader` → `Header`
   - Rename interface `TuiHeaderProps` → `HeaderProps`

2. tui-footer.tsx → footer.tsx
   - Rename export `TuiFooter` → `Footer`
   - Rename interface `TuiFooterProps` → `FooterProps`

Use git mv for renames. Update all internal references.
```

### 3.3 Rename Feature Screen Components Agent

```
Task(subagent_type="typescript-pro")

Prompt:
Rename TUI feature screen components by removing the "-tui" suffix.

Files to rename:

1. features/review/components/review-screen-tui.tsx → review-screen.tsx
   - Rename export `ReviewScreenTui` → `ReviewScreen`

2. features/menu/components/home-menu-tui.tsx → home-menu.tsx
   - Rename export `HomeMenuTui` → `HomeMenu`
   - Rename interface `HomeMenuTuiProps` → `HomeMenuProps`

3. features/history/components/history-screen-tui.tsx → history-screen.tsx
   - Rename export `HistoryScreenTui` → `HistoryScreen`

4. features/settings/components/settings-screen-tui.tsx → settings-screen.tsx
   - Rename export `SettingsScreenTui` → `SettingsScreen`

Use git mv for renames. Update all internal references.
```

---

## Phase 4: Update All Imports (Single Agent - Critical)

### 4.1 Import Update Agent

```
Task(subagent_type="react-component-architect")

Prompt:
Update ALL imports across the codebase to use new component names.

Files to update:

1. /Users/voitz/Projects/stargazer/apps/web/src/app/router.tsx
   - Change `HomeMenuTui` → `HomeMenu` from `home-menu`
   - Change `ReviewScreenTui` → `ReviewScreen` from `review-screen`
   - Change `HistoryScreenTui` → `HistoryScreen` from `history-screen`
   - Change `SettingsScreenTui` → `SettingsScreen` from `settings-screen`

2. /Users/voitz/Projects/stargazer/apps/web/src/app/routes/__root.tsx
   - Remove any old component imports
   - Keep minimal root layout

3. /Users/voitz/Projects/stargazer/apps/web/src/features/modals/trust-prompt-modal.tsx
   - Change `TuiModal` → `Modal` from `@/components/ui/modal`
   - Change `TuiCheckbox` → `Checkbox` from `@/components/ui/checkbox`
   - Change `TuiButton` → `Button` from `@/components/ui/button`

4. /Users/voitz/Projects/stargazer/apps/web/src/features/modals/agent-inspector-modal.tsx
   - Change `TuiModal` → `Modal` from `@/components/ui/modal`

5. All TUI screen files (review-screen, home-menu, history-screen, settings-screen)
   - Change `TuiHeader` → `Header` from `@/components/layout/header`
   - Change `TuiFooter` → `Footer` from `@/components/layout/footer`
   - Change `TuiMenu` → `Menu` from `@/components/ui/menu`
   - Change `TuiTable` → `Table` from `@/components/ui/table`
   - Change `TuiButton` → `Button` from `@/components/ui/button`

Read each file, update imports, save.
```

---

## Phase 5: CSS Consolidation (Sequential)

### 5.1 Remove WebTUI Dependencies Agent

```
Task(subagent_type="Bash")

Prompt:
Remove WebTUI npm dependencies.

Commands:
cd /Users/voitz/Projects/stargazer/apps/web
npm uninstall @webtui/css @webtui/theme-catppuccin

# Verify package.json no longer has @webtui
grep -r "webtui" package.json || echo "WebTUI removed from package.json"
```

### 5.2 Consolidate Theme CSS Agent

```
Task(subagent_type="tailwind-frontend-expert")

Prompt:
Consolidate CSS files into a single theme system.

1. Read current files:
   - /Users/voitz/Projects/stargazer/apps/web/src/styles/theme.css
   - /Users/voitz/Projects/stargazer/apps/web/src/styles/tui-theme.css
   - /Users/voitz/Projects/stargazer/apps/web/src/index.css

2. Create new consolidated /Users/voitz/Projects/stargazer/apps/web/src/styles/theme.css:
   - Remove @webtui imports
   - Keep all TUI CSS variables (--tui-bg, --tui-fg, etc.)
   - Keep all TUI utility classes (.tui-text-*, .tui-bg-*, etc.)
   - Keep animations (cursor-blink, etc.)
   - Keep scrollbar styles
   - Keep JetBrains Mono font setup

3. Move index.css content to /Users/voitz/Projects/stargazer/apps/web/src/styles/index.css:
   - Import tailwindcss
   - Import ./theme.css
   - Keep any animations

4. Delete old files:
   - /Users/voitz/Projects/stargazer/apps/web/src/styles/tui-theme.css
   - /Users/voitz/Projects/stargazer/apps/web/src/index.css

5. Update /Users/voitz/Projects/stargazer/apps/web/src/main.tsx:
   - Change import from './index.css' to './styles/index.css'
```

---

## Phase 6: Bulletproof React Structure (Sequential)

### 6.1 Create Pages Directory Agent

```
Task(subagent_type="react-component-architect")

Prompt:
Reorganize to bulletproof-react pages pattern for TanStack Router.

Create /Users/voitz/Projects/stargazer/apps/web/src/pages/ directory with:

1. pages/home.tsx
   - Re-export HomeMenu from features/menu/components/home-menu
   - This is the page component for the index route

2. pages/review.tsx
   - Re-export ReviewScreen from features/review/components/review-screen
   - This is the page component for /review/:id route

3. pages/history.tsx
   - Re-export HistoryScreen from features/history/components/history-screen
   - This is the page component for /history route

4. pages/settings.tsx
   - Re-export SettingsScreen from features/settings/components/settings-screen
   - This is the page component for /settings route

5. pages/index.ts
   - Barrel export all pages

Then update router.tsx to import from @/pages instead of @/features/*/components.

Pattern:
```tsx
// pages/home.tsx
export { HomeMenu as HomePage } from '@/features/menu/components/home-menu';

// pages/index.ts
export { HomePage } from './home';
export { ReviewPage } from './review';
export { HistoryPage } from './history';
export { SettingsPage } from './settings';
```
```

### 6.2 Create UI Barrel Export Agent

```
Task(subagent_type="typescript-pro")

Prompt:
Create barrel export file for UI components.

Create /Users/voitz/Projects/stargazer/apps/web/src/components/ui/index.ts:

```typescript
export { Button, type ButtonProps } from './button';
export { Checkbox, type CheckboxProps } from './checkbox';
export { Menu, type MenuItem, type MenuProps } from './menu';
export { Modal, type ModalProps } from './modal';
export { Table, type TableColumn, type TableProps } from './table';
```

Create /Users/voitz/Projects/stargazer/apps/web/src/components/layout/index.ts:

```typescript
export { Header, type HeaderProps } from './header';
export { Footer, type FooterProps } from './footer';
```
```

---

## Phase 7: Validation (Parallel Agents)

### 7.1 TypeScript Validation Agent

```
Task(subagent_type="Bash")

Prompt:
Run TypeScript type-check to verify all imports are correct.

Commands:
cd /Users/voitz/Projects/stargazer
npm run type-check 2>&1 | head -100

Report any errors related to:
- Missing imports
- Incorrect component names
- Type mismatches
```

### 7.2 Build Verification Agent

```
Task(subagent_type="Bash")

Prompt:
Run full build to verify everything compiles.

Commands:
cd /Users/voitz/Projects/stargazer/apps/web
npm run build 2>&1

Report success or any build errors.
```

### 7.3 Code Review Agent

```
Task(subagent_type="code-reviewer")

Prompt:
Review the migrated codebase for:

1. Consistency - All components follow same naming pattern (no tui- prefix)
2. Imports - All imports use @/ alias correctly
3. CSS - No references to @webtui packages
4. Structure - Follows bulletproof-react patterns:
   - pages/ for route components
   - features/ for feature modules
   - components/ for shared UI

Files to review:
- /Users/voitz/Projects/stargazer/apps/web/src/components/ui/*.tsx
- /Users/voitz/Projects/stargazer/apps/web/src/components/layout/*.tsx
- /Users/voitz/Projects/stargazer/apps/web/src/pages/*.tsx
- /Users/voitz/Projects/stargazer/apps/web/src/app/router.tsx
- /Users/voitz/Projects/stargazer/apps/web/src/styles/*.css

Report issues with file:line references.
```

---

## Execution Order

```
┌─────────────────────────────────────────┐
│  Phase 1: Analysis (parallel)           │
│  ├─ Dependency analysis agent           │
│  └─ TUI component inventory agent       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 2: File Cleanup (sequential)     │
│  ├─ 2.1 Delete old UI components        │
│  ├─ 2.2 Delete old feature components   │
│  └─ 2.3 Delete old route files          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 3: Rename Components (parallel)  │
│  ├─ 3.1 Rename UI components            │
│  ├─ 3.2 Rename layout components        │
│  └─ 3.3 Rename feature screens          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 4: Update Imports (single)       │
│  └─ 4.1 Import update agent             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 5: CSS Consolidation (sequential)│
│  ├─ 5.1 Remove WebTUI dependencies      │
│  └─ 5.2 Consolidate theme CSS           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 6: Structure (sequential)        │
│  ├─ 6.1 Create pages directory          │
│  └─ 6.2 Create barrel exports           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 7: Validation (parallel)         │
│  ├─ 7.1 TypeScript validation           │
│  ├─ 7.2 Build verification              │
│  └─ 7.3 Code review                     │
└─────────────────────────────────────────┘
```

---

## Agent Types Summary

| Agent | Purpose | Phase |
|-------|---------|-------|
| `Explore` | Dependency analysis, file inventory | 1 |
| `Bash` | File deletion, npm commands | 2, 5.1, 7.1, 7.2 |
| `typescript-pro` | Component renaming, type updates | 3, 6.2 |
| `react-component-architect` | Import updates, pages structure | 4, 6.1 |
| `tailwind-frontend-expert` | CSS consolidation | 5.2 |
| `code-reviewer` | Final validation | 7.3 |

---

## Post-Migration Structure

```
apps/web/src/
├── styles/
│   ├── index.css           # Entry: @import tailwindcss + theme
│   └── theme.css           # Consolidated TUI theme (no WebTUI)
├── components/
│   ├── ui/
│   │   ├── button.tsx      # Was tui-button.tsx
│   │   ├── checkbox.tsx    # Was tui-checkbox.tsx
│   │   ├── menu.tsx        # Was tui-menu.tsx
│   │   ├── modal.tsx       # Was tui-modal.tsx
│   │   ├── table.tsx       # Was tui-table.tsx
│   │   └── index.ts        # Barrel export
│   └── layout/
│       ├── header.tsx      # Was tui-header.tsx
│       ├── footer.tsx      # Was tui-footer.tsx
│       └── index.ts        # Barrel export
├── features/
│   ├── review/components/
│   │   └── review-screen.tsx   # Was review-screen-tui.tsx
│   ├── menu/components/
│   │   └── home-menu.tsx       # Was home-menu-tui.tsx
│   ├── history/components/
│   │   └── history-screen.tsx  # Was history-screen-tui.tsx
│   ├── settings/components/
│   │   └── settings-screen.tsx # Was settings-screen-tui.tsx
│   └── modals/
│       ├── trust-prompt-modal.tsx
│       └── agent-inspector-modal.tsx
├── pages/
│   ├── home.tsx            # Re-exports HomeMenu
│   ├── review.tsx          # Re-exports ReviewScreen
│   ├── history.tsx         # Re-exports HistoryScreen
│   ├── settings.tsx        # Re-exports SettingsScreen
│   └── index.ts            # Barrel export
├── app/
│   ├── router.tsx          # Imports from @/pages
│   ├── routes/
│   │   └── __root.tsx      # Minimal root layout
│   └── providers/
│       └── ...
└── main.tsx                # Imports styles/index.css
```

---

## Success Criteria

- [ ] No files with `tui-` prefix remain
- [ ] No imports from `@webtui/*`
- [ ] No old UI components (button, card, badge, etc.)
- [ ] All components export clean names (Button, Modal, etc.)
- [ ] CSS consolidated into single theme.css
- [ ] index.css moved to styles/
- [ ] pages/ directory exists with route re-exports
- [ ] TypeScript type-check passes
- [ ] Build succeeds
- [ ] No hardcoded colors (all use CSS variables)

---

## How to Run This Workflow

```
Read and execute: /Users/voitz/Projects/stargazer/.claude/workflows/web-cleanup-migration.md

Execute phases in order. Use Task tool to launch specialized agents.
Parallelize where indicated. Wait for dependencies before proceeding.
```
