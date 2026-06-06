# Testing Philosophy

Test runner: **Vitest 4** for all 10 packages (`libs/core`, `libs/keys`, `libs/registry`, `libs/ui`, `apps/web`, `apps/docs`, `apps/landing`, `cli/add`, `cli/diffgazer`, `cli/server`). Test files are colocated with sources as `<name>.test.ts(x)`.

## The Rules

### 1. Test behavior, not implementation

Assert on what consumers see or experience: rendered output, accessible roles/labels/text, returned values from public APIs, fired events. Never assert on internal state, private function calls, ref internals, or call counts (unless count IS the contract — e.g. shutdown sends exactly one SIGTERM).

If a test would break when refactoring internals without changing behavior, it's testing implementation. Delete or rewrite.

### 2. Accessible queries, in priority order

```
getByRole > getByLabelText > getByPlaceholderText > getByText > getByDisplayValue > getByAltText > getByTitle > getByTestId
```

`getByTestId` is the last resort. Use it only when:
- No accessible query reaches the target (e.g. layout containers with no semantic role).
- The `data-testid` IS the public API being verified (a `*ClassName` / `data-testid` prop forwarded to consumers).
- The test is a **hook test harness** that renders the hook's return value to a `data-testid` element so the test can read it back (`libs/ui/registry/hooks/testing/use-floating-position.test.ts`, `use-overflow.test.ts`). Hook outputs (numbers, coords, booleans) have no native role.

Document the second and third cases inline with `// getByTestId: <why>`.

`container.querySelector` and `.querySelector("#id")` are anti-patterns UNLESS:
- **Focus-movement tests in `libs/keys`** select target elements by `#id` to assert `document.activeElement === <expected>`. The focused element is identified by id; the accessible name (e.g. "A", "B") is not distinguishing. AGENTS.md keys library rules require this: *"test actual focus movement, active descendant, boundary callbacks, editable-target behavior."* Annotate with `// querySelector by id: testing focus movement to non-accessible-name target (keys library convention per AGENTS.md)`.
- **Structural assertion on an element with no accessible role** (decorative `<svg>`, layout shells, mocked-DOM SSR snapshots). Annotate with `// querySelector retained: <element type> has no accessible role; structural assertion is the contract`.

### 3. Fewer, longer tests

One test covering a complete user flow > five micro-step tests. Users don't stop after clicking one button. Match the test scope to the user scope.

Use `it.each` to collapse parameterizable cases (different keys → same action). **Title must include every parameter value** so a failing iteration is bisectable: `` `moves focus to item ${expectedIndex} via ${key}` ``. One behavior per `it.each` block — don't mix nav-key matrices with disabled-handling matrices.

### 4. Boundary mocks only

`vi.mock(...)` is allowed at **system boundaries**:
- Network / `fetch` (e.g. `@diffgazer/core/api/hooks` which wraps `createApi` over `fetch`, `@/lib/api` web singleton, AI SDK clients like `ai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`, `zhipu-ai-provider`)
- Filesystem (`node:fs`, `node:fs/promises`)
- Subprocess (`node:child_process`, thin wrappers like `cli/server/src/shared/lib/git/service.ts` which `promisify(execFile)`)
- OS keychain (`@napi-rs/keyring`, thin wrappers like `cli/server/src/shared/lib/config/keyring.ts` which dynamically loads the native addon)
- Timers (`setTimeout`/`setInterval`/`Date.now` via `vi.useFakeTimers()`)
- Browser-only APIs unavailable in jsdom (`IntersectionObserver`, `ResizeObserver`, `matchMedia`, `HTMLDialogElement.showModal`/`close`)
- External libraries with their own contract (`@tanstack/react-router` — routing decisions are explicit user behavior, the library is the boundary)

**Every retained `vi.mock(...)` MUST carry a `// Boundary mock: <why>` comment** naming the specific boundary. The audit gate enforces this.

**Mocking internal modules (sibling files, app composition, hooks owned by the same app) is forbidden.** When a test needs to isolate a unit from its compositional dependencies, refactor the unit for dependency injection (the `apps/web/src/features/home/components/home-presentation.tsx` split is the reference).

### 5. `userEvent` over `fireEvent`

`userEvent` simulates real browser behavior (focus management, event sequence, default actions). `fireEvent` is a low-level escape hatch.

`fireEvent` is retained ONLY for:
- Animation/transition events: `animationEnd`, `animationStart`, `transitionEnd` (no userEvent equivalent)
- Synthetic dialog events: `cancel`, `close` on `<dialog>` (no userEvent equivalent)
- Coordinate-based hit-detection: `fireEvent.click(el, { clientX, clientY })` for dialog backdrop tests
- Pointer/touch event-type contract tests: `pointerdown`, `touchstart` when asserting the event type itself
- Hover under fake timers: `mouseEnter`/`mouseLeave` when `vi.useFakeTimers()` is active (userEvent uses real timers internally)
- Native `<img>` `load`/`error` events (no userEvent equivalent)

Every `fireEvent.*` retention MUST carry an inline `// fireEvent retained: <why>` comment.

### 6. Fake timers for async waits

Replace hardcoded `setTimeout(N)` / `await new Promise(r => setTimeout(r, N))` with one of:
- `vi.useFakeTimers()` + `vi.advanceTimersByTime(N)` (deterministic wait)
- `vi.waitFor(() => expect(predicate).toBe(true), { timeout, interval })` (bounded wait, exits early)
- Real `setTimeout` only inside `vi.useFakeTimers()` scope driven by `vi.advanceTimersByTimeAsync`

Hardcoded waits without justification are brittle and flaky. The CI gate forbids them.

### 7. Accessibility coverage

Every UI component test (`libs/ui/registry/ui/**/*.test.tsx`) MUST either:
- Call `expect(await axe(container)).toHaveNoViolations()` at least once, OR
- Carry an inline `// axe skipped: <reason>` comment

The convention covers presentational components (decorative SVG icons, ASCII branding, dividers, presentational text wrappers, mocked-layout views, SSR snapshots, overlay infrastructure helpers).

If `axe()` surfaces a real violation: fix the component. Do not silence rules to make a test pass.

### 8. Hook tests assert public contract

`renderHook(...)` tests must assert on the hook's documented public return shape (state values, callable methods, observable side effects). Never assert on private refs or internal state, even if `result.current.somePrivateRef` is technically accessible.

Exception: when a ref or field IS public API (e.g. `useFocusRestore`'s `target`), assert it as documented.

### 9. CLI tests run on Vitest

Both `cli/add` and `cli/diffgazer` run on Vitest 4 with `environment: "node"`. Subprocess tests use `pool: "forks"` + `fileParallelism: false`. Ink-based `.tsx` tests use `esbuild.jsx: "automatic"` (no jsdom — Ink renders to terminal streams).

### 10. Type-check enforcement

Every package has `test:types` script: `vitest --typecheck --typecheck.only --run`. The CI gate (`pnpm run verify`) runs `turbo run test:types` after `test`. Test files participate in `tsconfig.test.json` (separate from production `tsconfig.json` to keep production type-check fast and prevent jest-dom/vitest-globals types from leaking into prod source).

## Shared test helpers

- `libs/keys/src/testing/navigation-behavior.ts` — `testNavigationBehavior(options)`. Parameterizes keyboard nav tests across components that use `aria-activedescendant` or focus-tracking.
- `libs/ui/registry/testing/form-behavior.ts` — `expectFieldInvalid`, `expectFieldDescribedBy`, `fillField`, `submitForm`. Shared form-validity assertions and form-flow actions.
- `libs/ui/testing/axe.ts` — `axe` re-export with the registered `toHaveNoViolations` matcher.

Helpers live in per-package `testing/` directories (not a separate `@diffgazer/testing` package — extraction deferred until a 3rd consumer needs the shape).

## What NOT to test

- Pure type files, constants, re-export index files
- Thin wrappers that delegate to already-tested functions
- Pure styling primitives with no logic
- Framework behavior (React's `useState`, library internals)
- Component-library internals when you can test the user-visible composition

## Verification gates (per `AGENTS.md`)

Per-package after changes:
```
pnpm --filter <pkg> type-check        # production type-check
pnpm --filter <pkg> test              # runtime tests
pnpm --filter <pkg> test:types        # type-check test files
```

After registry/UI/keys/CLI/docs changes (handoff-affecting):
```
pnpm run prepare:artifacts && pnpm run validate:artifacts:check
```

Before declaring SOTA-ready:
```
pnpm run verify                       # full chain incl. test:types + smoke
```

Final release gate:
```
pnpm run release-check                # verify + smoke:packages + pack --dry-run × 4
```

`turbo run test:types` is wired in `verify`, `test-ci`, and `release-check` as a required step.

### Catalog smoke: bundled snapshot (offline) + live models.dev (network)

`pnpm run smoke:modelsdev` asserts `gemini`/`groq`/`cerebras` each resolve to a
non-empty `ModelInfo[]` via `catalogToModelInfo` from the `@diffgazer/core/catalog`
surface. It is part of the `smoke` chain.

On every run it validates the bundled offline snapshot (`CATALOG_SNAPSHOT`) — the
design D6 guarantee that the picker is never blank on first run/offline — so a bad
snapshot regenerate is caught even with no network. This makes
`DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` pass offline.

Adding `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` additionally fetches the live
`https://models.dev/api.json`, parses it with the shipped `parseModelsDevCatalog`,
and runs the same assertions against the live data. CI pairs both flags, so the
release gate validates both the offline snapshot and the live fetch.

## Anti-pattern reference

When reviewing or writing tests, run through this list:

- Does a test name start with "should call/set/invoke/fire/trigger" + an internal name? → rewrite to user-visible behavior
- Is `vi.mock(...)` of an internal module (no boundary annotation)? → refactor for DI or delete the mock
- Is `getByTestId` used where `getByRole` would work? → switch
- Is `fireEvent.click` used where `await user.click(...)` works? → switch (unless documented exception)
- Is `setTimeout(N)` used as a wait? → switch to `vi.waitFor` or fake timers
- Does a hook test assert on `result.current.someInternalRef`? → assert on observable output instead
- Does a UI component test have no axe assertion AND no skip rationale? → add one
- Is `vi.fn()` typed as bare `Mock<Procedure | Constructable>`? → add a generic: `vi.fn<typeof realFn>()` or `Mock<Api["method"]>`
- Is `as any` used? → narrow the types properly; never silence

## Test counts (baseline at SOTA refactor completion)

| Package | Files | Tests | Tests delta vs pre-SOTA |
|---|---|---|---|
| libs/core | 46 | 380 | +1 |
| libs/keys | 20 | 290 | +11 |
| libs/registry | 12 | 140 | +8 |
| cli/server | 39 | 374 | +9 |
| libs/ui | 132 (multi-project ×2) | 1564 | +32 |
| apps/web | 49 | 257 | +2 |
| apps/docs | 6 | 61 | 0 |
| cli/add | 3 | 49 | 0 |
| cli/diffgazer | 22 | 195 | +23 |

Net change: +86 tests across the suite. All increases come from `it.each` row expansion (granular per-case names) and new axe coverage. No test was deleted.
