# Tests Audit (Practical Testing)

**Agent:** `unit-testing:test-automator`

## Purpose
Validate tests across the monorepo for practical, human-like testing - no overengineering.

---

## Philosophy

> "The more your tests resemble the way your software is used, the more confidence they can give you." - Testing Library

**Test behavior, not implementation.**

---

## Checklist

### 1. Test Structure (AAA Pattern)

```typescript
// ✅ Good - clear Arrange-Act-Assert
it('should return error when review not found', async () => {
  // Arrange
  const nonExistentId = 'fake-id'

  // Act
  const result = await reviewService.getById(nonExistentId)

  // Assert
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain('not found')
})

// ❌ Bad - unclear structure
it('test review', async () => {
  const r = await reviewService.getById('fake')
  expect(r.ok).toBe(false)
  const r2 = await reviewService.create({ title: 'x' })
  expect(r2.ok).toBe(true)
})
```

**Check:** Each test has clear Arrange-Act-Assert sections.

### 2. Test Behavior, Not Implementation

```typescript
// ✅ Good - tests observable behavior
it('should display error message when API fails', async () => {
  server.use(
    http.get('/api/reviews', () => HttpResponse.error())
  )

  render(<ReviewList />)

  await waitFor(() => {
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  })
})

// ❌ Bad - tests implementation details
it('should call useState 3 times', () => {
  const useStateSpy = vi.spyOn(React, 'useState')
  render(<ReviewList />)
  expect(useStateSpy).toHaveBeenCalledTimes(3)
})

// ❌ Bad - tests internal state
it('should set loading to true then false', () => {
  const { result } = renderHook(() => useReview('1'))
  expect(result.current.internalLoadingState).toBe(true)
})
```

**Check:** Tests assert on user-visible outcomes, not internal state.

### 3. Use Right Query Priority (React Testing Library)

```typescript
// ✅ Good - accessible queries
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)
screen.getByPlaceholderText(/search/i)
screen.getByText(/welcome/i)

// ❌ Bad - implementation queries
screen.getByTestId('submit-btn')
container.querySelector('.btn-primary')
screen.getByClassName('submit-button')
```

**Priority order:**
1. `getByRole` (most preferred)
2. `getByLabelText`
3. `getByPlaceholderText`
4. `getByText`
5. `getByTestId` (last resort)

**Check:** Tests use accessible queries, not test IDs or class selectors.

### 4. Use userEvent over fireEvent

```typescript
// ✅ Good - realistic user interaction
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.type(screen.getByRole('textbox'), 'hello')
await user.click(screen.getByRole('button'))

// ❌ Bad - synthetic events
fireEvent.change(input, { target: { value: 'hello' } })
fireEvent.click(button)
```

**Check:** Use `userEvent` for interactions, not `fireEvent`.

### 5. Don't Over-Mock

```typescript
// ✅ Good - mock at network boundary with MSW
import { http, HttpResponse } from 'msw'

server.use(
  http.get('/api/reviews', () => {
    return HttpResponse.json([{ id: '1', title: 'Test' }])
  })
)

// ❌ Bad - mock everything
vi.mock('../api/reviewApi', () => ({
  getReviews: vi.fn().mockResolvedValue([{ id: '1' }])
}))
vi.mock('../hooks/useReview', () => ({
  useReview: vi.fn().mockReturnValue({ data: [...] })
}))
```

**Check:**
- Mock at network boundary (MSW)
- Don't mock internal modules unless necessary
- Don't mock hooks you're testing

### 6. Test Coverage That Matters

```typescript
// ✅ Good - test important paths
describe('ReviewService', () => {
  it('creates review with valid input')
  it('returns error for invalid input')
  it('handles network failure gracefully')
})

// ❌ Bad - testing trivial code
describe('constants', () => {
  it('API_URL is defined', () => {
    expect(API_URL).toBeDefined()
  })
})

// ❌ Bad - testing framework behavior
it('useState updates state', () => {
  const [state, setState] = useState(0)
  setState(1)
  expect(state).toBe(1)  // Testing React, not your code
})

// ❌ Bad - testing same behavior twice
it('shows error for empty email')
it('validates email is not empty')  // Duplicate!

// ❌ Bad - testing third-party library
it('zod parses string correctly', () => {
  expect(z.string().parse('hello')).toBe('hello') // Tests Zod, not your code
})
```

**Test:**
- Business logic
- Edge cases
- Error handling
- Integration points

**Don't test:**
- Constants
- Trivial getters/setters (no logic)
- Framework behavior (React, Vitest)
- CSS/styling
- Third-party library behavior
- Same case tested elsewhere
- Internal implementation details

### 6a. 100% Use Case Coverage > 100% Code Coverage

```typescript
// ❌ Bad - testing to hit coverage numbers
it('covers the else branch', () => {
  // This test exists only because coverage tool flagged line 42
})

// ✅ Good - testing actual use cases
it('handles user cancellation gracefully')
it('retries on network timeout')
it('shows validation error for invalid input')
```

**Don't write tests just for coverage.** Ask:
- Does this test document a real use case?
- Would a bug here break the app?
- Does this test help me refactor safely?

### 7. Test File Colocation

```
// ✅ Good - colocated
├── parser.ts
├── parser.test.ts

// ❌ Bad - separate folder
├── src/
│   └── parser.ts
├── tests/
│   └── parser.test.ts
```

**Check:** Test files next to source files.

### 8. Descriptive Test Names

```typescript
// ✅ Good - describes behavior
it('should return empty array when no reviews match filter')
it('should throw HTTPException when user not authenticated')
it('should retry failed requests up to 3 times')

// ❌ Bad - vague names
it('works')
it('test createReview')
it('handles error')
```

**Check:** Test names describe expected behavior, not implementation.

### 9. Async Handling

```typescript
// ✅ Good - proper async handling
it('loads reviews', async () => {
  render(<ReviewList />)

  await waitFor(() => {
    expect(screen.getByText('Review 1')).toBeInTheDocument()
  })
})

// ❌ Bad - no await, flaky test
it('loads reviews', () => {
  render(<ReviewList />)
  expect(screen.getByText('Review 1')).toBeInTheDocument()  // Flaky!
})
```

**Check:**
- Use `await waitFor()` for async assertions
- Use `findBy*` queries for async elements
- Don't use arbitrary `setTimeout`

### 10. No Overengineering

```typescript
// ❌ Bad - overly abstract test helpers
const createTestReview = (overrides = {}) => ({
  id: faker.string.uuid(),
  title: faker.lorem.words(3),
  severity: faker.helpers.arrayElement(['low', 'high']),
  ...overrides
})

const setupTestEnvironment = async (config: TestConfig) => {
  // 50 lines of setup...
}

// ✅ Good - simple, readable
const testReview = {
  id: '1',
  title: 'Test Review',
  severity: 'high',
}
```

**Check:**
- Test setup is simple and readable
- No complex test factories unless needed
- Inline test data when possible

---

## Commands

```bash
# Find fireEvent usage (should be userEvent)
grep -rn "fireEvent\." apps/ packages/ --include="*.test.ts*"

# Find getByTestId usage (should use accessible queries)
grep -rn "getByTestId\|queryByTestId" apps/ packages/ --include="*.test.ts*"

# Find tests without await for async
grep -rn "it\(.*async" apps/ packages/ --include="*.test.ts*" -A 5 | grep -v "await"

# Find tests in __tests__ folders (should be colocated)
find apps/ packages/ -name "__tests__" -type d

# Find tests spying on React internals (implementation detail)
grep -rn "spyOn.*React\|spyOn.*useState\|spyOn.*useEffect" apps/ packages/ --include="*.test.ts*"

# Find tests checking internal state (implementation detail)
grep -rn "_internal\|\.current\._\|private" apps/ packages/ --include="*.test.ts*"

# Find duplicate test descriptions
grep -rn "it\('" apps/ packages/ --include="*.test.ts*" | cut -d"'" -f2 | sort | uniq -d

# Find tests that just check existence (likely trivial)
grep -rn "toBeDefined\(\)\|toBeTruthy\(\)" apps/ packages/ --include="*.test.ts*"

# Find vi.mock for internal modules (over-mocking)
grep -rn "vi\.mock\('\.\.\/" apps/ packages/ --include="*.test.ts*"
```

---

## Output

| Issue | File | Line | Fix |
|-------|------|------|-----|
| Uses fireEvent | review.test.tsx | 34 | Change to userEvent |
| Uses getByTestId | form.test.tsx | 12 | Use getByRole/getByLabelText |
| Tests implementation | hook.test.ts | 45 | Test observable behavior |
| Not colocated | __tests__/parser.test.ts | - | Move next to parser.ts |
| Over-mocked | api.test.ts | 5-20 | Use MSW instead |

---

## Sources
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Common Mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)
