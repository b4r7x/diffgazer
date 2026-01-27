# /audit-react

Comprehensive React codebase audit for anti-patterns and violations.

## Execution Steps

### Step 1: Load Principles

First, ensure you understand the React principles by reviewing `.claude/skills/react-principles.md`, specifically:
- Section 6: Memoization Policy (the three allowed cases)
- Section 7: Anti-Patterns Encyclopedia

### Step 2: Spawn Discovery Agents

Launch parallel agents to scan the codebase:

```
Agent 1: memoization-scanner
- Find all useMemo, useCallback, React.memo, memo() usage
- For each, check if it falls into allowed cases
- Report violations with file:line

Agent 2: hooks-scanner
- Find all useEffect without cleanup
- Find useEffect with missing dependencies
- Find derived state computed in effects
- Find conditional hook calls
- Find stale closures
- Report violations with file:line

Agent 3: component-scanner
- Find files >200 lines
- Find components with >5 useState
- Find props passed through 3+ levels
- Find state not colocated
- Report violations with file:line

Agent 4: performance-scanner
- Find .map() without stable keys
- Find inline objects/functions passed to memoized children
- Find large lists (50+ items) without virtualization
- Report violations with file:line
```

### Step 3: Compile Report

Combine agent findings into structured report:

```markdown
# React Audit Report

**Date:** [current date]
**Path:** [scanned path]

## Summary

| Category | Violations |
|----------|-----------|
| Unnecessary Memoization | X |
| Hook Anti-Patterns | X |
| Component Structure | X |
| Performance Issues | X |

## Violations

### 🔴 Critical (Breaks React Rules)
[List with file:line and description]

### 🟠 High (Should Fix)
[List with file:line and description]

### 🟡 Medium (Improve)
[List with file:line and description]

### 🟢 Low (Consider)
[List with file:line and description]
```

### Step 4: Present to User

Show the report and ask:

```
Found [X] violations across [Y] files.

How would you like to proceed?
1. Fix all violations (parallel agents)
2. Fix specific category only
3. Review violations before fixing
4. Export report only
```

### Step 5: Execute Fixes (If Approved)

Spawn parallel fix agents:

**Agent: memoization-fixer**
```
Task: Remove unnecessary memoization

Violations:
[list from report]

Rules:
- Remove useMemo that isn't a Context Provider value
- Remove useCallback that isn't (useEffect dep + reused elsewhere)
- Remove React.memo without documented performance issue
- DO NOT add any new memoization
- Preserve the computation, just remove the wrapper

Example fix:
// Before
const name = useMemo(() => first + ' ' + last, [first, last]);
// After
const name = first + ' ' + last;
```

**Agent: hooks-fixer**
```
Task: Fix hook anti-patterns

Violations:
[list from report]

Rules:
- Add cleanup to useEffect with subscriptions/timers/listeners
- Add missing dependencies to arrays
- Convert derived state effects to computed values
- Fix stale closures with functional updates
- Move functions inside useEffect if only used there

Example fixes:

// Missing cleanup
// Before
useEffect(() => {
  window.addEventListener('resize', handler);
}, []);
// After
useEffect(() => {
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// Derived state
// Before
const [count, setCount] = useState(0);
useEffect(() => setCount(items.length), [items]);
// After
const count = items.length;

// Stale closure
// Before
useEffect(() => {
  setInterval(() => setCount(count + 1), 1000);
}, []);
// After
useEffect(() => {
  const timer = setInterval(() => setCount(c => c + 1), 1000);
  return () => clearInterval(timer);
}, []);
```

**Agent: component-fixer**
```
Task: Improve component structure

Violations:
[list from report]

Rules:
- Split god components into focused sub-components
- Extract repeated logic into custom hooks
- Move state closer to where it's used
- Add Context for props passing through 3+ levels

Approach for splitting:
1. Identify distinct responsibilities
2. Create sub-components for each
3. Extract shared state into custom hooks
4. Keep parent as composition layer
```

**Agent: performance-fixer**
```
Task: Fix performance issues

Violations:
[list from report]

Rules:
- Replace index keys with stable unique IDs
- For large lists, add react-window virtualization
- For inline props to memoized children: either remove memo or extract constant

Example:
// Bad key
items.map((item, i) => <Item key={i} />)
// Good key
items.map(item => <Item key={item.id} />)
```

### Step 6: Verify

After all agents complete:

1. Run type-check: `npm run type-check`
2. Run tests: `npm run test`
3. Report results to user

### Step 7: Summary

```
## Audit Complete

### Fixed
- Removed X unnecessary useMemo
- Removed X unnecessary useCallback
- Removed X unnecessary React.memo
- Fixed X useEffect issues
- Split X god components
- Fixed X key prop issues

### Tests
✓ Type-check passed
✓ All tests passed

### Remaining (Manual Review Needed)
[Any issues that couldn't be auto-fixed]
```

---

## Arguments

- `[path]` - Directory to audit (default: `src`)
- `--fix` - Auto-fix with confirmation
- `--report-only` - Generate report without fixes
- `--category=<cat>` - Audit specific category: `memoization`, `hooks`, `components`, `performance`
