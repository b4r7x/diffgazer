# Create Web UI

Create the Stargazer Web UI application following Bulletproof React architecture.

## Prerequisites

Before starting, load these skills:
- `stargazer-context` - Project understanding
- `bulletproof-react` - Architecture patterns
- `web-design-guidelines` - Design principles
- `base-ui-patterns` - Component patterns

## Phase 1: Project Setup

### 1.1 Initialize Vite + React

```bash
cd apps
pnpm create vite web --template react-ts
cd web
pnpm add -D tailwindcss postcss autoprefixer
pnpm add @base-ui-components/react @tanstack/react-router class-variance-authority clsx tailwind-merge
pnpm add @repo/api @repo/schemas @repo/core
```

### 1.2 Configure Tailwind

Create `tailwind.config.ts` with:
- Dark mode: 'class'
- CSS variables for theming
- Severity colors (blocker, high, medium, low, nit)
- Custom animations (fade-in, slide-in)

### 1.3 Configure Path Aliases

Update `vite.config.ts`:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 1.4 Create Directory Structure

```
apps/web/src/
├── app/
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── review/
│   │   │   ├── index.tsx
│   │   │   └── $reviewId.tsx
│   │   └── settings.tsx
│   ├── providers.tsx
│   └── router.tsx
├── components/
│   └── ui/
├── features/
│   ├── review/
│   ├── settings/
│   └── agents/
├── hooks/
├── lib/
│   ├── api.ts
│   └── utils.ts
├── stores/
├── types/
└── main.tsx
```

---

## Phase 2: Core UI Components

### 2.1 Utility Functions

Create `src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 2.2 Button Component

Create `src/components/ui/button.tsx`:
- Use class-variance-authority for variants
- Variants: default, destructive, outline, ghost, link
- Sizes: sm, md, lg
- Support asChild pattern for composition

### 2.3 Card Component

Create `src/components/ui/card.tsx`:
- CardRoot, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- Consistent padding and border radius
- Dark mode support

### 2.4 Badge Component

Create `src/components/ui/badge.tsx`:
- Variants: default, secondary, destructive, outline
- Severity variants: blocker, high, medium, low, nit
- Use semantic colors from tailwind config

### 2.5 Dialog Component

Create `src/components/ui/dialog.tsx`:
- Use @base-ui-components/react/dialog
- DialogRoot, DialogTrigger, DialogContent, DialogTitle, DialogDescription
- Backdrop with blur
- Animation on open/close

### 2.6 Tabs Component

Create `src/components/ui/tabs.tsx`:
- Use @base-ui-components/react/tabs
- TabsRoot, TabsList, TabsTrigger, TabsContent
- Underline indicator style

### 2.7 Select Component

Create `src/components/ui/select.tsx`:
- Use @base-ui-components/react/select
- SelectRoot, SelectTrigger, SelectContent, SelectItem
- Support for disabled items

### 2.8 Skeleton Component

Create `src/components/ui/skeleton.tsx`:
- Pulse animation
- Configurable width/height

### 2.9 Progress Component

Create `src/components/ui/progress.tsx`:
- Use @base-ui-components/react/progress
- Configurable colors
- Label support

### 2.10 Input Components

Create `src/components/ui/input.tsx` and `textarea.tsx`:
- Consistent styling
- Error state
- Label integration

---

## Phase 3: Domain Components

### 3.1 Severity Badge

Create `src/features/review/components/severity-badge.tsx`:
```typescript
interface SeverityBadgeProps {
  severity: 'blocker' | 'high' | 'medium' | 'low' | 'nit';
}
```
- Use severity colors
- Include emoji: 🔴 🟠 🟡 🔵 ⚪

### 3.2 Agent Status Indicator

Create `src/features/agents/components/agent-status.tsx`:
```typescript
interface AgentStatusProps {
  status: 'queued' | 'running' | 'complete' | 'error';
  agent: AgentMeta;
  currentAction?: string;
  issueCount?: number;
}
```
- Animated spinner for running
- Checkmark for complete
- Show current action when running

### 3.3 Issue Card

Create `src/features/review/components/issue-card.tsx`:
- Display issue title, severity, file location
- Click to expand details
- Show suggested patch preview
- Hover state

### 3.4 Code Block

Create `src/components/ui/code-block.tsx`:
- Syntax highlighting (use shiki or highlight.js)
- Line numbers
- Copy button
- Language badge

### 3.5 Diff View

Create `src/features/review/components/diff-view.tsx`:
- Side-by-side or unified view
- Line highlighting for issue location
- Color coding for additions/deletions

---

## Phase 4: Feature - Review

### 4.1 Review API

Create `src/features/review/api/review-api.ts`:
```typescript
export async function streamTriage(options: TriageOptions): Promise<EventSource> {
  // Use @repo/api client
  // Return SSE stream
}

export async function getReviewHistory(): Promise<ReviewHistoryEntry[]> {
  // Fetch from /reviews
}

export async function getReview(id: string): Promise<TriageResult> {
  // Fetch single review
}
```

### 4.2 Review Hooks

Create `src/features/review/hooks/use-triage-stream.ts`:
```typescript
export function useTriageStream() {
  // Manage SSE connection
  // Parse AgentStreamEvent
  // Return { events, issues, isRunning, start, stop }
}
```

Create `src/features/review/hooks/use-agent-activity.ts`:
```typescript
export function useAgentActivity(events: AgentStreamEvent[]) {
  // Derive agent states from events
  // Return { agents, currentAction, progress }
}
```

### 4.3 Review Components

Create `src/features/review/components/`:
- `review-panel.tsx` - Main review container
- `issue-list.tsx` - List of issues with filters
- `issue-details.tsx` - Expanded issue view
- `agent-activity-panel.tsx` - Show agent progress
- `review-header.tsx` - Controls and filters

### 4.4 Review Page

Create `src/app/routes/review/index.tsx`:
- Start new review flow
- File selection
- Lens/profile selection
- Show agent activity during review
- Display results

Create `src/app/routes/review/$reviewId.tsx`:
- Load existing review
- Browse issues
- Show details

---

## Phase 5: Feature - Settings

### 5.1 Settings API

Create `src/features/settings/api/settings-api.ts`:
- `getProviderStatus()` - Fetch provider configuration
- `saveConfig()` - Save provider settings
- `getSettings()` - Fetch user settings
- `saveSettings()` - Save user settings

### 5.2 Settings Components

Create `src/features/settings/components/`:
- `provider-selector.tsx` - AI provider selection
- `model-selector.tsx` - Model selection per provider
- `theme-selector.tsx` - Light/dark/system
- `api-key-input.tsx` - Secure key input

### 5.3 Settings Page

Create `src/app/routes/settings.tsx`:
- Provider configuration
- Theme settings
- About section

---

## Phase 6: Layout & Navigation

### 6.1 Root Layout

Create `src/app/routes/__root.tsx`:
- ThemeProvider
- Header with navigation
- Main content area
- Footer

### 6.2 Header

Create `src/components/layout/header.tsx`:
- Logo/brand
- Navigation links (Review, History, Settings)
- Theme toggle
- Provider status indicator

### 6.3 Sidebar (optional)

Create `src/components/layout/sidebar.tsx`:
- Navigation for larger screens
- Collapsible

---

## Phase 7: Home Page

### 7.1 Dashboard

Create `src/app/routes/index.tsx`:
- Quick actions (Start Review, View History)
- Recent reviews summary
- Provider status card
- Git status (if in repo)

---

## Phase 8: Polish

### 8.1 Loading States
- Add skeleton loaders to all data-fetching components
- Add loading spinners to buttons during actions

### 8.2 Error States
- Add error boundaries
- Add error UI to all data components
- Toast notifications for actions

### 8.3 Empty States
- Add empty state UI to lists
- Add onboarding prompts

### 8.4 Animations
- Add subtle transitions
- Add micro-interactions
- Respect prefers-reduced-motion

### 8.5 Accessibility
- Verify keyboard navigation
- Add ARIA labels
- Test with screen reader
- Check color contrast

---

## Validation Checklist

After each phase:
```bash
pnpm type-check
pnpm build
pnpm preview  # Manual test
```

## Success Criteria

- [ ] All UI components render correctly
- [ ] Dark/light theme works
- [ ] Review flow works end-to-end
- [ ] Agent activity shows real-time
- [ ] Settings can be changed
- [ ] Responsive on mobile
- [ ] Accessible (keyboard, screen reader)
- [ ] No TypeScript errors
- [ ] Build succeeds
