# CLI Bulletproof React Verification Workflow

## Overview

Verify `apps/cli` follows Bulletproof React structure with CLI-specific adaptations.

---

## Reference Structure (from docs/architecture.md)

```
apps/cli/src/
├── index.ts                 # Entry: Commander setup
├── app/                     # Application layer
│   ├── screens/             # TUI screens (like routes for web)
│   ├── provider.tsx         # Root context providers
│   └── app.tsx              # Main Ink application
├── commands/                # Commander command handlers
├── components/              # Shared Ink components
├── config/                  # CLI configuration
├── features/                # Feature modules
│   └── [feature]/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       └── index.ts         # Public API
├── hooks/                   # Shared hooks
├── lib/                     # Utilities (server bootstrap, etc.)
├── stores/                  # Zustand stores
├── types/
└── utils/
```

---

## Phase 1: Structure Audit (Sequential)

### Agent 1: Directory Analysis
```
Analyze apps/cli/src/:

1. List all directories and their contents
2. Compare against reference structure
3. Identify:
   - Missing directories
   - Extra directories that don't fit pattern
   - Misplaced files
```

### Agent 2: Feature Module Audit
```
For each feature in features/:

1. Check structure matches:
   - api/ (if needed)
   - components/
   - hooks/
   - index.ts (public API)

2. Verify:
   - No cross-feature imports
   - Public API exports only what's needed
   - Feature-specific tests grouped with feature
```

---

## Phase 2: Component & Hook Audit (Parallel)

### Agent 3: Shared Components Check
```
Analyze components/:

1. Each component should be reusable across features
2. Feature-specific components belong in features/[name]/components/
3. Check for unused components
```

### Agent 4: Shared Hooks Check
```
Analyze hooks/:

1. Each hook should be reusable across features
2. Feature-specific hooks belong in features/[name]/hooks/
3. Check for unused hooks
```

### Agent 5: Screens Check
```
Analyze app/screens/:

1. Each screen should:
   - Compose from feature components
   - Not contain business logic
   - Be thin orchestration layer

2. No screen should import from another screen
```

---

## Phase 3: Testing Structure (Sequential)

### Agent 6: Test Organization
```
Verify testing structure:

1. __tests__/ directories for mocks only
2. Test files (.test.ts, .spec.ts) grouped with source:
   - components/button.tsx → components/button.test.tsx
   - hooks/use-foo.ts → hooks/use-foo.test.ts

3. Feature tests inside feature directories
```

---

## Phase 4: Fixes (Parallel)

### Agent 7: Move Misplaced Files
```
Based on audit:
1. Move feature-specific code to features/
2. Move shared code to appropriate shared directory
3. Update imports
```

### Agent 8: Code Simplifier
```
Run pr-review-toolkit:code-simplifier:
- Remove unused exports
- Consolidate duplicate code
- Verify feature boundaries
```

---

## Expected Output

1. **Compliance Report**: What matches, what doesn't
2. **File Movement Plan**: What needs to move where
3. **Applied Changes**: Refactored structure
4. **Validation**: Type-check passes, tests pass

---

## Bulletproof React Key Rules

1. **Unidirectional imports**: shared → features → app
2. **Feature isolation**: Features don't import from each other
3. **Public APIs**: Features export only what's needed via index.ts
4. **Colocation**: Tests, types, utils close to what they test/type/help
