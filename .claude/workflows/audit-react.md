# React Audit Workflow

> Comprehensive React codebase audit. Run with `/audit-react` or manually.

---

## Overview

This workflow audits React code for:
1. **Memoization violations** - Unnecessary useMemo/useCallback/React.memo
2. **Hook anti-patterns** - Missing deps, wrong usage, stale closures
3. **Component issues** - God components, props drilling, poor structure
4. **State management** - Derived state stored, poor colocation
5. **Performance issues** - Missing keys, inline objects to memoized children

---

## Phase 1: Discovery

### Step 1.1: Find All React Files

```bash
# Find all React component files
find src -name "*.tsx" -o -name "*.jsx" | grep -v ".test." | grep -v ".spec."
```

### Step 1.2: Identify Patterns to Check

Search for these patterns in the codebase:

**Memoization Usage:**
```bash
grep -rn "useMemo\|useCallback\|React\.memo\|memo(" src --include="*.tsx" --include="*.jsx"
```

**Hook Usage:**
```bash
grep -rn "useEffect\|useState\|useReducer\|useRef\|useContext" src --include="*.tsx" --include="*.jsx"
```

**Component Size (potential God components):**
```bash
# Files over 200 lines
wc -l src/**/*.tsx | awk '$1 > 200 {print}'
```

---

## Phase 2: Memoization Audit

### Allowed Memoization Cases

1. **Context Provider values** - `useMemo` on value passed to Context Provider
2. **useEffect dependency + reused** - `useCallback` when function is in useEffect AND used in JSX
3. **Proven performance issue** - With comment documenting profiler results

### Check 2.1: Find All useMemo

For each `useMemo` found, verify it falls into allowed cases:

```
□ Is this a Context Provider value?
  → Look for: <SomeContext value={memoizedValue}>
  → If YES: VALID
  → If NO: Continue

□ Is there a comment explaining performance issue?
  → Look for: // PERF: or documented profiler results
  → If YES: VALID (verify comment is legitimate)
  → If NO: VIOLATION - Remove useMemo
```

### Check 2.2: Find All useCallback

For each `useCallback` found:

```
□ Is this function used in useEffect dependency array?
  → Look for: useEffect(() => { ... }, [thisFunction])
  → If YES: Is it ALSO used elsewhere (JSX, other hooks)?
    → If YES: VALID
    → If NO: VIOLATION - Move function inside useEffect
  → If NO: Continue

□ Is this a Context Provider action?
  → Look for: value={{ action: memoizedCallback }}
  → If YES: VALID
  → If NO: VIOLATION - Remove useCallback
```

### Check 2.3: Find All React.memo / memo()

For each memoized component:

```
□ Is there a documented performance issue?
  → Look for: // PERF: comment with profiler data
  → If YES: VALID
  → If NO: VIOLATION - Remove memo wrapper
```

### Memoization Violations Report Format

```
## Memoization Violations

### Unnecessary useMemo
- [ ] `src/features/auth/hooks/use-auth.ts:45` - useMemo for simple string concatenation
- [ ] `src/components/card.tsx:23` - useMemo for filtering, not a Context value

### Unnecessary useCallback
- [ ] `src/components/button.tsx:12` - useCallback not used in useEffect
- [ ] `src/features/dashboard/chart.tsx:67` - useCallback only used in JSX

### Unnecessary React.memo
- [ ] `src/components/header.tsx:1` - No documented performance issue
```

---

## Phase 3: Hook Anti-Patterns Audit

### Check 3.1: useEffect Issues

**Missing dependency array:**
```
Pattern: useEffect(() => { ... }) // No second argument
Severity: HIGH
```

**Missing dependencies:**
```
Pattern: useEffect(() => { doSomething(value) }, []) // value not in deps
Severity: HIGH
```

**Missing cleanup:**
```
Pattern: useEffect with addEventListener/setInterval/subscribe without return cleanup
Severity: HIGH
```

**Derived state in effect:**
```
Pattern: useEffect(() => { setDerived(compute(state)) }, [state])
Severity: MEDIUM - Should compute during render
```

**Event handling in effect:**
```
Pattern: useEffect(() => { if (condition) showNotification() }, [condition])
Severity: MEDIUM - Should be in event handler
```

### Check 3.2: Conditional Hooks

```
Pattern: if (condition) { useState(...) }
Pattern: if (condition) return; useState(...) // Hook after early return
Severity: CRITICAL - Breaks React rules
```

### Check 3.3: Stale Closures

```
Pattern: useEffect(() => {
  setInterval(() => {
    setState(stateValue) // Using stateValue instead of functional update
  }, 1000)
}, [])
Severity: HIGH
```

### Hook Violations Report Format

```
## Hook Violations

### Critical (Must Fix)
- [ ] `src/features/chat/message-list.tsx:34` - Hook after early return

### High (Should Fix)
- [ ] `src/features/auth/login-form.tsx:56` - useEffect missing cleanup for event listener
- [ ] `src/components/timer.tsx:23` - Stale closure in setInterval

### Medium (Improve)
- [ ] `src/features/dashboard/stats.tsx:78` - Derived state computed in useEffect
```

---

## Phase 4: Component Structure Audit

### Check 4.1: God Components

```
Threshold: >200 lines OR >5 useState OR >3 useEffect
Action: Recommend splitting
```

### Check 4.2: Props Drilling

```
Pattern: Same prop passed through 3+ levels without being used
Action: Recommend Context
```

### Check 4.3: Poor Colocation

```
Pattern: State defined in parent but only used by single child
Action: Move state to child
```

### Check 4.4: Stored Derived State

```
Pattern: useState + useEffect to sync with another state
Example:
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  useEffect(() => setCount(items.length), [items])
Action: Derive during render: const count = items.length
```

### Component Violations Report Format

```
## Component Structure Violations

### God Components (Split)
- [ ] `src/features/dashboard/dashboard.tsx` - 450 lines, 12 useState, 6 useEffect

### Props Drilling
- [ ] `theme` prop: App → Layout → Header → NavItem (4 levels)

### Poor State Colocation
- [ ] `src/app.tsx:23` - searchQuery state only used by SearchBar child

### Stored Derived State
- [ ] `src/features/cart/cart.tsx:45` - total stored, should derive from items
```

---

## Phase 5: Performance Audit

### Check 5.1: Missing Keys

```
Pattern: .map() without key or with index as key
Severity: MEDIUM-HIGH
```

### Check 5.2: Inline Objects/Functions to Memoized Children

```
Pattern: <MemoizedComponent config={{ ... }} onClick={() => ...} />
Only flag if child is wrapped in React.memo
Severity: MEDIUM (defeats memoization purpose)
```

### Check 5.3: Large Lists Without Virtualization

```
Pattern: .map() rendering 50+ items without react-window/react-virtual
Severity: LOW-MEDIUM (depends on item complexity)
```

### Performance Violations Report Format

```
## Performance Violations

### Missing/Bad Keys
- [ ] `src/features/products/product-list.tsx:34` - Using index as key

### Inline Props to Memoized Children
- [ ] `src/components/sidebar.tsx:56` - Inline object to MemoizedNavItem

### Large Lists
- [ ] `src/features/logs/log-viewer.tsx:23` - 1000+ items without virtualization
```

---

## Phase 6: Generate Report

### Full Report Template

```markdown
# React Audit Report

**Date:** [DATE]
**Files Scanned:** [COUNT]
**Total Violations:** [COUNT]

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Memoization | 0 | 3 | 5 | 0 |
| Hooks | 1 | 4 | 2 | 0 |
| Components | 0 | 2 | 3 | 1 |
| Performance | 0 | 1 | 2 | 3 |

## Critical Issues (Fix Immediately)

[List critical violations]

## High Priority Issues

[List high violations]

## Medium Priority Issues

[List medium violations]

## Low Priority Issues

[List low violations]

---

## Fix Plan

After user approval, violations will be fixed in parallel by specialized agents:

1. **Memoization Agent** - Remove unnecessary useMemo/useCallback/memo
2. **Hooks Agent** - Fix useEffect issues, add cleanup, fix deps
3. **Component Agent** - Split god components, fix structure
4. **Performance Agent** - Fix keys, virtualize lists
```

---

## Phase 7: Multi-Agent Fix Orchestration

After user reviews and approves the report:

### Fix Execution Strategy

**Parallel Agents:**

1. **memoization-fixer** - Handles all memoization violations
   - Removes unnecessary useMemo
   - Removes unnecessary useCallback
   - Removes unnecessary React.memo
   - Preserves allowed cases (Context, documented perf)

2. **hooks-fixer** - Handles all hook violations
   - Adds missing cleanup functions
   - Fixes dependency arrays
   - Converts derived state effects to computed values
   - Fixes stale closures with functional updates

3. **component-fixer** - Handles component structure
   - Splits god components
   - Extracts custom hooks
   - Improves state colocation
   - Adds Context for props drilling

4. **performance-fixer** - Handles performance issues
   - Fixes key props
   - Adds virtualization
   - Fixes inline props to memoized children

### Agent Instructions Template

Each agent receives:
```
You are fixing [CATEGORY] violations in a React codebase.

## Violations to Fix

[List of specific violations with file:line]

## Rules

1. Make minimal changes - only fix the listed violations
2. Do not add new memoization unless it's an allowed case
3. Preserve existing behavior
4. Run tests after changes
5. Report back with changes made

## Allowed Memoization Cases (Reference)

1. Context Provider values
2. useCallback for useEffect dep + reused elsewhere
3. Documented performance issues with profiler data

## Changes Made

[Agent fills this in]
```

---

## Running the Audit

### Manual Execution

```
1. Load: /react-principles (to understand rules)
2. Run: Phase 1-6 discovery and analysis
3. Present: Report to user
4. Wait: User approval for fixes
5. Execute: Spawn parallel fix agents
6. Verify: Run tests, type-check
```

### Automated Command

```
/audit-react [path]
```

Options:
- `--fix` - Auto-fix after report (requires confirmation)
- `--category=memoization|hooks|components|performance` - Audit specific category
- `--severity=critical|high|medium|low` - Filter by severity
