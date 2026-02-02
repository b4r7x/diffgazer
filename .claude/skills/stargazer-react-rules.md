# Stargazer React Rules

Quick reference for React patterns in this project.

## DON'T USE

| Pattern | Why | Instead |
|---------|-----|---------|
| `useMemo` | React Compiler optimizes | Just compute inline |
| `useCallback` | React Compiler optimizes | Just define function |
| `memo()` | React Compiler optimizes | Just render |
| `useEffect` for derived state | Unnecessary render cycle | Compute during render |
| `useEffect` for events | Wrong mental model | Use event handlers |

## DO USE

```tsx
// ✅ Derived state - compute during render
function Component({ items }) {
  const total = items.reduce((sum, i) => sum + i.price, 0)
  return <div>{total}</div>
}

// ✅ Event handlers - not useEffect
function Form() {
  const [value, setValue] = useState('')

  function handleSubmit() {
    // Do everything here, not in useEffect
    validate(value)
    submit(value)
  }

  return <form onSubmit={handleSubmit}>...</form>
}

// ✅ Reset state with key
<UserProfile key={userId} user={user} />

// ✅ useEffect ONLY for external sync
useEffect(() => {
  const ws = new WebSocket(url)
  return () => ws.close()
}, [url])
```

## SSE Streaming Pattern

```tsx
function useTriageStream(onEvent: (e: TriageEvent) => void) {
  useEffect(() => {
    const eventSource = new EventSource('/api/triage/stream')
    eventSource.onmessage = (e) => onEvent(JSON.parse(e.data))
    return () => eventSource.close()
  }, []) // onEvent intentionally omitted - stable reference expected
}
```
