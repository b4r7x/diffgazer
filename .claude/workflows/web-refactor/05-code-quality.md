# Workflow 05: Code Quality

## Overview

Remove console statements, fix hook usage, and clean up empty directories.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo.

### Prerequisites
- Phases 1-4 completed

### Problems to Fix
1. **Console statements** - 5 files with console.log/error/warn
2. **ReviewPanel hook** - Using wrong destructuring
3. **Empty directories** - stores/, types/ are empty

### Patterns to Follow (from CLAUDE.md)
- No console statements in production code
- Use error states instead of console.error
- Delete unused code/directories

---

## Task 1: Remove Console Statements

**Agent:** `codebase-cleanup:code-reviewer`

### File 1: triage-api.ts

**Path:** `/Users/voitz/Projects/stargazer/apps/web/src/features/review/api/triage-api.ts`

**Line ~41:**
```diff
- console.error("Failed to parse SSE event", e)
+ // Silently ignore malformed SSE events
```

### File 2: review-api.ts

**Path:** `/Users/voitz/Projects/stargazer/apps/web/src/features/review/api/review-api.ts`

**Line ~64:**
```diff
- console.warn('Failed to parse SSE event:', data)
+ // Silently ignore malformed SSE events
```

**Note:** This file may have been deleted in Phase 3. If so, skip this.

### File 3: settings.tsx

**Path:** `/Users/voitz/Projects/stargazer/apps/web/src/app/routes/settings.tsx`

**Line ~34:**
```diff
- console.error(e)
+ // Error is already captured in state by the hook
+ // Or: setError(e instanceof Error ? e : new Error('Unknown error'))
```

### File 4: review/index.tsx

**Path:** `/Users/voitz/Projects/stargazer/apps/web/src/app/routes/review/index.tsx`

**Lines ~74-75:**
```diff
- console.log('Apply patch', id)
- console.log('Explain', id)
+ // TODO: Implement patch application
+ // TODO: Implement explanation feature
```

---

## Task 2: Fix ReviewPanel Hook Usage

**Agent:** `frontend-developer`

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/features/review/components/review-panel.tsx`

### Step 1: Check actual hook return type

Read: `/Users/voitz/Projects/stargazer/apps/web/src/features/review/hooks/use-triage-stream.ts`

The hook likely returns something like:
```typescript
return {
  state,      // Contains events, issues, etc.
  start,      // Function to start stream
  stop,       // Function to stop stream
  selectIssue // Function to select an issue
}
```

### Step 2: Fix destructuring

**Current (broken):**
```typescript
const { events, issues } = useTriageStream()
```

**Fixed (example - adjust based on actual hook):**
```typescript
const { state, start, stop, selectIssue } = useTriageStream()
const { events, issues } = state
```

Or if the hook returns different structure:
```typescript
const triageStream = useTriageStream()
const events = triageStream.state?.events ?? []
const issues = triageStream.state?.issues ?? []
```

### Step 3: Update component to use correct values

Ensure all usages of `events` and `issues` in the component work with the new structure.

---

## Task 3: Delete Empty Directories

**Agent:** `Bash`

**Commands:**
```bash
# Check if directories are empty
ls /Users/voitz/Projects/stargazer/apps/web/src/stores/ 2>/dev/null
ls /Users/voitz/Projects/stargazer/apps/web/src/types/ 2>/dev/null

# Delete if empty
rmdir /Users/voitz/Projects/stargazer/apps/web/src/stores/ 2>/dev/null || echo "stores/ not empty or already deleted"
rmdir /Users/voitz/Projects/stargazer/apps/web/src/types/ 2>/dev/null || echo "types/ not empty or already deleted"

# Verify
ls /Users/voitz/Projects/stargazer/apps/web/src/
```

**Note:** `rmdir` only deletes empty directories. If they contain files, it will fail (which is correct - we shouldn't delete non-empty directories without checking).

---

## Validation

After completing all tasks:

```bash
cd /Users/voitz/Projects/stargazer

# Check no console statements remain
grep -r "console\." apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
# Should return nothing (or only intentional debug utilities)

# Type check
npm run type-check

# Quick test
cd apps/web && npm run dev
# Should start without errors
```

---

## Optional: Additional Cleanup

If time permits, also consider:

### Remove unused exports

**Check if these functions are imported anywhere:**
```bash
grep -r "validateApiKey" apps/web/src/
grep -r "deleteConfig" apps/web/src/
```

If only defined (not imported), delete them from their source files.

### Create barrel exports for components

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/components/ui/index.ts`

```typescript
export * from './button'
export * from './card'
export * from './badge'
export * from './dialog'
export * from './tabs'
export * from './select'
export * from './input'
export * from './textarea'
export * from './skeleton'
export * from './progress'
export * from './code-block'
export * from './separator'
export * from './spinner'
```

This allows cleaner imports:
```typescript
import { Button, Card, Badge } from '@/components/ui'
```
