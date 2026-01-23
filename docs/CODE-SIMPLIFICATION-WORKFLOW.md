# Code Simplification Workflow

## Overview

This workflow ANALYZES the codebase and OUTPUTS a structured task plan. Tasks are then executed by assigned agents in fresh contexts to avoid bloating the main conversation.

**Flow:**
```
ANALYZE (this workflow) → OUTPUT TASKS → EXECUTE (separate agent sessions)
```

---

## Quick Copy-Paste Prompt for Analysis

```
Run a comprehensive code simplification ANALYSIS on this TypeScript monorepo.

DO NOT make changes. ONLY analyze and create a task plan.

GOAL: Identify all simplification opportunities and output a phased task list that agents can execute in separate contexts.

Execute analysis phases:

PHASE 1 - Discovery:
- Run code-archaeologist agent to map codebase structure
- Run project-analyst agent to detect tech stack
- Run Explore agent to find all type/schema definitions
- OUTPUT: Codebase map, tech stack summary, type locations inventory

PHASE 2 - Type Duplication Analysis:
- Run pr-review-toolkit:type-design-analyzer on packages/schemas/
- Run Explore agent to find types defined outside packages/schemas/
- Compare types across: packages/schemas/, packages/core/, packages/api/, apps/cli/, apps/server/
- OUTPUT: List of duplicate types with file locations

PHASE 3 - Over-Abstraction Analysis:
- Run code-review-ai:architect-review on all source directories
- Run feature-dev:code-explorer to trace execution paths
- Identify: wrapper functions, unnecessary layers, premature generics
- OUTPUT: List of abstractions to eliminate with file:line locations

PHASE 4 - Complexity Analysis:
- Run pr-review-toolkit:code-simplifier in analysis mode
- Run code-simplifier:code-simplifier to identify issues
- Find: YAGNI violations, KISS violations, functions >20 lines, nesting >3 levels
- OUTPUT: List of files/functions needing simplification

PHASE 5 - Readability Analysis:
- Run experienced-engineer:code-quality-reviewer
- Find: poor naming, abbreviations, clever tricks, DRY violations
- OUTPUT: List of readability issues with locations

PHASE 6 - Error Handling Analysis:
- Run pr-review-toolkit:silent-failure-hunter
- Find: silent failures, catch-and-rethrow, over-defensive code
- OUTPUT: List of error handling issues

PHASE 7 - Comment Analysis:
- Run experienced-engineer:code-quality-reviewer
- Find all comments in source files
- Flag for removal:
  * Comments describing WHAT code does (obvious from code)
  * Commented-out code
  * TODO/FIXME without ticket references
  * Section dividers and decorative comments
  * Redundant JSDoc on self-explanatory functions
- Flag to KEEP:
  * Comments explaining WHY (business reasons)
  * Non-obvious workarounds with explanation
  * Regex explanations
  * External API quirks
  * Performance justifications
  * Warnings about non-obvious behavior
- OUTPUT: List of comments to remove with file:line locations

PHASE 8 - Test Analysis:
- Run unit-testing:test-automator on all test files
- Find tests to DELETE:
  * Tests for trivial code (getters, setters, simple property access)
  * Duplicate test cases (same behavior tested twice)
  * Implementation-detail tests (spying on private methods)
  * CSS/styling tests
  * Tests that just verify framework behavior
  * Tests that mock everything
- Find tests to KEEP:
  * Business logic tests
  * Edge case tests
  * Error handling tests
  * Integration point tests
- OUTPUT: List of tests to remove/consolidate

FINAL OUTPUT - Create Task Plan:

Write a markdown file at docs/tasks/SIMPLIFICATION-TASKS.md with:

1. EXECUTIVE SUMMARY
   - Total issues found per category
   - Estimated complexity (files affected)
   - Priority order

2. PHASE 1 TASKS: Type Consolidation
   For each duplicate type, create a task:
   ```
   ### Task 1.X: Consolidate [TypeName]
   **Agent:** javascript-typescript:typescript-pro
   **Files:** [list of files]
   **Action:** Move type to packages/schemas/[file].ts, update all imports
   **Context needed:** [minimal context for agent]
   ```

3. PHASE 2 TASKS: Remove Abstractions
   For each unnecessary abstraction:
   ```
   ### Task 2.X: Remove [abstraction description]
   **Agent:** code-review-ai:architect-review
   **Files:** [list of files]
   **Action:** [specific action]
   **Context needed:** [minimal context]
   ```

4. PHASE 3 TASKS: Simplify Code
   For each complex file/function:
   ```
   ### Task 3.X: Simplify [file/function]
   **Agent:** pr-review-toolkit:code-simplifier
   **File:** [file path]
   **Issues:** [YAGNI/KISS/length/nesting]
   **Action:** [specific simplification]
   ```

5. PHASE 4 TASKS: Improve Readability
   For each readability issue:
   ```
   ### Task 4.X: Rename/refactor [target]
   **Agent:** experienced-engineer:code-quality-reviewer
   **File:** [file path]
   **Issue:** [naming/DRY/tricks]
   **Action:** [specific fix]
   ```

6. PHASE 5 TASKS: Fix Error Handling
   For each error handling issue:
   ```
   ### Task 5.X: Fix error handling in [location]
   **Agent:** pr-review-toolkit:silent-failure-hunter
   **File:** [file path]
   **Issue:** [silent failure/rethrow/defensive]
   **Action:** [specific fix]
   ```

7. PHASE 6 TASKS: Remove Comments
   For each file with unnecessary comments:
   ```
   ### Task 6.X: Remove comments from [file]
   **Agent:** experienced-engineer:code-quality-reviewer
   **File:** [file path]
   **Comments to remove:** [list with line numbers]
   **Comments to keep:** [list with reasons]
   **Action:** Delete unnecessary comments, keep only WHY comments
   ```

8. PHASE 7 TASKS: Clean Up Tests
   For each test file with issues:
   ```
   ### Task 7.X: Clean up tests in [file]
   **Agent:** unit-testing:test-automator
   **File:** [test file path]
   **Tests to remove:** [list - trivial/duplicate/implementation tests]
   **Tests to keep:** [list - behavior tests]
   **Action:** Remove low-value tests, consolidate duplicates
   ```

Each task must be:
- Self-contained (agent can execute with no prior context)
- Specific (exact files and line numbers)
- Actionable (clear what to do)
- Assigned (which agent handles it)
```

---

## Agent Assignments Reference

### Analysis Phase Agents

| Agent | Role in Analysis |
|-------|------------------|
| `code-archaeologist` | Map codebase structure |
| `project-analyst` | Detect tech stack |
| `Explore` | Find files, types, patterns |
| `pr-review-toolkit:type-design-analyzer` | Analyze schema quality |
| `code-review-ai:architect-review` | Find over-abstraction |
| `feature-dev:code-explorer` | Trace execution paths |
| `pr-review-toolkit:code-simplifier` | Find complexity issues |
| `code-simplifier:code-simplifier` | Find clarity issues |
| `experienced-engineer:code-quality-reviewer` | Find DRY/naming issues, unnecessary comments |
| `pr-review-toolkit:silent-failure-hunter` | Find error handling issues |
| `pr-review-toolkit:comment-analyzer` | Analyze comment accuracy and necessity |
| `unit-testing:test-automator` | Analyze test quality and coverage |

### Execution Phase Agents (for tasks)

| Task Type | Assigned Agent |
|-----------|----------------|
| Type consolidation | `javascript-typescript:typescript-pro` |
| Remove abstraction | `code-review-ai:architect-review` |
| Simplify code | `pr-review-toolkit:code-simplifier` |
| Improve readability | `experienced-engineer:code-quality-reviewer` |
| Fix error handling | `pr-review-toolkit:silent-failure-hunter` |
| Remove comments | `experienced-engineer:code-quality-reviewer` |
| Clean up tests | `unit-testing:test-automator` |
| Validate changes | `code-reviewer` |
| Run tests | `unit-testing:test-automator` |

---

## Task Template Format

Each generated task should follow this format for agent execution:

```markdown
### Task [Phase].[Number]: [Short Description]

**Priority:** [Critical/High/Medium/Low]
**Agent:** [agent-name]
**Estimated Scope:** [number of files]

**Files:**
- path/to/file1.ts (lines X-Y)
- path/to/file2.ts (lines A-B)

**Problem:**
[Clear description of what's wrong]

**Action:**
[Specific steps to fix]

**Acceptance Criteria:**
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]

**Context for Agent:**
```
[Minimal context the agent needs - relevant code snippets, type definitions, etc.]
```
```

---

## Principles for Task Generation

### YAGNI Tasks
```markdown
**Problem:** Unused code/future provisions
**Action:** Delete [specific code]
**Criteria:** No compilation errors, tests pass
```

### KISS Tasks
```markdown
**Problem:** Over-complex implementation
**Action:** Replace with simpler approach: [describe]
**Criteria:** Same functionality, fewer lines, less nesting
```

### DRY Tasks
```markdown
**Problem:** Code duplicated 3+ times
**Action:** Extract to [location], update [N] call sites
**Criteria:** Single source of truth, all imports updated
```

### SRP Tasks
```markdown
**Problem:** Function does multiple things
**Action:** Split into [function1], [function2]
**Criteria:** Each function has one responsibility
```

### Type Consolidation Tasks
```markdown
**Problem:** Type [Name] defined in multiple locations
**Action:**
1. Keep/create in packages/schemas/src/[file].ts
2. Use z.infer<typeof Schema> pattern
3. Update imports in [list of files]
**Criteria:** Single type definition, all imports from @stargazer/schemas
```

### Abstraction Removal Tasks
```markdown
**Problem:** Wrapper function adds no value
**Action:** Delete wrapper, call underlying function directly
**Criteria:** No intermediate function, same behavior
```

---

## Output File Structure

The analysis should produce:

```
docs/tasks/SIMPLIFICATION-TASKS.md
├── Executive Summary
│   ├── Issue counts by category
│   ├── Files affected
│   └── Priority order
├── Phase 1: Type Consolidation (X tasks)
├── Phase 2: Remove Abstractions (X tasks)
├── Phase 3: Simplify Code (X tasks)
├── Phase 4: Improve Readability (X tasks)
├── Phase 5: Fix Error Handling (X tasks)
├── Phase 6: Remove Comments (X tasks)
├── Phase 7: Clean Up Tests (X tasks)
└── Phase 8: Validation Tasks
```

---

## Execution Instructions

After analysis produces the task file:

### Option 1: Sequential Execution
```
For each task in SIMPLIFICATION-TASKS.md:
1. Open new Claude Code session
2. Provide task context
3. Run: "Execute this task: [paste task]"
4. Verify acceptance criteria
5. Commit changes
```

### Option 2: Batch by Agent
```
Group tasks by assigned agent, then:
1. Open session for agent type
2. Execute all tasks for that agent
3. Commit batch
4. Next agent
```

### Option 3: Priority-Based
```
Execute Critical tasks first, then High, etc.
Each in fresh context with task details only.
```

---

## Sample Task Output

```markdown
# Simplification Tasks - Generated [Date]

## Executive Summary
- **Type duplicates:** 8 found
- **Unnecessary abstractions:** 12 found
- **Complex functions:** 15 found (>20 lines or >3 nesting)
- **Readability issues:** 23 found
- **Error handling issues:** 6 found
- **Total files affected:** 34

## Phase 1: Type Consolidation

### Task 1.1: Consolidate ReviewResult type

**Priority:** High
**Agent:** javascript-typescript:typescript-pro
**Estimated Scope:** 4 files

**Files:**
- packages/schemas/src/review.ts (define here)
- packages/core/src/ai/types.ts (lines 45-52, delete)
- apps/server/src/services/review.ts (lines 12-19, delete)
- apps/cli/src/features/review/types.ts (lines 8-15, delete)

**Problem:**
ReviewResult type defined in 3 locations with slight variations.

**Action:**
1. Create canonical definition in packages/schemas/src/review.ts
2. Use Zod schema with z.infer pattern
3. Delete duplicate definitions
4. Update imports to use @stargazer/schemas

**Acceptance Criteria:**
- [ ] Single ReviewResult in packages/schemas
- [ ] All 4 files import from @stargazer/schemas
- [ ] TypeScript compiles without errors
- [ ] Tests pass

**Context for Agent:**
```typescript
// Current definitions to consolidate:
// packages/core/src/ai/types.ts
type ReviewResult = { score: number; feedback: string; }

// apps/server/src/services/review.ts
interface ReviewResult { score: number; feedback: string; issues?: string[]; }

// Target pattern:
import { z } from 'zod';
export const ReviewResultSchema = z.object({...});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
```

---

### Task 1.2: Consolidate SessionState type
...
```

---

## Comment Removal Guidelines

### Rule: Delete All Comments Except Non-Self-Explanatory Code

Good code is self-documenting. Comments should only exist when the code CANNOT explain itself.

### DELETE These Comments

```typescript
// BAD: Obvious from code
// Get the user name
const userName = user.name;

// BAD: Describing what code does
// Loop through users
for (const user of users) { ... }

// BAD: Changelog comments
// Added by John on 2024-01-15
// Updated to fix bug #123

// BAD: Commented-out code
// const oldImplementation = () => { ... };

// BAD: TODO without action
// TODO: maybe refactor this later

// BAD: Section dividers
// ==========================================
// USER FUNCTIONS
// ==========================================

// BAD: Redundant JSDoc
/**
 * Gets the user by ID
 * @param id - The user ID
 * @returns The user
 */
function getUserById(id: string): User { ... }
```

### KEEP These Comments

```typescript
// GOOD: Why, not what (business reason)
// Stripe requires amount in cents, not dollars
const amountInCents = amount * 100;

// GOOD: Non-obvious workaround
// Using setTimeout(0) to defer to next event loop tick
// because React state updates are batched
setTimeout(() => setState(newValue), 0);

// GOOD: Regex explanation
// Matches: user@domain.com, user+tag@sub.domain.co.uk
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GOOD: External API quirk
// API returns 200 with error in body (not standard HTTP errors)
if (response.data.error) throw new Error(response.data.error);

// GOOD: Performance reason
// Using Map instead of Object for O(1) deletion
const cache = new Map<string, User>();

// GOOD: Warning about non-obvious behavior
// WARNING: This mutates the original array
function sortInPlace(arr: number[]) { ... }
```

### Comment Analysis Task Template

```markdown
### Task X.X: Remove unnecessary comments from [file]
**Agent:** experienced-engineer:code-quality-reviewer
**File:** [file path]
**Action:**
1. Delete all comments that describe WHAT code does
2. Delete all commented-out code
3. Delete all TODO/FIXME without tickets
4. Keep only comments explaining WHY (business logic, workarounds, warnings)
**Criteria:** Only non-obvious code has comments
```

---

## Testing Guidelines

### Core Principle: Test Behavior, Not Implementation

Tests should verify WHAT the code does, not HOW it does it. Tests that are tightly coupled to implementation break on every refactor, even when functionality is correct.

### What TO Test

| Test Type | Examples |
|-----------|----------|
| **Business logic** | Calculations, validations, transformations |
| **Edge cases** | Empty arrays, null inputs, boundary values |
| **Error conditions** | Invalid input handling, API failures |
| **Integration points** | API contracts, database queries |
| **User-facing behavior** | Form submission, navigation, output |

```typescript
// GOOD: Tests behavior/outcome
test('calculates total with tax', () => {
  const cart = createCart([{ price: 100 }, { price: 50 }]);
  expect(cart.totalWithTax(0.1)).toBe(165);
});

// GOOD: Tests edge case
test('returns empty array when no users match filter', () => {
  const users = filterUsers([], { active: true });
  expect(users).toEqual([]);
});

// GOOD: Tests error handling
test('throws when user not found', async () => {
  await expect(getUser('invalid-id')).rejects.toThrow('User not found');
});
```

### What NOT to Test

| Don't Test | Why |
|------------|-----|
| **Getters/setters** | Trivial, no logic |
| **Simple property access** | `user.name` doesn't need a test |
| **Framework behavior** | React renders, Express routes |
| **CSS/styling** | Visual tests are different |
| **Third-party libraries** | They have their own tests |
| **Implementation details** | Private methods, internal state |
| **Type definitions** | TypeScript compiler checks these |

```typescript
// BAD: Testing trivial getter
test('getName returns name', () => {
  const user = new User('John');
  expect(user.getName()).toBe('John');  // POINTLESS
});

// BAD: Testing implementation detail
test('calls internal validate method', () => {
  const spy = jest.spyOn(service, '_validate');
  service.save(data);
  expect(spy).toHaveBeenCalled();  // BRITTLE
});

// BAD: Testing CSS
test('button has correct color', () => {
  render(<Button />);
  expect(screen.getByRole('button')).toHaveStyle({ color: 'blue' });  // FRAGILE
});

// BAD: Testing framework
test('component renders', () => {
  render(<MyComponent />);
  expect(screen.getByTestId('my-component')).toBeInTheDocument();  // NO VALUE
});

// BAD: Duplicate test (same case, different name)
test('handles empty input', () => { ... });
test('works with no data', () => { ... });  // DUPLICATE
```

### Test Quality Rules

1. **One assertion focus per test** - Test one behavior
2. **No duplicate test cases** - Same logic = one test
3. **Tests survive refactoring** - Only fail when behavior changes
4. **No mocking everything** - Mock only external dependencies
5. **No 100% coverage obsession** - Cover meaningful paths
6. **Deterministic** - Same result every run
7. **Fast** - Unit tests should be milliseconds

### Testing Analysis Task Template

```markdown
### Task X.X: Clean up tests in [file]
**Agent:** unit-testing:test-automator
**File:** [test file path]
**Action:**
1. Remove tests for trivial code (getters, setters, simple access)
2. Remove duplicate test cases (same behavior, different names)
3. Remove implementation-detail tests (spying on private methods)
4. Remove CSS/styling tests
5. Keep only behavior tests that verify WHAT, not HOW
**Criteria:** Each test verifies one meaningful behavior
```

### Add to Analysis Prompt

Include in PHASE 7 of analysis:

```
PHASE 7 - Test Analysis:
- Run unit-testing:test-automator to analyze test files
- Find: trivial tests, duplicate cases, implementation tests, CSS tests
- OUTPUT: List of tests to remove/consolidate
```

---

## Validation Phase

After all tasks complete, run:

```
Run validation on the simplified codebase:

1. Run code-reviewer for security check
2. Run unit-testing:test-automator to verify all tests pass
3. Run javascript-typescript:typescript-pro to verify type safety
4. Confirm:
   - No duplicate types remain
   - No wrapper functions remain
   - All functions <20 lines
   - Max 3 nesting levels
   - Only WHY comments remain (no WHAT comments)
   - No trivial/duplicate/implementation tests
   - All remaining tests pass
```
