# Web UI TUI Implementation Workflow

> **Orchestration workflow for creating Stargazer web app from TUI mockups**
> Run this in empty AI context. Uses multiple specialized agents.

## Context

**Goal:** Implement web UI from 25 TUI-style HTML mockups (excluding Observatory style #1)

**Source mockups:** `/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/`
- Use: `stargazer_issue_review_dashboard_2` through `stargazer_issue_review_dashboard_26`
- Skip: `stargazer_issue_review_dashboard_1` (Observatory style - not wanted)
- Skip: `stargazer_issue_review_dashboard_25` (Portfolio style - not wanted)

**Target:** `/Users/voitz/Projects/stargazer/apps/web/src/`

**Tech stack:** React 19, TypeScript, Tailwind CSS 4, TanStack Router

---

## Design System (TUI Theme)

Extract these tokens from mockups and use consistently:

```css
/* Colors - GitHub Dark inspired */
--tui-bg: #0D1117;
--tui-fg: #C9D1D9;
--tui-blue: #58A6FF;      /* primary, links, active */
--tui-violet: #BC8CFF;    /* secondary, accents */
--tui-green: #3FB950;     /* success, passed */
--tui-red: #FF7B72;       /* error, blocker */
--tui-yellow: #D29922;    /* warning, high */
--tui-border: #30363D;
--tui-selection: #1F2428;

/* Typography */
font-family: 'JetBrains Mono', monospace;

/* Key patterns */
- ASCII art logo in header
- Keyboard shortcuts in footer (inverted colors)
- Selection indicator: ▌ (left bar)
- Checkbox: [x] / [ ]
- Radio: (x) / ( )
- Double-border modals
```

---

## Mockup → Screen Mapping

| Mockup # | Screen | Priority |
|----------|--------|----------|
| 2 | Review Screen (TUI split-pane) | P0 |
| 3 | Trust Prompt Modal | P1 |
| 4 | Home Menu (simple) | P0 |
| 5 | History List | P1 |
| 6 | Setup Wizard | P2 |
| 7 | Home Menu (with context sidebar) | P0 |
| 8 | History Dashboard (table) | P1 |
| 9 | Review Screen (variant) | P0 |
| 10 | Permissions Editor | P2 |
| 11-14 | Review variants | P1 |
| 15 | System Diagnostics | P2 |
| 16-19 | Settings variants | P1 |
| 20 | Agent Inspector Modal | P1 |
| 21-24 | Additional screens | P2 |
| 26 | Onboarding | P2 |

---

## Phase 1: Agent Orchestration Setup

### 1.1 Launch Exploration Agent

```
Task(subagent_type="Explore", model="haiku")

Prompt:
Analyze /Users/voitz/Projects/stargazer/apps/web/src/

Return:
1. Current component structure (files + one-line descriptions)
2. Existing Tailwind config and theme setup
3. TanStack Router route structure
4. Any existing TUI-style components

Format: file path : description (one line each)
```

### 1.2 Launch Mockup Analysis Agent

```
Task(subagent_type="general-purpose", model="haiku")

Prompt:
Read these mockup HTML files and extract reusable components:

Files to read (TUI style only):
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_2/code.html
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_4/code.html
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_7/code.html

For each, extract:
1. Component patterns (with Tailwind classes)
2. Color usage mapping to --tui-* tokens
3. Typography patterns
4. Interactive states (hover, selected, active)

Return JSON with component specs.
```

---

## Phase 2: Component Library Creation

### 2.1 Launch Theme Token Agent

```
Task(subagent_type="tailwind-frontend-expert")

Prompt:
Create Tailwind CSS theme tokens for TUI style.

Read mockup: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_2/code.html

Create file: /Users/voitz/Projects/stargazer/apps/web/src/styles/tui-theme.css

Requirements:
- CSS custom properties for all TUI colors
- Font setup for JetBrains Mono
- Custom scrollbar styles (from mockups)
- Cursor blink animation
- Selection highlight styles

Use mockup's <style> and tailwind.config as reference.
```

### 2.2 Launch Primitives Agent (parallel batch)

Run these agents IN PARALLEL:

```
Task(subagent_type="react-component-architect")

Prompt:
Create TUI-style Button component.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_10/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/components/ui/tui-button.tsx

Variants from mockups:
- primary: bg-tui-blue text-black font-bold
- secondary: border border-tui-border hover:bg-tui-selection
- destructive: text-tui-red border-tui-red hover:bg-tui-red hover:text-black
- ghost: hover:bg-tui-selection

Include keyboard focus styles. Use JetBrains Mono.
```

```
Task(subagent_type="react-component-architect")

Prompt:
Create TUI-style Checkbox component.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_3/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/components/ui/tui-checkbox.tsx

Pattern from mockups:
- Checked: [x] with text-tui-blue
- Unchecked: [ ] with text-tui-fg
- Selected row: bg-tui-blue text-black

Controlled component with onChange handler.
```

```
Task(subagent_type="react-component-architect")

Prompt:
Create TUI-style Menu component.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_4/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/components/ui/tui-menu.tsx

Pattern from mockups:
- Selected: bg-tui-blue text-black with ▌ indicator
- Hover: bg-tui-selection
- Keyboard navigation: arrow keys + Enter
- Number shortcuts: [1], [2], etc.

Props: items, selectedIndex, onSelect, showNumbers
```

```
Task(subagent_type="react-component-architect")

Prompt:
Create TUI-style Table component.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_8/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/components/ui/tui-table.tsx

Pattern from mockups:
- Header: bg-tui-selection text-tui-violet
- Row hover: bg-tui-selection
- Selected row: bg-[#C9D1D9] text-[#0D1117] (inverted)
- Column separators: │ character or border

Props: columns, data, selectedRowIndex, onRowSelect
```

### 2.3 Launch Layout Components Agent (sequential)

```
Task(subagent_type="react-component-architect")

Prompt:
Create TUI Header component with ASCII logo.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_2/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/components/layout/tui-header.tsx

Include:
1. ASCII art logo (from mockup, responsive sizing)
2. Provider status indicator (● GPT-4o • Active)
3. Decorative separator: ─ ✦ ─ ✧ ─

Props: providerName, providerStatus, subtitle
```

```
Task(subagent_type="react-component-architect")

Prompt:
Create TUI Footer component with keyboard shortcuts.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_2/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/components/layout/tui-footer.tsx

Pattern:
- Inverted colors: bg-tui-fg text-black
- Keyboard hints: "↑/↓ Select • Enter Open • q Quit"

Props: shortcuts: Array<{key: string, label: string}>
```

```
Task(subagent_type="react-component-architect")

Prompt:
Create TUI Modal component with double-border.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_20/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/components/ui/tui-modal.tsx

Pattern from mockups:
- Double border: border-[6px] border-double border-tui-fg
- Dark overlay: bg-black/60
- Background blur on content behind
- Close on Escape key

Props: isOpen, onClose, title, children
```

---

## Phase 3: Screen Implementation

### 3.1 Home Menu Screen

```
Task(subagent_type="frontend-developer")

Prompt:
Create Home Menu screen matching TUI mockups.

Reference mockups:
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_4/code.html
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_7/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/app/routes/index.tsx

Features:
1. TuiHeader with logo
2. TuiMenu with options:
   - [1] Start New Review
   - [2] Resume Last Run
   - [3] History
   - [4] Settings
   - [5] Help
3. Optional: Context sidebar (mockup #7) with:
   - Trusted directory
   - Provider info
   - Last run stats
4. TuiFooter with shortcuts

Use existing TUI components from /apps/web/src/components/
Route navigation on menu selection.
```

### 3.2 Review Screen (CRITICAL)

```
Task(subagent_type="frontend-developer")

Prompt:
Create Review Screen matching TUI mockups.

Reference mockups:
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_2/code.html
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_9/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/features/review/components/review-screen-tui.tsx

Layout from mockups:
1. Left panel (2/5 width):
   - Analysis run info card
   - Severity filter buttons (BLOCKER, HIGH, MED, LOW)
   - Issue list with selection

2. Right panel (3/5 width):
   - Tab navigation: [Details] Explain Trace Patch
   - Issue title + location
   - Symptom section
   - "Why it matters" section
   - Fix plan checkboxes
   - Code block with diff

3. Footer with keyboard shortcuts

Use components:
- TuiHeader, TuiFooter, TuiMenu, TuiTable
- New: SeverityFilter, IssueList, IssueDetails, CodeDiff

Keyboard navigation: j/k for list, Tab for pane focus
```

### 3.3 History Screen

```
Task(subagent_type="frontend-developer")

Prompt:
Create History Screen matching TUI mockups.

Reference mockups:
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_5/code.html
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_8/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/features/history/components/history-screen-tui.tsx

Features:
1. TuiHeader with "History Mode" subtitle
2. Tab nav: [Review Runs] Sessions
3. TuiTable with columns:
   - ID (#8821)
   - Date
   - Scope (Unstaged, Staged, branch name)
   - Provider
   - Stats (issues count, Passed indicator)
4. Row selection and navigation
5. Footer shortcuts: Tab, Enter, d (delete), Esc

Fetch data from review history API.
```

### 3.4 Settings Screen

```
Task(subagent_type="frontend-developer")

Prompt:
Create Settings Screen matching TUI mockups.

Reference mockups:
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_12/code.html
- /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_15/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/features/settings/components/settings-screen-tui.tsx

Layout:
1. Left panel: Provider list
   - Gemini [✓ configured]
   - OpenAI [• needs key]
   - Anthropic [• needs key]
   - OpenAI-compatible [local/other]

2. Right panel: Selected provider config
   - Model preset buttons: [Fast] [Balanced] [Best]
   - Description text
   - Advanced settings toggle

3. Tab for Diagnostics (mockup #15):
   - Version info
   - Terminal environment
   - Storage paths
   - Action buttons

Use TUI components throughout.
```

### 3.5 Modals

```
Task(subagent_type="frontend-developer")

Prompt:
Create Trust Prompt Modal matching TUI mockups.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_3/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/features/modals/trust-prompt-modal.tsx

Pattern:
1. TuiModal wrapper with double-border
2. Title: "Trust this directory?"
3. Checkbox list:
   - [x] Allow reading repository files
   - [x] Allow reading git metadata
   - [ ] Allow running commands (tests/lint) ← FOCUSED/SELECTED
4. Current directory display
5. Footer: ↑/↓ select • Space toggle • Enter confirm • Esc exit

Props: directory, onConfirm, onCancel
```

```
Task(subagent_type="frontend-developer")

Prompt:
Create Agent Inspector Modal matching TUI mockups.

Reference: /Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_20/code.html

Create: /Users/voitz/Projects/stargazer/apps/web/src/features/modals/agent-inspector-modal.tsx

Layout:
1. TuiModal with tabs: Summary | [Evidence] | Trace
2. Collapsible file sections with code preview
3. Syntax highlighted code with line numbers
4. Critical/warning markers on lines
5. Footer with Tab/j/k/Esc shortcuts

Props: issue, onClose
```

---

## Phase 4: Integration & Validation

### 4.1 Route Integration Agent

```
Task(subagent_type="react-component-architect")

Prompt:
Update TanStack Router configuration to include all TUI screens.

Read current: /Users/voitz/Projects/stargazer/apps/web/src/app/router.tsx

Update routes:
- / → Home Menu (TUI)
- /review → Review Screen (TUI)
- /review/$reviewId → Review Detail (TUI)
- /history → History Screen (TUI)
- /settings → Settings Screen (TUI)

Ensure TuiHeader and TuiFooter wrap all routes via __root.tsx layout.
```

### 4.2 Validation Agent

```
Task(subagent_type="code-reviewer")

Prompt:
Review all created TUI components for:

1. Consistency with mockup designs
2. Tailwind class usage matches TUI theme
3. Keyboard navigation implemented
4. Accessibility (ARIA labels, focus management)
5. No hardcoded colors (use CSS variables)

Files to review:
- /Users/voitz/Projects/stargazer/apps/web/src/components/ui/tui-*.tsx
- /Users/voitz/Projects/stargazer/apps/web/src/components/layout/tui-*.tsx
- /Users/voitz/Projects/stargazer/apps/web/src/features/*/components/*-tui.tsx

Report issues with file:line references.
```

### 4.3 Build Verification Agent

```
Task(subagent_type="Bash")

Prompt:
Run type-check and build for web app:

cd /Users/voitz/Projects/stargazer
npm run type-check
cd apps/web && npm run build

Report any TypeScript or build errors.
```

---

## Execution Order

```
┌─────────────────────────────────────────┐
│  Phase 1: Analysis (parallel)           │
│  ├─ Explore agent (current structure)   │
│  └─ Mockup analysis agent               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 2: Components                    │
│  ├─ 2.1 Theme tokens (first)            │
│  ├─ 2.2 Primitives (parallel batch)     │
│  │   ├─ tui-button                      │
│  │   ├─ tui-checkbox                    │
│  │   ├─ tui-menu                        │
│  │   └─ tui-table                       │
│  └─ 2.3 Layout (sequential)             │
│       ├─ tui-header                     │
│       ├─ tui-footer                     │
│       └─ tui-modal                      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 3: Screens (can parallelize)     │
│  ├─ 3.1 Home Menu                       │
│  ├─ 3.2 Review Screen (CRITICAL)        │
│  ├─ 3.3 History Screen                  │
│  ├─ 3.4 Settings Screen                 │
│  └─ 3.5 Modals                          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Phase 4: Integration                   │
│  ├─ 4.1 Route integration               │
│  ├─ 4.2 Code review validation          │
│  └─ 4.3 Build verification              │
└─────────────────────────────────────────┘
```

---

## Agent Types to Use

| Agent | Purpose |
|-------|---------|
| `Explore` | Quick codebase analysis |
| `general-purpose` | Mockup HTML parsing |
| `tailwind-frontend-expert` | Theme/CSS creation |
| `react-component-architect` | Component creation |
| `frontend-developer` | Screen implementation |
| `code-reviewer` | Validation |
| `Bash` | Build verification |

---

## Files to Create (Summary)

**Theme:**
- `apps/web/src/styles/tui-theme.css`

**Components:**
- `apps/web/src/components/ui/tui-button.tsx`
- `apps/web/src/components/ui/tui-checkbox.tsx`
- `apps/web/src/components/ui/tui-menu.tsx`
- `apps/web/src/components/ui/tui-table.tsx`
- `apps/web/src/components/ui/tui-modal.tsx`
- `apps/web/src/components/layout/tui-header.tsx`
- `apps/web/src/components/layout/tui-footer.tsx`

**Screens:**
- `apps/web/src/app/routes/index.tsx` (update)
- `apps/web/src/features/review/components/review-screen-tui.tsx`
- `apps/web/src/features/history/components/history-screen-tui.tsx`
- `apps/web/src/features/settings/components/settings-screen-tui.tsx`

**Modals:**
- `apps/web/src/features/modals/trust-prompt-modal.tsx`
- `apps/web/src/features/modals/agent-inspector-modal.tsx`

---

## How to Run This Workflow

In empty AI context, execute:

```
Read and follow: /Users/voitz/Projects/stargazer/.claude/workflows/web-ui-tui-implementation.md

Execute phases in order. Use Task tool to launch specialized agents.
Parallelize where indicated. Wait for dependencies before proceeding.
```

---

## Success Criteria

- [ ] All TUI components render matching mockup designs
- [ ] Keyboard navigation works (j/k, arrows, Enter, Escape)
- [ ] Theme uses CSS variables (no hardcoded colors)
- [ ] Build passes without errors
- [ ] All screens accessible via router
- [ ] Modals open/close properly
- [ ] Footer shows context-appropriate shortcuts
