# Migrate Feature to MVP

**Usage:** Paste and replace `[FEATURE]` with what you want to migrate.

---

## Prompt

Migrate `[FEATURE]` from `.depracated/` to new MVP.

**Rules:**
- Don't bloat this context - use agents for heavy lifting
- Simplify everything - remove unnecessary code
- NO useMemo/useCallback/memo - React Compiler handles this
- Tests only for critical paths
- Storage in `.stargazer/reviews/` (per-project, not global)

**Workflow:**

1. **Explore** (spawn agent):
   ```
   Task: feature-dev:code-explorer
   "Find everything related to [FEATURE] in .depracated/.
   Return: files, dependencies, how it works."
   ```

2. **Plan** (after explore completes):
   - What to migrate 1:1
   - What to simplify
   - What to remove
   - Migration order

3. **Implement** (per file, parallel agents where possible):
   ```
   Task: code-simplifier:code-simplifier
   "Simplify this code from .depracated/[file]:
   - Remove unused exports
   - Replace useEffect with event handlers where possible
   - Remove useMemo/useCallback/memo
   - Flatten unnecessary abstractions"
   ```

4. **Test** (critical only):
   ```
   Task: unit-testing:test-automator
   "Write 2-3 tests for [component]. Only happy path + 1 edge case."
   ```

5. **Review** (at the end):
   ```
   Task: pr-review-toolkit:code-reviewer
   "Review migrated [FEATURE]. Check: simplicity, no over-engineering, React patterns."
   ```

**Output:** Return short summary of what's done, what's next.
