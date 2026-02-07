# Testing Guidelines Validation

Validated on: 2026-02-07
Validated against: Vitest 4.0.18, MSW 2.x, React Testing Library 16.x, React 19.2

## Summary

- Guidelines checked: 16
- Valid (no changes needed): 12
- Needs update: 2
- Missing topics: 4

## Infrastructure Status

### Vitest Configs

| Package | Config exists | Status |
|---------|--------------|--------|
| `packages/core` | Yes | Minimal but functional. No issues. |
| `packages/api` | Yes | Minimal but functional. No issues. |
| `packages/schemas` | Yes | Minimal but functional. No issues. |
| `apps/server` | Yes | Minimal but functional. No issues. |
| `apps/web` | Yes | Includes `@vitejs/plugin-react`, `jsdom` environment, `@` alias. Correct. |
| `packages/hooks` | **No** | Has 1 test file (`get-figlet.test.ts`) but no vitest config and no test script. Tests are not discoverable by `pnpm -r test`. |

**No root vitest config or workspace/projects config exists.** Each package runs independently via `pnpm -r test`. This is a valid approach for this monorepo size but means no merged coverage reports. Vitest 4.0 supports `test.projects` in a root config as the recommended approach (the old `vitest.workspace` file is deprecated since 3.2). This is not a problem today but worth noting for future coverage reporting.

### Test Scripts

| Package | `test` | `test:watch` |
|---------|--------|--------------|
| Root `package.json` | `pnpm -r test` | Missing |
| `packages/core` | `vitest run` | `vitest` |
| `packages/api` | `vitest run` | `vitest` |
| `packages/schemas` | `vitest run` | `vitest` |
| `packages/hooks` | **Missing** | **Missing** |
| `apps/server` | `vitest run` | `vitest` |
| `apps/web` | `vitest run` | `vitest` |

**Issue:** `packages/hooks` has no test script. The test file `get-figlet.test.ts` exists but is never run by `pnpm -r test`.

### Dependencies

| Dependency | Installed | Version | Location |
|------------|-----------|---------|----------|
| `vitest` | Yes | `^4.0.18` | Root workspace devDep |
| `@testing-library/react` | Yes | `^16.3.2` | `apps/web` devDep |
| `@testing-library/user-event` | Yes | `^14.6.1` | `apps/web` devDep |
| `@testing-library/jest-dom` | Yes | `^6.9.1` | `apps/web` devDep |
| `jsdom` | Yes | `^28.0.0` | `apps/web` devDep |
| `@vitejs/plugin-react` | Yes | `^5.1.3` | `apps/web` devDep |
| `msw` | **Not installed** | N/A | N/A |

**MSW is not installed** anywhere in the project. The testing guidelines recommend MSW for HTTP mocking, but the actual tests use `vi.fn()` and manual fetch mocking (e.g., `globalThis.fetch = vi.fn()`). This is pragmatic and works fine for the current test scope. MSW would only become necessary if integration tests are added that test through real HTTP layers.

### Test Counts (actual vs audit estimates)

| Area | Audit estimate | Actual files | Actual tests |
|------|---------------|--------------|--------------|
| Server | ~170-230 | 31 files | 384 tests |
| Packages (core) | ~50-65 | 8 files | 117 tests |
| Packages (api) | ~12-15 | 3 files | 28 tests |
| Packages (schemas) | ~8-10 | 3 files | 16 tests |
| Packages (hooks) | Not listed | 1 file | Not run |
| Web | ~70-95 | 15 files | 110 tests |
| **Total** | ~330-430 | **61 files** | **655 tests** |

---

## Guideline-by-Guideline Validation

### 1. Philosophy ("100% use case coverage > 100% code coverage")

**Status**: VALID
**Current**: Tests document assumptions and catch regressions. They should make refactoring safe, not prevent it.
**Best Practice**: This aligns with Kent C. Dodds's Testing Trophy, Martin Fowler's Practical Test Pyramid, and Kent Beck's test desiderata. Still universally recommended.
**Recommendation**: No change needed.

### 2. What to Test / What NOT to Test

**Status**: VALID
**Current**: Test business logic, edge cases, error handling, integration points, user-visible behavior. Skip constants, trivial code, framework behavior, CSS, implementation details, third-party libs.
**Best Practice**: This is the standard guidance from Testing Library, Kent C. Dodds, and the broader community. The categories are complete and well-chosen.
**Recommendation**: No change needed.

### 3. Implementation Details Examples

**Status**: VALID
**Current**: Shows bad examples (testing internal state, spying on useState, testing framework behavior) and good example (testing observable behavior with screen queries).
**Best Practice**: Perfectly aligned with Testing Library's core philosophy. The examples are clear and actionable.
**Recommendation**: No change needed.

### 4. AAA Pattern (Arrange, Act, Assert)

**Status**: VALID
**Current**: Clear template with example. "One logical assertion per test, related assertions are fine."
**Best Practice**: AAA is universally recommended. The "related assertions OK" nuance is correct and avoids the dogmatic "one assert per test" anti-pattern.
**Recommendation**: No change needed.

### 5. Mock at Boundaries

**Status**: VALID
**Current**: MSW for HTTP, `vi.mock` for fs/keyring/environment, never mock internal business logic or hooks you're testing.
**Best Practice**: This is the correct guidance. The note clarifying that `vi.mock` is appropriate for non-network boundaries (fs, keyring) is valuable and accurate.
**Recommendation**: Minor note -- MSW is documented as the recommended HTTP mock tool, but it is not installed in the project. The actual tests use `globalThis.fetch = vi.fn()` which is perfectly adequate for unit tests. Consider adding a note that MSW is recommended for integration tests but manual fetch mocking is acceptable for unit tests where the fetch boundary is immediate.

### 6. Mocking Decision Table

**Status**: VALID
**Current**: 6 rows covering HTTP, filesystem, keyring, timers, env vars, and internal logic.
**Best Practice**: The table is complete for the project's needs. The `vi.stubEnv()` recommendation for environment variables is correct (available since Vitest 1.x).
**Recommendation**: No change needed. The table matches what the actual tests do.

### 7. React Testing Library Query Priority

**Status**: VALID
**Current**: getByRole > getByLabelText > getByPlaceholderText > getByText > getByTestId.
**Best Practice**: This is the exact priority order from the official Testing Library documentation. Still current in 2026.
**Recommendation**: No change needed.

### 8. userEvent over fireEvent

**Status**: VALID
**Current**: Recommends `userEvent.setup()` with `await user.type()` / `await user.click()`. Shows fireEvent as bad example.
**Best Practice**: This is the current best practice. `userEvent` v14 (installed at `^14.6.1`) uses the `setup()` API correctly. The examples in testing.md match the recommended usage.
**Recommendation**: No change needed.

### 9. Async Handling (waitFor, findBy)

**Status**: VALID
**Current**: Shows `waitFor()` and `findBy` as good patterns, flags missing `await` and arbitrary `setTimeout` as bad.
**Best Practice**: Still the correct guidance. React Testing Library's async utilities handle concurrent rendering in React 19 correctly.
**Recommendation**: No change needed.

### 10. Test Data

**Status**: VALID
**Current**: Prefer simple inline data. Factories only when test requires many variations, complex relationships, or shared across many files.
**Best Practice**: This is pragmatic and correct. Avoiding over-engineered factories (especially with faker) is widely recommended for smaller projects. The guidance correctly identifies when factories become justified.
**Recommendation**: No change needed.

### 11. Testing Result<T, E>

**Status**: VALID
**Current**: Shows pattern for testing both success and failure paths with discriminated union narrowing.
**Best Practice**: This is project-specific but the pattern is correct. The `if (result.ok)` / `if (!result.ok)` narrowing is idiomatic TypeScript.
**Recommendation**: No change needed.

### 12. Test Naming

**Status**: VALID
**Current**: "should [behavior] when [condition]" pattern. Bad examples: vague names, implementation-focused names.
**Best Practice**: This naming convention is widely used. Some teams prefer dropping "should" (e.g., "returns error when review not found") but both are acceptable. The current guidance is clear.
**Recommendation**: No change needed.

### 13. File Organization (Co-located tests)

**Status**: VALID
**Current**: `parser.ts` next to `parser.test.ts`. Separate `tests/` folder marked as bad.
**Best Practice**: Co-location is the growing consensus, especially for unit tests. This is consistent with the project's structure docs (`structure-packages.md`, `structure-apps.md`).
**Recommendation**: No change needed.

### 14. MSW API Syntax

**Status**: NEEDS_UPDATE
**Current**: Shows `import { http, HttpResponse } from 'msw'` with `http.get()` and `HttpResponse.json()`.
**Best Practice**: The syntax shown is correct for MSW v2 (released November 2023). The old v1 API (`rest.get`, `ctx.json`) is deprecated. However, MSW is **not installed** in the project. The guidelines recommend it as a tool but the project doesn't use it.
**Recommendation**: Add a note clarifying MSW is for future integration tests. For current unit tests, the project uses direct fetch mocking (`globalThis.fetch = vi.fn()`), which is appropriate. The MSW v2 syntax shown is correct if/when MSW is adopted.

### 15. Coverage vs Value

**Status**: VALID
**Current**: "Don't chase coverage numbers." Test critical paths, edge cases, error handling. Skip trivial code.
**Best Practice**: Still the dominant view. Kent Beck's quote is still widely cited. The guidance is actionable.
**Recommendation**: No change needed.

### 16. Anti-Patterns Table

**Status**: NEEDS_UPDATE (minor)
**Current**: Lists 8 anti-patterns including testing implementation, over-mocking, 100% coverage, complex setup, duplicate tests, snapshot abuse, fireEvent, getByTestId.
**Best Practice**: All 8 are still valid. However, two additional anti-patterns have become prominent in 2025-2026 discourse:
- **Testing memoization in React 19**: With React Compiler auto-memoizing, testing that `useMemo`/`useCallback` are called is testing implementation details. The project's `patterns.md` already notes this but `testing.md` doesn't mention it.
- **Excessive `act()` wrapping**: React Testing Library wraps `render`, `renderHook`, and `fireEvent` in `act()` automatically. Manually wrapping in `act()` is almost always unnecessary and masks real async issues.
**Recommendation**: Consider adding these two items to the anti-patterns table.

---

## Missing Topics

### 1. Vitest 4 Features

**Status**: MISSING
**Impact**: Low (informational)
**Details**: The project uses Vitest 4.0.18 but the testing guidelines don't mention any Vitest 4 features. Key features worth documenting:
- **Test Projects** (`test.projects` in root config) replaces the deprecated `vitest.workspace` file. Useful if the project wants merged coverage reports or a single root test command.
- **Visual Regression Testing** is now stable in Vitest 4 browser mode. Not applicable yet since the project doesn't use browser mode, but worth noting under "CSS/styling" in the "What NOT to Test" section as an alternative.
- **Test Tags** (Vitest 4.1 beta) allow filtering tests by tag and applying custom configs per tag.

**Recommendation**: Not urgent. Add a brief note about `test.projects` if the team wants unified coverage later.

### 2. React 19 Compiler Testing Considerations

**Status**: MISSING
**Impact**: Medium
**Details**: The project uses React 19 with the React Compiler. The `patterns.md` already says "no manual `useCallback`/`useMemo`" but `testing.md` doesn't address how this affects testing:
- Do not test that components memoize correctly (implementation detail under React Compiler).
- Do not use `React.memo()` wrapping in tests to verify re-render counts.
- Focus on observable output, not render performance.

**Recommendation**: Add a short section "React 19 Compiler and Testing" that references `patterns.md` and clarifies that render-count testing is an anti-pattern.

### 3. Hono `app.request()` Integration Testing

**Status**: MISSING (acknowledged in test-audit.md Phase 5)
**Impact**: Low (future work)
**Details**: The test-audit.md mentions `app.request()` for integration tests as Phase 5. The `testing.md` guidelines don't cover this pattern. However, many server tests already use Hono's `app.request()` pattern (e.g., `app.test.ts`, `trust-guard.test.ts`, `setup-guard.test.ts`).

**Recommendation**: Add a brief section on Hono integration testing since the project already uses this pattern:
```typescript
// Integration test using Hono app.request()
const res = await app.request('/api/health')
expect(res.status).toBe(200)
```

### 4. Test Cleanup / Isolation

**Status**: MISSING
**Impact**: Medium
**Details**: The guidelines don't mention test cleanup patterns. With Vitest 4, `mockReset` can be configured globally. The vi.mock/vi.spyOn discussion in the community emphasizes cleanup to avoid cross-test pollution.

**Recommendation**: Add a brief section on cleanup:
- Use `afterEach(() => vi.restoreAllMocks())` or set `mockReset: true` in vitest config.
- Clear any global state between tests (timers, fetch mocks, module-level caches).

---

## Contradictions

### 1. Test-audit.md "Current State" is severely outdated

The test-audit.md states:

> | Test runner | None configured |
> | Test deps | Not installed (need `pnpm add -Dw vitest`) |
> | Config files | None (need per-package vitest.config.ts) |
> | Test scripts | None in any package.json |
> | Existing tests | 3 files in packages/core (~60 tests) |

**Actual state** (as of 2026-02-07):
- Vitest `^4.0.18` installed at root
- 5 vitest configs exist (packages/core, packages/api, packages/schemas, apps/server, apps/web)
- Test scripts exist in all package.json files except `packages/hooks`
- **61 test files** exist with **655 passing tests**

### 2. Test-audit.md file count estimate is outdated

The audit estimated `~64 files` and `~330-430 tests`. The project now has 61 test files and 655 tests. The per-area estimates are also off because many files were written since the audit.

### 3. Test-audit.md "Infrastructure Needed" section is done

The three infrastructure steps (install vitest, per-package configs, test scripts) are all complete. The section should be marked as completed or removed.

### 4. Test-audit.md "Implementation Order" phases are partially complete

Phases 0-4 are substantially complete. The audit lists 64 modules to test across 5 phases. Many of these have test files now. The audit should be updated to reflect current coverage.

### 5. No contradiction between testing.md and test-audit.md on principles

The testing principles, rules, and quality standards are consistent between both documents. The contradictions are purely about the "Current State" and infrastructure sections being stale.

---

## Recommended Changes to testing.md

### Change 1: Add MSW installation note

In the "Mock at Boundaries" section, after the MSW code example, add:

```markdown
**Note:** MSW is recommended for integration tests that go through HTTP layers.
For unit tests where you mock fetch directly, `globalThis.fetch = vi.fn()` is acceptable.
MSW must be installed separately (`pnpm add -Dw msw`) if needed.
```

### Change 2: Add React 19 Compiler note

Add a new section after "Testing Result<T, E>":

```markdown
## React 19 Compiler

This project uses React 19 with the React Compiler, which auto-memoizes components.

**Do NOT test:**
- Re-render counts or memoization behavior
- That `useMemo`/`useCallback` are called (they shouldn't exist in this codebase)
- Component identity via `React.memo()` wrappers

**DO test:**
- Observable output (what the user sees)
- State transitions (user action -> UI change)
- Side effects (API calls, navigation)

See `patterns.md` for the "No Manual Memoization" rule.
```

### Change 3: Add two anti-patterns

Add to the anti-patterns table:

```markdown
| Manual `act()` wrapping | RTL wraps automatically | Only use for non-RTL async |
| Testing memoization | React Compiler handles it | Test behavior, not renders |
```

### Change 4: Add cleanup section

Add after "File Organization":

```markdown
## Test Cleanup

Vitest isolates each test file by default but mocks persist within a file.

```typescript
// In vitest config (or globally)
test: { mockReset: true }

// Or manually per file
afterEach(() => {
  vi.restoreAllMocks()
})
```

Clear module-level caches and global state between tests when needed.
```

---

## Recommended Changes to test-audit.md

### Change 1: Update "Current State" section

Replace the entire "Current State" table with current data:

```markdown
## Current State (updated 2026-02-07)

| What | Status |
|------|--------|
| Test runner | Vitest 4.0.18 (root workspace devDep) |
| Config files | 5 configs (core, api, schemas, server, web) |
| Test scripts | All packages except `packages/hooks` |
| Test files | 61 files |
| Tests passing | 655 (all green) |

### Coverage by area
| Area | Files | Tests |
|------|-------|-------|
| apps/server | 31 | 384 |
| packages/core | 8 | 117 |
| apps/web (+ .tsx) | 15 | 110 |
| packages/api | 3 | 28 |
| packages/schemas | 3 | 16 |
| packages/hooks | 1 | Not run (missing config) |
```

### Change 2: Mark "Infrastructure Needed" as complete

Add `DONE` status to each infrastructure step, or replace the section:

```markdown
## Infrastructure — COMPLETE

- [x] Vitest installed (`^4.0.18` at root)
- [x] Per-package vitest.config.ts (5 configs)
- [x] Test scripts in package.json (5 of 6 packages)
- [ ] `packages/hooks` missing vitest config and test script
```

### Change 3: Update "Implementation Order" with completion status

Mark phases that are substantially complete. Add checkmarks to individual items that have test files.

### Change 4: Fix packages/hooks gap

Add `packages/hooks` to the audit. It has a test file (`get-figlet.test.ts`) but no vitest config and no test script. Either:
- Add vitest config + test script to `packages/hooks`
- Or move the test to a package that has test infrastructure

---

## Sources

- [Vitest 4.0 Release Blog](https://vitest.dev/blog/vitest-4)
- [Vitest Test Projects Documentation](https://vitest.dev/guide/projects)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking)
- [MSW 2.0 Introduction](https://mswjs.io/blog/introducing-msw-2.0)
- [MSW Best Practices](https://mswjs.io/docs/best-practices/managing-the-worker/)
- [Testing Library FAQ](https://testing-library.com/docs/react-testing-library/faq/)
- [React Compiler Introduction](https://react.dev/learn/react-compiler/introduction)
- [Common Mistakes with React Testing Library (Kent C. Dodds)](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [vi.spyOn vs vi.mock Discussion](https://github.com/vitest-dev/vitest/discussions/4224)
- [Vitest 3 Monorepo Setup](https://www.thecandidstartup.org/2025/09/08/vitest-3-monorepo-setup.html)
