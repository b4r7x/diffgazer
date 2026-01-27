# Stargazer Component Library Specification

**Analysis Date:** January 27, 2026
**Screens Analyzed:** 26 mockups
**Design System:** TUI (GitHub Dark) + Modern React Web

---

## Design System Tokens

### Colors (TUI Theme - GitHub Dark)

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#0D1117` | All backgrounds |
| Foreground | `#C9D1D9` | Default text |
| Primary Blue | `#58A6FF` | Buttons, links, highlights |
| Secondary Violet | `#BC8CFF` | Secondary actions |
| Success Green | `#3FB950` | Passed, checked, success |
| Error Red | `#FF7B72` | Blocker severity, errors |
| Warning Yellow | `#D29922` | Medium severity, warnings |
| Border | `#30363D` | Borders, dividers |
| Selection | `#1F2428` | Hover states |

**Severity Colors:**
- Blocker: `#FF7B72`
- High: `#F0883E`
- Medium: `#D29922`
- Low: `#3FB950`
- Nitpick: `#58A6FF`

### Typography

| Element | Font | Size |
|---------|------|------|
| Body/Default | JetBrains Mono | 13px |
| Labels | JetBrains Mono | 10px |
| Small | JetBrains Mono | 11px |
| Heading | JetBrains Mono | 14px |
| Title | JetBrains Mono | 20px+ |

### Spacing System

- **Tight:** 0.25rem (4px), 0.5rem (8px)
- **Standard:** 1rem (16px), 1.5rem (24px)
- **Large:** 2rem (32px), 3rem (48px)

---

## Components by Category

### Layout Components

#### Header

**Usage:** Top navigation with logo, status, and breadcrumbs

**Variants:**
- `default` - Main header with logo, title, status
- `wizard` - Setup wizard with progress
- `minimal` - Web-only simplified header

**Visual Structure:**
```
┌─────────────────────────────────────────────────┐
│ ◆ stargazer ◆  [breadcrumb]  Status: Ready     │
└─────────────────────────────────────────────────┘
```

**Props:**
```typescript
{
  title: string;
  status?: string;
  breadcrumb?: string[];
  showLogo?: boolean;
  variant?: 'default' | 'wizard' | 'minimal';
}
```

#### Footer

**Usage:** Bottom status bar with keyboard shortcuts

**Visual Structure:**
```
┌─────────────────────────────────────────────────┐
│ T/1: Select  Enter: Open  Esc: Back  q: Quit  │
└─────────────────────────────────────────────────┘
```

**Variants:**
- `default` - Full shortcuts
- `minimal` - Essential keys only

#### SplitPane

**Usage:** Two-column layout for sidebar + main content

**Variants:**
- `context_left` - 20% context, 80% main
- `equal` - 50/50 split
- `list_detail` - 30% list, 70% detail

```
┌──────────┬──────────────┐
│ Context  │              │
│ Panel    │ Main Content │
│          │              │
└──────────┴──────────────┘
```

#### Modal

**Usage:** Centered dialog with double-line ASCII border

**Variants:**
- `dialog` - Information/confirmation
- `form` - Input forms
- `warning` - Security warnings

```
     ╔════════════════════════╗
     ║ Modal Title           ║
     ╠════════════════════════╣
     ║                        ║
     ║  Content here...       ║
     ║                        ║
     ╠════════════════════════╣
     ║ [ Save ]  [ Cancel ]   ║
     ╚════════════════════════╝
```

---

### Navigation Components

#### Menu / MenuItem

**Usage:** Vertical list of selectable options with keyboard shortcuts

**Visual Structure:**
```
MAIN MENU
 [1] Start New Review        ← selected (blue background)
 [2] Resume Last Run
 [3] History
 [4] Settings
 [5] Help
```

**MenuItem Variants:**
- `default` - Normal text
- `selected` - Blue background, bold
- `disabled` - Muted color

**Props:**
```typescript
MenuItem {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  shortcut?: string | number;
}
```

#### TabNav / TabItem

**Usage:** Multi-view navigation within screens

**Variants:**
- `horizontal` - Review detail tabs (Summary, Evidence, Trace)
- `text_based` - Settings tabs with underline

**Visual Structure:**
```
[Review Runs]  Sessions
─────────────  ────────
(underline on active tab)
```

---

### Data Display Components

#### Table

**Usage:** Columnar display of structured data (review history, results list)

**Column Types:**
- Review History: ID | Date | Scope | Provider | Stats
- Issues List: File | Line | Severity | Title | Suggestion
- Sessions: ID | Date | Scope | Provider | Status

**Features:**
- Monospace alignment
- Fixed-width columns
- Row selection with highlight
- Optional striping

**Visual Structure:**
```
┌─────────────────────────────────────────────┐
│ ID      Date      Scope       Status        │
├─────────────────────────────────────────────┤
│ #8821   10-24     Unstaged    20 Issues   ← │ (selected)
│ #8820   10-23     Staged      0 Issues      │
│ #8819   10-22     feat/auth   4 Issues      │
└─────────────────────────────────────────────┘
```

#### IssueCard

**Usage:** Individual issue display in lists and detail views

**Variants:**
- `compact` - Single line with severity
- `expanded` - Full details with code
- `inline` - Web view with syntax highlighting

**Visual Structure (Compact):**
```
[CRITICAL] Potential SQL Injection
  File: src/auth/login.ts:43
  The input parameter is concatenated...
  Fix: Use parameterized queries
```

**Visual Structure (Expanded):**
```
╔════════════════════════════════════╗
║ [CRITICAL] Potential SQL Injection ║
╠════════════════════════════════════╣
║ File: src/auth/login.ts:43         ║
║ Description: The input parameter... ║
║                                    ║
║ Evidence    Trace    Patch         ║
║ ─────────────────────────────────  ║
║ [code block with evidence]        ║
╚════════════════════════════════════╝
```

#### CodeBlock

**Usage:** Display code with diff highlighting and line numbers

**Variants:**
- `diff` - Green (+) and Red (-) lines
- `snippet` - Example code
- `trace` - Stack traces with line numbers

**Features:**
- Line numbers (optional)
- Syntax highlighting (web) or monospace (CLI)
- Diff coloring (addition/deletion)

```
 39  const query = 'SELECT * FROM users WHERE user = "' + username + '"';
           ↑ additions shown in green
 42  const result = await db.query(query);
           ↑ optional syntax highlighting
```

#### Badge

**Usage:** Small status/severity labels

**Variants:**
```
[BLOCKER]  [HIGH]  [MEDIUM]  [LOW]  [NIT]  [✓ PASSED]
  red       orange   yellow  green  blue    green
```

**Usage Contexts:**
- Severity indicators on issues
- Status indicators (passed, failed)
- Trust status (trusted directory)
- Generic tags

#### StatusDot

**Usage:** Colored indicator for status state

**Colors:**
- Passed: Green `#3FB950`
- Warning: Yellow `#D29922`
- Error: Red `#FF7B72`
- Pending: Blue `#58A6FF`

**Visual:** `● ● ● ●` (colored circles)

#### Breadcrumb

**Usage:** Navigation path indicator

**Visual:**
```
CLI > Config > Advanced Settings
```

---

### Form Components

#### Input

**Usage:** Text input for user entry

**Variants:**
- `text` - General text input
- `password` - Masked input for API keys (shows asterisks)
- `search` - Filter/search input
- `env_var` - Environment variable path (shows `$` prefix)

**Visual Structure:**
```
┌────────────────────────────────┐
│ KEY: **********************●   │ (● = cursor)
└────────────────────────────────┘

Or with label:
API KEY
┌────────────────────────────────┐
│ sk_live_****│                  │ (│ = cursor)
└────────────────────────────────┘
```

**Features:**
- Blinking cursor animation
- Character masking for passwords
- Placeholder text support
- Max length enforcement

#### Checkbox

**Usage:** Binary toggle for permissions and settings

**Visual:**
```
[x] Allow reading repository files
[ ] Allow reading git metadata
[x] Run commands (tests/lint)
```

**Props:**
```typescript
{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}
```

#### RadioGroup

**Usage:** Mutually exclusive selection

**Variants:**
- `vertical` - Stacked options (theme selection, provider choice)
- `horizontal` - Side-by-side options (mode selection)

**Visual:**
```
( ) OpenAI
(x) Gemini
( ) Anthropic
( ) Local (Ollama)
```

#### Button

**Usage:** Clickable action

**Variants:**
```
[ Start Review Now ]  ← primary (blue background)
[ Open Docs ]        ← secondary (border only)
[ Revoke Trust ]     ← destructive (red border)
[ Settings ]         ← ghost (text only)
```

**Features:**
- Bracket notation `[ ]`
- Keyboard shortcut display
- Disabled state support
- Hover highlight

#### Select

**Usage:** Dropdown menu for options

**Visual:**
```
( ) OpenAI
(x) Gemini         ← selected
( ) Anthropic
```

---

### Feedback Components

#### Alert / Warning Box

**Usage:** Inline notifications

**Variants:**
- `warning` - Yellow border, security notices
- `error` - Red border, failures
- `info` - Blue border, information
- `success` - Green border, confirmations

**Visual:**
```
╭─ ⚠ SECURITY WARNING ─────────────────────╮
│ Enabling 'Run commands' allows the AI    │
│ to execute shell scripts. This grants    │
│ significant access to your system.       │
╰──────────────────────────────────────────╯
```

#### Spinner

**Usage:** Loading indicator

**Animation Styles:**
- `default` - Rotating: `/ | \ -`
- `dots` - Cycling: `. .. ...`
- `bars` - Cycling: `▁ ▂ ▃ ▄ ▅ ▆ ▇ █`

**Visual:**
```
● Analyzing changes...   (animated spinner)
```

#### Progress

**Usage:** Progress indication

**Variants:**
- `bar` - Filled/unfilled ASCII blocks
- `dots` - Step indicators

**Visual:**
```
████████░░░░░░░░  50%

or

●●●○○
```

#### Toast (Web only)

**Usage:** Temporary notification popup

**Variants:** success, error, info

---

## Screen Patterns

### Welcome/Landing Screen
- ASCII art logo
- Feature bullet list
- Quick start code examples
- Button group for main actions

### Menu Screen
- SplitPane layout
- Left: Context panel (trusted dir, provider, last run)
- Right: Main menu with shortcuts
- Footer with keyboard hints

### Trust Wizard
- Centered modal
- Permission checkboxes
- Current directory display
- Security warning box
- Action buttons

### Settings Hub
- TabNav or SplitPane
- Provider list with selection
- Model preset buttons
- Configuration fields
- Toggle switches for behavior

### Review History
- TabNav (Review Runs, Sessions)
- Full-width Table
- Status badges and indicators
- Action shortcuts in footer

### Issue Detail Screen
- SplitPane: Issue list | Details
- Issue list: Severity indicator, title, file:line
- Details: CodeBlock, Evidence tab, Trace tab
- Drilldown actions

### Help Screen
- Collapsible FAQ items
- Category tags for filtering
- Code examples in CodeBlocks
- Search/filter support

---

## Implementation Guidelines

### CLI (React Ink)

Use these patterns for all CLI components:

```typescript
// Layout
<Box flexDirection="column" marginTop={1}>
  <Text color={colors.primary}>Header</Text>
  <Box flexDirection="row">
    <Box width="30%">{/* sidebar */}</Box>
    <Box width="70%">{/* content */}</Box>
  </Box>
</Box>

// Colors
<Text color={colors.severity.blocker}>Critical</Text>
<Text color={colors.ui.success} bold>Fixed</Text>

// Selection state
<Text color={isSelected ? colors.primary : colors.muted}>
  {isSelected ? '>' : ' '} Menu Item
</Text>
```

### Web (React + Tailwind)

Use these patterns for all web components:

```typescript
// CVA pattern
const buttonVariants = cva('px-3 py-1 border rounded', {
  variants: {
    variant: {
      primary: 'bg-[#58A6FF] text-black',
      secondary: 'border-[#58A6FF] text-[#58A6FF]',
      destructive: 'border-[#FF7B72] text-[#FF7B72]',
    },
  },
});

// Component
<div className={cn(buttonVariants({ variant }))}>
  Action
</div>
```

### Shared Principles

1. **Single source of truth for types** - Use `@repo/schemas`
2. **Color tokens** - Never hardcode colors, use theme tokens
3. **Spacing grid** - Multiples of 0.5rem (8px)
4. **Monospace typography** - JetBrains Mono everywhere
5. **Keyboard-first (CLI)** - All actions accessible via keyboard
6. **Dark mode only** - GitHub Dark palette
7. **Accessibility** - ARIA labels, semantic HTML for web

---

## Reusability Checklist

- [ ] Component has clear variants defined
- [ ] Props interface is documented
- [ ] Color/styling uses design tokens (not hardcoded)
- [ ] Component tested with all variants
- [ ] Compound components properly composed
- [ ] Error states handled
- [ ] Loading states handled
- [ ] Empty states handled
- [ ] Disabled state working
- [ ] Keyboard navigation working (CLI)
- [ ] Mobile responsive (Web)

---

## File Locations

**CLI Components:** `/apps/cli/src/features/*/components/`
**Web Components:** `/apps/web/src/components/ui/` and `/apps/web/src/features/*/components/`
**Shared Schemas:** `/packages/schemas/src/`
**Shared Utilities:** `/packages/core/src/`

---

## Component Status

### Implemented
- Layout: Header, Footer, SplitPane, Modal
- Navigation: Menu, TabNav
- Data Display: Table, IssueCard, CodeBlock, Badge, StatusDot, Breadcrumb
- Form: Input, Checkbox, RadioGroup, Button, Select
- Feedback: Alert, Spinner, Progress, Toast (web)

### Ready for Implementation
All components in this specification are extraction-ready from existing screens.

---

## Next Steps

1. Document each component individually
2. Create Storybook stories for all variants
3. Set up component testing suite
4. Create component usage examples
5. Build component library documentation site
