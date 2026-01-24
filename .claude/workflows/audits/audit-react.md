# React/TypeScript Audit (CLI & Web Apps)

**Agent:** `react-component-architect`

## Purpose
Validate React code in `apps/cli/` and `apps/web/` against 2026 best practices.

---

## Checklist

### 1. Don't Overuse useMemo/useCallback

React Compiler (1.0, October 2025) auto-memoizes. Manual memoization is rarely needed.

```typescript
// ❌ Bad - unnecessary memoization
const filteredItems = useMemo(() =>
  items.filter(i => i.active),
  [items]
)

const handleClick = useCallback(() => {
  doSomething()
}, [])

// ✅ Good - let compiler optimize
const filteredItems = items.filter(i => i.active)

const handleClick = () => {
  doSomething()
}
```

**When manual memoization IS needed:**
- Third-party libraries requiring stable references
- Truly expensive calculations (profile first!)
- Effect dependencies requiring precise control

**Check:** Search for `useMemo` and `useCallback` - each should have documented reason.

### 2. Write Pure Components

React Compiler requires pure components for optimization.

```typescript
// ❌ Bad - impure (side effects in render)
function BadComponent() {
  const now = Date.now()  // Non-deterministic
  someGlobalVar = 'mutated'  // Side effect
  return <div>{now}</div>
}

// ✅ Good - pure
function GoodComponent({ timestamp }: Props) {
  return <div>{timestamp}</div>
}
```

**Check:**
- No `Date.now()`, `Math.random()` in render
- No mutations of props or external state
- No side effects outside useEffect

### 3. Use Zustand Correctly

```typescript
// ❌ Bad - selecting entire store
const state = useStore()

// ✅ Good - select specific values
const count = useStore(state => state.count)
const increment = useStore(state => state.increment)

// ✅ Good - useShallow for multiple values
import { useShallow } from 'zustand/react/shallow'
const { count, name } = useStore(
  useShallow(state => ({ count: state.count, name: state.name }))
)
```

**Check:**
- Always use selectors with Zustand
- Use `useShallow` for multiple values
- One store per concern (not one giant store)

### 4. File Naming (kebab-case)

```
// ✅ Good
use-review.ts
review-display.tsx
review-api.ts

// ❌ Bad
useReview.ts
ReviewDisplay.tsx
reviewApi.ts
```

**Check:** ALL files in apps/ use kebab-case.

### 5. Component Structure

```typescript
// ✅ Good - focused, single responsibility
function ReviewItem({ review, onSelect }: ReviewItemProps) {
  return (
    <Box>
      <Text>{review.title}</Text>
      <Button onPress={() => onSelect(review.id)}>Select</Button>
    </Box>
  )
}

// ❌ Bad - too much logic in component
function ReviewItem({ reviewId }: { reviewId: string }) {
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReview(reviewId).then(setReview).finally(() => setLoading(false))
  }, [reviewId])

  // ... 50 more lines
}
```

**Check:**
- Components < 100 lines
- Logic extracted to hooks
- Single responsibility

### 6. Custom Hooks Pattern

```typescript
// ✅ Good - hook encapsulates logic
function useReview(id: string) {
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

// Usage
function ReviewScreen({ id }: Props) {
  const { status, data, error, fetch } = useReview(id)
  // Clean component, logic in hook
}
```

**Check:** Complex logic extracted to custom hooks.

### 7. Colocation

```
// ✅ Good - hook used only by this component is colocated
components/review-card/
├── review-card.tsx
├── review-card.test.tsx
├── use-review-card.ts      # Only used here
└── index.ts

// ❌ Bad - hook in shared hooks/ but used by one component
hooks/
└── use-review-card.ts      # Only used by ReviewCard
```

**Check:** Hooks/utils used by one component are colocated.

### 8. Import Hierarchy

```typescript
// ✅ Good - correct hierarchy
// In features/review/components/review-list.tsx
import { Button } from '@/components/ui/button'  // Shared
import { useReview } from '../hooks/use-review'  // Same feature

// ❌ Bad - cross-feature import
import { useChat } from '@/features/chat/hooks'  // VIOLATION
```

**Check:** No cross-feature imports. Features compose at app layer.

---

## Commands

```bash
# Find useMemo/useCallback (review each)
grep -rn "useMemo\|useCallback" apps/cli/src apps/web/src

# Find camelCase files (should be kebab-case)
find apps/cli/src apps/web/src -name "*.ts" -o -name "*.tsx" | xargs basename -a | grep -E '^[a-z].*[A-Z]'

# Find Date.now() or Math.random() in components
grep -rn "Date.now()\|Math.random()" apps/cli/src apps/web/src --include="*.tsx"

# Find cross-feature imports
grep -rn "from '@/features/" apps/cli/src/features/ | grep -v "from '@/features/\($(basename $(dirname $file))\)"
```

---

## Output

| Issue | File | Line | Fix |
|-------|------|------|-----|
| Unnecessary useMemo | review-list.tsx | 23 | Remove, let compiler optimize |
| camelCase file | useReview.ts | - | Rename to use-review.ts |
| Cross-feature import | review/api.ts | 5 | Move shared logic to src/ |
| Impure component | timer.tsx | 12 | Move Date.now() to prop/effect |

---

## Sources
- [React Compiler Introduction](https://react.dev/learn/react-compiler/introduction)
- [When to useMemo and useCallback - Kent C. Dodds](https://kentcdodds.com/blog/usememo-and-usecallback)
- [Working with Zustand - TkDodo](https://tkdodo.eu/blog/working-with-zustand)
- [React 19 Best Practices](https://dev.to/jay_sarvaiya_reactjs/react-19-best-practices-write-clean-modern-and-efficient-react-code-1beb)
