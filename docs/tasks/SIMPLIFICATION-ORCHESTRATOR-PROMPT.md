# Code Simplification Execution Prompt

Copy and paste this prompt into a fresh Claude Code session to execute the simplification tasks.

---

## Execution Prompt

```
Execute the code simplification tasks defined in docs/tasks/SIMPLIFICATION-TASKS.md

CRITICAL RULES:
1. Use the Task tool to spawn agents for EVERY task - do NOT execute tasks directly in this context
2. Run agents in PARALLEL within each phase when tasks are independent
3. After each phase completes, verify changes compile before proceeding
4. Commit after each phase with descriptive message

## Execution Order

### PHASE 1: Error Handling Fixes (CRITICAL - Run First)

Spawn these agents IN PARALLEL:

1. Task tool with subagent_type="pr-review-toolkit:silent-failure-hunter"
   Prompt: "Execute Task 1.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Fix empty catch blocks in packages/core/src/secrets/keyring.ts. Read the task file for full details. Make the code changes."

2. Task tool with subagent_type="pr-review-toolkit:silent-failure-hunter"
   Prompt: "Execute Task 1.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Fix silent degradation in apps/server/src/services/review-orchestrator.ts parseFileReviewResult function. Read the task file for full details. Make the code changes."

3. Task tool with subagent_type="pr-review-toolkit:silent-failure-hunter"
   Prompt: "Execute Task 1.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Fix error context loss in apps/server/src/services/review.ts git diff error handling. Read the task file for full details. Make the code changes."

After all complete: Run `pnpm turbo type-check` to verify. Commit: "fix: improve error handling - preserve context, remove silent failures"

---

### PHASE 2: Remove Duplicate Code (HIGH - DRY Violations)

Spawn these agents IN PARALLEL:

1. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 2.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove duplicate sanitization functions. Delete sanitizeUnicode and escapeXml from apps/server/src/services/review.ts and import from apps/server/src/lib/sanitization.ts instead. Read the task file for full details."

2. Task tool with subagent_type="react-component-architect"
   Prompt: "Execute Task 2.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Extract common SSE stream hook. Create apps/cli/src/hooks/use-sse-stream.ts with shared logic from use-review.ts and use-chat.ts. Read the task file for full details."

3. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 2.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Create error state helper in apps/cli/src/lib/state-helpers.ts and use it in review and chat hooks. Read the task file for full details."

4. Task tool with subagent_type="react-component-architect"
   Prompt: "Execute Task 2.4 from docs/tasks/SIMPLIFICATION-TASKS.md: Create Separator component in apps/cli/src/components/ui/separator.tsx and replace inline separators. Read the task file for full details."

After all complete: Run `pnpm turbo type-check && pnpm turbo test`. Commit: "refactor: remove duplicate code - extract common hooks and components"

---

### PHASE 3: Remove Over-Abstractions (MEDIUM)

Spawn these agents IN PARALLEL:

1. Task tool with subagent_type="code-review-ai:architect-review"
   Prompt: "Execute Task 3.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove AI client factory indirection. Simplify packages/core/src/ai/client.ts to directly export createGeminiClient. Read the task file for full details."

2. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 3.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove unused utility modules. Check if apps/server/src/lib/sse-utils.ts, apps/server/src/lib/normalization.ts, and packages/core/src/ai/schema-converter.ts are actually used. Delete if unused. Read the task file for full details."

3. Task tool with subagent_type="react-component-architect"
   Prompt: "Execute Task 3.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Simplify entity API hooks. Merge useEntityApi configuration directly into consumer hooks or remove the abstraction layer. Read the task file for full details."

4. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 3.4 from docs/tasks/SIMPLIFICATION-TASKS.md: Flatten types directory. Inline ListState type or move to single file. Delete apps/cli/src/types/ directory structure. Read the task file for full details."

5. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 3.5 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove pass-through deleteReview wrapper in packages/core/src/storage/review-history.ts. Use reviewStore.remove directly or return existed field. Read the task file for full details."

After all complete: Run `pnpm turbo type-check && pnpm turbo test`. Commit: "refactor: remove unnecessary abstractions and unused modules"

---

### PHASE 4: Simplify Complex Code (HIGH/MEDIUM)

Spawn these agents SEQUENTIALLY (these are larger changes):

1. Task tool with subagent_type="react-component-architect"
   Prompt: "Execute Task 4.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Split App component (295 lines) in apps/cli/src/app/app.tsx. Extract view-specific components to apps/cli/src/app/views/ directory. Create navigation manager hook. App component should be <100 lines. Read the task file for full details."

After 4.1 completes, verify with `pnpm turbo type-check`

2. Task tool with subagent_type="backend-architect"
   Prompt: "Execute Task 4.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Split chat.post handler (93 lines) in apps/server/src/api/routes/chat.ts. Extract chat orchestration to apps/server/src/services/chat.ts. Route handler should be <30 lines. Read the task file for full details."

3. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 4.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Simplify AsyncState generic type in apps/cli/src/hooks/use-config.ts. Inline specific state types instead of using generic. Read the task file for full details."

After all complete: Run `pnpm turbo type-check && pnpm turbo test`. Commit: "refactor: simplify complex components and handlers"

---

### PHASE 5: Type/Schema Improvements (MEDIUM)

Spawn these agents IN PARALLEL:

1. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 5.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Add messageCount validation to SessionSchema in packages/schemas/src/session.ts using .refine() like SavedReviewSchema does. Add tests. Read the task file for full details."

2. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 5.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Add file/line relationship constraint to ReviewIssueSchema in packages/schemas/src/review.ts. If line is specified, file must be specified. Add tests. Read the task file for full details."

3. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 5.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Extract shared ScoreSchema (z.number().min(0).max(10).nullable()) in packages/schemas/src/review.ts and use in all score fields. Read the task file for full details."

After all complete: Run `pnpm turbo type-check && pnpm turbo test`. Commit: "feat: strengthen schema validations and type safety"

---

### PHASE 6: Remove Unnecessary Comments (LOW)

Spawn these agents IN PARALLEL:

1. Task tool with subagent_type="experienced-engineer:code-quality-reviewer"
   Prompt: "Execute Task 6.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove WHAT comments from apps/server/src/services/review-orchestrator.ts. Remove section dividers and step comments. Keep WHY comments. Read the task file for the specific lines to remove."

2. Task tool with subagent_type="experienced-engineer:code-quality-reviewer"
   Prompt: "Execute Task 6.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove WHAT comments from apps/server/src/api/routes/chat.ts. Remove obvious comments like 'Load session', 'Add user message'. Read the task file for specific lines."

3. Task tool with subagent_type="experienced-engineer:code-quality-reviewer"
   Prompt: "Execute Task 6.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove WHAT comments from apps/cli/src/app/hooks/use-navigation.ts. Remove comments that just restate function names. Keep PASSIVE_VIEWS explanation. Read the task file for specific lines."

4. Task tool with subagent_type="experienced-engineer:code-quality-reviewer"
   Prompt: "Execute Task 6.4 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove TODO without ticket from packages/core/src/ai/client.ts line 13. Either create a ticket and reference it, or remove the comment. Read the task file for details."

After all complete: Commit: "chore: remove unnecessary comments - keep only WHY comments"

---

### PHASE 7: Clean Up Tests (LOW)

Spawn these agents IN PARALLEL:

1. Task tool with subagent_type="unit-testing:test-automator"
   Prompt: "Execute Task 7.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove framework behavior tests from packages/core/src/storage/persistence.test.ts. Remove tests for mkdir, file write, error message formatting. Keep validation and business logic tests. Read the task file for specific line numbers."

2. Task tool with subagent_type="unit-testing:test-automator"
   Prompt: "Execute Task 7.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove TypeScript compile-time tests from packages/schemas/src/config-union.test.ts. Remove type narrowing tests (lines 57-82) and Zod default behavior tests. Read the task file for details."

3. Task tool with subagent_type="unit-testing:test-automator"
   Prompt: "Execute Task 7.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Remove constant validation duplicates from packages/schemas/src/config.test.ts. Remove GEMINI_MODEL_INFO and AVAILABLE_PROVIDERS constant structure tests. Read the task file for specific lines."

After all complete: Run `pnpm turbo test` to verify remaining tests pass. Commit: "test: remove low-value tests - keep behavior tests only"

---

### PHASE 8: Readability Improvements (MEDIUM)

Spawn these agents IN PARALLEL:

1. Task tool with subagent_type="experienced-engineer:code-quality-reviewer"
   Prompt: "Execute Task 8.1 from docs/tasks/SIMPLIFICATION-TASKS.md: Rename single-letter parameters. In use-screen-handlers.ts: s→session, r→review. In review.ts: s→text. In response.ts: c→ctx. In review-aggregator.ts: i→issue. Read the task file for file locations."

2. Task tool with subagent_type="experienced-engineer:code-quality-reviewer"
   Prompt: "Execute Task 8.2 from docs/tasks/SIMPLIFICATION-TASKS.md: Extract magic numbers to constants. 50→MAX_DIFF_LINES_DISPLAY in git-diff-display.tsx. 24→DEFAULT_TERMINAL_HEIGHT in use-scroll.ts. Add comments to existing constants. Read the task file for details."

3. Task tool with subagent_type="javascript-typescript:typescript-pro"
   Prompt: "Execute Task 8.3 from docs/tasks/SIMPLIFICATION-TASKS.md: Centralize error codes in packages/schemas/src/errors.ts. Add common codes (INTERNAL_ERROR, AI_ERROR, STREAM_ERROR, NOT_FOUND) and use in route handlers. Read the task file for details."

After all complete: Run `pnpm turbo type-check && pnpm turbo test`. Commit: "refactor: improve code readability - naming and constants"

---

## FINAL VALIDATION

After all phases complete, run:

1. Full type check: `pnpm turbo type-check`
2. All tests: `pnpm turbo test`
3. Build: `pnpm turbo build`

If all pass, create summary commit: "refactor: complete code simplification - 28 tasks executed"

Report completion status and any issues encountered.
```

---

## Execution Notes

- **Total Tasks**: 28
- **Estimated Agents to Spawn**: 28 (some phases can run in parallel)
- **Expected Commits**: 9 (one per phase + final)

### If an Agent Fails

If an agent encounters an error:
1. Read the agent's output file to understand the issue
2. Fix the issue manually if simple
3. Re-run the agent with additional context if needed
4. Continue with remaining tasks

### Parallel Execution

Phases 1, 2, 3, 5, 6, 7, 8 can have their tasks run in parallel within the phase.
Phase 4 should run sequentially due to larger, interdependent changes.
