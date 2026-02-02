# Stargazer Agent Workflow

How to orchestrate agents for Stargazer development.

## Principle

**Main context stays light. Agents do heavy work.**

Don't read entire files into main context. Spawn agents to:
- Explore codebase
- Analyze code
- Simplify migrations
- Write tests
- Review changes

## Agent Types for This Project

| Agent | Use For |
|-------|---------|
| `feature-dev:code-explorer` | Find files, understand dependencies |
| `feature-dev:code-architect` | Plan migration approach |
| `code-simplifier:code-simplifier` | Simplify migrated code |
| `unit-testing:test-automator` | Write minimal tests |
| `pr-review-toolkit:code-reviewer` | Quality check |

## Parallel vs Sequential

**Parallel** (no dependencies):
```
// Explore multiple areas at once
Task: feature-dev:code-explorer "Find triage service in .depracated/"
Task: feature-dev:code-explorer "Find SSE streaming in .depracated/"
Task: feature-dev:code-explorer "Find lens definitions in .depracated/"
```

**Sequential** (depends on previous):
```
// 1. First explore
Task: feature-dev:code-explorer "Find [FEATURE]"

// 2. Then plan (needs explore results)
// ... plan based on findings ...

// 3. Then implement (needs plan)
// ... write code ...

// 4. Then simplify (needs implementation)
Task: code-simplifier:code-simplifier "Simplify [file]"

// 5. Then review (needs final code)
Task: pr-review-toolkit:code-reviewer "Review [feature]"
```

## Example: Migrate Triage Service

```
1. EXPLORE (parallel)
   Task: feature-dev:code-explorer
   "Find triage-related code in .depracated/apps/server/src/"

   Task: feature-dev:code-explorer
   "Find triage schemas in .depracated/packages/schemas/"

2. PLAN (sequential, after explore)
   Files to migrate:
   - services/triage.ts → simplify
   - routes/triage.ts → keep mostly
   - schemas/triage.ts → keep as-is

   Remove:
   - Complex caching logic
   - Unused export functions

3. IMPLEMENT (sequential per file)
   Write simplified triage.ts

   Task: code-simplifier:code-simplifier
   "Review and simplify apps/server/src/services/triage.ts"

4. TEST (after implement)
   Task: unit-testing:test-automator
   "Write 3 tests for triage service:
   1. Happy path - review completes
   2. Error - no git diff
   3. Error - AI fails"

5. REVIEW (after all)
   Task: pr-review-toolkit:code-reviewer
   "Review triage service migration.
   Check: simplicity, no over-engineering, proper error handling."
```

## Output Format

After each phase, summarize:
```
## [FEATURE] Migration - Phase [N]

**Done:**
- Migrated X
- Simplified Y
- Tested Z

**Next:**
- [what's next]

**Blockers:**
- [if any]
```
