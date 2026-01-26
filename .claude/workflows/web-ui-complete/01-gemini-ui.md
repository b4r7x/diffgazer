# Web UI - Gemini Workflow (UI & Design)

**Model:** Gemini 3 Pro
**Focus:** Design system, UI components, visual layout, animations

This workflow creates all visual elements. Use mock data for now - Opus will wire the backend.

---

## Context

You are building the web UI for Stargazer - a local-only AI code review tool. The UI should:
- Mirror the CLI functionality (main menu, review, history, settings)
- Use WebTUI CSS library for terminal aesthetic
- Follow Bulletproof React architecture
- Use Catppuccin Mocha colors with cyan "Stargazer" accent

### Design Reference

The CLI has these views that web needs to replicate:
- Main menu with actions (review, history, settings)
- Split pane review screen (agent panel | issue list | issue details)
- Agent activity panel with real-time status
- Issue tabs (details, explain, patch, trace)
- Review history list
- Settings/onboarding wizard

### Tech Stack

- Vite + React 18
- TanStack Router (already configured)
- WebTUI CSS (to install)
- Tailwind CSS (utilities only, not design tokens)
- Base UI headless components (already installed)

---

## Phase 1: Design System Setup

### 1.1 Install WebTUI

```bash
cd apps/web
pnpm add @webtui/css @webtui/theme-catppuccin
```

### 1.2 Create Stargazer Theme

Create `apps/web/src/styles/theme.css`:

```css
/* WebTUI base - must define layers first */
@layer base, utils, components;

/* WebTUI imports */
@import '@webtui/css';
@import '@webtui/theme-catppuccin';

/* Stargazer Theme (Catppuccin Mocha base) */
:root {
  /* Font */
  --font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  --font-size: 14px;
  --line-height: 1.5;

  /* Backgrounds (Catppuccin Mocha) */
  --background0: #1e1e2e;
  --background1: #181825;
  --background2: #313244;
  --background3: #45475a;

  /* Foregrounds */
  --foreground0: #cdd6f4;
  --foreground1: #bac2de;
  --foreground2: #a6adc8;

  /* Borders */
  --box-border-color: #45475a;
  --table-border-color: #45475a;
  --separator-color: #45475a;

  /* Stargazer Accent (Cyan) */
  --accent: #89dceb;
  --accent-muted: #74c7ec;
  --accent-dim: #6c7086;

  /* Catppuccin accent colors */
  --red: #f38ba8;
  --peach: #fab387;
  --yellow: #f9e2af;
  --green: #a6e3a1;
  --teal: #94e2d5;
  --blue: #89b4fa;
  --mauve: #cba6f7;
  --pink: #f5c2e7;

  /* Severity colors */
  --severity-blocker: var(--red);
  --severity-high: var(--peach);
  --severity-medium: var(--yellow);
  --severity-low: var(--blue);
  --severity-nit: var(--foreground2);

  /* Status colors */
  --status-running: var(--accent);
  --status-complete: var(--green);
  --status-pending: var(--foreground2);
  --status-error: var(--red);

  /* Diff colors */
  --diff-add: #a6e3a133;
  --diff-remove: #f38ba833;
  --diff-add-text: var(--green);
  --diff-remove-text: var(--red);
}

/* Dark mode is default */
html {
  background-color: var(--background0);
  color: var(--foreground0);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--background1);
}

::-webkit-scrollbar-thumb {
  background: var(--background3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent-dim);
}
```

### 1.3 Update index.css

Update `apps/web/src/index.css`:

```css
@import './styles/theme.css';
@import 'tailwindcss/utilities';

/* Global resets */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background-color: var(--background0);
}

/* Focus visible */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Selection */
::selection {
  background-color: var(--accent);
  color: var(--background0);
}
```

### 1.4 Update Tailwind Config

Update `apps/web/tailwind.config.ts` to use CSS variables:

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          0: 'var(--background0)',
          1: 'var(--background1)',
          2: 'var(--background2)',
          3: 'var(--background3)',
        },
        foreground: {
          0: 'var(--foreground0)',
          1: 'var(--foreground1)',
          2: 'var(--foreground2)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          muted: 'var(--accent-muted)',
          dim: 'var(--accent-dim)',
        },
        severity: {
          blocker: 'var(--severity-blocker)',
          high: 'var(--severity-high)',
          medium: 'var(--severity-medium)',
          low: 'var(--severity-low)',
          nit: 'var(--severity-nit)',
        },
        status: {
          running: 'var(--status-running)',
          complete: 'var(--status-complete)',
          pending: 'var(--status-pending)',
          error: 'var(--status-error)',
        },
      },
      fontFamily: {
        mono: ['var(--font-family)'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

**Validation:** `pnpm build` - Theme should apply correctly

---

## Phase 2: UI Primitives

Create WebTUI-styled React components in `apps/web/src/components/ui/`.

### 2.1 Button Component

Create `apps/web/src/components/ui/button.tsx`:

```typescript
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'destructive' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn('webtui-button', className)}
        variant-={variant === 'primary' ? 'primary' : undefined}
        box-={variant === 'outline' ? 'outline' : undefined}
        size-={size}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

### 2.2 Badge Component

Create `apps/web/src/components/ui/badge.tsx`:

```typescript
import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline'
  severity?: 'blocker' | 'high' | 'medium' | 'low' | 'nit'
}

const severityColors = {
  blocker: 'bg-severity-blocker text-background-0',
  high: 'bg-severity-high text-background-0',
  medium: 'bg-severity-medium text-background-0',
  low: 'bg-severity-low text-background-0',
  nit: 'bg-severity-nit text-background-0',
}

export function Badge({ className, variant, severity, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'webtui-badge',
        severity && severityColors[severity],
        className
      )}
      variant-={variant}
      {...props}
    />
  )
}
```

### 2.3 Card Component

Create `apps/web/src/components/ui/card.tsx`:

```typescript
import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-background-2 border border-[var(--box-border-color)] rounded-md p-4',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-3', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-foreground-0 font-bold text-lg', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-foreground-1', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'
```

### 2.4 Additional UI Components

Create these following the same WebTUI + Tailwind pattern:

| Component | File | WebTUI Class |
|-----------|------|--------------|
| Input | `input.tsx` | `webtui-input` |
| Textarea | `textarea.tsx` | `webtui-textarea` |
| Select | `select.tsx` | `webtui-select` |
| Progress | `progress.tsx` | `webtui-progress` |
| Spinner | `spinner.tsx` | `webtui-spinner` |
| Separator | `separator.tsx` | `webtui-separator` |
| Dialog | `dialog.tsx` | `webtui-dialog` + Base UI |
| Tabs | `tabs.tsx` | Custom + Base UI |
| Tooltip | `tooltip.tsx` | `webtui-tooltip` + Base UI |

### 2.5 Create barrel export

Create `apps/web/src/components/ui/index.ts`:

```typescript
export { Button, type ButtonProps } from './button'
export { Badge, type BadgeProps } from './badge'
export { Card, CardHeader, CardTitle, CardContent } from './card'
export { Input } from './input'
export { Textarea } from './textarea'
export { Select } from './select'
export { Progress } from './progress'
export { Spinner } from './spinner'
export { Separator } from './separator'
export { Dialog } from './dialog'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
export { Tooltip } from './tooltip'
```

**Validation:** All components render with correct styling

---

## Phase 3: Layout Components

### 3.1 Header Component

Create `apps/web/src/components/layout/header.tsx`:

```typescript
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  provider?: string
  model?: string
}

export function Header({ provider, model }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--box-border-color)] bg-background-1">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 hover:opacity-80">
          <span className="text-xl">⭐</span>
          <span className="text-accent font-bold">stargazer</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <NavLink to="/">Menu</NavLink>
          <NavLink to="/review">Review</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {provider && (
          <Badge variant="outline">
            {provider} {model && `/ ${model}`}
          </Badge>
        )}
      </div>
    </header>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1 rounded text-foreground-1 hover:text-foreground-0 hover:bg-background-2 transition-colors"
      activeProps={{ className: 'text-accent bg-background-2' }}
    >
      {children}
    </Link>
  )
}
```

### 3.2 Footer Bar Component

Create `apps/web/src/components/layout/footer-bar.tsx`:

```typescript
interface Shortcut {
  key: string
  label: string
}

interface FooterBarProps {
  shortcuts?: Shortcut[]
}

export function FooterBar({ shortcuts = [] }: FooterBarProps) {
  return (
    <footer className="flex items-center gap-4 px-4 py-2 border-t border-[var(--box-border-color)] bg-background-1 text-sm">
      {shortcuts.map((shortcut) => (
        <div key={shortcut.key} className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background-3 rounded text-foreground-2 text-xs">
            {shortcut.key}
          </kbd>
          <span className="text-foreground-2">{shortcut.label}</span>
        </div>
      ))}
    </footer>
  )
}
```

### 3.3 Sidebar Component (Optional)

Create `apps/web/src/components/layout/sidebar.tsx`:

```typescript
import { Link } from '@tanstack/react-router'

const menuItems = [
  { icon: '📝', label: 'Review', to: '/review' },
  { icon: '📜', label: 'History', to: '/history' },
  { icon: '💬', label: 'Sessions', to: '/sessions' },
  { icon: '⚙️', label: 'Settings', to: '/settings' },
]

export function Sidebar() {
  return (
    <aside className="w-48 border-r border-[var(--box-border-color)] bg-background-1 flex flex-col">
      {menuItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex items-center gap-2 px-4 py-3 text-foreground-1 hover:bg-background-2 hover:text-foreground-0"
          activeProps={{ className: 'bg-background-2 text-accent border-l-2 border-accent' }}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </aside>
  )
}
```

### 3.4 Split Pane Component

Create `apps/web/src/components/layout/split-pane.tsx`:

```typescript
import { type ReactNode } from 'react'

interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  leftWidth?: string | number
  className?: string
}

export function SplitPane({
  left,
  right,
  leftWidth = '40%',
  className,
}: SplitPaneProps) {
  return (
    <div className={`flex h-full ${className ?? ''}`}>
      <div
        className="flex-shrink-0 border-r border-[var(--box-border-color)] overflow-auto"
        style={{ width: leftWidth }}
      >
        {left}
      </div>
      <div className="flex-1 overflow-auto">{right}</div>
    </div>
  )
}
```

**Validation:** Layout renders correctly

---

## Phase 4: Feature Components (Visual Only)

### 4.1 Main Menu View

Create `apps/web/src/features/menu/components/main-menu.tsx`:

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface MainMenuProps {
  provider?: string
  model?: string
  lastReviewAt?: string
  onAction?: (action: string) => void
}

const menuItems = [
  { key: 'r', label: 'Review unstaged changes', action: 'review-unstaged' },
  { key: 'R', label: 'Review staged changes', action: 'review-staged' },
  { key: 'f', label: 'Review specific files...', action: 'review-files' },
  { key: 'l', label: 'Resume last review', action: 'resume-review' },
  { key: 'h', label: 'History', action: 'history' },
  { key: 's', label: 'Settings', action: 'settings' },
]

export function MainMenu({ provider, model, lastReviewAt, onAction }: MainMenuProps) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Brand */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-accent mb-2">
          ⭐ stargazer
        </h1>
        <p className="text-foreground-2">AI-powered code review</p>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-foreground-2">Provider:</span>
            <Badge variant="outline">
              {provider || 'Not configured'}
              {model && ` / ${model}`}
            </Badge>
          </div>
          {lastReviewAt && (
            <span className="text-foreground-2 text-sm">
              Last review: {lastReviewAt}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground-2 text-sm uppercase tracking-wide">
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.action}
              onClick={() => onAction?.(item.action)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-background-3 text-left transition-colors group"
            >
              <kbd className="px-2 py-0.5 bg-background-3 rounded text-foreground-2 text-sm group-hover:bg-accent group-hover:text-background-0">
                {item.key}
              </kbd>
              <span className="text-foreground-1 group-hover:text-foreground-0">
                {item.label}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4.2 Agent Activity Panel

Create `apps/web/src/features/agents/components/agent-activity-panel.tsx`:

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface Agent {
  id: string
  name: string
  emoji: string
  status: 'queued' | 'running' | 'complete'
  currentAction?: string
  issueCount: number
}

interface AgentActivityPanelProps {
  agents: Agent[]
  currentAction?: string
}

export function AgentActivityPanel({ agents, currentAction }: AgentActivityPanelProps) {
  const allComplete = agents.length > 0 && agents.every((a) => a.status === 'complete')
  const totalIssues = agents.reduce((sum, a) => sum + a.issueCount, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Agent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}

        {allComplete && (
          <div className="pt-3 mt-3 border-t border-[var(--separator-color)]">
            <p className="text-status-complete">Review complete</p>
            <p className="text-foreground-2 text-sm">
              {agents.length} agents • {totalIssues} issues
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AgentRow({ agent }: { agent: Agent }) {
  const statusIcon = {
    queued: '○',
    running: '',
    complete: '✓',
  }

  const statusColor = {
    queued: 'text-status-pending',
    running: 'text-status-running',
    complete: 'text-status-complete',
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {agent.status === 'running' ? (
          <Spinner className="w-4 h-4" />
        ) : (
          <span className={statusColor[agent.status]}>
            {statusIcon[agent.status]}
          </span>
        )}
        <span className={agent.status === 'queued' ? 'text-foreground-2' : ''}>
          {agent.emoji} {agent.name}
        </span>
        {agent.status === 'complete' && agent.issueCount > 0 && (
          <span className="text-severity-medium text-sm ml-auto">
            {agent.issueCount} issue{agent.issueCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {agent.status === 'running' && agent.currentAction && (
        <p className="text-foreground-2 text-sm pl-6">
          └─ {agent.currentAction}
        </p>
      )}
    </div>
  )
}
```

### 4.3 Issue List Component

Create `apps/web/src/features/review/components/issue-list.tsx`:

```typescript
import { Badge } from '@/components/ui/badge'
import type { TriageIssue } from '@repo/schemas/triage'

interface IssueListProps {
  issues: TriageIssue[]
  selectedId?: string
  onSelect?: (id: string) => void
}

export function IssueList({ issues, selectedId, onSelect }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="p-4 text-center text-foreground-2">
        No issues found
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--separator-color)]">
      {issues.map((issue) => (
        <IssueItem
          key={issue.id}
          issue={issue}
          isSelected={issue.id === selectedId}
          onSelect={() => onSelect?.(issue.id)}
        />
      ))}
    </div>
  )
}

function IssueItem({
  issue,
  isSelected,
  onSelect,
}: {
  issue: TriageIssue
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 hover:bg-background-2 transition-colors ${
        isSelected ? 'bg-background-2 border-l-2 border-accent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground-0 truncate">{issue.title}</p>
          <p className="text-sm text-foreground-2 truncate">
            {issue.file_path}:{issue.line_start}
          </p>
        </div>
        <Badge severity={issue.severity}>{issue.severity}</Badge>
      </div>
    </button>
  )
}
```

### 4.4 Issue Details Component

Create `apps/web/src/features/review/components/issue-details.tsx`:

```typescript
import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/ui/code-block'
import type { TriageIssue } from '@repo/schemas/triage'

interface IssueDetailsProps {
  issue: TriageIssue | null
  onApplyPatch?: (id: string) => void
  onExplain?: (id: string) => void
}

export function IssueDetails({ issue, onApplyPatch, onExplain }: IssueDetailsProps) {
  const [activeTab, setActiveTab] = useState('details')

  if (!issue) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-2">
        Select an issue to view details
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--separator-color)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg text-foreground-0">{issue.title}</h2>
            <p className="text-foreground-2 text-sm mt-1">
              {issue.file_path}:{issue.line_start}
              {issue.line_end !== issue.line_start && `-${issue.line_end}`}
            </p>
          </div>
          <Badge severity={issue.severity} className="flex-shrink-0">
            {issue.severity}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          {issue.suggested_patch && (
            <Button size="sm" onClick={() => onApplyPatch?.(issue.id)}>
              Apply Patch
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onExplain?.(issue.id)}>
            Explain
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="px-4 border-b border-[var(--separator-color)]">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="explain">Explain</TabsTrigger>
          {issue.suggested_patch && <TabsTrigger value="patch">Patch</TabsTrigger>}
          {issue.trace?.length && <TabsTrigger value="trace">Trace</TabsTrigger>}
        </TabsList>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="details">
            <div className="space-y-4">
              <div>
                <h3 className="text-foreground-2 text-sm uppercase mb-2">Description</h3>
                <p className="text-foreground-1">{issue.body}</p>
              </div>
              {issue.code_context && (
                <div>
                  <h3 className="text-foreground-2 text-sm uppercase mb-2">Code Context</h3>
                  <CodeBlock code={issue.code_context} />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="explain">
            <p className="text-foreground-2">
              Click "Explain" to get AI-generated explanation.
            </p>
          </TabsContent>

          <TabsContent value="patch">
            {issue.suggested_patch && (
              <CodeBlock code={issue.suggested_patch} language="diff" />
            )}
          </TabsContent>

          <TabsContent value="trace">
            <div className="space-y-2 text-sm font-mono">
              {issue.trace?.map((entry, i) => (
                <div key={i} className="text-foreground-2">
                  {entry}
                </div>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
```

### 4.5 Review Split Screen

Create `apps/web/src/features/review/components/review-screen.tsx`:

```typescript
import { useState } from 'react'
import { SplitPane } from '@/components/layout/split-pane'
import { AgentActivityPanel } from '@/features/agents/components/agent-activity-panel'
import { IssueList } from './issue-list'
import { IssueDetails } from './issue-details'
import type { TriageIssue } from '@repo/schemas/triage'

interface ReviewScreenProps {
  issues: TriageIssue[]
  agents: Array<{
    id: string
    name: string
    emoji: string
    status: 'queued' | 'running' | 'complete'
    currentAction?: string
    issueCount: number
  }>
  isReviewing?: boolean
  onApplyPatch?: (id: string) => void
  onExplain?: (id: string) => void
}

export function ReviewScreen({
  issues,
  agents,
  isReviewing,
  onApplyPatch,
  onExplain,
}: ReviewScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    issues[0]?.id ?? null
  )

  const selectedIssue = issues.find((i) => i.id === selectedId) ?? null
  const showAgentPanel = isReviewing || agents.some((a) => a.status !== 'complete')

  return (
    <div className="h-full flex">
      {/* Agent Panel */}
      {showAgentPanel && (
        <div className="w-64 flex-shrink-0 border-r border-[var(--box-border-color)] p-4">
          <AgentActivityPanel agents={agents} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1">
        <SplitPane
          leftWidth="40%"
          left={
            <IssueList
              issues={issues}
              selectedId={selectedId ?? undefined}
              onSelect={setSelectedId}
            />
          }
          right={
            <IssueDetails
              issue={selectedIssue}
              onApplyPatch={onApplyPatch}
              onExplain={onExplain}
            />
          }
        />
      </div>
    </div>
  )
}
```

### 4.6 Review History List

Create `apps/web/src/features/history/components/history-list.tsx`:

```typescript
import { Badge } from '@/components/ui/badge'
import type { ReviewHistoryEntry } from '@repo/schemas/review-history'

interface HistoryListProps {
  reviews: ReviewHistoryEntry[]
  onSelect?: (id: string) => void
}

export function HistoryList({ reviews, onSelect }: HistoryListProps) {
  if (reviews.length === 0) {
    return (
      <div className="p-8 text-center text-foreground-2">
        <p className="text-2xl mb-2">📜</p>
        <p>No review history yet</p>
        <p className="text-sm mt-1">Start a review to see it here</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--separator-color)]">
      {reviews.map((review) => (
        <HistoryItem key={review.id} review={review} onSelect={onSelect} />
      ))}
    </div>
  )
}

function HistoryItem({
  review,
  onSelect,
}: {
  review: ReviewHistoryEntry
  onSelect?: (id: string) => void
}) {
  const issueCount = review.summary?.totalIssues ?? 0
  const date = new Date(review.startedAt).toLocaleDateString()

  return (
    <button
      onClick={() => onSelect?.(review.id)}
      className="w-full text-left p-4 hover:bg-background-2 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground-0">
            {review.scope.type === 'unstaged' ? 'Unstaged changes' :
             review.scope.type === 'staged' ? 'Staged changes' :
             `${review.scope.files?.length ?? 0} files`}
          </p>
          <p className="text-sm text-foreground-2">{date}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-foreground-2">{issueCount} issues</span>
          <Badge variant="outline">{review.status}</Badge>
        </div>
      </div>
    </button>
  )
}
```

**Validation:** All feature components render with mock data

---

## Phase 5: Routes

### 5.1 Root Layout

Update `apps/web/src/app/routes/__root.tsx`:

```typescript
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { FooterBar } from '@/components/layout/footer-bar'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background-0">
      <Header />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <FooterBar
        shortcuts={[
          { key: 'r', label: 'review' },
          { key: 'h', label: 'history' },
          { key: 's', label: 'settings' },
        ]}
      />
    </div>
  )
}
```

### 5.2 Index Route (Main Menu)

Update `apps/web/src/app/routes/index.tsx`:

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MainMenu } from '@/features/menu/components/main-menu'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()

  const handleAction = (action: string) => {
    switch (action) {
      case 'review-unstaged':
      case 'review-staged':
      case 'review-files':
        navigate({ to: '/review' })
        break
      case 'history':
        navigate({ to: '/history' })
        break
      case 'settings':
        navigate({ to: '/settings' })
        break
    }
  }

  return (
    <MainMenu
      provider="anthropic"
      model="claude-sonnet-4"
      onAction={handleAction}
    />
  )
}
```

### 5.3 Review Route

Update `apps/web/src/app/routes/review/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { ReviewScreen } from '@/features/review/components/review-screen'

export const Route = createFileRoute('/review/')({
  component: ReviewPage,
})

// Mock data for now - Opus will wire real data
const mockAgents = [
  { id: '1', name: 'Detective', emoji: '🔍', status: 'complete' as const, issueCount: 3 },
  { id: '2', name: 'Guardian', emoji: '🛡️', status: 'running' as const, currentAction: 'Analyzing auth patterns...', issueCount: 0 },
  { id: '3', name: 'Optimizer', emoji: '⚡', status: 'queued' as const, issueCount: 0 },
]

const mockIssues = [
  {
    id: '1',
    title: 'Potential null reference',
    body: 'The variable may be null at this point.',
    severity: 'high' as const,
    file_path: 'src/utils/parser.ts',
    line_start: 42,
    line_end: 42,
    code_context: 'const result = data.items.map(x => x.value)',
    suggested_patch: '- const result = data.items.map(x => x.value)\n+ const result = data?.items?.map(x => x.value) ?? []',
  },
  {
    id: '2',
    title: 'Missing error handling',
    body: 'API call should handle errors.',
    severity: 'medium' as const,
    file_path: 'src/api/client.ts',
    line_start: 15,
    line_end: 20,
    code_context: 'await fetch(url)',
  },
]

function ReviewPage() {
  return (
    <ReviewScreen
      issues={mockIssues}
      agents={mockAgents}
      isReviewing={true}
    />
  )
}
```

### 5.4 History Route

Create `apps/web/src/app/routes/history.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { HistoryList } from '@/features/history/components/history-list'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

// Mock data for now
const mockReviews = [
  {
    id: '1',
    startedAt: new Date().toISOString(),
    status: 'completed' as const,
    scope: { type: 'unstaged' as const },
    summary: { totalIssues: 5 },
  },
  {
    id: '2',
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'completed' as const,
    scope: { type: 'files' as const, files: ['src/app.ts', 'src/utils.ts'] },
    summary: { totalIssues: 2 },
  },
]

function HistoryPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-foreground-0 mb-4">Review History</h1>
      <HistoryList reviews={mockReviews} />
    </div>
  )
}
```

### 5.5 Settings Route

Update `apps/web/src/app/routes/settings.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold text-foreground-0">Settings</h1>

      {/* Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-foreground-2 mb-1">Provider</label>
            <Select>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-foreground-2 mb-1">Model</label>
            <Select>
              <option value="claude-sonnet-4">Claude Sonnet 4</option>
              <option value="claude-opus-4">Claude Opus 4</option>
            </Select>
          </div>
          <Button>Save</Button>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-sm text-foreground-2 mb-1">Theme</label>
            <Select>
              <option value="dark">Dark (Stargazer)</option>
              <option value="light">Light</option>
              <option value="auto">System</option>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Validation:** All routes render with correct layout

---

## Phase 6: Polish

### 6.1 Add Animations

Add to `apps/web/src/styles/theme.css`:

```css
/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

.animate-slide-in {
  animation: slideIn 0.2s ease-out;
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}

/* Transitions */
.transition-colors {
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 6.2 Create Code Block Component

Create `apps/web/src/components/ui/code-block.tsx`:

```typescript
interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const lines = code.split('\n')

  return (
    <div className="bg-background-1 rounded border border-[var(--box-border-color)] overflow-hidden">
      <pre className="p-3 overflow-x-auto text-sm font-mono">
        <code>
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                language === 'diff'
                  ? line.startsWith('+')
                    ? 'bg-[var(--diff-add)] text-[var(--diff-add-text)]'
                    : line.startsWith('-')
                    ? 'bg-[var(--diff-remove)] text-[var(--diff-remove-text)]'
                    : ''
                  : ''
              }
            >
              <span className="text-foreground-2 select-none mr-4 inline-block w-8 text-right">
                {i + 1}
              </span>
              {line || ' '}
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}
```

### 6.3 Loading States

Create `apps/web/src/components/ui/skeleton.tsx`:

```typescript
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-background-3 rounded animate-pulse',
        className
      )}
    />
  )
}
```

**Validation:**
```bash
pnpm type-check
pnpm build
pnpm dev  # Manual visual check
```

---

## Deliverables Checklist

After completing this workflow, you should have:

- [ ] WebTUI installed and configured
- [ ] Stargazer theme CSS variables
- [ ] All UI primitives (Button, Badge, Card, Input, etc.)
- [ ] Layout components (Header, Footer, SplitPane)
- [ ] Main menu with actions
- [ ] Agent activity panel
- [ ] Issue list component
- [ ] Issue details with tabs
- [ ] Review split screen
- [ ] History list
- [ ] Settings page (visual)
- [ ] All routes configured
- [ ] Animations and polish
- [ ] No TypeScript errors
- [ ] Build passes

**Next:** Run `02-opus-integration.md` to wire everything to the backend.
