# Testing Guidelines

## Philosophy

> "The more your tests resemble the way your software is used, the more confidence they can give you." - Testing Library

**100% use case coverage > 100% code coverage**

Tests document assumptions and catch regressions. They should make refactoring safe, not prevent it.

---

## What to Test

| Category | Examples |
|----------|----------|
| Business logic | Validation rules, calculations, transformations |
| Edge cases | Empty inputs, boundaries, null/undefined |
| Error handling | Network failures, invalid data, timeouts |
| Integration points | API responses, service interactions |
| User-visible behavior | What user sees/clicks, form submissions |

---

## What NOT to Test

| Skip | Why |
|------|-----|
| Constants | `expect(API_URL).toBe('...')` tests nothing |
| Trivial getters/setters | No logic to verify |
| Framework behavior | React/Vitest already tested |
| CSS/styling | Visual regression tools exist for this |
| Implementation details | Couples tests to code structure |
| Third-party libraries | Their tests cover them |

### Implementation Details Examples

```typescript
// ❌ BAD: Tests implementation (internal state)
it('sets loading to true', () => {
  const { result } = renderHook(() => useReview())
  expect(result.current._internalLoading).toBe(true)
})

// ❌ BAD: Tests implementation (spy on internals)
it('calls useState 3 times', () => {
  const spy = vi.spyOn(React, 'useState')
  render(<Component />)
  expect(spy).toHaveBeenCalledTimes(3)
})

// ❌ BAD: Tests framework behavior
it('useState updates state', () => {
  const [state, setState] = useState(0)
  setState(1)
  expect(state).toBe(1) // Testing React, not your code
})

// ✅ GOOD: Tests observable behavior
it('shows loading indicator while fetching', async () => {
  render(<ReviewList />)
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
```

---

## Test Structure (AAA Pattern)

```typescript
it('should return error when review not found', async () => {
  // Arrange - setup test data
  const nonExistentId = 'fake-id'

  // Act - perform the action
  const result = await reviewService.getById(nonExistentId)

  // Assert - verify the outcome
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain('not found')
})
```

**One logical assertion per test.** Related assertions are fine:

```typescript
// ✅ OK: Related assertions
expect(result.ok).toBe(false)
expect(result.error?.code).toBe('NOT_FOUND')

// ❌ BAD: Unrelated assertions (split into separate tests)
expect(result.ok).toBe(false)
expect(otherService.callCount).toBe(0)
```

---

## Mocking Guidelines

### Mock at Boundaries

```typescript
// ✅ GOOD: Mock at network boundary (MSW)
import { http, HttpResponse } from 'msw'

server.use(
  http.get('/api/reviews', () => {
    return HttpResponse.json([{ id: '1', title: 'Test' }])
  })
)

// ❌ BAD: Mock internal business logic modules
vi.mock('../api/reviewApi', () => ({
  getReviews: vi.fn().mockResolvedValue([{ id: '1' }])
}))

// ❌ BAD: Mock hooks you're testing
vi.mock('../hooks/useReview', () => ({
  useReview: vi.fn().mockReturnValue({ data: [...] })
}))
```

### When Mocking is OK

- External services (APIs, databases)
- Time/Date (`vi.useFakeTimers()`)
- Environment variables
- File system operations

### When Mocking is NOT OK

- Internal business logic modules (test through them)
- Hooks you're testing
- State management internals

**Note:** `vi.mock` is the correct tool for boundary mocking of non-network dependencies (file system, OS keyring, environment). MSW is preferred for HTTP/API boundaries.

### Mocking Decision Table

| What to mock | Tool | Example |
|---|---|---|
| HTTP/API requests | MSW | `http.get('/api/reviews', ...)` |
| File system | `vi.mock('node:fs/promises')` | Read/write operations |
| OS keyring | `vi.mock('../keyring')` | Credential storage |
| Timers/Date | `vi.useFakeTimers()` | Debounce, polling |
| Environment vars | `vi.stubEnv()` | `process.env.NODE_ENV` |
| Internal business logic | Do NOT mock | Test through public API |

---

## React Testing Library

### Query Priority

```typescript
// ✅ Accessible queries (prefer these)
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)
screen.getByPlaceholderText(/search/i)
screen.getByText(/welcome/i)

// ❌ Implementation queries (avoid)
screen.getByTestId('submit-btn')        // Last resort only
container.querySelector('.btn-primary')  // Never
```

**Priority order:**
1. `getByRole` - how assistive tech sees it
2. `getByLabelText` - form fields
3. `getByPlaceholderText` - inputs
4. `getByText` - non-interactive content
5. `getByTestId` - only when nothing else works

### User Interactions

```typescript
// ✅ GOOD: Realistic interactions
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.type(screen.getByRole('textbox'), 'hello')
await user.click(screen.getByRole('button'))

// ❌ BAD: Synthetic events (misses real behavior)
fireEvent.change(input, { target: { value: 'hello' } })
fireEvent.click(button)
```

### Async Handling

```typescript
// ✅ GOOD: Wait for async
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// ✅ GOOD: findBy for async elements
const element = await screen.findByText('Loaded')

// ❌ BAD: No await (flaky test)
expect(screen.getByText('Loaded')).toBeInTheDocument()

// ❌ BAD: Arbitrary timeout
await new Promise(r => setTimeout(r, 1000))
```

---

## Test Data

### Keep It Simple

```typescript
// ✅ GOOD: Simple, readable data
const testReview = {
  id: '1',
  title: 'Test Review',
  severity: 'high',
}

// ❌ BAD: Over-engineered factory
const createTestReview = (overrides = {}) => ({
  id: faker.string.uuid(),
  title: faker.lorem.words(3),
  severity: faker.helpers.arrayElement(['low', 'high']),
  createdAt: faker.date.recent(),
  ...overrides
})
```

### Use Factories Only When Needed

Complex factories are OK when:
- Test requires many variations
- Data has complex relationships
- Shared across many test files

---

## Testing Result<T, E>

This project uses Result types for error handling. Test both paths:

```typescript
// Testing success
const result = await service.doThing()
expect(result.ok).toBe(true)
if (result.ok) expect(result.value).toEqual(expected)

// Testing failure
const result = await service.doThing()
expect(result.ok).toBe(false)
if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
```

---

## Test Naming

```typescript
// ✅ GOOD: Describes behavior
it('should return empty array when no reviews match filter')
it('should throw HTTPException when user not authenticated')
it('should retry failed requests up to 3 times')

// ❌ BAD: Vague/implementation-focused
it('works')
it('test createReview')
it('calls the API')
```

---

## File Organization

```
// ✅ GOOD: Co-located
├── parser.ts
├── parser.test.ts

// ❌ BAD: Separate folder
├── src/
│   └── parser.ts
├── tests/
│   └── parser.test.ts
```

---

## Common Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Testing implementation | Breaks on refactor | Test observable behavior |
| Over-mocking | Tests mock, not code | Mock at boundaries only |
| 100% coverage goal | Tests trivial code | Focus on use cases |
| Complex test setup | Hard to understand | Keep setup simple |
| Testing same case twice | Wastes time | One test per behavior |
| Snapshot abuse | Brittle, no intent | Assert specific values |
| `fireEvent` | Misses real behavior | Use `userEvent` |
| `getByTestId` first | Couples to implementation | Use accessible queries |

---

## Coverage vs Value

Don't chase coverage numbers. Instead:

1. **Test critical paths** - What breaks the app if wrong?
2. **Test edge cases** - What unusual inputs occur?
3. **Test error handling** - How does failure behave?
4. **Skip trivial code** - If it can't fail, don't test it

**Kent Beck:** "I get paid for code that works, not for tests. My philosophy is to test as little as possible to reach a given level of confidence."

---

## Sources

- [Testing Library Philosophy](https://testing-library.com/docs/react-testing-library/intro/)
- [Kent Beck's Test Desiderata](https://medium.com/@kentbeck_7670/test-desiderata-94150638a4b3)
- [Martin Fowler's Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Software Testing Anti-patterns](https://blog.codepipes.com/testing/software-testing-antipatterns.html)
- [Don't Test Implementation Details in React](https://maxrozen.com/dont-test-implementation-details-react)
- [TDD, Where Did It All Go Wrong](https://keyvanakbary.github.io/learning-notes/talks/tdd-where-did-it-all-go-wrong/)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking)
