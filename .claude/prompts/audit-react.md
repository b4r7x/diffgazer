# /audit-react

Audit React codebase for anti-patterns and violations, then fix with parallel agents.

## Execution

### Phase 1: Scan (Parallel Agents)

Launch 4 agents simultaneously to scan the codebase:

**Agent 1: Memoization Scanner** (haiku)
```
Search for: useMemo, useCallback, React.memo, memo(

For each occurrence, check if it's one of the THREE allowed cases:
1. Context Provider value
2. useCallback used in useEffect AND reused elsewhere
3. Documented performance issue (// PERF: comment with profiler data)

Report violations as:
- file:line - description of why it's unnecessary
```

**Agent 2: Hooks Scanner** (haiku)
```
Search for useEffect and check for:
- Missing dependency array (no second argument)
- Missing dependencies (values used but not in deps)
- Missing cleanup (addEventListener/setInterval/subscribe without return)
- Derived state pattern: useEffect(() => setX(compute(y)), [y])
- Stale closure: setState(value) instead of setState(v => ...)

Search for conditional hooks:
- if (x) { useState() }
- Hook calls after early returns

Report violations with file:line and fix suggestion
```

**Agent 3: Component Scanner** (haiku)
```
Check for:
- Files >200 lines
- Components with >5 useState or >3 useEffect
- Props passed through 3+ component levels
- State defined in parent but only used by single child

Report with file:line and recommendation
```

**Agent 4: Performance Scanner** (haiku)
```
Check for:
- .map() with index as key or missing key
- Inline objects/functions passed to memoized (React.memo) children
- Lists rendering 50+ items without virtualization

Report with file:line and severity
```

### Phase 2: Compile Report

Combine all agent findings:

```markdown
# React Audit Report

## Summary
| Category | Count |
|----------|-------|
| Unnecessary Memoization | X |
| Hook Issues | X |
| Component Structure | X |
| Performance | X |

## 🔴 Critical
[List - breaks React rules]

## 🟠 High
[List - should fix]

## 🟡 Medium
[List - improve code quality]
```

### Phase 3: User Approval

Present report and ask:
```
Found X violations. Options:
1. Fix all (launches parallel fix agents)
2. Fix specific category
3. Review details first
4. Export report only
```

### Phase 4: Fix (Parallel Agents)

If user approves, launch fix agents **in parallel**:

**Agent: memoization-fixer**
- Remove useMemo wrappers (keep computation)
- Remove useCallback wrappers
- Remove React.memo wrappers
- DO NOT add any new memoization

**Agent: hooks-fixer**
- Add cleanup functions to effects
- Fix dependency arrays
- Convert `useEffect(() => setDerived(...))` to direct computation
- Fix stale closures with functional updates

**Agent: component-fixer**
- Split large components
- Extract custom hooks
- Move state closer to usage
- Add Context where needed

**Agent: performance-fixer**
- Fix key props
- Add virtualization for large lists

### Phase 5: Verify

After agents complete:
1. Run `npm run type-check`
2. Run `npm run test`
3. Report summary

## Arguments

- `[path]` - Target directory (default: src)
- `--fix` - Auto-fix after confirmation
- `--report-only` - No fixes, just report
- `--category=X` - Audit specific: memoization, hooks, components, performance
