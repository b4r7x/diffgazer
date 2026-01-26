# Master Web Refactor Orchestrator

## Overview

This orchestrator refactors the Stargazer web app to follow bulletproof-react patterns. It is **self-contained** for empty AI context execution.

---

## Project Context

### What is Stargazer
Local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

### Tech Stack
- TypeScript, React 19, Hono (server), Zod, Vitest, Vercel AI SDK
- Web: TanStack Router, Tailwind CSS v4, WebTUI, Base UI

### Monorepo Structure (Current)
```
packages/
├── core/       # Shared business logic, Result type
├── schemas/    # Zod schemas (canonical types) - LEAF
├── api/        # API client - LEAF
├── cli/        # ❌ ORPHANED - Delete (duplicates apps/cli)
├── ui/         # ❌ UNUSED - Delete (duplicates apps/web/src/components/ui/)
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI (primary)
├── web/        # React web app (needs refactor)
```

### Key Patterns (DO NOT REMOVE)
1. **Result<T, E>** - Use for errors, not exceptions
2. **Provider Abstraction** - AI providers are swappable
3. **CORS Localhost Only** - Security requirement (CVE-2024-28224)
4. **XML Escaping** - Escape user content in prompts (CVE-2025-53773)
5. **No Manual Memoization** - React 19 Compiler handles it
6. **Bulletproof-react** - Features isolated, no cross-feature imports

### Architecture Rules
- Import flow: apps → packages, packages/core → schemas
- ALL files use kebab-case naming
- Web: app/providers/, features/, components/, hooks/, lib/
- Absolute imports with `@/` prefix

---

## What We're Fixing

### Critical (Build-Breaking)
1. **Workspace name conflict** - @repo/cli in 2 places
2. **Duplicate imports** - Syntax errors in 2 files
3. **packages/cli** - 90 lines dead code, orphaned
4. **packages/ui** - 14 files unused, duplicates web components
5. **Dead Vite boilerplate** - App.tsx, App.css, assets/
6. **Missing date-fns** - Imported but not in package.json
7. **Missing sessions route** - File exists, not registered
8. **@repo/ui import** - Will break after package deletion

### Architecture Violations
9. **contexts/** - Should be app/providers/
10. **Duplicate streamTriage** - 2 different implementations
11. **Duplicate AgentActivityPanel** - 2 different components
12. **Duplicate config APIs** - Different return types
13. **Cross-feature imports** - review imports from agents

### Code Quality
14. **Console statements** - 5 files with console.log/error
15. **Relative imports** - 12 files use ../../../
16. **Empty directories** - stores/, types/

---

## Execution Instructions

Run phases sequentially. Within each phase, agents can run in parallel where noted.

Use Task tool with specified `subagent_type`:
```
Task(subagent_type="agent-type", prompt="...", description="...")
```

---

## PHASE 1: Critical Cleanup (PARALLEL)

**Run all 3 agents in parallel.**

### Agent 1.1: Delete Orphaned Packages
```
subagent_type: "Bash"

Task: Delete packages/cli and packages/ui directories.

Commands:
rm -rf /Users/voitz/Projects/stargazer/packages/cli
rm -rf /Users/voitz/Projects/stargazer/packages/ui

Verification:
ls /Users/voitz/Projects/stargazer/packages/

Expected output: api, core, schemas, tsconfig (NO cli, NO ui)
```

### Agent 1.2: Fix Duplicate Imports
```
subagent_type: "frontend-developer"

Task: Remove duplicate imports causing syntax errors.

FILE 1: /Users/voitz/Projects/stargazer/apps/web/src/features/agents/components/agent-activity-panel.tsx

Problem: Lines 7-9 duplicate lines 2-4
- Line 2: import { cn } from '../../../lib/utils';
- Line 3: import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
- Line 4: import { Spinner } from '../../../components/ui/spinner';
- Line 7: import { cn } from '../../../lib/utils';  // DUPLICATE - DELETE
- Line 8: import { Card, ... } from '../../../components/ui/card';  // DUPLICATE - DELETE
- Line 9: import { Spinner } from '../../../components/ui/spinner';  // DUPLICATE - DELETE

ACTION: Delete lines 7, 8, 9

---

FILE 2: /Users/voitz/Projects/stargazer/apps/web/src/features/review/components/issue-list.tsx

Problem: Lines 5-6 duplicate lines 2-3
- Line 2: import { cn } from '../../../lib/utils';
- Line 3: import { Badge } from '../../../components/ui/badge';
- Line 5: import { cn } from '../../../lib/utils';  // DUPLICATE - DELETE
- Line 6: import { Badge } from '../../../components/ui/badge';  // DUPLICATE - DELETE

ACTION: Delete lines 5, 6
```

### Agent 1.3: Delete Dead Vite Boilerplate
```
subagent_type: "Bash"

Task: Delete unused Vite template files.

Commands:
rm /Users/voitz/Projects/stargazer/apps/web/src/App.tsx
rm /Users/voitz/Projects/stargazer/apps/web/src/App.css
rm -rf /Users/voitz/Projects/stargazer/apps/web/src/assets/

Verification:
ls /Users/voitz/Projects/stargazer/apps/web/src/

Expected: NO App.tsx, NO App.css, NO assets/
```

**Wait for Phase 1 to complete before Phase 2.**

---

## PHASE 2: Dependencies & Routes (PARALLEL)

**Run both agents in parallel.**

### Agent 2.1: Fix package.json Dependencies
```
subagent_type: "frontend-developer"

Task: Update apps/web/package.json and install.

File: /Users/voitz/Projects/stargazer/apps/web/package.json

Changes:
1. REMOVE from dependencies:
   "@repo/ui": "workspace:*"

2. ADD to dependencies:
   "date-fns": "^3.6.0"

After editing, run:
cd /Users/voitz/Projects/stargazer && pnpm install

Verify: No errors in pnpm install output
```

### Agent 2.2: Fix Router and Dialog
```
subagent_type: "react-component-architect"

Task: Register sessions route and fix dialog.tsx.

TASK 1: Register sessions route

File: /Users/voitz/Projects/stargazer/apps/web/src/app/router.tsx

Read the file first. Find where historyRoute is defined and routeTree is created.

Add import (if missing):
import SessionsPage from './routes/sessions'

Add route definition after historyRoute:
const sessionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sessions',
    component: SessionsPage,
})

Update routeTree to include sessionsRoute:
const routeTree = rootRoute.addChildren([
    indexRoute,
    reviewRoute,
    reviewDetailRoute,
    settingsRoute,
    historyRoute,
    sessionsRoute,  // ADD THIS
])

---

TASK 2: Fix dialog.tsx (remove @repo/ui import)

File: /Users/voitz/Projects/stargazer/apps/web/src/components/ui/dialog.tsx

Current file re-exports from @repo/ui which was deleted.

Replace entire file with implementation using @base-ui/react:

import * as React from 'react'
import * as DialogPrimitive from '@base-ui/react/Dialog'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Backdrop>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Popup>
  </DialogPortal>
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

**Wait for Phase 2 to complete before Phase 3.**

---

## PHASE 3: Structure Refactor (PARALLEL)

**Run all 3 agents in parallel.**

### Agent 3.1: Move Contexts to Providers
```
subagent_type: "frontend-developer"

Task: Restructure contexts/ to app/providers/ per bulletproof-react.

STEP 1: Create directory
mkdir -p /Users/voitz/Projects/stargazer/apps/web/src/app/providers

STEP 2: Move and rename file
Source: /Users/voitz/Projects/stargazer/apps/web/src/contexts/config-context.tsx
Destination: /Users/voitz/Projects/stargazer/apps/web/src/app/providers/config-provider.tsx

Update internal import:
OLD: import { getConfig, getProviderStatus } from "../features/settings/api/config-api";
NEW: import { getConfig, getProviderStatus } from "@/features/settings/api/config-api";

STEP 3: Create providers barrel
File: /Users/voitz/Projects/stargazer/apps/web/src/app/providers/index.tsx

Content:
import { ReactNode } from 'react'
import { ConfigProvider, useConfigContext } from './config-provider'

export { useConfigContext }

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider>
      {children}
    </ConfigProvider>
  )
}

STEP 4: Update main.tsx
File: /Users/voitz/Projects/stargazer/apps/web/src/main.tsx

OLD:
import { ConfigProvider } from './contexts/config-context'
<ConfigProvider>
  <RouterProvider router={router} />
</ConfigProvider>

NEW:
import { AppProviders } from './app/providers'
<AppProviders>
  <RouterProvider router={router} />
</AppProviders>

STEP 5: Update use-config.ts
File: /Users/voitz/Projects/stargazer/apps/web/src/features/settings/hooks/use-config.ts

OLD: import { useConfigContext } from "../../../contexts/config-context";
NEW: import { useConfigContext } from "@/app/providers";

STEP 6: Delete old directory
rm -rf /Users/voitz/Projects/stargazer/apps/web/src/contexts/
```

### Agent 3.2: Consolidate Duplicate APIs
```
subagent_type: "code-simplifier:code-simplifier"

Task: Remove duplicate API implementations.

TASK 1: Clean review-api.ts

File: /Users/voitz/Projects/stargazer/apps/web/src/features/review/api/review-api.ts

This file has functions that duplicate other files:
- streamTriage (duplicates triage-api.ts) - DELETE
- getReviewHistory (duplicates review-history-api.ts) - DELETE
- getReview (duplicates review-history-api.ts) - DELETE

Keep only type definitions if they're used elsewhere.
If file becomes empty or only has unused types, DELETE entire file.

---

TASK 2: Analyze config-api.ts vs settings-api.ts

Files:
- /Users/voitz/Projects/stargazer/apps/web/src/features/settings/api/config-api.ts
- /Users/voitz/Projects/stargazer/apps/web/src/features/settings/api/settings-api.ts

Both have overlapping functions. Check which is actually used:

1. Search for imports of config-api.ts:
   - config-context.tsx imports getConfig, getProviderStatus from config-api.ts

2. Search for imports of settings-api.ts:
   - May be unused or used elsewhere

If settings-api.ts is unused, DELETE it.
If both are used, consolidate into ONE file (keep config-api.ts since it's imported by context).
```

### Agent 3.3: Consolidate Duplicate Components
```
subagent_type: "code-simplifier:code-simplifier"

Task: Remove duplicate AgentActivityPanel component.

Two versions exist:
1. /Users/voitz/Projects/stargazer/apps/web/src/features/agents/components/agent-activity-panel.tsx
   Props: { agents: AgentState[], className?: string }
   Full implementation with Card styling

2. /Users/voitz/Projects/stargazer/apps/web/src/features/review/components/agent-activity-panel.tsx
   Props: { events: AgentStreamEvent[] }
   Simpler version

STEPS:
1. Search for imports of each version to see which is used:
   grep -r "agent-activity-panel" apps/web/src/

2. Keep the version that's actually used (likely agents/ version)

3. Delete the unused version

4. If both are used with different props, you need to:
   - Keep one canonical version
   - Update consumers to use correct props
   - Or create adapter if needed
```

**Wait for Phase 3 to complete before Phase 4.**

---

## PHASE 4: Import Fixes (PARALLEL)

**Run both agents in parallel.**

### Agent 4.1: Fix Cross-Feature Imports
```
subagent_type: "frontend-developer"

Task: Fix bulletproof-react violation - features importing from other features.

Per bulletproof-react: Features CANNOT import from other features.

Search for violations:
grep -r "from.*features/agents" apps/web/src/features/review/
grep -r "from.*features/review" apps/web/src/features/agents/

For each violation found:

OPTION A (Recommended): Move shared component to src/components/

If AgentActivityPanel or AgentStatus is imported by review feature:

Move from: apps/web/src/features/agents/components/agent-activity-panel.tsx
Move to: apps/web/src/components/agent-activity-panel.tsx

Move from: apps/web/src/features/agents/components/agent-status.tsx
Move to: apps/web/src/components/agent-status.tsx

Update ALL imports to use @/components/agent-activity-panel

OPTION B: Keep in features/agents/ but have app layer compose

If review-screen.tsx needs AgentActivityPanel, have the route pass it as prop:
- routes/review/index.tsx imports AgentActivityPanel
- Passes it to ReviewScreen as prop
```

### Agent 4.2: Convert Relative to Absolute Imports
```
subagent_type: "javascript-typescript:typescript-pro"

Task: Convert all ../../../ imports to @/ absolute imports.

First, verify @/ alias is configured:
- /Users/voitz/Projects/stargazer/apps/web/tsconfig.json should have paths
- /Users/voitz/Projects/stargazer/apps/web/vite.config.ts should have alias

Then update these files (search for '../../../'):

1. apps/web/src/features/history/components/history-list.tsx
2. apps/web/src/features/menu/components/main-menu.tsx
3. apps/web/src/features/review/api/review-history-api.ts
4. apps/web/src/features/review/api/git-api.ts
5. apps/web/src/features/review/api/triage-api.ts
6. apps/web/src/features/review/components/review-screen.tsx
7. apps/web/src/features/review/components/issue-details.tsx
8. apps/web/src/features/review/components/issue-list.tsx
9. apps/web/src/features/sessions/api/sessions-api.ts
10. apps/web/src/features/agents/components/agent-activity-panel.tsx
11. apps/web/src/features/settings/api/config-api.ts
12. apps/web/src/features/settings/hooks/use-config.ts

PATTERN:
OLD: import { cn } from '../../../lib/utils'
NEW: import { cn } from '@/lib/utils'

OLD: import { Card } from '../../../components/ui/card'
NEW: import { Card } from '@/components/ui/card'

OLD: import { api } from '../../../lib/api'
NEW: import { api } from '@/lib/api'
```

**Wait for Phase 4 to complete before Phase 5.**

---

## PHASE 5: Code Quality (PARALLEL)

**Run all 3 agents in parallel.**

### Agent 5.1: Remove Console Statements
```
subagent_type: "codebase-cleanup:code-reviewer"

Task: Remove console statements from production code.

Files with console statements:

1. /Users/voitz/Projects/stargazer/apps/web/src/features/review/api/triage-api.ts
   Line ~41: console.error("Failed to parse SSE event", e)
   REPLACE WITH: // Silently ignore malformed events

2. /Users/voitz/Projects/stargazer/apps/web/src/features/review/api/review-api.ts
   Line ~64: console.warn('Failed to parse SSE event:', data)
   REPLACE WITH: // Silently ignore malformed events

3. /Users/voitz/Projects/stargazer/apps/web/src/app/routes/settings.tsx
   Line ~34: console.error(e)
   REPLACE WITH: Set error state (check if error state exists, use it)

4. /Users/voitz/Projects/stargazer/apps/web/src/app/routes/review/index.tsx
   Lines ~74-75: console.log('Apply patch', id) and console.log('Explain', id)
   REPLACE WITH: // TODO: Implement patch application / explanation
```

### Agent 5.2: Fix ReviewPanel Hook Usage
```
subagent_type: "frontend-developer"

Task: Fix ReviewPanel using wrong hook destructuring.

File: /Users/voitz/Projects/stargazer/apps/web/src/features/review/components/review-panel.tsx

Current (BROKEN):
const { events, issues } = useTriageStream()

But useTriageStream returns: { state, start, stop, selectIssue }

Read the actual useTriageStream hook to see its return type:
File: /Users/voitz/Projects/stargazer/apps/web/src/features/review/hooks/use-triage-stream.ts

Update ReviewPanel to use correct destructuring based on actual hook return.

If ReviewPanel needs events/issues, they might be inside state:
const { state } = useTriageStream()
const events = state.events
const issues = state.issues
```

### Agent 5.3: Delete Empty Directories
```
subagent_type: "Bash"

Task: Delete empty directories.

Commands:
rmdir /Users/voitz/Projects/stargazer/apps/web/src/stores/ 2>/dev/null || true
rmdir /Users/voitz/Projects/stargazer/apps/web/src/types/ 2>/dev/null || true

Verification:
ls -la /Users/voitz/Projects/stargazer/apps/web/src/

Confirm stores/ and types/ no longer exist (or were already deleted).
```

**Wait for Phase 5 to complete before Phase 6.**

---

## PHASE 6: Validation (SEQUENTIAL)

### Agent 6.1: Type Check and Build
```
subagent_type: "javascript-typescript:typescript-pro"

Task: Validate TypeScript and test the app.

STEP 1: Run type-check
cd /Users/voitz/Projects/stargazer && npm run type-check

If errors, fix them. Common issues:
- Missing imports after file moves
- Type mismatches from consolidation
- Missing exports in barrel files

STEP 2: Start dev server
cd /Users/voitz/Projects/stargazer/apps/web && npm run dev

Verify:
- Server starts without errors
- No console errors on page load

STEP 3: Test routes
Navigate to:
- http://localhost:5173/ (home)
- http://localhost:5173/sessions (new route)
- http://localhost:5173/settings
- http://localhost:5173/history

All routes should load without 404 or errors.

STEP 4: Report remaining issues
List any TypeScript errors or runtime issues found.
```

---

## Post-Refactor Structure

After all phases complete:

```
packages/
├── core/           # Shared business logic
├── schemas/        # Zod schemas
├── api/            # HTTP client
└── tsconfig/       # Shared TS config

apps/
├── cli/            # React Ink CLI
├── server/         # Hono backend
└── web/
    └── src/
        ├── app/
        │   ├── providers/
        │   │   ├── index.tsx           # AppProviders wrapper
        │   │   └── config-provider.tsx # Moved from contexts/
        │   ├── routes/
        │   │   ├── __root.tsx
        │   │   ├── index.tsx
        │   │   ├── history.tsx
        │   │   ├── sessions.tsx        # Now registered
        │   │   ├── settings.tsx
        │   │   └── review/
        │   └── router.tsx              # Sessions route added
        ├── components/
        │   ├── ui/                     # All UI primitives
        │   │   └── dialog.tsx          # Standalone implementation
        │   ├── layout/
        │   ├── agent-activity-panel.tsx # Moved from features/
        │   └── agent-status.tsx         # Moved from features/
        ├── features/
        │   ├── review/
        │   │   ├── api/
        │   │   │   ├── triage-api.ts   # Only SSE implementation
        │   │   │   ├── git-api.ts
        │   │   │   └── review-history-api.ts
        │   │   ├── components/
        │   │   └── hooks/
        │   ├── settings/
        │   │   ├── api/
        │   │   │   └── config-api.ts   # Consolidated
        │   │   └── hooks/
        │   ├── history/
        │   ├── menu/
        │   └── sessions/
        ├── hooks/
        ├── lib/
        ├── main.tsx                    # Uses AppProviders
        └── index.css
```

---

## Summary

| Phase | Agents | Tasks |
|-------|--------|-------|
| 1 | 3 parallel | Delete packages, fix duplicate imports, delete dead code |
| 2 | 2 parallel | Fix dependencies, routes, dialog.tsx |
| 3 | 3 parallel | Move providers, consolidate APIs, consolidate components |
| 4 | 2 parallel | Fix cross-feature imports, convert to @/ |
| 5 | 3 parallel | Remove console, fix hook, delete empty dirs |
| 6 | 1 sequential | Type check, build, test |

**Total: 14 agent tasks, 6 phases**
