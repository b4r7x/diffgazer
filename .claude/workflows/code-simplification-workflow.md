# Code Simplification Workflow

## Overview

```
ANALYZE (discovery) → OUTPUT TASKS → EXECUTE (separate agents)
```

---

## Analysis Phases

### Phase 1: Discovery
**Agents:** code-archaeologist, project-analyst, Explore

Output:
- Codebase map
- Tech stack summary
- Type locations inventory

### Phase 2: Type Duplication
**Agents:** type-design-analyzer, Explore

Output:
- List of duplicate types with file locations
- Types outside packages/schemas/ that should be moved

### Phase 3: Over-Abstraction
**Agents:** architect-review, code-explorer

Output:
- Wrapper functions to eliminate
- Unnecessary layers
- Premature generics

### Phase 4: Complexity
**Agents:** code-simplifier

Output:
- YAGNI violations
- KISS violations
- Functions >20 lines
- Nesting >3 levels

### Phase 5: Readability
**Agents:** code-quality-reviewer

Output:
- Poor naming
- Abbreviations
- Clever tricks
- DRY violations

### Phase 6: Error Handling
**Agents:** silent-failure-hunter

Output:
- Silent failures
- Catch-and-rethrow
- Over-defensive code

### Phase 7: Comments
**Agents:** code-quality-reviewer

DELETE:
- WHAT comments (obvious from code)
- Commented-out code
- TODO without tickets
- Section dividers
- Redundant JSDoc

KEEP:
- WHY comments (business reasons)
- Non-obvious workarounds
- Regex explanations
- API quirks
- Performance notes
- Behavior warnings

### Phase 8: Tests
**Agents:** test-automator

DELETE:
- Trivial tests (getters, setters)
- Duplicate test cases
- Implementation-detail tests
- CSS/styling tests
- Framework behavior tests
- Everything-mocked tests

KEEP:
- Business logic tests
- Edge case tests
- Error handling tests
- Integration point tests

---

## Execution Agents

| Task Type | Agent |
|-----------|-------|
| Type consolidation | typescript-pro |
| Remove abstraction | architect-review |
| Simplify code | code-simplifier |
| Improve readability | code-quality-reviewer |
| Fix error handling | silent-failure-hunter |
| Remove comments | code-simplifier |
| Clean up tests | test-automator |
| Validate changes | code-reviewer |

---

## Task Template

```markdown
### Task [Phase].[Number]: [Description]

**Priority:** [Critical/High/Medium/Low]
**Agent:** [agent-name]
**Files:** [list with line numbers]

**Problem:**
[What's wrong]

**Action:**
[Steps to fix]

**Criteria:**
- [ ] [Outcome 1]
- [ ] [Outcome 2]
```

---

## Principles

### YAGNI
- Delete unused code
- No future provisions

### KISS
- Simpler is better
- Fewer lines, less nesting

### DRY
- Extract if used 3+ times
- Single source of truth

### SRP
- One function, one job
- Split multi-purpose functions

---

## Validation

After all tasks:
1. npm run type-check
2. npx vitest run
3. Verify:
   - No duplicate types
   - No wrapper functions
   - Functions <20 lines
   - Max 3 nesting levels
   - Only WHY comments
   - All tests pass
