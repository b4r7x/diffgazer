# Web Implementation – Quick Reference

Use this document alongside `web-implementation-phases.md` for fast lookups during development.

---

## Phase Quick Start

### Phase 1: Primitives (2–3 days)

**Start with:**
```bash
cd apps/web
npm run dev
# Edit tailwind.config.ts → src/components/ui/button.tsx
```

**Create in order:**
1. `button.tsx` (variants: primary, secondary, outline, ghost)
2. `input.tsx` (variants: default, error, disabled)
3. `badge.tsx` (severity, status labels)
4. `card.tsx` (container)
5. `tabs.tsx` (tab navigation)
6. `popover.tsx` (dropdown container)
7. `tooltip.tsx` (hover tooltips)
8. `modal.tsx` (dialog wrapper)

**Test template:**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders with primary variant', () => {
    render(<Button variant="primary">Click me</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
  });
});
```

---

### Phase 2: Layout (2–3 days)

**Depends on:** Phase 1 complete

**Create in order:**
1. `header.tsx` - Logo, nav tabs, user profile
2. `footer-bar.tsx` - Status, user info
3. `split-pane.tsx` - Resizable left/right panes
4. `sidebar.tsx` - Left panel container
5. `content-panel.tsx` - Right panel container
6. `main-layout.tsx` - Wrapper (Header + Outlet + Footer)

**Key: Split Pane Pattern**
```typescript
// apps/web/src/components/layout/split-pane.tsx
interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  dividerPosition?: number; // 0-100 %
  onDividerMove?: (pos: number) => void;
}

export function SplitPane({ left, right, dividerPosition = 50, onDividerMove }: SplitPaneProps) {
  // Use mouse/touch events to track divider drag
  // Update CSS grid or flex basis dynamically
}
```

---

### Phase 3A: Home Menu (< 1 day)

**File:** `apps/web/src/features/menu/components/main-menu.tsx`

**Template:**
```typescript
interface MainMenuProps {
  onAction: (action: 'review-unstaged' | 'review-staged' | 'history' | 'sessions' | 'settings') => void;
}

export function MainMenu({ onAction }: MainMenuProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-12">
        <div>
          <h1>Stargazer Observatory</h1>
          <p>AI-Powered Code Review</p>
        </div>
        <div className="space-y-4">
          <Button onClick={() => onAction('review-unstaged')}>Review Unstaged</Button>
          <Button onClick={() => onAction('review-staged')}>Review Staged</Button>
          {/* ... more buttons ... */}
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 3B: Review Screen (4–5 days) ⭐ CRITICAL

**File:** `apps/web/src/features/review/components/review-screen.tsx`

**State structure:**
```typescript
// Hook: useReview() in hooks/use-review.ts
interface ReviewState {
  reviewId: string;
  issues: TriageIssue[];
  selectedIssueId: string | null;
  filters: {
    severity: TriageSeverity | 'all';
    lens: LensId | 'all';
    source: string | 'all';
  };
  isLoading: boolean;
  error: Error | null;
}

function ReviewScreen({ reviewId }: { reviewId: string }) {
  const { state, selectIssue, updateFilters, applyPatch, ignoreIssue } = useReview(reviewId);

  return (
    <SplitPane
      left={<IssueList issues={...} onSelect={selectIssue} filters={...} />}
      right={<IssueDetails issue={state.issues.find(i => i.id === state.selectedIssueId)} />}
    />
  );
}
```

**Component breakdown:**
- `issue-list.tsx` - Scrollable list, clickable rows, filter UI
- `issue-item.tsx` - Single row (title, severity, lens, source)
- `issue-details.tsx` - Full details (title, description, code diff, suggestions)
- `code-diff.tsx` - Syntax-highlighted diff using Prism/highlight.js
- `severity-badge.tsx` - Color-coded severity label
- `filter-toolbar.tsx` - Dropdown filters
- `actions-panel.tsx` - Apply, Ignore, Drill Down buttons

**API calls:**
```typescript
// In useReview hook:
const { data: review } = useQuery({
  queryKey: ['review', reviewId],
  queryFn: () => api.getReview(reviewId),
});

const applyPatch = useMutation({
  mutationFn: (issueId: string) => api.applyPatch(reviewId, issueId),
  onSuccess: () => {
    // Remove issue from list or mark as applied
    queryClient.invalidateQueries({ queryKey: ['review', reviewId] });
  }
});
```

---

### Phase 3C: History Page (2–3 days)

**File:** `apps/web/src/features/history/components/history-page.tsx`

**Template:**
```typescript
export function HistoryPage() {
  const { reviews, isLoading } = useHistory();
  const navigate = useNavigate();

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4 p-6">
      <HistoryFilters onFilterChange={...} />
      <HistoryTable
        reviews={reviews}
        onRowClick={(review) => navigate({ to: `/review/${review.id}` })}
      />
    </div>
  );
}
```

**Columns:**
- Review ID (clickable)
- Scope (staged/unstaged/all)
- Date (relative: "2h ago")
- Issue Count
- Status (completed/in-progress)

---

### Phase 3D: Settings Page (2–3 days)

**File:** `apps/web/src/features/settings/components/settings-page.tsx`

**Tab structure:**
```typescript
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('provider');

  return (
    <div>
      <TabNav
        tabs={[
          { id: 'provider', label: 'AI Provider' },
          { id: 'permissions', label: 'Permissions' },
          { id: 'diagnostics', label: 'Diagnostics' },
        ]}
        active={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="p-6">
        {activeTab === 'provider' && <ProviderConfig />}
        {activeTab === 'permissions' && <PermissionsTab />}
        {activeTab === 'diagnostics' && <DiagnosticsTab />}
      </div>
    </div>
  );
}
```

**Provider Config Tab:**
- Dropdown: Select provider (OpenRouter, Zhipu, etc.)
- Input: API key (masked)
- Input: Model ID
- Input: Endpoint URL (optional)
- Button: Test Connection

**Permissions Tab:**
- Checkbox matrix: [Repo] x [Capability]
- Toggle: Trust persistence (session vs permanent)

**Diagnostics Tab:**
- Server health indicator (green/red)
- Version info
- Recent error logs (scrollable)
- Button: Clear logs

---

### Phase 4: Modals (1–2 days)

**Pattern:**
```typescript
// 1. Hook to trigger modal
function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}

// 2. Modal component
function TrustPromptModal({ isOpen, onClose, onConfirm, repoName }: TrustPromptModalProps) {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <Modal.Header>Trust this repository?</Modal.Header>
      <Modal.Body>Allow Stargazer to review code in <strong>{repoName}</strong>?</Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onConfirm('session'); onClose(); }}>Trust This Session</Button>
        <Button variant="primary" onClick={() => { onConfirm('persistent'); onClose(); }}>Trust Permanently</Button>
      </Modal.Footer>
    </Modal>
  );
}

// 3. Use in component
function App() {
  const trust = useModal();

  useEffect(() => {
    if (!userTrustedRepo) {
      trust.open();
    }
  }, []);

  return <TrustPromptModal isOpen={trust.isOpen} onClose={trust.close} ... />;
}
```

**Four required modals:**
1. **TrustPromptModal** - Trust repo confirmation
2. **SetupWizardModal** - Onboarding (multi-step form)
3. **AgentInspectorModal** - Drill-down details
4. **ConfirmModal** - Generic confirm/alert

---

## Design Tokens Cheat Sheet

### Colors
```css
/* Primary */
--primary: #79C0FF;        /* Starlight blue */
--secondary: #BC8CFF;      /* Aurora violet */

/* Background */
--background: #0A0E14;     /* Inky navy (main bg) */
--surface: #161B22;        /* Dark graphite (cards) */
--surface-secondary: #0d1117; /* Deeper graphite */
--border: #30363d;         /* Subtle borders */

/* Semantic */
--success: #3FB950;        /* Green */
--warning: #D29922;        /* Yellow */
--destructive: #FF7B72;    /* Red */
```

### Typography
```css
--font-display: 'Space Grotesk';   /* h1, h2, nav */
--font-body: 'Inter';              /* paragraph, label */
--font-mono: 'JetBrains Mono';     /* code, error messages */
```

### Spacing
Tailwind 4 defaults: 4px base unit
- xs: 2px
- sm: 4px
- md: 8px
- lg: 16px
- xl: 24px
- 2xl: 32px

### Shadow
Custom glow effect:
```css
box-shadow: 0 0 20px -5px rgba(121, 192, 255, 0.15);
```

---

## Testing Checklist

### Unit Tests
```bash
npx vitest run src/components/ui/
npx vitest run src/components/layout/
```

**Coverage target:** 80%+ (focus on logic, not CSS)

### Integration Tests
```bash
npx vitest run src/features/
```

**Test data:** Use factory functions or mock data generators

### E2E Tests (future)
```bash
npx playwright test
```

---

## Common Patterns

### 1. Fetch Data in Component
```typescript
import { useEffect, useState } from 'react';
import { api } from '@repo/api';

function MyComponent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchData()
      .then(result => setData(result.data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{/* render data */}</div>;
}
```

### 2. Form with Validation
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  apiKey: z.string().min(1, 'API key required'),
  model: z.string().min(1, 'Model required'),
});

function ProviderForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('apiKey')} />
      {errors.apiKey && <span>{errors.apiKey.message}</span>}
      <button type="submit">Save</button>
    </form>
  );
}
```

### 3. Keyboard Navigation
```typescript
function Dropdown({ items, onSelect }: { items: string[]; onSelect: (item: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(i => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(i => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      onSelect(items[selectedIndex]);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  };

  return (
    <ul onKeyDown={handleKeyDown} role="listbox">
      {items.map((item, i) => (
        <li
          key={item}
          role="option"
          aria-selected={i === selectedIndex}
          className={i === selectedIndex ? 'bg-primary' : ''}
          onClick={() => onSelect(item)}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
```

---

## File Paths (Always Absolute)

### Key directories
```
/Users/voitz/Projects/stargazer/apps/web/src/
  components/     ← Reusable UI components
  features/       ← Feature modules
  app/            ← Routes, providers, config
  styles/         ← Global CSS
```

### Import aliases
```typescript
import Button from '@/components/ui/button';        // absolute path
import { ReviewScreen } from '@/features/review';   // absolute path
import { api } from '@repo/api';                    // workspace package
```

---

## Commands Reference

```bash
# Development
npm run dev                    # Start dev server (port 5173)

# Building
npm run build                  # Full build
npm run type-check             # TypeScript check

# Testing
npx vitest run                 # Run all tests
npx vitest run --ui           # Interactive dashboard
npx vitest run --coverage      # Coverage report

# Linting
npm run lint                   # ESLint check

# Cleaning
npm run clean                  # Clean build artifacts
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/web-phase-1

# Commit after each phase
git add .
git commit -m "Phase 1: Add UI primitives (button, input, badge, etc.)"

# Push when done
git push origin feature/web-phase-1
```

---

## Debugging Tips

1. **React DevTools:** Install [React DevTools extension](https://react-devtools-tutorial.vercel.app/)
2. **Tailwind Debug:** Add `debugScreens` plugin in `tailwind.config.ts`
3. **Network Issues:** Check browser DevTools Network tab for API calls
4. **Type Errors:** Run `npm run type-check` before committing

---

## When Stuck

1. Check existing components in `src/components/` and `src/features/`
2. Review mockups in `/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/`
3. Look at CLAUDE.md for architecture decisions
4. Ask in slack/discord (or create issue)

---

## Phase 3B (Review Screen) Deep Dive

This is the most complex screen. Key considerations:

### State Management
- Use React hooks (useState, useEffect) for local state
- Consider custom hook `useReview()` to encapsulate API calls
- DO NOT use Redux unless absolutely necessary

### Performance
- Virtual scroll for issue lists (100+ issues)
- Lazy load code diffs (only show when issue selected)
- Debounce filter/search inputs

### Accessibility
- Semantic HTML: `<table>` for history, `<ul>/<li>` for issue list
- ARIA: `role="listbox"`, `aria-selected`, `aria-expanded`
- Keyboard: Arrow keys to navigate, Enter to select
- Focus: Move focus when selecting issue (via ref)

### Testing
Mock API response:
```typescript
const mockIssues = [
  {
    id: 'issue-1',
    title: 'Missing null check',
    severity: 'high',
    lens: 'correctness',
    source: 'detector',
    description: '...',
    codeLocation: { file: 'app.ts', line: 42 },
    suggestion: '...',
    diff: '...',
  },
  // ... more issues
];
```

---

## Resources

- **Tailwind Docs:** https://tailwindcss.com/docs
- **React Docs:** https://react.dev
- **TanStack Router:** https://tanstack.com/router/latest
- **Lucide Icons:** https://lucide.dev
- **Zod Validation:** https://zod.dev
