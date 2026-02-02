# Stargazer Simplify Patterns

How to simplify code when migrating from `.depracated/`.

## Remove

- Unused exports
- Commented-out code
- `_unused` variables
- Empty index.ts barrel files that just re-export
- Overly generic abstractions used once
- Feature flags for features we're keeping
- Backwards compatibility shims

## Flatten

```tsx
// Before: unnecessary abstraction
function useEntityList<T>(fetcher: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([])
  // ... 50 lines of generic logic
}

// After: just write what you need
function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([])
  // ... 15 lines of specific logic
}
```

## Inline

```tsx
// Before: separate file for 10-line utility
// utils/format-severity.ts
export function formatSeverity(s: Severity): string { ... }

// After: inline where used (if used once)
function IssueItem({ issue }) {
  const severityLabel = issue.severity.toUpperCase()
  // ...
}
```

## Storage Change

```
// Before (global):
~/.config/stargazer/reviews/{id}.json

// After (per-project):
.stargazer/reviews/{id}.json
```

## Keep As-Is

- Zod schemas (they're already good)
- Result<T,E> pattern (it works)
- SSE event types (need full typing)
- Lens definitions (core feature)
