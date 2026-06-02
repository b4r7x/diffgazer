export const meta = {
  name: 'remediation-phase-runner',
  description: 'Run one 2026-06-01 remediation phase: Fixer -> independent unbiased Validator, loop on FAIL',
  phases: [
    { title: 'Fix', detail: 'Opus Fixer resolves the phase findings + adds behavior tests' },
    { title: 'Validate', detail: 'Fresh unbiased Opus Validator re-derives status + runs gates' },
  ],
}

const SPEC = 'audits/2026-06-01/THERMO-NUCLEAR-REMEDIATION-SPEC.md'
const AUDIT = 'audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md'
const BASE = 'a42db394'

const PHASES = {
  P0: {
    ids: 'the apps/docs biome release-gate blocker (`pnpm run check` currently fails with ~133 biome errors in apps/docs), N39, N47, N22',
    packages: 'apps/docs',
    diffScope: 'apps/docs',
    decisions: 'None.',
    tasks: [
      'Make `pnpm run check` pass for @diffgazer/docs. Run `pnpm --filter @diffgazer/docs exec biome check --write`, then hand-apply the unsafe fixes biome will not auto-apply: apps/docs/src/components/breadcrumbs.tsx:49 string-concat -> template literal; apps/docs/vite.config.ts:5 `path` -> `node:path`; sort imports; fix all remaining formatter diffs. INSPECT every auto-edit and REVERT any that change runtime behavior.',
      'N39: bring the F017-touched docs scripts into the lint gate. apps/docs/biome.json files.includes currently excludes scripts/. Add scripts/** (at least scripts/generate-sitemap.mjs and its test) so `biome check` actually covers them, then fix every violation surfaced (import sort + tab indentation).',
      'N47: fix apps/docs/scripts/generate-sitemap.d.mts:7 so writeSitemap return type includes robotsTarget (matches generate-sitemap.mjs:155-176). Correcting the type is preferred over deleting the .d.mts.',
      'N22: apps/docs/src/components/breadcrumbs.test.ts:35-37 has a comment claiming it skips when content is absent, but it hard-asserts existsSync(...).toBe(true). Make the comment match the fail-loud assertion (keep the hard assertion).',
    ],
    gates: [
      'pnpm --filter @diffgazer/docs exec biome check',
      'pnpm --filter @diffgazer/docs type-check',
      'pnpm --filter @diffgazer/docs test',
      'pnpm run check',
    ],
  },

  P1: {
    ids: 'N01, N03, N04, N07, N34, N35, N36, N37, N50',
    packages: 'cli/server, cli/diffgazer',
    diffScope: 'cli/server cli/diffgazer',
    decisions: [
      'N01/N07/N34 (RESOLVED): the PACKAGED binary must abort review sessions on shutdown like dev does. Export `shutdownSessions` from @diffgazer/server by adding `export { shutdownSessions } from "./features/review/sessions.js";` to cli/server/src/index.ts. Then in cli/diffgazer/src/lib/servers/embedded-server.ts stop(), call shutdownSessions() BEFORE closing.close() so in-flight sessions abort, SSE subscribers get the terminal error, and close() can drain. Make stop() async if needed. This is the real completion of F018.',
      'N37 (RESOLVED): keep JSON.stringify of the token but ADD HTML-safe escaping of `</script>` and `<!--` sequences (e.g. replace `<` with \\u003c and `>` with \\u003e in the serialized token) so a value can never break out of the inline <script>. FIX the misleading test (embedded-server.test.ts) to assert the ESCAPED output / absence of the literal breakout sequence. DO NOT delete the test.',
    ].join(' '),
    tasks: [
      'N01/N07/N34: implement the shutdownSessions wiring above; add a behavior test that an active session with a subscriber is aborted (terminal SSE error emitted, subscribers cleared) when the packaged embedded-server stop() runs.',
      'N03: the env-overridable child force-kill delay (cli/diffgazer/src/config.ts:22-28, read via DIFFGAZER_FORCE_KILL_DELAY_MS) can exceed the hardcoded parent grace timeout (create-process-server.ts:128-143 / web-launcher.ts / use-exit.ts gracefulMs=3000) and orphan the process. Derive gracefulMs from forceKillMs (gracefulMs = forceKillMs + 1000) so parent grace always strictly exceeds child kill. Add a test that with DIFFGAZER_FORCE_KILL_DELAY_MS raised (e.g. 5000) the resolved gracefulMs > forceKillMs.',
      'N04: web launch never prints the server URL (only opens browser / warns on failure). In cli/diffgazer/src/lib/servers/server-factories.ts make the onReady handler always log `Diffgazer is running at <address>` (and still open the browser when openBrowser), for both dev (createWebServer) and prod (createEmbeddedServer). So headless/closed-tab runs still surface the URL.',
      'N35: cli/server/src/app.ts:141-157 onError double-logs crashed requests (unhandled_error + the requestLogger tail request log) and the manual REQUEST_ID_HEADER set is dead (the requestLogger tail re-sets it and wins). Hono 4.12 runs onError INSIDE the middleware chain so the tail DOES run. Delete the false comment, delete the dead header write, and trim the duplicated request-shaped fields from the unhandled_error log so each crash logs once with requestId+error+stack only.',
      'N36: remove the test-only dead re-export alias `readOrCreateProjectFile` (cli/server/src/shared/lib/config/state.ts:190) and update state.test.ts to use createProjectFile directly (read-or-create semantics are unchanged).',
      'N37: harden HTML-shell token escaping in embedded-server.ts buildHtmlShell and fix the misleading test per the decision above.',
      'N50: remove the unreachable SPA-fallback branch in embedded-server.ts:120-126 (rewriteRequestPath is an identity fn because the GET /* handler already serves SPA navigation; register serveStatic({ root: webRoot }) without the dead rewriteRequestPath). Behavior unchanged.',
    ],
    gates: [
      'pnpm --filter @diffgazer/server test',
      'pnpm --filter @diffgazer/server type-check',
      'pnpm --filter diffgazer test',
      'pnpm --filter diffgazer type-check',
    ],
  },

  P2: {
    ids: 'N10, N19, N25, N27, N45',
    packages: 'cli/server, libs/core, apps/web',
    diffScope: 'cli/server libs/core apps/web',
    decisions: [
      'F010 = OPTION B (REMOVE THE DEAD SCOPE PLUMBING). This was decided from the code: no UI creates scoped reviews (createReview is {mode}-only at home-presentation.tsx:132) and no caller passes scope to getActiveReviewSession (page.tsx:55, home-presentation.tsx:146/151). Per AGENTS.md, delete the half-wired scope surface rather than build it out.',
      'Concretely for Option B: (1) libs/core/src/api/review.ts — revert getActiveReviewSession to (client, mode?) dropping the scope param + serialization, remove the ActiveReviewSessionOptions interface, and revert the bound wrapper to getActiveReviewSession: (mode?) => getActiveReviewSession(client, mode). (2) cli/server/src/features/review/schemas.ts — remove profile/lenses/files (and csvToArray/MAX_LENSES if now unused) from ActiveSessionQuerySchema, leaving { mode }. (3) cli/server/src/features/review/review-routes.ts — getActiveSessionHandler takes mode only and calls getActiveSessionForProject WITHOUT scopeKey (the ?? "" default already matches the empty-scope sessions every caller creates). (4) delete the scope-specific tests in libs/core/src/api/review.test.ts. Leave the create-side scopeKey machinery (buildScopeKey in sessions.ts used by createSession) intact — it is harmless and not dead. N45 (CSV file encoding) and N19 (lens dedup) are RESOLVED by removing the lookup-side scope query surface entirely.',
    ].join(' '),
    tasks: [
      'Execute Option B end-to-end so NO half-wired state remains: the scope param, ActiveReviewSessionOptions, and the lookup-side query fields are fully gone; mode-only active lookup is restored; scope tests are removed.',
      'After removal, confirm `rg ActiveReviewSessionOptions` and `rg "scope" cli/server/src/features/review/schemas.ts` show no orphaned references, and the React Query layer (libs/core/src/api/hooks/queries/review.ts, hooks/review.ts) remains mode-only and consistent.',
      'Keep/adjust the mode-only active-session tests so the lookup contract stays covered.',
    ],
    gates: [
      'pnpm --filter @diffgazer/server test',
      'pnpm --filter @diffgazer/core test',
      'pnpm --filter @diffgazer/web test',
      'pnpm --filter @diffgazer/server type-check',
      'pnpm --filter @diffgazer/core type-check',
      'pnpm --filter @diffgazer/web type-check',
    ],
  },

  P3: {
    ids: 'N05, N33, N09, N08, N16, N32, N17, N18, N26, N52, N14',
    packages: 'libs/registry, libs/ui, libs/keys (+ regenerate libs/ui/public/r and libs/keys/public/r)',
    diffScope: 'libs/registry libs/ui libs/keys',
    decisions: 'N17/N18/N26 (RESOLVED): INLINE the single/low-use object-form `*From` helpers into their positional public functions in compute-floating-position.ts and DELETE the inaccurate justification comment, while KEEPING the public positional signatures unchanged (that was the point of F007). Pin the positional public API with the existing test.',
    tasks: [
      'N05: libs/registry/src/shadcn/validate.ts validates file.path but not file.target (the field that controls shadcn copy-install write location). Apply ensureSafeFilePath to file.target too (when present) in both the source and public loops. Add a test with a SAFE path but an UNSAFE target (../escape, /abs) asserting it throws /Unsafe registry file path/.',
      'N33: the public-registry INDEX item files[] (publicItem.files, registry.json) are never path-checked nor compared to source. In validatePublicRegistryFresh, run ensureSafeFilePath over publicItem.files and compare index file paths to the transformed source (expectedItem.files). Add a test injecting an unsafe path into the index.',
      'N09: use-active-heading.ts scroll-spy permanently freezes when scrollTo targets an already-in-view heading (scrollingToRef never clears because no scroll/scrollend fires). Arm a self-clearing settle timer in scrollTo (reusing settleTimerRef/settleDelay, clearing any prior timer) for BOTH container and window branches so the guard always releases and update() re-runs. Add a behavior test: programmatic scrollTo to an in-view heading, then assert scroll-spy resumes tracking subsequent scrolls.',
      'N08/N16/N32: apply the F006 realm fix to use-floating-position.ts. Replace the host-realm `parent instanceof HTMLElement` at ~:80 with a parent.ownerDocument.defaultView-derived HTMLElement check; read the ResizeObserver constructor from the trigger view (not globalThis) at ~:160-163. Add a true cross-realm regression test (separate JSDOM realm, assert wrapper is NOT host-instanceof HTMLElement) that a scroll listener / resize observation attaches to a cross-realm overflow ancestor.',
      'N17/N18/N26: inline the object-form floating helpers per the decision; fix the misleading comment in compute-floating-position.ts.',
      'N52: the realm-safe helper isNode (libs/keys/src/dom/dom.ts:21) is exported only to its test and duplicated inline at its call sites. Wire isNode into use-focus-trap.ts isInsideContainer (and keyboard-provider.tsx isEventWithinContainer if it duplicates the same logic) instead of the inline `instanceof View.Node`. Keep isNode unexported from the barrel. (Deletion is the fallback only if wiring is infeasible.)',
      'N14: libs/keys/src/dom/navigation-items.ts:56-57 uses the GLOBAL Node.DOCUMENT_POSITION_* constants, contradicting the realm-correctness convention. Reuse the realm-safe comparator already in focusable.ts (export its documentOrder and import it) so the merged-selector sort no longer reads global Node. Regenerate navigation.json.',
      'Regenerate + validate registries: `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check`. libs/ui/public/r and libs/keys/public/r MUST byte-match the updated source for every changed item.',
    ],
    gates: [
      'pnpm --filter @diffgazer/registry test',
      'pnpm --filter @diffgazer/ui test',
      'pnpm --filter @diffgazer/keys test',
      'pnpm --filter @diffgazer/registry type-check',
      'pnpm --filter @diffgazer/ui type-check',
      'pnpm --filter @diffgazer/keys type-check',
      'pnpm run prepare:artifacts && pnpm run validate:artifacts:check',
    ],
  },

  P4: {
    ids: 'N06, N21, N38, N46, N53',
    packages: 'apps/web',
    diffScope: 'apps/web',
    decisions: 'N38/N53 (RESOLVED): REMOVE the dead clearScopedRouteState calls. No component writes `/review:highlighted` (home-presentation.tsx:120) or the destination settings keys (settings hub page.tsx). Keep the real destination clear at home-presentation.tsx:192 (its /settings target IS a real writer). Drop now-unused imports.',
    tasks: [
      'N06: apps/web/src/utils/download.ts revokes the blob object URL synchronously after click(), aborting the download in Safari/WebKit. Append the anchor, click, remove it, and defer the revoke past the current task (setTimeout(() => URL.revokeObjectURL(url), 0)). Add a test around the deferred revoke timing.',
      'N38/N53: remove the dead clearScopedRouteState("/review","highlighted") in home-presentation.tsx navigateToReview, and the equivalent dead destination-scope clear in settings/components/hub/page.tsx handleActivate. Verify against use-scoped-route-state.ts that no component writes those keys. Drop now-unused clearScopedRouteState imports where applicable. Keep home-presentation.tsx:192 (real /settings writer).',
      'N21: collapse the two-layer app-local re-export indirection for isApiError. In review/components/page.tsx import isApiError directly from @diffgazer/core/api; delete the `export { isApiError }` from use-review-error-handler.ts and the self-flagging comment + re-export in review/hooks/index.ts so the barrel only re-exports real hooks.',
      'N46: remove the unused useViewportBreakpoint hook (apps/web/src/hooks/use-viewport-breakpoint.ts) and the dead apps/web/src/hooks/index.ts barrel (confirm zero importers of `@/hooks` and of useViewportBreakpoint with rg first). If this orphans getBreakpointTierFromPx in libs/core, check `rg getBreakpointTierFromPx` — if it becomes unused, note it for P5/core rather than editing core here (stay within apps/web).',
    ],
    gates: [
      'pnpm --filter @diffgazer/web test',
      'pnpm --filter @diffgazer/web type-check',
    ],
  },

  P5: {
    ids: 'N11, N12, N13, N15, N20, N23, N24, N28, N29, N30, N31, N40, N41, N42, N43, N44, N48, N49, N51',
    packages: 'libs/core, libs/keys, libs/ui (test comments), cli/server, cli/add, scripts/monorepo, apps/hub, apps/landing, deploy, root package.json',
    diffScope: 'libs/core libs/keys libs/ui cli/server cli/add scripts apps/hub apps/landing deploy package.json',
    decisions: 'N30 (RESOLVED): on SESSION_STALE / SESSION_NOT_FOUND in useReviewStream.resume, dispatch RESET (clearing isStreaming and the dangling reviewId) BEFORE returning err(result.error), so the state machine reaches a terminal state instead of hanging with isStreaming=true. The caller still receives err() (onStaleSession/onNotFoundInSession still fire) and state.error stays null.',
    tasks: [
      'Core: N11 keep the literal error-code union instead of widening `code` to string — remove BOTH widening casts (schemas/errors.ts createDomainErrorCodes return `as [string,...string[]]` AND issues.ts REVIEW_SPECIFIC_CODES cast) so z.enum infers the literal union; verify with core type-check.',
      'Core: N12 delete the dead AgentMetaSchema.emoji field (accepted on input, stripped by the transform, never produced/consumed).',
      'Core: N30 fix the resume terminal transition per the decision; extend the existing stale-resume test to assert isStreaming===false after resume resolves.',
      'Core: N31 derive isStepEvent\'s STEP_EVENT_TYPES set from StepEventSchema.options discriminant literals (use the non-legacy `.values`: new Set(StepEventSchema.options.flatMap(o => [...o.shape.type.values]))) instead of the hardcoded duplicate Set.',
      'Core: N44 rewrite the stale DRY comment in libs/core/src/review/display.ts that references a DELETED web file (review-container.utils.ts) and a no-longer-real divergence; describe the single-source-of-truth accurately.',
      'Core/scripts: N49 tighten the dist ESM guard over-permissive `.json` exclusion (libs/core/scripts/verify-dist-esm-imports.ts:32) — drop `&& !specifier.endsWith(".json")` to match the keys guard.',
      'CARRYOVER from P4/N46 (libs/core dead code): deleting apps/web useViewportBreakpoint orphaned getBreakpointTierFromPx (libs/core/src/layout/breakpoints.ts:15) — it now has ZERO consumers (verify with `rg getBreakpointTierFromPx`, excluding its own def + tests). Remove the function and any barrel re-export (e.g. `export *`/named export in libs/core/src/layout/index.ts). KEEP the columns-based getBreakpointTier used by the CLI. If a breakpoints test references only getBreakpointTierFromPx, update/remove that test case accordingly. libs/core is a PRIVATE lib (not a published public API), so per AGENTS.md delete the dead export rather than keep it.',
      'Anti-slop ticket-ID sweep (keep durable rationale, remove ONLY the audit/ticket IDs + future-work hedging): N13 libs/core/src/schemas/presentation/shortcuts.ts (slot-07 F10); N15 libs/keys/src/hooks/use-focus-restore.ts (KEY-019/KEY-020 + "known limitation") and keyboard-provider.tsx KEY-019; N28/N29 libs/ui registry test files (F005/F006/F007) and scripts/monorepo/package-scripts.test.mjs (F012/F015); N51 cli/server/src/features/review/sessions.test.ts (F151/F155). After this, `rg -n "F0[0-9]{2}|KEY-0[0-9]{2}|slot-07|STRUCTURE\\.md" <src and test dirs>` must be clean (outside audits/).',
      'cli/add: N20 collapse the unreachable redundant `?? (...)` keys fallback in ownedFileHash (cli/add/src/commands/remove.ts:26-28) to a single manifest read; keep the getKeysHookNames import (still used by resolveKeyName).',
      'Scripts/CI: N42 add a test asserting the REAL per-PR gate enforces bench strictness — parse .github/workflows/release-readiness.yml and assert the Verify step runs `DIFFGAZER_SMOKE_STRICT_SKIPS=1 ... pnpm run verify`. Do NOT inline strict into the root `verify` script (it is the local dev command).',
      'Scripts: N43 remove the redundant non-strict second `pnpm run smoke:packages` in the release-check script (package.json) — the strict `smoke` already runs smoke:packages.',
      'Scripts: N48 add the missing checkSlo clean-pass test (scripts/monorepo/benchmark-slo.test.mjs) — an all-200 within-SLO result leaves BOTH functionalFailures and latencyBreaches empty.',
      'apps/hub: N40 add apps/hub/tsconfig.test.json + a `test:types` script + a vitest.config.ts typecheck block (matching apps/landing/apps/web) so hub test files participate in `turbo run test:types`. N23 add `noEmit: true` to apps/hub/tsconfig.json (remove outDir/rootDir) so `tsc -b` stops emitting throwaway JS before vite build.',
      'apps/landing/deploy: N24 wire VITE_DOCS_ORIGIN through the landing deploy path (ARG+ENV in deploy/landing.Dockerfile, args block in docker-compose.yml landing service) mirroring the docs service, so the documented .env.example override is not inert.',
      'deploy: N41 update stale deploy/REVERSE_PROXY.md — hub Content cell "Static HTML (single page)" -> "Static SPA (Vite + React)"; broaden Coolify Watch Paths for landing (apps/landing/**,libs/ui/**) and hub (apps/hub/**,libs/ui/**) since both bundles now depend on libs/ui theme CSS.',
    ],
    gates: [
      'pnpm --filter @diffgazer/core test',
      'pnpm --filter @diffgazer/core type-check',
      'pnpm --filter @diffgazer/keys type-check',
      'pnpm --filter @diffgazer/ui type-check',
      'pnpm --filter @diffgazer/server type-check',
      'pnpm --filter @diffgazer/add type-check',
      'pnpm --filter @diffgazer/hub type-check',
      'pnpm run test:scripts',
      'pnpm run check',
    ],
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['gate', 'findings', 'gateResults', 'summary'],
  properties: {
    gate: { type: 'string', enum: ['PASS', 'FAIL'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status', 'evidence'],
        properties: {
          id: { type: 'string', description: 'finding id e.g. N01, or "release-gate"' },
          status: { type: 'string', enum: ['resolved', 'partial', 'not-fixed', 'regressed'] },
          evidence: { type: 'string', description: 'file:line proof from the CURRENT source' },
        },
      },
    },
    newIssues: {
      type: 'array',
      description: 'regressions / new bugs / new slop / weakened tests / registry drift / boundary violations found in the diff',
      items: { type: 'string' },
    },
    gateResults: { type: 'string', description: 'each gate command + its real pass/fail result' },
    worklist: { type: 'string', description: 'if FAIL: concrete actionable worklist for the next Fixer pass; else empty' },
    summary: { type: 'string' },
  },
}

function fixerPrompt(p, round, worklist) {
  const head = round === 1
    ? `You are the Fixer (round 1) for ${p.id} of the Diffgazer 2026-06-01 remediation.`
    : `You are the Fixer (round ${round}) for ${p.id}. A previous Fixer pass was judged FAIL by an independent Validator. Address its worklist AND keep all already-correct fixes.\n\nVALIDATOR WORKLIST TO ADDRESS:\n${worklist}`
  return [
    head,
    '',
    'Load skills if available: code-audit, clean-code, code-quality, anti-slop, test-behavior-not-implementation (+ react-senior-guide and its subskills for any React work).',
    `Read AGENTS.md, then read the spec ${SPEC} and the entries for ${p.ids} in ${AUDIT} (each has file:line evidence + a recommended fix). Run \`git status --short\` before your first edit; preserve unrelated dirty files; never revert unrelated work.`,
    '',
    `RESOLVE EXACTLY these findings: ${p.ids}.`,
    `Owned packages (keep edits within): ${p.packages}.`,
    '',
    `PHASE DECISIONS (already made — honour them, do not re-litigate): ${typeof p.decisions === 'string' ? p.decisions : p.decisions}`,
    '',
    'FIX TASKS:',
    ...p.tasks.map((t, i) => `${i + 1}. ${t}`),
    '',
    'HARD RULES:',
    '- Fix root causes. Do not silence symptoms with permissive fallbacks or by weakening/deleting tests.',
    '- Add BEHAVIOR tests (user-visible output / accessible queries / public contract) for changed logic/API/a11y/registry/CLI/deploy-gate. No vi.mock of internal modules; no asserting internal refs/call-counts as the contract.',
    '- DO NOT introduce audit/ticket-id comments (F0xx, KEY-0xx, slot-xx, STRUCTURE.md) into source OR tests. Keep only durable rationale.',
    '- Keep public contracts consistent across source, docs, examples, generated public registries (libs/ui/public/r, libs/keys/public/r), and package exports. Regenerate committed registries when their source changed. Never commit generated data under */docs/generated or cli/add/src/generated.',
    '- Do NOT git commit. Leave changes in the working tree.',
    '',
    'GATES (run them and record real output):',
    ...p.gates.map((g) => `  $ ${g}`),
    'Then run `git diff --check`.',
    '',
    'Report back (concise): files changed; per-finding what you did + the exact proof path (file:line) and the test that pins it; each gate command + result; any residual risk; any untracked files you created.',
  ].join('\n')
}

function validatorPrompt(p, round) {
  return [
    `You are an INDEPENDENT, UNBIASED Validator (round ${round}) for ${p.id}. You did NOT write these fixes and must not assume they are correct. Default to skepticism: if you cannot PROVE a finding is resolved from the current source, it is NOT resolved.`,
    '',
    `Inputs: AGENTS.md, the spec ${SPEC}, the finding entries for ${p.ids} in ${AUDIT}, and the working-tree diff. Do NOT read any Fixer notes or self-assessment — re-derive truth from the CURRENT source by reading the cited files yourself.`,
    `Review the diff with: \`git --no-pager diff ${BASE} -- ${p.diffScope}\` (and \`git status --short\` for new/untracked files).`,
    '',
    `For EACH of ${p.ids}: read the cited files in the current tree and decide resolved | partial | not-fixed | regressed, with a file:line proof. For any behavioral claim, OPEN the test and confirm it asserts user-visible behavior (not internal state/refs/call-counts) and that it would actually fail without the fix.`,
    '',
    'Then run these gates yourself and record the REAL output (pass/fail):',
    ...p.gates.map((g) => `  $ ${g}`),
    '',
    'Independently scan every file in the diff for: regressions, new bugs, new anti-slop (ticket-id comments, dead code, misleading comments), weakened or deleted tests, public-registry drift (public/r vs source), and architecture boundary violations (libs/core importing apps/*//cli/*, libs/ui importing app code).',
    '',
    'Return the structured verdict. gate=PASS ONLY IF every listed finding is `resolved` AND the diff introduced nothing new (no regression/slop/weakened test/registry drift/boundary violation) AND every gate passed. Otherwise gate=FAIL with a concrete, actionable worklist naming each thing the next Fixer must do.',
  ].join('\n')
}

// NOTE: `args` is not reliably delivered to the script via scriptPath, so the
// active phase is set explicitly here and bumped per invocation (P0..P5).
const PHASE = 'P5'
const MAX_ROUNDS = 3
const p = PHASES[PHASE]
if (!p) {
  throw new Error(`Unknown phaseId: ${PHASE}`)
}
p.id = PHASE

const rounds = []
let worklist = ''
let verdict = null

for (let round = 1; round <= MAX_ROUNDS; round++) {
  log(`${PHASE} round ${round}: dispatching Fixer (${p.ids})`)
  phase('Fix')
  const fixerReport = await agent(fixerPrompt(p, round, worklist), {
    label: `${PHASE} fixer r${round}`,
    phase: 'Fix',
    agentType: 'general-purpose',
  })

  log(`${PHASE} round ${round}: dispatching independent Validator`)
  phase('Validate')
  verdict = await agent(validatorPrompt(p, round), {
    label: `${PHASE} validator r${round}`,
    phase: 'Validate',
    agentType: 'general-purpose',
    schema: VERDICT_SCHEMA,
  })

  rounds.push({ round, fixerReport, verdict })

  if (verdict && verdict.gate === 'PASS') {
    log(`${PHASE} PASS on round ${round}`)
    break
  }
  worklist = (verdict && verdict.worklist) || 'Validator returned no actionable worklist; re-verify and complete every listed finding.'
  log(`${PHASE} FAIL on round ${round}; looping to next Fixer pass`)
}

return {
  phase: PHASE,
  gate: verdict && verdict.gate,
  roundsRun: rounds.length,
  findings: verdict && verdict.findings,
  newIssues: verdict && verdict.newIssues,
  gateResults: verdict && verdict.gateResults,
  summary: verdict && verdict.summary,
  finalWorklist: verdict && verdict.gate === 'FAIL' ? (verdict.worklist || '') : '',
  fixerReports: rounds.map((r) => ({ round: r.round, report: r.fixerReport })),
}
