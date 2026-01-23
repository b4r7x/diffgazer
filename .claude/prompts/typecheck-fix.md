# TypeCheck Fix Prompts

## Quick Fix (Single File)

```
Fix TypeScript errors in [FILE] properly:

1. Run: npx tsc --noEmit [FILE] 2>&1
2. Read the file and understand each error
3. Fix each error with proper types (NO any, NO as, NO @ts-ignore, NO !)
4. Verify: npx tsc --noEmit [FILE]

Agent: typescript-pro
```

---

## Full Codebase Fix

```
Fix all TypeScript errors in codebase (excluding test files):

STEP 1 - Discover errors:
Run: npx tsc --noEmit 2>&1 | grep -v "\.test\.ts" | grep -v "__test__"
List all errors grouped by file.

STEP 2 - Fix each file:
For each file with errors, run typescript-pro agent:
- Read file
- Fix all type errors properly
- Verify file compiles

STEP 3 - Final validation:
Run: npm run type-check
Confirm zero errors.

FORBIDDEN FIXES:
- any type
- as assertions (except after type guard)
- @ts-ignore / @ts-expect-error
- ! non-null assertions
- Making types looser

REQUIRED FIXES:
- Proper type definitions
- Type guards for narrowing
- Generic constraints
- Correct function signatures
- Fix root cause, not symptoms
```

---

## Fix Specific Error Types

### Missing Types (TS2304, TS2307)

```
Fix missing type errors in [FILE]:

Errors: [PASTE TS2304/TS2307 ERRORS]

Fix by:
- Add missing imports
- Define missing types in correct location (packages/schemas/ for shared types)
- Export types that should be public

Do NOT: Use any or create loose placeholder types.

Agent: typescript-pro
```

### Type Mismatch (TS2322, TS2345)

```
Fix type mismatch errors in [FILE]:

Errors: [PASTE TS2322/TS2345 ERRORS]

Fix by:
- Change value to match expected type
- Fix function parameter types
- Fix return types
- Use proper type conversion (String(), Number(), etc.)

Do NOT: Use `as` to force types or `any` to bypass.

Agent: typescript-pro
```

### Null/Undefined (TS2531, TS2532, TS2533)

```
Fix null/undefined errors in [FILE]:

Errors: [PASTE TS2531/TS2532/TS2533 ERRORS]

Fix by:
- Add type guards: if (value !== null)
- Fix source to not return null if not expected
- Add proper optional typing where null IS valid
- Use discriminated unions

Do NOT: Use ?. to hide issues, ! to assert, or as to cast away null.

Agent: typescript-pro
```

### Missing Properties (TS2339, TS2551)

```
Fix missing property errors in [FILE]:

Errors: [PASTE TS2339/TS2551 ERRORS]

Fix by:
- Add property to interface/type definition
- Use type guard: if ('prop' in obj)
- Fix property name typos
- Import correct type that has the property

Do NOT: Use (obj as any).prop or @ts-ignore.

Agent: typescript-pro
```

### Generic Errors (TS2314, TS2344)

```
Fix generic type errors in [FILE]:

Errors: [PASTE TS2314/TS2344 ERRORS]

Fix by:
- Add constraints: <T extends SomeType>
- Fix generic parameter count
- Ensure generic flows through code correctly
- Use conditional types if needed

Agent: typescript-pro
```

---

## Parallel Execution

```
Fix TypeScript errors across multiple files in parallel:

Files with errors:
- [FILE1]
- [FILE2]
- [FILE3]

Run typescript-pro agent for each file in parallel.
Each agent should:
1. Read assigned file
2. Fix all type errors properly (no any, no as, no ignores)
3. Verify: npx tsc --noEmit [FILE]

After all complete, run: npm run type-check
```

---

## Post-Fix Validation

```
Validate TypeScript fixes are proper:

1. Run: npm run type-check
2. Search codebase for forbidden patterns:
   - grep -r "as any" packages/ apps/
   - grep -r "@ts-ignore" packages/ apps/
   - grep -r "@ts-expect-error" packages/ apps/
   - grep -r ": any" packages/ apps/

If any found, fix them properly.

Agent: typescript-pro
```

---

## Create tsconfig for Non-Test TypeCheck

```bash
# Create tsconfig that excludes tests
cat > tsconfig.typecheck.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__test__/**",
    "**/__tests__/**",
    "**/test/**",
    "**/tests/**"
  ]
}
EOF

# Run typecheck excluding tests
npx tsc --noEmit --project tsconfig.typecheck.json
```
