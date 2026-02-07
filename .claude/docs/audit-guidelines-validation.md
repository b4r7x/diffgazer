# Testing Guidelines Validation

Validated against current best practices (February 2026).

## Summary

**Our guidelines are solid.** The testing.md document aligns well with current industry consensus. No guidelines are outdated or wrong. A few minor additions would strengthen it — primarily Vitest-specific patterns and clarifying when `vi.mock()` is acceptable alongside the "mock at boundaries" rule. The core philosophy, patterns, and anti-patterns are all still considered best practice.

---

## Guideline-by-Guideline Review

### 1. AAA Pattern (Arrange-Act-Assert)

- **Status**: VALID
- **Current consensus**: AAA remains the standard test structure pattern across the industry. Nearly all modern testing tools with BDD syntax encourage it. Manning, Semaphore, Microsoft, and Node.js best practices all recommend it in 2025-2026.
- **Our guideline says**: Use AAA pattern, one logical assertion per test, related assertions OK.
- **Recommendation**: Keep as-is. The alternative Given-When-Then (GWT) is functionally equivalent and used more in BDD contexts. No need to mention it since we're not doing BDD.

### 2. Mock at Boundaries Only

- **Status**: VALID, but NEEDS_MINOR_CLARIFICATION
- **Current consensus**: Strategic mocking at system boundaries is the consensus. Kent C. Dodds (Epic Web Dev) frames it as "test boundaries" — wherever you draw the line, everything past it is mocked. The risk of "overmocking" (where nothing real is tested) is the primary concern. The community agrees: mock external services, not internal modules.
- **Our guideline says**: Mock at boundaries (MSW for network), don't mock internal modules or hooks you're testing. `vi.mock` shown as bad example.
- **Recommendation**: Add a small clarification that `vi.mock()` is acceptable for non-network boundaries — e.g., file system, OS keyring, timers, environment variables. Our "When Mocking is OK" section already covers this, but the code example showing `vi.mock` as universally bad could confuse developers. The issue is mocking *internal business logic modules*, not `vi.mock` itself. Consider adding a positive `vi.mock` example for FS/keyring mocking to complement the MSW example.

### 3. MSW for API Mocking

- **Status**: VALID
- **Current consensus**: MSW 2.x remains the industry standard for API mocking in JavaScript testing. It's actively maintained (latest ecosystem updates through late 2025). The key advantage is that it intercepts real HTTP requests without stubbing fetch/axios, making tests more realistic. Vitest's official docs recommend MSW for request mocking. Alternatives (Mirage JS, Mockoon) exist but serve different niches.
- **Our guideline says**: Use MSW (`http`, `HttpResponse` from `msw`) for API mocking.
- **Recommendation**: Keep as-is. MSW 2.x import syntax shown (`http`, `HttpResponse`) is current. Note: for this project (local CLI tool), MSW is relevant for testing the web frontend's API calls. Server-side tests can use direct function calls or `vi.mock` for external services.

### 4. Testing Library Query Priority

- **Status**: VALID
- **Current consensus**: The Testing Library query priority remains the official recommendation. `getByRole` is still the top priority — it queries the accessibility tree and ensures tests match how assistive technology sees elements. The priority order (role > label > placeholder > text > testId) is unchanged.
- **Our guideline says**: Exactly matches Testing Library's official priority. `getByTestId` as last resort, `querySelector` as never.
- **Recommendation**: Keep as-is. One minor note from the community: `getByRole` can be slow on very large DOM trees, but this is a performance edge case, not a reason to change the guideline.

### 5. userEvent over fireEvent

- **Status**: VALID
- **Current consensus**: userEvent is unanimously preferred over fireEvent in 2025-2026. The Testing Library docs explicitly state "you should always try to use userEvent over fireEvent whenever you are able to." The `eslint-plugin-testing-library` even has a `prefer-user-event` rule. userEvent simulates real browser behavior (focus, keyboard events, selection manipulation), while fireEvent only dispatches a single DOM event.
- **Our guideline says**: Use `userEvent.setup()` + `user.type()`/`user.click()`. Shows fireEvent as bad example.
- **Recommendation**: Keep as-is. The `userEvent.setup()` pattern shown is the current recommended approach.

### 6. "100% Use Case Coverage > 100% Code Coverage"

- **Status**: VALID
- **Current consensus**: The industry consensus in 2025-2026 is clear: use case/behavior coverage is the business-focused priority, while code coverage is a supporting technical metric. High code coverage does not equal effective testing — you can have 90-100% code coverage with a buggy application. The community recommends not chasing coverage numbers but focusing on critical paths, edge cases, and error handling.
- **Our guideline says**: "100% use case coverage > 100% code coverage." Don't chase coverage numbers. Test critical paths, edge cases, error handling. Skip trivial code.
- **Recommendation**: Keep as-is. This is exactly the current consensus. The Kent Beck quote we include ("test as little as possible to reach a given level of confidence") remains widely cited.

### 7. "What NOT to Test" List

- **Status**: VALID
- **Current consensus**: The items in our skip list are all still considered correct:
  - Constants: Testing `expect(X).toBe('literal')` creates coupling without value
  - Trivial getters/setters: No logic to verify
  - Framework behavior: React/Vitest are already tested
  - CSS/styling: Visual regression tools (Chromatic, Percy) handle this
  - Implementation details: Still the #1 anti-pattern in frontend testing
  - Third-party libraries: Their maintainers test them
- **Our guideline says**: Skip constants, trivial code, framework behavior, CSS, implementation details, third-party libs.
- **Recommendation**: Keep as-is. The implementation details examples (testing internal state, spying on useState, testing framework behavior) are particularly good and match current advice.

### 8. Kent Beck / Martin Fowler / Testing Trophy References

- **Status**: VALID, minor context update possible
- **Current consensus**: These remain the canonical references. Martin Fowler's 2021 "On the Diverse and Fantastical Shapes of Testing" article adds nuance — the specific proportions (pyramid vs trophy vs honeycomb) matter less than writing fast, reliable, expressive tests with clear boundaries. The Testing Trophy (Kent C. Dodds) is considered the more relevant model for frontend JavaScript, while the Test Pyramid is more suited to backend/microservices.
- **Our guideline says**: References Kent Beck, Martin Fowler's Practical Test Pyramid, Testing Library philosophy, and several other solid sources.
- **Recommendation**: Keep as-is. Our sources section is solid. Could optionally add Martin Fowler's "On the Diverse and Fantastical Shapes of Testing" (2021) since it addresses the pyramid-vs-trophy debate directly, but this is not critical.

### 9. Test Data (Simple Over Factories)

- **Status**: VALID
- **Current consensus**: Simple, readable test data is preferred. Factories with faker are considered over-engineering for most cases. The community still recommends using plain object literals for test data and only reaching for factories when test suites become large enough to warrant them.
- **Our guideline says**: Use simple literal data. Factories OK only when many variations, complex relationships, or shared across files.
- **Recommendation**: Keep as-is.

### 10. Test Naming and File Organization

- **Status**: VALID
- **Current consensus**: Behavior-describing test names and co-located test files remain the standard. Vitest documentation and community best practices both recommend placing test files next to source files.
- **Our guideline says**: Describe behavior in test names. Co-locate test files with source.
- **Recommendation**: Keep as-is.

---

## Missing Guidelines We Should Add

### 1. Vitest-Specific Patterns (RECOMMENDED)

Our guidelines are framework-agnostic but we use Vitest. Worth adding a short Vitest section:

- **`vi.mock()` for boundary mocking**: Show a positive example of mocking FS, keyring, or environment — things MSW can't handle. This complements the MSW guidance without contradicting "mock at boundaries."
- **`vi.useFakeTimers()`**: Already mentioned but no code example. Useful for testing debounce, polling, timeouts.
- **`vi.hoisted()`**: For hoisting mock setup above `vi.mock()` calls (Vitest 1.x+ pattern).
- **Workspace/monorepo config**: Brief note on per-package `vitest.config.ts` since we're a monorepo.

### 2. Clarify vi.mock() vs MSW Decision (RECOMMENDED)

Add a decision table:

| What to mock | Tool | Example |
|---|---|---|
| HTTP/API requests | MSW | `http.get('/api/reviews', ...)` |
| File system | `vi.mock('node:fs/promises')` | Read/write operations |
| OS keyring | `vi.mock('./keyring')` | Credential storage |
| Timers/Date | `vi.useFakeTimers()` | Debounce, polling |
| Environment vars | `vi.stubEnv()` | `process.env.NODE_ENV` |
| Internal business logic | Do NOT mock | Test through public API |

### 3. Result<T,E> Testing Pattern (RECOMMENDED)

Since this project uses Result types everywhere, a short note on how to test them would be valuable:

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

## Guidelines to Remove or Modify

**Nothing needs removal.** All current guidelines are valid and well-aligned with 2025-2026 best practices.

### Minor Modifications

1. **Mocking section**: The `vi.mock()` example labeled as bad should clarify that the issue is mocking *internal business logic*, not `vi.mock()` itself. `vi.mock()` is the correct tool for boundary mocking of non-network dependencies (FS, keyring, etc.).

2. **Sources section**: Optionally add:
   - [Martin Fowler - On the Diverse and Fantastical Shapes of Testing (2021)](https://martinfowler.com/articles/2021-test-shapes.html)
   - [Vitest Mocking Guide](https://vitest.dev/guide/mocking)
   - [Epic Web Dev - What Is A Test Boundary?](https://www.epicweb.dev/what-is-a-test-boundary)

---

## Verdict

Our testing guidelines are **well-aligned with current best practices**. The philosophy is sound, the patterns are correct, and the anti-patterns are still relevant. The recommended additions (Vitest-specific patterns, vi.mock clarification, Result testing) are enhancements, not corrections. No urgent changes needed.
