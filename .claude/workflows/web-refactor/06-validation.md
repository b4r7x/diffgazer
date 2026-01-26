# Workflow 06: Validation

## Overview

Final validation - type check, build test, and runtime verification.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo.

### Prerequisites
- Phases 1-5 completed

### What to Validate
1. TypeScript compiles without errors
2. Dev server starts
3. All routes load correctly
4. No console errors in browser

---

## Task 1: TypeScript Validation

**Agent:** `javascript-typescript:typescript-pro`

### Step 1: Run type-check
```bash
cd /Users/voitz/Projects/stargazer
npm run type-check
```

### Common errors and fixes

**Error: Cannot find module '@/...'**
- Verify tsconfig.json has `paths` configured
- Verify vite.config.ts has `resolve.alias` configured

**Error: Module not found '@repo/ui'**
- Verify all @repo/ui imports were removed or replaced
- Check dialog.tsx was updated

**Error: Property 'X' does not exist on type 'Y'**
- Hook return type mismatch (review-panel.tsx)
- Update destructuring to match actual return type

**Error: Duplicate identifier**
- Duplicate imports still exist
- Check agent-activity-panel.tsx and issue-list.tsx

### Step 2: Fix any errors found

For each error:
1. Read the error message and file path
2. Navigate to the file
3. Fix the issue
4. Re-run type-check

Repeat until: `npm run type-check` passes with 0 errors

---

## Task 2: Build Test

**Agent:** `javascript-typescript:typescript-pro`

### Step 1: Build the app
```bash
cd /Users/voitz/Projects/stargazer/apps/web
npm run build
```

### Common build errors

**Vite build errors:**
- Usually same as TypeScript errors
- May also include CSS/asset issues

**Check output:**
- Should see `dist/` directory created
- No errors in build output

---

## Task 3: Runtime Verification

**Agent:** `javascript-typescript:typescript-pro`

### Step 1: Start dev server
```bash
cd /Users/voitz/Projects/stargazer/apps/web
npm run dev
```

Should see:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### Step 2: Test routes

Open browser and navigate to each route:

| Route | Expected |
|-------|----------|
| http://localhost:5173/ | Home/dashboard loads |
| http://localhost:5173/settings | Settings page loads |
| http://localhost:5173/history | History page loads |
| http://localhost:5173/sessions | Sessions page loads (NEW) |
| http://localhost:5173/review | Review page loads |

### Step 3: Check browser console

Open Developer Tools (F12) → Console tab

Should see:
- No red errors
- No "Failed to load" messages
- No "Cannot find module" errors

### Step 4: Test key functionality

1. **Settings page:**
   - Should show provider configuration
   - No errors when loading

2. **Sessions page:**
   - Should load without 404
   - May be empty (no sessions yet)

3. **History page:**
   - Should load review history
   - May be empty (no reviews yet)

---

## Final Checklist

After all validation:

- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] Dev server starts without errors
- [ ] All routes load (/, /settings, /history, /sessions, /review)
- [ ] No console errors in browser
- [ ] No 404 errors

---

## Report

If any issues remain, document them:

### Remaining Issues

| Issue | File | Severity | Notes |
|-------|------|----------|-------|
| Example | path/to/file.tsx | High/Medium/Low | Description |

### Completed Successfully

If all checks pass:
```
✅ TypeScript: 0 errors
✅ Build: Success
✅ Dev server: Running
✅ Routes: All loading
✅ Console: No errors

Web refactor complete.
```

---

## Post-Refactor Structure

Final structure should be:

```
packages/
├── core/           # Shared business logic
├── schemas/        # Zod schemas
├── api/            # HTTP client
└── tsconfig/       # Shared TS config

apps/web/src/
├── app/
│   ├── providers/
│   │   ├── index.tsx
│   │   └── config-provider.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── history.tsx
│   │   ├── sessions.tsx
│   │   ├── settings.tsx
│   │   └── review/
│   └── router.tsx
├── components/
│   ├── ui/
│   │   └── dialog.tsx (standalone)
│   ├── layout/
│   ├── agent-activity-panel.tsx
│   └── agent-status.tsx
├── features/
│   ├── review/
│   ├── settings/
│   ├── history/
│   ├── menu/
│   └── sessions/
├── hooks/
├── lib/
├── main.tsx
└── index.css
```

**Deleted:**
- `packages/cli/` (orphaned)
- `packages/ui/` (unused duplicate)
- `apps/web/src/App.tsx` (dead code)
- `apps/web/src/App.css` (dead code)
- `apps/web/src/assets/` (dead code)
- `apps/web/src/contexts/` (moved to providers)
- `apps/web/src/stores/` (empty)
- `apps/web/src/types/` (empty)
