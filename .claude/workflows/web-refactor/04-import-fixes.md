# Workflow 04: Import Fixes

## Overview

Fix cross-feature imports (bulletproof violation) and convert relative imports to absolute `@/` paths.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo.

### Prerequisites
- Phases 1-3 completed

### Problems to Fix
1. **Cross-feature imports** - Features importing from other features
2. **Relative imports** - 12 files use `../../../` instead of `@/`

### Patterns to Follow (from structure-apps.md)
- Features CANNOT import from other features
- Composition happens in app layer (routes)
- Use `@/` absolute imports, not `../../../`

---

## Task 1: Fix Cross-Feature Imports

**Agent:** `frontend-developer`

### Step 1: Find violations
```bash
# Features importing from other features
grep -r "from.*features/" apps/web/src/features/ --include="*.tsx" --include="*.ts" | grep -v "from.*features/.*/" | head -20
```

### Known violation
`features/review/` imports from `features/agents/`:
- `review-screen.tsx` imports `AgentActivityPanel` from `features/agents/`

### Fix: Move shared components to src/components/

**If AgentActivityPanel is used by multiple features:**

Move from: `apps/web/src/features/agents/components/agent-activity-panel.tsx`
Move to: `apps/web/src/components/agent-activity-panel.tsx`

Move from: `apps/web/src/features/agents/components/agent-status.tsx`
Move to: `apps/web/src/components/agent-status.tsx`

```bash
# Move files
mv apps/web/src/features/agents/components/agent-activity-panel.tsx apps/web/src/components/
mv apps/web/src/features/agents/components/agent-status.tsx apps/web/src/components/
```

**Update ALL imports:**
```diff
- import { AgentActivityPanel } from '@/features/agents/components/agent-activity-panel'
+ import { AgentActivityPanel } from '@/components/agent-activity-panel'

- import { AgentStatus } from '@/features/agents/components/agent-status'
+ import { AgentStatus } from '@/components/agent-status'
```

### Alternative: Keep in features/ but compose in app layer

If you prefer to keep components in features/:

1. Route component (`routes/review/index.tsx`) imports AgentActivityPanel
2. Passes it as prop to feature component
3. Feature component doesn't import from other features

```typescript
// routes/review/index.tsx
import { AgentActivityPanel } from '@/features/agents/components/agent-activity-panel'
import { ReviewScreen } from '@/features/review/components/review-screen'

export default function ReviewPage() {
  return <ReviewScreen AgentPanel={AgentActivityPanel} />
}
```

---

## Task 2: Convert Relative to Absolute Imports

**Agent:** `javascript-typescript:typescript-pro`

### Verify @/ alias is configured

**File:** `/Users/voitz/Projects/stargazer/apps/web/tsconfig.json`

Should have:
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

**File:** `/Users/voitz/Projects/stargazer/apps/web/vite.config.ts`

Should have:
```typescript
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

### Files to update

Find all files with relative imports:
```bash
grep -r "from '\.\./\.\./\.\." apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

**Known files (12):**

1. `features/history/components/history-list.tsx`
2. `features/menu/components/main-menu.tsx`
3. `features/review/api/review-history-api.ts`
4. `features/review/api/git-api.ts`
5. `features/review/api/triage-api.ts`
6. `features/review/components/review-screen.tsx`
7. `features/review/components/issue-details.tsx`
8. `features/review/components/issue-list.tsx`
9. `features/sessions/api/sessions-api.ts`
10. `features/agents/components/agent-activity-panel.tsx`
11. `features/settings/api/config-api.ts`
12. `features/settings/hooks/use-config.ts`

### Conversion pattern

```diff
- import { cn } from '../../../lib/utils'
+ import { cn } from '@/lib/utils'

- import { Card } from '../../../components/ui/card'
+ import { Card } from '@/components/ui/card'

- import { api } from '../../../lib/api'
+ import { api } from '@/lib/api'

- import { Badge } from '../../../components/ui/badge'
+ import { Badge } from '@/components/ui/badge'

- import { Spinner } from '../../../components/ui/spinner'
+ import { Spinner } from '@/components/ui/spinner'
```

### Batch conversion

For each file, replace all `../../../` patterns:

```bash
# Example for one file
sed -i '' "s|from '\.\./\.\./\.\./lib/|from '@/lib/|g" apps/web/src/features/history/components/history-list.tsx
sed -i '' "s|from '\.\./\.\./\.\./components/|from '@/components/|g" apps/web/src/features/history/components/history-list.tsx
```

Or manually edit each file.

---

## Validation

After completing all tasks:

```bash
cd /Users/voitz/Projects/stargazer

# Check no cross-feature imports remain
grep -r "from.*features/" apps/web/src/features/ --include="*.tsx" --include="*.ts" | grep -v "/index" | grep -v "from '@/features/"

# Check no ../../../ imports remain
grep -r "from '\.\./\.\./\.\." apps/web/src/ --include="*.ts" --include="*.tsx"
# Should return nothing

# Type check
npm run type-check
```
