# Workflow 03: Structure Refactor

## Overview

Move contexts to providers, consolidate duplicate APIs and components.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo.

### Prerequisites
- Phase 1 completed (dead code deleted)
- Phase 2 completed (dependencies fixed)

### Problems to Fix
1. **contexts/** - Should be `app/providers/` per bulletproof-react
2. **Duplicate streamTriage** - Two different implementations
3. **Duplicate AgentActivityPanel** - Two different components
4. **Duplicate config APIs** - Overlapping functions

### Patterns to Follow (from CLAUDE.md)
- Providers live in `app/providers/`
- Features cannot import from other features
- Single source of truth for each function

---

## Task 1: Move Contexts to Providers

**Agent:** `frontend-developer`

**Current structure:**
```
src/contexts/config-context.tsx  ❌ Wrong location
```

**Target structure:**
```
src/app/providers/
├── index.tsx           # AppProviders wrapper + exports
└── config-provider.tsx # Moved from contexts/
```

### Step 1: Create directory
```bash
mkdir -p /Users/voitz/Projects/stargazer/apps/web/src/app/providers
```

### Step 2: Move and rename file

**From:** `/Users/voitz/Projects/stargazer/apps/web/src/contexts/config-context.tsx`
**To:** `/Users/voitz/Projects/stargazer/apps/web/src/app/providers/config-provider.tsx`

Update internal import:
```diff
- import { getConfig, getProviderStatus } from "../features/settings/api/config-api";
+ import { getConfig, getProviderStatus } from "@/features/settings/api/config-api";
```

### Step 3: Create providers barrel

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/app/providers/index.tsx`

```typescript
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
```

### Step 4: Update main.tsx

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/main.tsx`

```diff
- import { ConfigProvider } from './contexts/config-context'
+ import { AppProviders } from './app/providers'

  <React.StrictMode>
-   <ConfigProvider>
+   <AppProviders>
      <RouterProvider router={router} />
-   </ConfigProvider>
+   </AppProviders>
  </React.StrictMode>
```

### Step 5: Update use-config.ts

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/features/settings/hooks/use-config.ts`

```diff
- import { useConfigContext } from "../../../contexts/config-context";
+ import { useConfigContext } from "@/app/providers";
```

### Step 6: Delete old directory
```bash
rm -rf /Users/voitz/Projects/stargazer/apps/web/src/contexts/
```

---

## Task 2: Consolidate Duplicate APIs

**Agent:** `code-simplifier:code-simplifier`

### Part A: Clean review-api.ts

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/features/review/api/review-api.ts`

This file has functions that duplicate other files:

| Function | Duplicates | Action |
|----------|------------|--------|
| `streamTriage` | triage-api.ts | DELETE |
| `getReviewHistory` | review-history-api.ts | DELETE |
| `getReview` | review-history-api.ts | DELETE |

**Steps:**
1. Read the file
2. Delete `streamTriage` function (entire function)
3. Delete `getReviewHistory` function (entire function)
4. Delete `getReview` function (entire function)
5. Keep type definitions only if they're exported and used elsewhere
6. If file becomes empty/useless, delete entire file

### Part B: Analyze config-api.ts vs settings-api.ts

**Files:**
- `/Users/voitz/Projects/stargazer/apps/web/src/features/settings/api/config-api.ts`
- `/Users/voitz/Projects/stargazer/apps/web/src/features/settings/api/settings-api.ts`

**Analysis:**
```bash
# Check what imports config-api.ts
grep -r "from.*config-api" apps/web/src/

# Check what imports settings-api.ts
grep -r "from.*settings-api" apps/web/src/
```

**Decision tree:**
- If only config-api.ts is used → DELETE settings-api.ts
- If only settings-api.ts is used → DELETE config-api.ts
- If both used → Consolidate into ONE file

**Known:** config-context.tsx imports from config-api.ts

---

## Task 3: Consolidate Duplicate Components

**Agent:** `code-simplifier:code-simplifier`

**Two AgentActivityPanel versions:**

| Location | Props |
|----------|-------|
| `features/agents/components/agent-activity-panel.tsx` | `{ agents: AgentState[], className?: string }` |
| `features/review/components/agent-activity-panel.tsx` | `{ events: AgentStreamEvent[] }` |

### Step 1: Find usage
```bash
grep -r "AgentActivityPanel" apps/web/src/ --include="*.tsx"
grep -r "agent-activity-panel" apps/web/src/ --include="*.tsx"
```

### Step 2: Determine which to keep

| Criteria | agents/ version | review/ version |
|----------|-----------------|-----------------|
| Lines | ~85 | ~33 |
| Completeness | Full Card UI | Uses AgentStatus |
| Likely primary | Yes | No |

### Step 3: Delete unused version

**If agents/ version is used:**
```bash
rm /Users/voitz/Projects/stargazer/apps/web/src/features/review/components/agent-activity-panel.tsx
```

**If review/ version is used:**
```bash
rm /Users/voitz/Projects/stargazer/apps/web/src/features/agents/components/agent-activity-panel.tsx
```

### Step 4: Update imports in consumers

All imports should point to the remaining version.

---

## Validation

After completing all tasks:

```bash
cd /Users/voitz/Projects/stargazer

# Type check
npm run type-check

# Verify no duplicate files
find apps/web/src -name "agent-activity-panel.tsx" | wc -l
# Expected: 1

# Verify contexts deleted
ls apps/web/src/contexts/ 2>/dev/null || echo "contexts/ deleted (good)"

# Verify providers exist
ls apps/web/src/app/providers/
# Expected: index.tsx, config-provider.tsx
```
