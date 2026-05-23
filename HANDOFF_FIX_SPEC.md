# Handoff Fix Specification

Date: 2026-05-23
Method: Consolidated from 6-agent SOTA audit + HANDOFF_AUDIT_FINDINGS.md validated by 4 Opus agents + security analysis

---

## Execution Model

Each phase:
1. **Opus implement agent** — makes the changes, runs verify commands, writes results to `PHASE_N_RESULT.md`
2. **Opus validation agent** — reads all changed files + `PHASE_N_RESULT.md`, re-runs verify commands independently, writes `PHASE_N_VALIDATION.md` with pass/fail per criterion
3. If any criterion fails → implement agent gets `PHASE_N_VALIDATION.md` as input, fixes only the failed items, re-runs verify
4. Validator runs again on the fixes
5. Max 3 loops per phase. If still failing after 3: escalate to user with the failing criteria and evidence
6. Phase is DONE when validator reports all criteria passing

Phases are ordered by dependency. Independent phases can run in parallel.

### Loop Protocol

**Implement agent output:** After making changes, run all verify commands listed in the phase. Write `PHASE_N_RESULT.md` with:
- Files changed (with line numbers)
- Verify command output (stdout/stderr)
- Self-assessment per validation criterion (PASS/FAIL with evidence)

**Validator agent input:** The phase spec + list of changed files + `PHASE_N_RESULT.md`.
**Validator agent task:** Read every changed file. Re-run every verify command independently. Check each validation criterion. Write `PHASE_N_VALIDATION.md` with PASS/FAIL per criterion + evidence.

**Retry input:** If validator reports failures, the implement agent gets `PHASE_N_VALIDATION.md` as context. It fixes ONLY the failed criteria — does not re-do passing work. Writes `PHASE_N_RESULT_v2.md`.

**Stuck detection:** If the same criterion fails 3 times with the same root cause, the phase is stuck. Output the exact error, the exact file:line, and what was tried. User decides.

### Agent scope rules

Each agent MUST:
- Read AGENTS.md before making changes
- Only touch files listed in the phase scope
- NOT touch files in "Do not touch" list
- Write tests for new behavior (not just verify existing tests pass)
- Run the phase verify commands before reporting done

Each agent MUST NOT:
- Refactor code outside the phase scope
- Add dependencies not specified in the phase
- Delete or modify tests for behavior they didn't change
- Make "while I'm here" improvements

---

## Consolidated Finding Index

Every open item from both audits, deduplicated. Items marked FIXED are excluded.

### Critical (4 open, 1 partial)

| ID | Issue | Source | Status |
|----|-------|--------|--------|
| C1 | JS-readable token - no CSP | HANDOFF_AUDIT | OPEN → CSP fix (no cookie migration) |
| C2 | No CSP/secureHeaders on embedded server | HANDOFF_AUDIT | OPEN |
| C3 | Hidden UI hook shims re-export @diffgazer/keys | HANDOFF_AUDIT | PARTIAL |
| C4 | Release workflow doesn't pin readiness SHA | HANDOFF_AUDIT | OPEN |
| C5 | Deploy independent of readiness + failure masking | HANDOFF_AUDIT | OPEN |

### High (8 open, 3 partial)

| ID | Issue | Source | Status |
|----|-------|--------|--------|
| H1 | NPM_TOKEN vs Trusted Publishing/OIDC | HANDOFF_AUDIT | OPEN |
| H2 | Wizard pre-selects file storage for API keys | HANDOFF_AUDIT | PARTIAL |
| H3 | 148-task spec stale (all unchecked) | HANDOFF_AUDIT | OPEN → archive |
| H4 | Keys installation MDX URL missing /r/ prefix | HANDOFF_AUDIT | PARTIAL |
| H5 | Field ARIA IDs set in useEffect, not render | HANDOFF_AUDIT | OPEN |
| H6 | Select search combobox ignores Field label | HANDOFF_AUDIT | OPEN |
| H7 | prepare:generated wipes manual docs content | HANDOFF_AUDIT | OPEN |
| H9 | Hidden registry items not freshness-validated | HANDOFF_AUDIT | OPEN |
| H10 | Registry origin hardcoded in consumption-metadata | HANDOFF_AUDIT + SOTA | OPEN |
| H11 | Artifacts excluded from npm tarballs | HANDOFF_AUDIT | OPEN → document |

### Medium (12 open, 2 partial)

| ID | Issue | Source | Status |
|----|-------|--------|--------|
| M1 | Smoke tests cover 9/84 public UI JSON items | HANDOFF_AUDIT + SOTA | OPEN |
| M2 | Dev-mode project-root header powerful | HANDOFF_AUDIT | OPEN |
| M3 | No rate limit on AI provider routes | HANDOFF_AUDIT | OPEN |
| M4 | files[] in review schema unbounded | HANDOFF_AUDIT | PARTIAL |
| M7 | Lint/check not in release gates | HANDOFF_AUDIT | OPEN |
| M8 | = H10 (deduplicated) | - | - |
| M9 | RadioGroup/CheckboxGroup missing group labels | HANDOFF_AUDIT | OPEN |
| M10 | Raw window.addEventListener("keydown") for "?" | HANDOFF_AUDIT | OPEN |
| M11 | Provider keyboard hooks duplicate focus-zone mechanics | HANDOFF_AUDIT | PARTIAL |
| M12 | ConfigStore 522-line maintenance hotspot | HANDOFF_AUDIT | OPEN |
| M13 | Static nginx lacks CSP/Permissions-Policy/HSTS | HANDOFF_AUDIT | OPEN |
| M14 | Docs preview uses package imports, not copy mode | HANDOFF_AUDIT | OPEN |
| M15 | Copy metadata paths disagree with dgadd defaults | HANDOFF_AUDIT | OPEN |

### From SOTA Audit (not in HANDOFF_AUDIT)

| ID | Issue | Status |
|----|-------|--------|
| S1 | Smoke tests don't cover menu/navigation-list/code-block | OPEN |
| S2 | diffgazer CLI missing prepublishOnly | OPEN |
| S3 | @diffgazer/keys peer floor >=0.1.1, should be >=0.2.0 | OPEN |
| S4 | Stale .output build artifacts (old domain in 49 files) | OPEN |
| S5 | Registry validator silent-skip for non-CSS missing files | OPEN |

### Low / Informational (fix if touched)

| ID | Issue | Status |
|----|-------|--------|
| L1 | robots.txt hardcodes domain | OPEN |
| L2 | Hub has no package.json | OPEN |
| L3 | Typography docs/examples incomplete | OPEN |
| L4 | Form state reset via effect in use-api-key-form.ts | OPEN |
| L5 | Local isInteractiveTarget overlaps keys utilities | OPEN |
| L6 | Keys URL /r/ prefix in keys docs content MDX | = H4 |

### Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| D1: Deployment | VPS + Coolify, `r.b4r7.dev` stays | User decision |
| D2: Auth model | CSP only, no HttpOnly cookie | CSP `connect-src 'self'` = same protection, zero complexity |
| D3: Docs manual libraries | Per-library resetDir instead of full wipe | SOTA: Fumadocs multi-tree, 5-10 line fix |
| D4: SSR search | Keep SSR (TanStack Start + Nitro) | Already SOTA for docs |
| D5: Stale spec | Archive to specs/archive/ | Work done, checkboxes stale |

---

## Phase 1: Quick Wins

**Effort:** ~15 min
**Dependencies:** None
**Parallel:** Yes (independent of all other phases)

### Items

| ID | Change | File(s) |
|----|--------|---------|
| S2 | Add `prepublishOnly` script | `cli/diffgazer/package.json` |
| S3 | Change keys peer dep floor to `>=0.2.0` | `libs/ui/package.json:332` |
| H3 | Move `specs/001-p0-handoff/` to `specs/archive/001-p0-handoff/` | directory move |
| H4 | Fix keys installation MDX URLs: add `/r/` prefix | `libs/keys/docs/content/getting-started/installation.mdx:41-42` |
| H2 | Change wizard default from `"file"` to `null` | `apps/web/src/features/onboarding/hooks/use-onboarding.ts:23` |
| L1 | Generate robots.txt from env or build-time origin | `apps/docs/public/robots.txt` + `apps/docs/scripts/generate-sitemap.mjs` |

### Implementation instructions

**S2:** Add to `cli/diffgazer/package.json`:
```json
"prepublishOnly": "pnpm run build && pnpm run type-check && pnpm run test"
```
Match the pattern used by `@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/add`.

**S3:** In `libs/ui/package.json`, change:
```
"@diffgazer/keys": ">=0.1.1"  →  "@diffgazer/keys": ">=0.2.0"
```

**H3:** `mv specs/001-p0-handoff specs/archive/001-p0-handoff` (create `specs/archive/` if needed).

**H4:** In `libs/keys/docs/content/getting-started/installation.mdx:41-42`, change:
```
https://r.b4r7.dev/keys/navigation.json  →  https://r.b4r7.dev/r/keys/navigation.json
https://r.b4r7.dev/keys/focus-trap.json  →  https://r.b4r7.dev/r/keys/focus-trap.json
```
Check ALL URLs in the file, not just these two.

**H2:** In `apps/web/src/features/onboarding/hooks/use-onboarding.ts:23`, change `INITIAL_DATA.secretsStorage` from `"file"` to `null`. This forces the user to explicitly choose storage method instead of pre-selecting file.

**L1:** In `apps/docs/scripts/generate-sitemap.mjs`, also generate `robots.txt` using the same `DEFAULT_ORIGIN` or `VITE_PUBLIC_ORIGIN` env var. Output to `.output/public/robots.txt`. Remove the static `apps/docs/public/robots.txt` or keep it as dev-only fallback.

### Verify

```bash
pnpm --filter @diffgazer/ui type-check
pnpm --filter diffgazer type-check
pnpm --filter @diffgazer/web type-check
ls specs/archive/001-p0-handoff/tasks.md
grep '/r/keys/' libs/keys/docs/content/getting-started/installation.mdx
grep 'prepublishOnly' cli/diffgazer/package.json
grep '>=0.2.0' libs/ui/package.json
```

### Validation criteria

- [ ] `cli/diffgazer/package.json` has `prepublishOnly` with build + type-check + test
- [ ] `libs/ui/package.json` peerDeps `@diffgazer/keys` is `>=0.2.0`
- [ ] `specs/001-p0-handoff/` no longer exists (moved to `specs/archive/`)
- [ ] ALL keys docs URLs include `/r/` prefix
- [ ] Onboarding wizard does not pre-select `"file"` storage
- [ ] `robots.txt` Sitemap URL derived from env/config, not hardcoded
- [ ] Type-check passes for touched packages

---

## Phase 2: CLI Security Hardening

**Effort:** ~30 min
**Dependencies:** None
**Parallel:** Yes (independent of phases 1, 3, 4, 5)

### Items

| ID | Change | File(s) |
|----|--------|---------|
| C1+C2 | Add CSP with per-response nonce | `cli/diffgazer/src/lib/servers/embedded-server.ts` |
| C2 | Add Permissions-Policy + Referrer-Policy | `cli/server/src/app.ts` |
| M3 | Add rate limiting on AI routes | `cli/server/src/features/review/router.ts` |
| M4 | Add files[] max count + length validation | `cli/server/src/features/review/schemas.ts` |
| M2 | Add explicit dev flag for project-root header | `cli/server/src/shared/lib/http/request.ts` |

### Implementation instructions

**C1+C2 (CSP with nonce):** In `embedded-server.ts`, modify the SPA shell handler:

```typescript
import { randomBytes } from "node:crypto";

// In the HTML response handler:
const nonce = randomBytes(16).toString("base64");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const script = `<script nonce="${nonce}">window.__DIFFGAZER_SHUTDOWN_TOKEN__=${JSON.stringify(token)};</script>`;

// Set CSP header on the response:
c.header("Content-Security-Policy", csp);
```

Only apply in packaged mode (`DIFFGAZER_PACKAGED=1`). In dev mode, Vite HMR needs inline scripts and WebSocket connections — CSP would break hot reload.

**C2 (additional headers):** In `cli/server/src/app.ts`, in the existing security headers middleware (around line 61-63), add:

```typescript
c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), midi=(), display-capture=()");
c.header("Referrer-Policy", "no-referrer");
```

**M3 (rate limiting):** Create a simple in-memory rate limiter in `cli/server/src/shared/middlewares/rate-limit.ts`:
- Per-process Map tracking request timestamps
- Max 10 review creations per minute
- Max 20 drilldowns per minute
- Max 30 model/context fetches per minute
- Return 429 when exceeded
- Apply to `POST /api/reviews`, `POST /api/reviews/:id/drilldown`, `POST /api/context/refresh`

Keep it simple — this is a local app, not a distributed system. No Redis, no sliding windows. A fixed-window counter per route prefix is sufficient.

**M4 (input validation):** In `cli/server/src/features/review/schemas.ts`, add constraints to `files`:
```typescript
files: z.array(z.string().max(500).regex(/^[^\0]+$/)).max(200)
```
Max 200 files, max 500 chars per path, no NUL bytes.

**M2 (dev-mode guard):** In `cli/server/src/shared/lib/http/request.ts`, change the dev-mode branch to only accept the project root header when an explicit `DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT=1` env var is set:
```typescript
const header = (!isPackaged() && process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT === "1")
  ? c.req.header(PROJECT_ROOT_HEADER)
  : undefined;
```

### Verify

```bash
pnpm --filter @diffgazer/server test
pnpm --filter @diffgazer/server type-check
pnpm --filter diffgazer type-check
```

### Validation criteria

- [ ] CSP header set on HTML responses with per-response nonce
- [ ] Nonce applied to the token injection `<script>` tag
- [ ] CSP NOT applied in dev mode (check for DIFFGAZER_PACKAGED guard)
- [ ] `Permissions-Policy` header present on all responses
- [ ] `Referrer-Policy: no-referrer` present on all responses
- [ ] Rate limiter exists and is applied to review/drilldown/context routes
- [ ] `files[]` schema has `.max(200)` and per-item `.max(500)` + no-NUL regex
- [ ] Dev project-root header requires `DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT=1`
- [ ] All existing tests still pass
- [ ] New tests written: CSP header present on HTML responses, nonce matches script tag, rate limiter returns 429 after threshold, files[] schema rejects >200 items
- [ ] No new dependencies added (rate limiter is in-memory, pure code)

---

## Phase 3: CI/CD Pipeline Fixes

**Effort:** ~20 min
**Dependencies:** None
**Parallel:** Yes (independent of all phases)

### Items

| ID | Change | File(s) |
|----|--------|---------|
| C4 | Pin release checkout to readiness SHA | `.github/workflows/release.yml` |
| C5 | Gate deploy on readiness + remove failure masking | `.github/workflows/deploy.yml` |
| M7 | Add lint/check to release gates | `package.json` |
| S2 | (done in Phase 1 — prepublishOnly) | - |

### Implementation instructions

**C4:** In `.github/workflows/release.yml`, at the checkout step (around line 30):
```yaml
- uses: actions/checkout@v6.0.2
  with:
    fetch-depth: 0
    ref: ${{ github.event.workflow_run.head_sha }}
```

**C5:** Modify `.github/workflows/deploy.yml`:

1. Change trigger from `on: push` to `on: workflow_run`:
```yaml
on:
  workflow_run:
    workflows: ["Release Readiness"]
    types: [completed]
    branches: [main]
```

2. Add condition: `if: github.event.workflow_run.conclusion == 'success'`

3. Use readiness SHA for checkout:
```yaml
- uses: actions/checkout@v6.0.2
  with:
    ref: ${{ github.event.workflow_run.head_sha }}
```

4. Remove `|| echo "Coolify webhook failed..."` masking. Let the step fail naturally. Add a separate post-deploy verification step:
```yaml
- name: Verify deployment
  run: |
    sleep 30
    curl -fI https://docs.b4r7.dev || echo "::warning::docs.b4r7.dev not responding"
    curl -fI https://r.b4r7.dev/r/ui/registry.json || echo "::warning::registry not responding"
    curl -fI https://diffgazer.b4r7.dev || echo "::warning::landing not responding"
```

5. Keep `workflow_dispatch` for manual deploys but add an explicit `if: github.event_name == 'workflow_dispatch' || ...` condition.

**M7:** In root `package.json`, add `pnpm run check` to both `verify` and `release-check` scripts. Insert before type-check:
```
"verify": "pnpm run prepare:artifacts && pnpm run verify:monorepo && pnpm run validate:artifacts:check && pnpm run check && DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 turbo run type-check && ...",
"release-check": "pnpm run prepare:artifacts && pnpm run validate:artifacts:check && pnpm run check && DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 turbo run type-check && ..."
```

### Verify

```bash
# YAML syntax check (if actionlint available):
actionlint .github/workflows/release.yml .github/workflows/deploy.yml 2>/dev/null || echo "actionlint not installed"
# Verify scripts parse:
node -e "const p = require('./package.json'); console.log(p.scripts.verify.includes('check') ? 'OK' : 'MISSING')"
grep 'workflow_run.head_sha' .github/workflows/release.yml
grep 'workflow_run' .github/workflows/deploy.yml
grep -c '|| echo' .github/workflows/deploy.yml  # should be 0 for the webhook step
```

### Validation criteria

- [ ] `release.yml` checkout uses `ref: ${{ github.event.workflow_run.head_sha }}`
- [ ] `deploy.yml` triggers on `workflow_run` of Release Readiness, not `push`
- [ ] `deploy.yml` has `conclusion == 'success'` gate
- [ ] `deploy.yml` webhook step does NOT have `|| echo` failure masking
- [ ] `deploy.yml` has post-deploy health check step
- [ ] `deploy.yml` still supports `workflow_dispatch` for manual deploys
- [ ] Root `verify` script includes `pnpm run check`
- [ ] Root `release-check` script includes `pnpm run check`

---

## Phase 4: Accessibility Fixes

**Effort:** ~45 min
**Dependencies:** None
**Parallel:** Yes (independent of phases 1-3, 5-6)

### Items

| ID | Change | File(s) |
|----|--------|---------|
| H5 | Field ARIA IDs during render, not useEffect | `libs/ui/registry/ui/field/field.tsx` |
| H6 | Select search combobox uses Field label | `libs/ui/registry/ui/select/select-search.tsx` |
| M9 | RadioGroup/CheckboxGroup group labels | `apps/web/src/features/settings/components/theme-selector-content.tsx`, `apps/web/src/features/onboarding/components/steps/provider-step.tsx` |
| M10 | Replace raw keydown with scoped hotkey | `apps/web/src/features/home/components/home-presentation.tsx` |

### Implementation instructions

**H5 (Field ARIA SSR):** The core issue is that `labelId`, `descriptionId`, `errorId` are `useState(undefined)` and set via `useEffect` in child components. This means SSR renders without ARIA relationships.

**Important:** The effect-based pattern exists for a reason — it tracks slot presence. If `FieldDescription` is not rendered, `aria-describedby` should NOT be emitted (pointing to a nonexistent element makes screen readers silently fail to announce — they don't fall back gracefully).

Fix approach:
1. Use `useId()` to generate stable base IDs during render (already done at line 92)
2. Compute deterministic IDs: `labelId = \`${baseId}-label\``, `descriptionId = \`${baseId}-description\``, `errorId = \`${baseId}-error\``
3. **Keep presence tracking** — but move it to render-time instead of effect-time. Options:
   a. Use React Context with a registration function that children call during render (not in useEffect)
   b. Use `React.Children` inspection in the Field parent to detect which slots are present
   c. Keep the `useState` registration pattern but initialize from a synchronous scan, not undefined
4. `FieldControl` emits `aria-labelledby` only when `labelPresent` is true, using the deterministic ID. Same for `aria-describedby` and `aria-errormessage`.
5. The IDs themselves are stable from first render. The presence tracking determines which ARIA attributes are emitted.

**Before writing the fix:**
1. Read `libs/ui/registry/ui/field/field.tsx` FULLY
2. Read `libs/ui/registry/testing/field.test.tsx` FULLY
3. Add a test FIRST: "when FieldDescription is not rendered, control has no aria-describedby attribute"
4. Add a test: "when FieldLabel is rendered, control has aria-labelledby on first render (not after effect)"
5. Then implement the fix to make both new tests pass while keeping all existing tests green

The test file is `libs/ui/registry/testing/field.test.tsx`.

**H6 (Select search label):** In `libs/ui/registry/ui/select/select-search.tsx`:
1. Destructure `ariaLabelledBy` from `useSelectContext()`
2. Compose it with the existing `aria-label`:
```tsx
aria-labelledby={ariaLabelledBy}
aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? "Search options")}
```
When `ariaLabelledBy` is present (from Field context), use it. When not, fall back to `aria-label`.

Read `select-context.tsx` to confirm `ariaLabelledBy` is in the context interface.

**M9 (group labels):** In each file, add `aria-label` to the RadioGroup/CheckboxGroup:
- `theme-selector-content.tsx:87` — add `aria-label="Select interface theme"`
- `provider-step.tsx:49` — add `aria-label="Select AI provider"` (or whatever the question is)

Read the files first to understand the exact JSX structure.

**M10 (raw keydown):** In `home-presentation.tsx` around line 219-231, replace:
```typescript
window.addEventListener("keydown", handler)
```
with:
```typescript
useKey("?", handler, { scope: "home" })
```
from `@diffgazer/keys`. This respects key scopes and editable-target guards. Read the current code to understand the handler logic. There's a `KEY-011` workaround comment — understand why it was done this way before changing.

### Verify

```bash
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/web type-check
```

### Validation criteria

- [ ] Field ARIA IDs (`aria-labelledby`, `aria-describedby`) present in SSR output (no useEffect dependency)
- [ ] `useId()` still used for base ID generation
- [ ] All existing Field tests pass
- [ ] Select search input gets `aria-labelledby` from Field context when available
- [ ] Select search falls back to `aria-label="Search options"` when no Field context
- [ ] All existing Select tests pass
- [ ] RadioGroup in theme selector has `aria-label`
- [ ] RadioGroup in provider step has `aria-label`
- [ ] Home "?" shortcut uses `useKey` or equivalent from `@diffgazer/keys`
- [ ] No raw `window.addEventListener("keydown")` remains in home-presentation.tsx
- [ ] axe accessibility audit passes in component tests

---

## Phase 5: Registry & Smoke Test Hardening

**Effort:** ~30 min
**Dependencies:** None
**Parallel:** Yes (fully independent of Phase 1)

### Items

| ID | Change | File(s) |
|----|--------|---------|
| S1 | Add menu/navigation-list/code-block to shadcn smoke | `scripts/monorepo/smoke-shadcn-install.mjs` |
| M1 | Add more items to smoke coverage | `scripts/monorepo/smoke-shadcn-install.mjs` |
| H9 | Validate hidden registry item content, not just existence | `libs/registry/src/shadcn/validate.ts` |
| S5 | Validate non-CSS file existence in registry validator | `libs/ui/scripts/validate-registry-metadata.ts` |
| C3 | Add defensive assertion for hidden hook shim @diffgazer/keys imports | `libs/ui/scripts/validate-registry-metadata.ts` or new test |
| M15 | Align copy metadata paths with dgadd defaults | `apps/docs/src/lib/consumption-metadata.ts` |

### Implementation instructions

**S1 + M1 (smoke coverage):** In `scripts/monorepo/smoke-shadcn-install.mjs`, add to `uiItems` array (around line 28):
```javascript
"menu", "navigation-list", "code-block", "sidebar", "tabs", "accordion", "stepper"
```
These were either previously broken (first 3) or are complex compound components that exercise deep dependency trees.

**H9 (hidden item validation):** In `libs/registry/src/shadcn/validate.ts`, around line 105-113, instead of just `ensureExists` for hidden items, run the same `compareItemFields` and file content comparison that visible items get. Remove the early `continue` after `ensureExists`.

**S5 (non-CSS file existence):** In `libs/ui/scripts/validate-registry-metadata.ts`, around line 440, extend the file existence check to ALL declared files, not just CSS. Change from:
```typescript
if (file.path.endsWith(".css")) { /* check existence */ }
```
to:
```typescript
// Check existence for all declared files
const fullPath = resolve(registryDir, file.path);
if (!existsSync(fullPath)) {
  errors.push(`Missing file: ${file.path}`);
}
```

**C3 (defensive assertion):** Add a validation check that ensures no non-hidden public registry item's file content contains bare `@diffgazer/keys` import specifiers. This can be in the existing validator or a new test. Check all files in `libs/ui/public/r/*.json` where `meta.hidden` is NOT true — their `content` field must not contain `from "@diffgazer/keys"` or `from '@diffgazer/keys'`.

**M15 (copy paths):** Read `apps/docs/src/lib/consumption-metadata.ts:42` and `cli/add/src/context.ts:97`. Align the docs copy path to match what `dgadd` actually outputs. If dgadd uses `src/components/ui/${itemId}`, docs should show that, not `components/${itemId}`.

### Verify

```bash
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke:shadcn
pnpm --filter @diffgazer/ui type-check
```

### Validation criteria

- [ ] `smoke-shadcn-install.mjs` tests at least: menu, navigation-list, code-block (previously broken)
- [ ] Hidden registry items get full content validation, not just existence check
- [ ] Non-CSS file existence is validated in the registry validator
- [ ] No non-hidden public registry JSON contains bare `@diffgazer/keys` imports
- [ ] Docs copy paths match dgadd default output paths
- [ ] All smoke tests pass
- [ ] Artifact validation passes

---

## Phase 6: Registry Origin & Docs Architecture

**Effort:** ~30 min
**Dependencies:** Phase 5 should complete first (validator changes)

### Items

| ID | Change | File(s) |
|----|--------|---------|
| H10 | Make registry origin env-configurable in docs | `apps/docs/src/lib/consumption-metadata.ts` |
| H7 | Per-library resetDir instead of full content wipe | `libs/registry/src/docs/sync-operations.ts` |
| H11 | Document artifact packaging decision | `PACKAGE_GOVERNANCE.md` |
| M14 | Align docs preview with copy consumer experience | `apps/docs/vite.config.ts` |
| S4 | Rebuild .output to clear stale domain refs | rebuild command |

### Implementation instructions

**H10 (env-configurable origin):** In `apps/docs/src/lib/consumption-metadata.ts:7`, change:
```typescript
const REGISTRY_ORIGIN = "https://r.b4r7.dev";
```
to:
```typescript
const REGISTRY_ORIGIN = import.meta.env.VITE_REGISTRY_ORIGIN ?? "https://r.b4r7.dev";
```
This allows preview/staging/custom deployments to use a different registry origin via env var. The default stays `r.b4r7.dev`.

**H7 (per-library resetDir):** In `libs/registry/src/docs/sync-operations.ts:289`, change:
```typescript
resetDir(paths.contentDir);
```
to:
```typescript
for (const artifact of artifacts) {
  const libraryContentDir = join(paths.contentDir, artifact.id);
  resetDir(libraryContentDir);
}
```
This only wipes content directories for artifact-backed libraries. A manually-authored library (e.g., `content/docs/diffgazer/`) is preserved.

Also apply the same logic to `paths.libraryAssetsDir` at line 290 — reset per-library subdirs only.

Read the full `runDocsSyncPass` function to understand the flow before changing. Ensure the `syncLibraryDocs` function at line 299 creates the right subdirectory structure.

**H11 (document artifact packaging):** Add a section to `PACKAGE_GOVERNANCE.md` explaining:
- `dist/artifacts` is excluded from npm tarballs by design
- Docs always deploy from the monorepo workspace, not published packages
- This is intentional: artifacts contain registry metadata for docs generation, not consumer-facing code

**M14 (docs preview alignment):** This is lower priority. Read `apps/docs/vite.config.ts` alias configuration. The issue is that docs previews use package imports (`@diffgazer/keys`) while copy consumers get local files. Evaluate whether this matters for docs accuracy. If the preview component rendering matches what copy consumers see, this is acceptable.

**S4 (rebuild .output):** After H10 changes, run:
```bash
pnpm run prepare:artifacts
pnpm run docs:build
```
Verify no `docs.diffgazer.b4r7.dev` references remain in `.output/`:
```bash
grep -r 'docs\.diffgazer\.b4r7\.dev' apps/docs/.output/ | wc -l  # should be 0
```

### Verify

```bash
pnpm --filter @diffgazer/docs type-check
pnpm --filter @diffgazer/docs test
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
grep -r 'docs\.diffgazer\.b4r7\.dev' apps/docs/.output/ | wc -l
```

### Validation criteria

- [ ] `consumption-metadata.ts` reads registry origin from `import.meta.env.VITE_REGISTRY_ORIGIN`
- [ ] Default value is still `https://r.b4r7.dev`
- [ ] `sync-operations.ts` resets per-library content dirs, not the entire contentDir
- [ ] Manual content in a non-artifact library namespace would survive sync
- [ ] `PACKAGE_GOVERNANCE.md` documents the artifact packaging decision
- [ ] `.output/` has zero references to old `docs.diffgazer.b4r7.dev` domain
- [ ] Docs type-check and tests pass

---

## Phase 7: Deploy Infrastructure

**Effort:** ~30 min
**Dependencies:** All other phases complete
**Parallel:** No — this is the final phase

### Items

| ID | Change | File(s) |
|----|--------|---------|
| M13 | Add CSP + Permissions-Policy to static nginx | `deploy/spa-nginx.conf`, `deploy/registry-nginx.conf` |
| H1 | Configure npm Trusted Publisher (stretch goal) | `.github/workflows/release.yml`, npm settings |
| - | Verify full release-check passes | root command |
| - | DNS + Coolify setup | MANUAL USER TASK |
| - | npm publish | MANUAL USER TASK (after deployment verified) |

### Implementation instructions

**M13 (nginx headers):** In `deploy/spa-nginx.conf` and `deploy/registry-nginx.conf`, add:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

For registry nginx specifically, also ensure CORS headers are correct for `npx shadcn add` (though Node.js fetch doesn't enforce CORS, it's good practice):
```nginx
add_header Access-Control-Allow-Origin "*" always;
add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
```

**H1 (Trusted Publisher):** This requires configuring npm Trusted Publishing in the npm registry settings for each package. Then change `release.yml` to use OIDC instead of `NPM_TOKEN`. This is a stretch goal — `NPM_TOKEN` with provenance works fine for initial publish.

**Full verification run:**
```bash
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test:types
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
pnpm run verify:monorepo
git diff --check
```

### Validation criteria

- [ ] `deploy/spa-nginx.conf` has CSP, Permissions-Policy, Referrer-Policy headers
- [ ] `deploy/registry-nginx.conf` has CSP, Permissions-Policy, CORS headers
- [ ] Full `pnpm run verify` passes
- [ ] Full `pnpm run release-check` passes
- [ ] `git diff --check` clean
- [ ] No whitespace errors in changed files

---

## Items Explicitly Not Fixed (with rationale)

| ID | Issue | Why not fixing |
|----|-------|---------------|
| M12 | ConfigStore 522-line hotspot | Refactoring without changing public API is risky. No user-facing impact. Track for post-handoff. |
| M11 | Provider keyboard hooks duplication | Uses library primitives correctly. Structural similarity, not copy-paste. Low risk. |
| L2 | Hub has no package.json | Hub is a single HTML file. Docker-only deployment. No build needed. |
| L3 | Typography docs incomplete | Functional component. Docs exist. Additional examples are nice-to-have. |
| L4 | Form state reset via effect | Contained, tested. Refactoring to key-based reset is a preference, not a bug. |
| L5 | isInteractiveTarget duplication | Single occurrence. Not worth extracting until pattern repeats. |
| H8 | Docs SSR deployment | Confirmed SOTA. Deploying via VPS+Coolify as Node.js SSR app. No change needed. |

---

## Execution Order

```
Phase 1 (quick wins)     ─┐
Phase 2 (CLI security)   ─┤
Phase 3 (CI/CD)          ─┤── all parallel, independent
Phase 4 (accessibility)  ─┤
Phase 5 (registry+smoke) ─┘
         │
         ▼
Phase 6 (registry origin + docs arch)  ── needs Phase 5 validator changes
         │
         ▼
Phase 7 (deploy infra + final verification)  ── needs all phases done
         │
         ▼
MANUAL: DNS + Coolify setup + npm publish
```

Phases 1-5 are all independent → run 5 agents in parallel.
Phase 6 after phase 5 (needs validator changes).
Phase 7 after all (final gate).
DNS/Coolify/npm publish are manual user tasks.

---

## Total Scope

- **30 items** to fix across 7 phases
- **~3 hours** estimated total implementation time
- **7 implement + 7 validate** = 14 agent runs minimum
- After Phase 7: ready for DNS + deploy + npm publish
