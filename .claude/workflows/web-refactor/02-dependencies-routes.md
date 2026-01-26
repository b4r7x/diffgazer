# Workflow 02: Dependencies & Routes

## Overview

Fix package.json dependencies, register missing routes, and fix dialog component after @repo/ui deletion.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo.

### Prerequisites
- Phase 1 completed (packages/cli and packages/ui deleted)

### Problems to Fix
1. **Missing date-fns** - Imported in 2 files but not in package.json
2. **@repo/ui reference** - Must be removed from package.json
3. **Sessions route** - File exists but not registered in router
4. **dialog.tsx** - Imports from deleted @repo/ui

---

## Task 1: Fix package.json Dependencies

**Agent:** `frontend-developer`

**File:** `/Users/voitz/Projects/stargazer/apps/web/package.json`

**Changes:**

1. Remove @repo/ui dependency:
```diff
  "dependencies": {
    "@base-ui/react": "^1.1.0",
    "@repo/api": "workspace:*",
    "@repo/core": "workspace:*",
    "@repo/schemas": "workspace:*",
-   "@repo/ui": "workspace:*",
    "@tailwindcss/vite": "^4.1.18",
```

2. Add date-fns:
```diff
    "clsx": "^2.1.1",
+   "date-fns": "^3.6.0",
    "react": "^19.2.3",
```

**After editing:**
```bash
cd /Users/voitz/Projects/stargazer && pnpm install
```

**Verify:** No errors in pnpm install output

---

## Task 2: Register Sessions Route

**Agent:** `react-component-architect`

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/app/router.tsx`

**Problem:** SessionsPage exists at `routes/sessions.tsx` but route is not in routeTree.

**Changes:**

1. Add import (if missing):
```typescript
import SessionsPage from './routes/sessions'
```

2. Add route definition (after historyRoute):
```typescript
const sessionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sessions',
    component: SessionsPage,
})
```

3. Add to routeTree:
```typescript
const routeTree = rootRoute.addChildren([
    indexRoute,
    reviewRoute,
    reviewDetailRoute,
    settingsRoute,
    historyRoute,
    sessionsRoute,  // ADD THIS
])
```

---

## Task 3: Fix dialog.tsx

**Agent:** `react-component-architect`

**File:** `/Users/voitz/Projects/stargazer/apps/web/src/components/ui/dialog.tsx`

**Problem:** Current file re-exports from `@repo/ui` which was deleted.

**Replace entire file with:**

```typescript
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
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
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
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
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

**Note:** This uses `@base-ui/react/Dialog` which is already in dependencies.

---

## Validation

After completing all tasks:

```bash
# Install dependencies
cd /Users/voitz/Projects/stargazer && pnpm install

# Type check
npm run type-check

# Start dev server
cd apps/web && npm run dev
```

Test:
- Navigate to http://localhost:5173/sessions
- Should load without 404
