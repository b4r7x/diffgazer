# TypeCheck Fix Workflow

## Overview

Run TypeScript type checking with test files excluded, then properly fix all type errors without workarounds.

**Forbidden Fixes:**
- ❌ `any` type
- ❌ `as` type assertions (except for proven safe narrowing)
- ❌ `@ts-ignore` / `@ts-expect-error`
- ❌ `!` non-null assertions
- ❌ `// eslint-disable` comments
- ❌ Making types looser to satisfy compiler
- ❌ Optional chaining to hide undefined issues

**Required Fixes:**
- ✅ Proper type definitions
- ✅ Type guards
- ✅ Generic constraints
- ✅ Correct function signatures
- ✅ Proper null/undefined handling
- ✅ Fix the root cause

---

## Phase 1: Discovery

### Run TypeCheck (Excluding Tests)

```bash
npx tsc --noEmit --project tsconfig.json --excludeFiles "**/*.test.ts" 2>&1 | head -100
```

Or create temporary tsconfig:

```bash
cat > tsconfig.typecheck.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "**/__test__/**"]
}
EOF
npx tsc --noEmit --project tsconfig.typecheck.json
```

### Capture Errors

Output format:
```
file.ts(line,col): error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'.
```

---

## Phase 2: Classification

### Agent: typescript-pro

Classify each error into categories:

| Category | Error Codes | Fix Strategy |
|----------|-------------|--------------|
| Missing Types | TS2304, TS2307 | Add imports or define types |
| Type Mismatch | TS2322, TS2345 | Fix type definitions or values |
| Missing Properties | TS2339, TS2551 | Add properties or fix access |
| Null/Undefined | TS2531, TS2532, TS2533 | Add guards or fix optionality |
| Generic Issues | TS2314, TS2344 | Fix generic constraints |
| Return Type | TS2355, TS2366 | Fix function return types |
| Overload Issues | TS2769 | Fix overload signatures |

---

## Phase 3: Fix Execution

### Agent Assignment by Error Type

| Error Type | Agent | Strategy |
|------------|-------|----------|
| Schema/Zod types | `typescript-pro` | Fix schema definitions, use z.infer |
| Function signatures | `typescript-pro` | Add proper generics, fix parameters |
| Null handling | `typescript-pro` | Add type guards, fix optionality |
| Import errors | `typescript-pro` | Fix imports, add exports |
| React types | `react-component-architect` | Fix component props, hooks |
| API types | `backend-architect` | Fix request/response types |
| Complex generics | `typescript-pro` | Refactor generic constraints |

### Fix Order

1. **Missing imports/exports** - Foundation for other fixes
2. **Type definitions** - Schema and interface fixes
3. **Function signatures** - Parameter and return types
4. **Null/undefined handling** - Type guards
5. **Generic constraints** - Complex type relationships

---

## Phase 4: Validation

After each fix:
```bash
npx tsc --noEmit --project tsconfig.typecheck.json
```

If new errors appear, fix those before proceeding.

---

## Proper Fix Patterns

### Type Mismatch (TS2322, TS2345)

**Wrong:**
```typescript
const value: string = someNumber as any;
const value: string = someNumber as unknown as string;
```

**Correct:**
```typescript
const value: string = String(someNumber);
// Or fix the source to return correct type
```

### Missing Property (TS2339)

**Wrong:**
```typescript
(obj as any).property
obj!.property
```

**Correct:**
```typescript
// Add type guard
if ('property' in obj && obj.property) {
  obj.property
}

// Or fix the type definition
interface MyObj {
  property: string;
}
```

### Null/Undefined (TS2531, TS2532)

**Wrong:**
```typescript
value!.method()
value?.method() // if hiding real issue
```

**Correct:**
```typescript
// Add guard
if (value !== null) {
  value.method()
}

// Or fix optionality in type
function getValue(): Value { // not Value | null
  return actualValue;
}
```

### Generic Constraints (TS2344)

**Wrong:**
```typescript
function fn<T>(x: T): T {
  return x.property; // Error: T doesn't have property
}
```

**Correct:**
```typescript
function fn<T extends { property: string }>(x: T): T {
  return x.property;
}
```

### Function Return (TS2355, TS2366)

**Wrong:**
```typescript
function fn(): string {
  // @ts-ignore
  return maybeString;
}
```

**Correct:**
```typescript
function fn(): string {
  if (typeof maybeString !== 'string') {
    throw new Error('Expected string');
  }
  return maybeString;
}

// Or fix return type
function fn(): string | undefined {
  return maybeString;
}
```

---

## Execution Commands

### Quick Fix (Single File)

```
Fix TypeScript errors in [FILE] properly:

1. Read the file
2. Run: npx tsc --noEmit [FILE] 2>&1
3. For each error, apply proper fix (no any, no assertions, no ignores)
4. Verify: npx tsc --noEmit [FILE]
5. Repeat until no errors

Agent: typescript-pro
```

### Full Codebase Fix

```
Fix all TypeScript errors in codebase (excluding tests):

Phase 1 - Discover:
Run: npx tsc --noEmit 2>&1 | grep -v "\.test\.ts"
List all errors with file:line:column

Phase 2 - Classify:
Group errors by type (missing types, mismatches, null issues, etc.)

Phase 3 - Fix (in order):
1. typescript-pro: Fix missing imports/exports
2. typescript-pro: Fix type definitions
3. typescript-pro: Fix function signatures
4. typescript-pro: Fix null/undefined handling
5. typescript-pro: Fix generic constraints

After each fix batch:
- Run typecheck to verify
- If new errors, fix those first

Phase 4 - Validate:
Run full typecheck, confirm zero errors.

FORBIDDEN: any, as, @ts-ignore, @ts-expect-error, !, loose types
REQUIRED: Proper types, guards, generics, correct signatures
```

---

## Agent Prompts

### typescript-pro: Fix Type Errors

```
Fix TypeScript errors in this file properly:

File: [PATH]
Errors:
[PASTE ERRORS]

Rules:
- NO `any` type ever
- NO `as` assertions (except proven safe narrowing after type guard)
- NO `@ts-ignore` or `@ts-expect-error`
- NO `!` non-null assertions
- NO making types looser

Fix by:
- Adding proper type definitions
- Using type guards for narrowing
- Fixing function signatures
- Adding generic constraints
- Fixing the root cause

After fixing, verify with: npx tsc --noEmit [PATH]
```

### typescript-pro: Fix Null Handling

```
Fix null/undefined TypeScript errors properly:

File: [PATH]
Errors: [TS2531, TS2532, TS2533 errors]

Do NOT use:
- Optional chaining (?.) to hide issues
- Non-null assertions (!)
- Type assertions (as)

DO use:
- Type guards: if (value !== null)
- Fix optionality at source
- Explicit undefined returns where appropriate
- Discriminated unions
```

### typescript-pro: Fix Generic Errors

```
Fix generic TypeScript errors properly:

File: [PATH]
Errors: [TS2314, TS2344 errors]

Fix by:
- Adding proper generic constraints: <T extends X>
- Using conditional types where needed
- Fixing type parameter usage
- Ensuring generic flows correctly through code
```
