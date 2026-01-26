# Workflow 01: Critical Cleanup

## Overview

Delete orphaned packages, fix duplicate imports, and remove dead code that blocks the build.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo with:
- `packages/` - Shared libraries (core, schemas, api)
- `apps/web/` - React web app (TanStack Router, Tailwind, WebTUI)
- `apps/cli/` - React Ink CLI
- `apps/server/` - Hono backend

### Problems to Fix
1. **packages/cli** - 90 lines, orphaned, name collision with apps/cli
2. **packages/ui** - 14 files, unused (only 1 import, rest duplicated)
3. **Duplicate imports** - Syntax errors in 2 files
4. **Dead Vite boilerplate** - App.tsx, App.css, assets/

---

## Task 1: Delete Orphaned Packages

**Agent:** `Bash`

**Commands:**
```bash
# Delete packages/cli (orphaned, duplicates apps/cli)
rm -rf /Users/voitz/Projects/stargazer/packages/cli

# Delete packages/ui (unused, duplicates apps/web/src/components/ui/)
rm -rf /Users/voitz/Projects/stargazer/packages/ui

# Verify
ls /Users/voitz/Projects/stargazer/packages/
```

**Expected output:** `api  core  schemas  tsconfig`

**Why:**
- `packages/cli` has name collision with `apps/cli` (@repo/cli)
- `packages/cli` only spawns dev servers (already done by apps/cli web command)
- `packages/ui` has 14 components but only dialog.tsx is imported
- All other UI components are duplicated in apps/web/src/components/ui/

---

## Task 2: Fix Duplicate Imports

**Agent:** `frontend-developer`

### File 1: agent-activity-panel.tsx

**Path:** `/Users/voitz/Projects/stargazer/apps/web/src/features/agents/components/agent-activity-panel.tsx`

**Problem:** Lines 7-9 are exact duplicates of lines 2-4

**Current (broken):**
```typescript
// Lines 2-4 (KEEP)
import { cn } from '../../../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Spinner } from '../../../components/ui/spinner';

// Some code between...

// Lines 7-9 (DELETE - duplicates)
import { cn } from '../../../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Spinner } from '../../../components/ui/spinner';
```

**Action:** Delete lines 7, 8, 9

### File 2: issue-list.tsx

**Path:** `/Users/voitz/Projects/stargazer/apps/web/src/features/review/components/issue-list.tsx`

**Problem:** Lines 5-6 are exact duplicates of lines 2-3

**Current (broken):**
```typescript
// Lines 2-3 (KEEP)
import { cn } from '../../../lib/utils';
import { Badge } from '../../../components/ui/badge';

// Some code between...

// Lines 5-6 (DELETE - duplicates)
import { cn } from '../../../lib/utils';
import { Badge } from '../../../components/ui/badge';
```

**Action:** Delete lines 5, 6

---

## Task 3: Delete Dead Vite Boilerplate

**Agent:** `Bash`

**Commands:**
```bash
# Delete unused Vite template files
rm /Users/voitz/Projects/stargazer/apps/web/src/App.tsx
rm /Users/voitz/Projects/stargazer/apps/web/src/App.css
rm -rf /Users/voitz/Projects/stargazer/apps/web/src/assets/

# Verify
ls /Users/voitz/Projects/stargazer/apps/web/src/
```

**Expected:** No `App.tsx`, `App.css`, or `assets/` directory

**Why:**
- `App.tsx` is Vite's default template, never imported
- `main.tsx` uses `RouterProvider` directly
- `assets/react.svg` is only used by dead `App.tsx`

---

## Validation

After completing all tasks:

```bash
# Verify packages deleted
ls /Users/voitz/Projects/stargazer/packages/
# Expected: api, core, schemas, tsconfig

# Verify dead code deleted
ls /Users/voitz/Projects/stargazer/apps/web/src/
# Expected: NO App.tsx, App.css, assets/

# Quick type check (may still fail due to @repo/ui imports)
cd /Users/voitz/Projects/stargazer && npm run type-check
```

Type check may still fail because:
- `apps/web/package.json` still references `@repo/ui`
- `dialog.tsx` still imports from `@repo/ui`

These are fixed in Phase 2.
