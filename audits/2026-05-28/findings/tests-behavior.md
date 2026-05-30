# Findings: tests-behavior

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 3 | 0 | 3 | 0 |
| Medium | 3 | 0 | 3 | 0 |
| Low | 8 | 0 | 8 | 0 |
| **Total** | **14** | **0** | **14** | **0** |

---

## Critical

_No critical findings._

---

## High

### F72 — [NEW] [tests] Spying on native HTMLElement prototype methods tests implementation details instead of behavior

- **file:line** — `libs/ui/registry/hooks/testing/use-form-reset.test.tsx:202-223`
- **What** — Test spies on HTMLFormElement.prototype.addEventListener and .removeEventListener to verify the hook adds/removes listeners only once. This tests implementation details (whether the hook churns listeners) rather than observable behavior.
- **Why** — Asserting on listener registration couples the test to internal wiring, so a behavior-preserving refactor of how listeners are attached would break the test for no real regression.
- **How** — Refactor to assert behavior: verify the reset callback fires exactly once per form reset event, not how many times addEventListener was called. Test that rerenders with stable props don't re-trigger the reset behavior.
- **Effort** — medium

### F199 — [NEW] [anti-slop] Tailwind class assertions in Progress component tests

- **file:line** — `libs/ui/registry/ui/progress/progress.test.tsx:39-68`
- **What** — Tests assert on internal Tailwind class names (h-1, h-2, progress-indeterminate) which are implementation details, not public API contracts.
- **Why** — Class-name assertions break when styling is restyled even though the rendered behavior is unchanged, and they do not verify what the user actually perceives.
- **How** — Replace className assertions with property-based assertions or visual regression tests. Lines 39-46 can test via aria attributes or component props. Lines 58-68 (indeterminate) can use computed style inspection or visual test. Alternative: add a comment documenting the class assertion as a public contract if size classes are indeed part of the public API.
- **Effort** — medium

### F200 — [NEW] [anti-slop] Tailwind class assertions in Skeleton component tests

- **file:line** — `libs/ui/registry/ui/skeleton/skeleton.test.tsx:19-30`
- **What** — Tests assert on Tailwind utility classes (animate-pulse, bg-secondary, rounded-sm) which are internal styling implementation, not observable behavior.
- **Why** — These assertions lock the test to specific utility classes, so any restyle breaks them despite identical observable output, while still not confirming the visual result.
- **How** — Remove lines 19-30. Keep lines 5-17 (aria-hidden and className prop forwarding). Test visual appearance via axe accessibility check, computed styles, or visual regression testing instead of class name assertions.
- **Effort** — low

---

## Medium

### F73 — [NEW] [tests] Multiple toHaveBeenCalledTimes assertions when call count is not documented contract

- **file:line** — `libs/ui/registry/ui/radio/radio.test.tsx:21`
- **What** — Test uses `expect(onChange).toHaveBeenCalledTimes(1)` to verify a radio selection fires onChange once. While reasonable here, many similar assertions conflate 'was called' with 'was called N times' when only the former is the observable contract.
- **Why** — Asserting an exact call count where the count is not part of the contract makes tests brittle to internal changes that do not alter the user-observable callback value.
- **How** — Distinguish between: (1) assertions on call count that are part of contract (e.g., 'fires exactly once per user action') vs (2) implementation-detail counts. For (2), assert the callback was called WITH the right value, not HOW MANY TIMES. For keyboard interaction patterns (use-key.test.tsx:117-128), call count IS the contract and is well-documented.
- **Effort** — medium

### F74 — [NEW] [tests] querySelector in tests verifies internal structure instead of public API behavior

- **file:line** — `libs/ui/registry/ui/tabs/tabs.test.tsx:524-526`
- **What** — Tests use `container.querySelectorAll('[data-slot="tabs-pill"]')` to assert internal implementation structure. The data-slot attribute is internal, not part of public API contract.
- **Why** — Querying internal data-slot attributes ties the test to a private DOM shape, so refactoring the markup breaks the test without any change to user-facing behavior.
- **How** — Replace internal structure checks with behavior assertions: (1) assert correct visual style applied via getComputedStyle, (2) assert no a11y violations, (3) if appearance matters, use visual regression testing. For purely internal structure, document why this specific DOM shape is part of contract.
- **Effort** — medium

### F202 — [NEW] [anti-slop] Tailwind class assertions in Typography tests without clear public contract

- **file:line** — `libs/ui/registry/ui/typography/typography.test.tsx:98-106`
- **What** — Tests assert truncate behavior via Tailwind class name instead of observable behavior. While lines 28-95 document size/weight/color as public contract (line 43 comment), truncate behavior is not similarly documented.
- **Why** — Asserting the truncate class rather than the truncation effect means the test passes even if truncation visually fails, and breaks if the class changes while behavior is preserved.
- **How** — Test truncate behavior via observable effect: verify text-overflow: ellipsis is applied (computed styles), or test text actually truncates in a constrained width. Or add comment documenting truncate class as public contract like line 43.
- **Effort** — low

---

## Low

### F75 — [NEW] [tests] Consistent proper use of fireEvent with documentation when userEvent equivalent unavailable

- **file:line** — `libs/ui/registry/ui/dialog/dialog.test.tsx:72-75`
- **What** — Dialog tests use fireEvent for native <dialog> cancel event and backdrop clicks, with explicit comments: 'fireEvent retained: native <dialog> cancel event has no user-event equivalent' and 'fireEvent retained: backdrop close requires explicit clientX/clientY'.
- **Why** — The documented justification makes a necessary deviation from userEvent legible, so reviewers can tell it is deliberate rather than accidental.
- **How** — No change needed. Preserve this pattern and cite as model in project guidelines. Ensure all non-standard test patterns have similar justification comments.
- **Effort** — low

### F76 — [NEW] [tests] Rerender with stable props correctly tests effect/dependency stability behavioral contract

- **file:line** — `libs/ui/registry/hooks/testing/use-form-reset.test.tsx:112-121`
- **What** — Tests use rerender + callback assertion to verify that changing props updates behavior correctly ('hook uses latest reset value', 'does not accumulate listeners across rerenders'). This correctly tests behavioral contract.
- **Why** — Driving the hook through rerenders and asserting on the resulting callback behavior validates the lifecycle contract without inspecting internal refs or implementation.
- **How** — No change needed. This is a correct pattern to preserve and extend.
- **Effort** — low

### F77 — [NEW] [dry] Keyboard navigation tests use testNavigationBehavior helper to avoid duplicate matrix testing

- **file:line** — `libs/keys/src/hooks/use-navigation.test.tsx:74-89`
- **What** — Tests reuse testNavigationBehavior helper to test navigation matrix (ArrowDown, ArrowUp, Home, End, wrap behavior). This avoids duplicating identical test cases across many navigation-enabled components.
- **Why** — A shared helper for the repeated navigation matrix removes copy-paste duplication and keeps each call site focused on what is specific to it.
- **How** — No change needed. Document this pattern as model for other cross-cutting test concerns and encourage expansion where similar matrices repeat.
- **Effort** — low

### F78 — [NEW] [public-api] Proper semantic keyboard callback naming enforces AGENTS.md public API contract

- **file:line** — `libs/keys/src/hooks/use-navigation.test.tsx:100-118`
- **What** — Tests verify keyboard callbacks use correct semantic names: onNavigationBoundaryReached, onHighlightChange, onSelect, onEnter. Names describe the action semantically, not implementation.
- **Why** — Asserting on semantic callback names guards the public API contract that names describe the event meaning rather than implementation details.
- **How** — No change needed. This is a correct pattern to preserve. Use as template when adding new keyboard-aware components.
- **Effort** — low

### F79 — [NEW] [tests] vi.mock() used appropriately only at system boundaries (git, network, fs)

- **file:line** — `cli/server/src/features/config/service.test.ts:19-21`
- **What** — Tests use vi.mock() exclusively at external system boundaries: git CLI subprocess (createGitService), OS keychain (@napi-rs/keyring), HTTP network (openrouter-models). Internal modules are never mocked.
- **Why** — Restricting mocks to external boundaries keeps tests exercising real internal code paths, so they verify integrated behavior rather than a fabricated mock surface.
- **How** — No change needed. Preserve this pattern. It is a model to cite in testing guidelines. Audit future tests to ensure mocks only appear at documented system boundaries.
- **Effort** — low

### F80 — [NEW] [docs] Test documentation of WHY pattern chosen is inconsistent across large test suites

- **file:line** — `libs/ui/registry/ui/dialog/dialog.test.tsx:1-75`
- **What** — Dialog test (1529 lines, largest in codebase) has clear inline comments explaining non-standard patterns ('fireEvent retained: ...', 'querySelector retained: ...'). Other large tests lack this clarity, making it unclear which patterns are necessary vs accidental.
- **Why** — Without consistent justification comments, readers cannot distinguish deliberate, necessary deviations from accidental ones, which invites both unwarranted "fixes" and uncaught anti-patterns.
- **How** — Audit largest test files (>500 lines) and add 1-line comments before any unusual test patterns: querySelector outside role queries, fireEvent outside userEvent, vi.spyOn, Object.defineProperty mocks. Justify why the pattern is necessary.
- **Effort** — low

### F204 — [NEW] [anti-slop] Accordion test traverses DOM with double parentElement chain

- **file:line** — `libs/ui/registry/ui/accordion/accordion.test.tsx:~520-530`
- **What** — Test uses .parentElement?.parentElement traversal to access accordion content wrapper instead of using semantic queries or aria attributes to find the element.
- **Why** — Walking fixed parentElement hops hard-codes the DOM nesting, so any structural change to the markup silently breaks the test even when behavior is intact.
- **How** — Instead of button.parentElement?.parentElement, query the content directly by role or id. Verify inert attribute via aria-expanded state or content visibility attributes. Use: screen.getByRole('region', {name: 'Section Two'}) or find content by associated label.
- **Effort** — low

### F205 — [NEW] [anti-slop] Code block test depends on lowlight internals (hljs-* classes)

- **file:line** — `libs/ui/registry/ui/code-block/code-block.test.tsx`
- **What** — Test verifies 'hljs-* class names when a lowlight instance is provided' which tests the highlighter library's class naming, not the component's behavior.
- **Why** — Asserting on the third-party library's class names couples the test to lowlight internals, so a library update can break the test without any change to the component's own behavior.
- **How** — Test that code is highlighted/colored via computed styles (colors are different from unstyled text) rather than class names. Or test via visual snapshot/regression. Focus on: 'when lowlight is provided, code is highlighted with color' not 'it emits hljs-* class names'.
- **Effort** — medium
