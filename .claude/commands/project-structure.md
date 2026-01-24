# Project Structure Context

Load this context when implementing new features or modifying project structure.

---

## Quick Reference

### Package Naming (packages/*)

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `error-classifier.ts` |
| Folders | kebab-case | `utils/` |
| Single-word | preferred | `result.ts` not `result-type.ts` |
| Tests | co-located | `parser.test.ts` next to `parser.ts` |

### App Naming (apps/cli/*, apps/web/*)

| Type | Convention | Example |
|------|------------|---------|
| All files | kebab-case | `review-display.tsx`, `use-review.ts` |
| Component names | PascalCase | `ReviewDisplay` |
| Hook names | camelCase | `useReview` (but file is `use-review.ts`) |
| Folders | kebab-case | `review-history/` |

### Server Naming (apps/server/*)

| Type | Convention | Example |
|------|------------|---------|
| Routes | kebab-case | `reviews.ts` |
| Services | kebab-case | `review-orchestrator.ts` |
| Middleware | kebab-case | `auth.ts` |

---

## Feature Module Template

```
features/[name]/
├── api/
│   ├── index.ts
│   └── [name]-api.ts
├── components/
│   ├── index.ts
│   └── [name]-screen.tsx
├── hooks/
│   ├── index.ts
│   └── use-[name].ts
└── index.ts
```

## App Layer

```
app/
├── screens/          # Screen components (routes)
├── views/            # Sub-views
├── provider.tsx      # Context providers
└── app.tsx           # Main component
# NO hooks in app/

features/app/         # App as pseudo-feature
├── hooks/
│   ├── use-app-state.ts
│   ├── use-navigation.ts
│   └── index.ts
└── index.ts

hooks/                # ONLY reusable hooks
├── use-config.ts     # Used by multiple features
└── use-async-operation.ts
```

---

## Colocation Principle

**Keep things close to where they're used:**

| Used by | Location |
|---------|----------|
| 1 component | `components/[name]/use-[name].ts` |
| 1 feature (multiple components) | `features/[name]/hooks/` |
| Multiple features | `src/hooks/` |

```
components/review-card/
├── review-card.tsx
├── review-card.test.tsx      # Colocated test
├── use-review-card.ts        # Colocated hook (only used here)
└── index.ts
```

---

## Import Rules

```typescript
// ✅ Correct
import { ok, err } from '@repo/core'
import { ReviewSchema } from '@repo/schemas'
import { useReview } from '@/features/review/hooks'
import { Button } from '@/components/ui/button'

// ❌ Wrong - cross-feature import
import { useChat } from '@/features/chat/hooks'  // from review feature

// ❌ Wrong - relative import from app
import { Button } from '../../../components/ui/button'
```

---

## Import Hierarchy

```
@repo/* (packages)
    ↓
components/, hooks/, lib/, stores/ (shared)
    ↓
features/*/ (feature modules)
    ↓
app/ (application layer)
```

Features cannot import from other features.

---

## Checklist Before Creating Files

- [ ] File name follows convention for target directory
- [ ] Parent folder exists or needs creation
- [ ] index.ts will export new module
- [ ] Tests will be co-located
- [ ] No circular dependencies introduced
- [ ] Import paths use absolute `@/` prefix

---

## Common Patterns

### Result Type (packages)

```typescript
import { ok, err, type Result } from '@repo/core'

const doSomething = (): Result<Data, Error> => {
  try {
    return ok(data)
  } catch (e) {
    return err(e as Error)
  }
}
```

### API Hook (apps/cli)

```typescript
// features/review/hooks/useReview.ts
export const useReview = (id: string) => {
  const [state, setState] = useState<ReviewState>({ status: 'idle' })

  const fetch = useCallback(async () => {
    setState({ status: 'loading' })
    const result = await reviewApi.get(id)
    if (result.ok) {
      setState({ status: 'success', data: result.value })
    } else {
      setState({ status: 'error', error: result.error })
    }
  }, [id])

  return { ...state, fetch }
}
```

### Route Handler (apps/server)

```typescript
// api/routes/reviews.ts
const reviews = new Hono()

reviews.get('/:id', async (c) => {
  const id = c.req.param('id')
  const result = await reviewService.getById(id)

  if (!result.ok) {
    throw new HTTPException(500, { message: result.error.message })
  }

  if (!result.value) {
    throw new HTTPException(404, { message: 'Review not found' })
  }

  return c.json(result.value)
})

export default reviews
```

---

## Full Documentation

- Package rules: `.claude/docs/structure-packages.md`
- App rules: `.claude/docs/structure-apps.md`
- Server rules: `.claude/docs/structure-server.md`
- Audit workflow: `.claude/workflows/09-structure-audit.md`
- Enforcement workflow: `.claude/workflows/10-structure-enforcement.md`
