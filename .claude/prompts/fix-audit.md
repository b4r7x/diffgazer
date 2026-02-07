# Code Quality Audit Fix — Agent Team Orchestration

## Your Mission

You are the team lead for fixing all issues found in the Stargazer code quality audit. Read the audit report, set up the team, and orchestrate fixes across the codebase.

## Phase 1: Understand the Audit

Before spawning teammates, YOU must read these files:

1. **Read the audit report**: `.claude/docs/code-quality-audit.md` — master list of 72 findings (6 CRITICAL, 18 HIGH, 28 MEDIUM, 20 LOW)
2. **Read the testing guidelines**: `.claude/docs/testing.md` — project testing rules
3. **Read the ADRs**: `.claude/docs/decisions.md` — architectural decisions to follow
4. **Read the patterns**: `.claude/docs/patterns.md` — protected patterns to preserve
5. **Read the security doc**: `.claude/docs/security.md` — threat model
6. **Read the test gap report**: `.claude/docs/test-implementation-report.md` — existing test gaps (Section 3)

## Phase 2: Spawn Fix Team

Create an agent team organized by domain. Each teammate fixes their assigned findings AND writes tests for the fixes. Use `bypassPermissions` mode for all teammates.

### Teammate 1: "security-fixer"
**Assignment: All security fixes (Phase 1 from audit)**

Findings to fix:
- **CRIT-1**: `apps/server/src/app.ts` — Replace static CORS allowlist with dynamic hostname check per ADR-0003. The `ALLOWED_ORIGINS` array on lines 9-14 must become a function that checks `new URL(origin).hostname === "localhost" || hostname === "127.0.0.1"` for any port.
- **CRIT-2**: `apps/server/src/shared/lib/paths.ts` — Add validation inside `resolveProjectRoot` / `getProjectRoot` to reject paths without `.git` or outside user home. Currently trusts `x-stargazer-project-root` header raw.
- **CRIT-6**: `apps/server/src/app.ts` — Add global middleware setting `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` response headers. Security docs claim these exist but they don't.
- **HIGH-6**: `apps/server/src/features/review/router.ts:101` — Add `requireRepoAccess` middleware to the review stream endpoint (`GET /stream`) and context endpoints.
- **HIGH-13**: `apps/server/src/shared/lib/review/prompts.ts:244-303` — Apply `escapeXml()` to ALL dynamic fields in `buildDrilldownPrompt`: `issue.id`, `issue.title`, `issue.file`, `issue.severity`, `issue.category`, and all fields in `otherIssuesSummary`.
- **HIGH-18**: `apps/server/src/dev.ts` — Add `hostname: "127.0.0.1"` to the `serve()` options.

After each fix, write/update the relevant test file to cover the fix. Run `pnpm --filter server test` after each file.

Spawn prompt: "You are fixing security issues in the Stargazer server. Read `.claude/docs/code-quality-audit.md` (CRIT-1, CRIT-2, CRIT-6, HIGH-6, HIGH-13, HIGH-18) and `.claude/docs/security.md` for full context. Read `.claude/docs/decisions.md` for ADR-0003 (CORS). Read each source file BEFORE modifying. Write tests for each fix. Run tests after each change. Preserve existing behavior — only fix the specific security gaps."

---

### Teammate 2: "react-cleanup"
**Assignment: All React/Web fixes**

Findings to fix:
- **CRIT-5**: Remove ALL `useCallback` and `useMemo` from these 12 files (React 19 Compiler handles it):
  - `apps/web/src/app/providers/config-provider.tsx` (4 useCallback + 2 useMemo)
  - `apps/web/src/app/providers/keyboard-provider.tsx` (2 useCallback + 1 useMemo)
  - `apps/web/src/app/providers/theme-provider.tsx` (1 useMemo)
  - `apps/web/src/components/ui/toast/toast-context.tsx` (2 useMemo)
  - `apps/web/src/components/layout/footer/footer-context.tsx` (2 useMemo)
  - `apps/web/src/features/history/hooks/use-reviews.ts` (1 useCallback)
  - `apps/web/src/components/ui/tabs/tabs.tsx` (1 useMemo)
  - `apps/web/src/components/ui/dialog/dialog.tsx` (1 useMemo)
  - `apps/web/src/components/ui/menu/menu.tsx` (1 useMemo)
  - `apps/web/src/components/ui/navigation-list/navigation-list.tsx` (1 useMemo)
  - `apps/web/src/components/ui/form/radio-group.tsx` (1 useMemo)
  - `apps/web/src/components/ui/form/checkbox.tsx` (1 useMemo)
- **HIGH-8**: `apps/web/src/hooks/use-settings.ts:52-55` — Move `triggerFetch()` call to a `useEffect` instead of calling during render phase.
- **HIGH-9**: `apps/web/src/app/providers/config-provider.tsx:138,166` — Replace `as SetupStatus` cast with Zod validation.
- **HIGH-10**: `apps/web/src/hooks/keyboard/use-selectable-list.ts:85-94` — Add `[focusedIndex]` dependency to the effect.
- **HIGH-16**: `apps/web/src/app/providers/config-provider.tsx:190,218,244` — Remove re-throw after `setError()`. Pick one error channel (state), don't throw.
- **HIGH-17**: `apps/web/src/features/review/hooks/use-review-stream.ts:140-175` — `resume` function should always return Result, catch and wrap in `err()` instead of re-throwing.
- **M-21**: `apps/web/src/hooks/use-settings.ts:71` — Either expose real error state or remove the `error` field.
- **L-16**: `apps/web/src/features/review/components/review-container.utils.ts:18-21` — Replace local `truncateText` with `truncate` from `@stargazer/core/strings`.
- **L-18**: `apps/web/src/hooks/use-scroll-into-view.ts:23,44` — Use `querySelectorAll<HTMLElement>` to remove `as` casts.

Run `pnpm --filter web test` after changes. Make sure existing tests still pass.

Spawn prompt: "You are fixing React code quality issues in the Stargazer web app. Read `.claude/docs/code-quality-audit.md` (CRIT-5, HIGH-8/9/10/16/17, M-21, L-16, L-18) for full context. Read `.claude/docs/patterns.md` for protected patterns. The project uses React 19 with Compiler — NO manual useCallback/useMemo. Read each source file BEFORE modifying. For CRIT-5, systematically remove all useCallback/useMemo from 12 listed files. For other fixes, make surgical changes only. Run `pnpm --filter web test` after changes."

---

### Teammate 3: "server-stability"
**Assignment: Server stability and error handling fixes**

Findings to fix:
- **CRIT-4**: `apps/server/src/shared/lib/ai/openrouter-models.ts:22` — Change `any` to `unknown`, add proper type narrowing or Zod parse for OpenRouter API response.
- **HIGH-1**: `apps/server/src/features/review/sessions.ts:18` — Add `MAX_SESSIONS = 50` limit with LRU eviction. Add periodic cleanup (30 min timeout) for sessions that never complete.
- **HIGH-3**: `apps/server/src/shared/lib/fs.ts:12-22` — In `readJsonFileSync`, only return `null` for ENOENT. For JSON parse errors, log a warning with the file path and return `null` (but log, don't silently swallow).
- **HIGH-4**: `apps/server/src/shared/lib/fs.ts:51` — Replace `Date.now()` with `randomUUID()` in `atomicWriteFile` temp filename.
- **HIGH-5**: `apps/server/src/features/review/sessions.ts:51-63` — In `addEvent`, handle async subscriber callbacks properly. Catch Promise rejections: `Promise.resolve(cb(event)).catch(e => console.error(...))`.
- **HIGH-7**: `apps/server/src/features/review/service.ts` — On client abort, mark session complete and call `deleteSession` to clean up properly.
- **HIGH-11**: `apps/server/src/shared/lib/ai/client.ts:90` — Add a comment documenting why the double assertion exists (SDK version mismatch). No code change needed beyond documentation.
- **M-12**: `apps/server/src/shared/lib/review/orchestrate.ts` — Initialize results array with rejected entries instead of undefined holes. When aborting, fill remaining slots with `{ status: 'rejected', reason: new Error('Aborted') }`.
- **M-13**: `apps/server/src/shared/lib/storage/reviews.ts:48-66` — `migrateReview` should return a new object instead of mutating.

After each fix, update/write the relevant test file. Run `pnpm --filter server test` after each.

Spawn prompt: "You are fixing server stability issues in Stargazer. Read `.claude/docs/code-quality-audit.md` (CRIT-4, HIGH-1/3/4/5/7/11, M-12/13) for full context. Read `.claude/docs/decisions.md` for ADR-0001 (Result pattern). Read each source file BEFORE modifying. Write tests for each fix. Make minimal changes — fix only the specific issue. Run `pnpm --filter server test` after each change."

---

### Teammate 4: "error-handling"
**Assignment: ADR-0001 compliance — refactor throw to Result<T,E>**

This is the biggest refactor. Findings:
- **CRIT-3 (part 1)**: `apps/server/src/shared/lib/ai/client.ts:93` — `createLanguageModel` should return `Result<LanguageModel, AIError>` instead of throwing.
- **CRIT-3 (part 2)**: `apps/server/src/shared/lib/ai/openrouter-models.ts:92,102,145` — `fetchOpenRouterModels` and `getOpenRouterModelsWithCache` should return `Result<OpenRouterModel[], AIError>` instead of throwing.
- **CRIT-3 (part 3)**: `apps/server/src/shared/lib/git/service.ts:177,181` — `getHeadCommit` should return `Result<string, GitError>` instead of throwing.
- **M-2**: Fix silent `catch {}` blocks in `git/service.ts` (lines 115, 124, 156, 167, 194) — add `console.warn` with context.

For each function changed from throw to Result:
1. Read the function and ALL its callers (grep for imports)
2. Change the function signature to return Result
3. Update ALL callers to handle Result instead of try/catch
4. Write/update tests for both success and error paths
5. Run tests to verify

Do NOT touch `packages/api/src/client.ts` (API client throw->Result is a larger refactor for a separate PR).

Spawn prompt: "You are refactoring server code from throw/try-catch to Result<T,E> pattern per ADR-0001. Read `.claude/docs/code-quality-audit.md` (CRIT-3, M-2) and `.claude/docs/decisions.md` (ADR-0001) for context. For each function: read it, read ALL callers (use grep), change to return Result, update callers, write tests. Functions to refactor: `createLanguageModel` in ai/client.ts, `fetchOpenRouterModels`/`getOpenRouterModelsWithCache` in openrouter-models.ts, `getHeadCommit` in git/service.ts. Also fix silent catch blocks in git/service.ts. Run `pnpm --filter server test` after each change."

---

### Teammate 5: "dead-code-cleanup"
**Assignment: Dead code removal, deduplication, small fixes**

Findings to fix:
- **L-19**: `packages/core/src/review/filtering.ts` — Delete `filterIssuesByPattern`, `issueMatchesPattern`, `filterIssues` (dead code, only used in tests). Update/remove their tests. Keep `filterIssuesBySeverity`.
- **L-20**: Remove dead exports: `DEFAULT_RUBRIC` from `prompts.ts`, `LENSES` from `lenses.ts`, `PROFILES` from `profiles.ts`.
- **M-5**: `apps/server/src/features/review/context.ts:12-22` — Replace local `readJsonFile` with import from `shared/lib/fs.ts` (add async variant if needed).
- **M-6**: `apps/server/src/shared/lib/ai/client.ts` + `git/errors.ts` — Extract shared `classifyError(error, rules)` utility, use it in both modules.
- **HIGH-12**: `packages/hooks/src/use-figlet.ts` — Rename to `get-figlet.ts`, rename function to `getFigletText`. Update consumers: `apps/cli/src/components/ui/logo.tsx` and `apps/web/src/components/ui/ascii-logo.tsx`. Update barrel export in `packages/hooks/src/index.ts`.
- **M-27**: `packages/hooks/src/use-figlet.ts` (now `get-figlet.ts`) — Add lazy font loading (only parse fonts on first call, not on import).
- **L-10**: `packages/core/src/strings.ts:6-9` — Add guard for `maxLength < suffix.length` in `truncate`.
- **L-11**: `packages/core/src/review/review-state.ts:259` — Add exhaustive check in reducer default case.
- **M-11**: `apps/server/src/features/review/schemas.ts:31-37` — Replace `.parse()` inside `.transform()` with `.safeParse()` or `.pipe()`.
- **M-10**: `apps/server/src/features/review/router.ts:299` — Map drilldown error codes to proper HTTP status codes using `handleStoreError` pattern.
- **M-15**: `apps/server/src/features/review/schemas.ts:20-29` — Add max item limit (1000) to `parseCsvParam`.

Run tests for each affected package after changes.

Spawn prompt: "You are doing dead code cleanup and small fixes in Stargazer. Read `.claude/docs/code-quality-audit.md` for full context on each finding. Your tasks: delete dead code (L-19, L-20), deduplicate utilities (M-5, M-6), rename useFiglet to getFigletText (HIGH-12, M-27), fix edge cases (L-10, L-11, M-11, M-10, M-15). Read each source file and ALL consumers (grep for imports) BEFORE modifying. Run tests for each affected package after changes: `pnpm --filter server test`, `pnpm --filter @stargazer/core test`, etc."

---

## Rules for ALL Teammates

- Read source files BEFORE modifying them
- Read ALL callers/consumers before changing a function signature (use grep)
- Make minimal, surgical changes — fix only the assigned finding
- Follow existing code style and patterns
- Use `Result<T, E>` for error handling (ADR-0001)
- Use ESM imports, never CommonJS
- Co-locate new test files next to source files
- Run tests after EACH change to catch regressions early
- If a test doesn't pass, fix it before moving on
- Do NOT touch files not listed in your assignment

## Phase 3: Verification

After all teammates finish, YOU (the lead) must:
1. Run `pnpm -r test` to verify ALL tests pass
2. Run `pnpm build` to verify no type errors
3. Count fixed findings vs total and report:
   - How many CRITICAL fixed (target: 6/6)
   - How many HIGH fixed (target: 18/18)
   - Remaining MEDIUM/LOW for future PRs
4. Write a summary to `.claude/docs/audit-fix-report.md`
