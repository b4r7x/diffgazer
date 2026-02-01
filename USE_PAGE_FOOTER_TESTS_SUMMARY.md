# usePageFooter Hook Tests - Summary

## File Location
`/Users/voitz/Projects/stargazer/apps/web/src/hooks/use-page-footer.test.ts`

## Test Coverage

### 1. Stable Reference - Single Update (2 tests)
Tests that verify the hook correctly handles stable array references and doesn't trigger unnecessary updates.

- **calls setShortcuts only once when same array reference is passed on re-render**
  - Verifies that passing the same array reference multiple times only triggers one setter call
  - Prevents unnecessary re-renders when array reference doesn't change

- **calls setRightShortcuts only once when same array reference is passed on re-render**
  - Same verification for rightShortcuts
  - Ensures both shortcuts and rightShortcuts handle stable references correctly

### 2. Unstable Reference, Same Content - No Extra Updates (3 tests)
Tests the deep equality fix that prevents infinite loops from inline array literals.

- **does NOT call setShortcuts again when new array with identical content is passed**
  - Critical test for the infinite loop fix
  - Verifies deep equality check (areShortcutsEqual) prevents updates when content is identical

- **does NOT call setRightShortcuts again when new array with identical content is passed**
  - Same verification for rightShortcuts
  - Ensures both sides use deep equality correctly

- **handles inline array literals correctly without infinite loops**
  - Simulates the real-world bug scenario: `usePageFooter({ shortcuts: [{ key: "a", label: "Action" }] })`
  - Verifies no infinite render loops occur (renderCount < 10)
  - Most important test for the original bug fix

### 3. Content Change - Triggers Update (4 tests)
Tests that verify updates ARE triggered when content actually changes.

- **calls setShortcuts when shortcut content changes**
  - Verifies different shortcuts trigger update

- **calls setShortcuts when shortcut label changes**
  - Verifies label changes are detected

- **calls setShortcuts when array length changes**
  - Verifies adding/removing shortcuts triggers update

- **calls setRightShortcuts when rightShortcut content changes**
  - Verifies rightShortcuts updates work correctly

### 4. Empty/Undefined rightShortcuts - Defaults to Empty (3 tests)
Tests the behavior when rightShortcuts is not provided.

- **does NOT call setRightShortcuts when rightShortcuts is undefined (initial ref is empty)**
  - Documents current behavior: undefined becomes EMPTY_SHORTCUTS []
  - Since ref starts as [], deep equality check passes, so setter is NOT called
  - This is a known limitation documented in the test

- **uses stable EMPTY_SHORTCUTS reference for undefined rightShortcuts**
  - Verifies EMPTY_SHORTCUTS constant provides stable reference
  - Prevents updates when rightShortcuts remains undefined

- **does NOT call setRightShortcuts when empty array explicitly passed (initial ref is empty)**
  - Documents that explicitly passing [] has same behavior as undefined
  - Since ref starts as [], deep equality returns true

### 5. Independent Updates - Only Changed Side Updates (3 tests)
Tests that changing shortcuts doesn't trigger rightShortcuts update and vice versa.

- **only calls setShortcuts when shortcuts change, not setRightShortcuts**
  - Verifies independent update tracking
  - Changing shortcuts shouldn't affect rightShortcuts

- **only calls setRightShortcuts when rightShortcuts change, not setShortcuts**
  - Verifies the reverse: rightShortcuts changes don't affect shortcuts

- **calls both setters when both shortcuts and rightShortcuts change**
  - Verifies both can update in the same render when both change

### 6. Edge Cases (4 tests)
Tests unusual but valid scenarios.

- **does NOT call setShortcuts when empty array passed (matches initial ref)**
  - Documents limitation: empty array on first render matches initial ref
  - Setter is not called due to deep equality check

- **handles transitioning from undefined to defined rightShortcuts**
  - Verifies going from undefined to defined triggers update

- **handles transitioning from defined to undefined rightShortcuts**
  - Verifies going from defined to undefined (becomes []) triggers update

- **handles shortcuts with disabled property correctly**
  - Documents that areShortcutsEqual only checks key/label
  - Changes to disabled property don't trigger updates
  - This is acceptable per the implementation

## Known Limitations Documented

1. **Empty Array Initial Value**: When shortcuts or rightShortcuts are empty arrays on first render, the setter is NOT called because the initial ref value is also an empty array, and deep equality returns true.

2. **Disabled Property Ignored**: The deep equality check (areShortcutsEqual) only compares key and label fields, so changes to the disabled property don't trigger updates. This is by design in the current implementation.

## Test Results
All 19 tests pass successfully.

## Implementation Verified
`/Users/voitz/Projects/stargazer/apps/web/src/hooks/use-page-footer.ts`

The tests verify:
- Deep equality checks prevent infinite loops from unstable array references
- Refs track previous values to avoid unnecessary updates
- EMPTY_SHORTCUTS constant provides stable reference for undefined rightShortcuts
- Both shortcuts and rightShortcuts update independently
- Content changes correctly trigger updates
