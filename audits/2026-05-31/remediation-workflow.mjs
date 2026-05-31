export const meta = {
  name: 'thermo-nuclear-remediation',
  description: 'Resolve audit findings F001-F019, regenerate artifacts, reaudit to convergence, run final gates',
  phases: [
    { title: 'Implement', detail: '7 opus agents, disjoint package write sets', model: 'opus' },
    { title: 'Artifacts', detail: 'regenerate + validate public registry/docs artifacts', model: 'opus' },
    { title: 'Reaudit', detail: '3 read-only reaudit passes (CLI/libs/apps)', model: 'opus' },
    { title: 'Converge', detail: 'fix unresolved/new findings, re-validate', model: 'opus' },
    { title: 'Gates', detail: 'final verification gates', model: 'opus' },
  ],
}

const REPO = '/Users/voitz/Projects/diffgazer-workspace'
const AUDIT = 'audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md'
const SPEC = 'audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md'

const PREAMBLE = `You are a remediation worker on ${REPO}.

You are NOT alone in the codebase. Other agents are fixing other packages concurrently. Do NOT revert, reformat, or overwrite edits outside your assigned write set. Do NOT run \`git checkout\`/\`git restore\`/\`git stash\` on files you did not create.

Read first, in order:
1. AGENTS.md (repository contract)
2. ${AUDIT} (the findings you own)
3. ${SPEC} (the matching remediation checklist sections)

Rules:
- Start with \`git status --short\`. Use \`rg\` for search. Make surgical edits — read existing implementation/tests before changing them.
- Fix root causes. Do NOT silence symptoms with permissive fallbacks, do NOT weaken or skip tests, do NOT add compatibility aliases unless a finding explicitly requires a public compatibility wrapper.
- Keep public contracts consistent across source, docs, examples, and exports.
- Add behavior-focused tests for every logic/API/accessibility/focus/registry/CLI/deploy-gate change.
- Do NOT regenerate generated public registry artifacts (libs/ui/public/r, libs/keys/public/r, docs generated data) — a dedicated artifact agent does that after you. Just fix source + tests.
- Run \`git diff --check\` before returning.`

const IMPL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings', 'filesChanged', 'commandsRun', 'allResolved', 'remainingRisk'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status', 'evidence'],
        properties: {
          id: { type: 'string', description: 'e.g. F001' },
          status: { type: 'string', enum: ['resolved', 'partial', 'failed'] },
          evidence: { type: 'string', description: 'what was changed + command/inspection proving the fix' },
        },
      },
    },
    filesChanged: { type: 'array', items: { type: 'string' } },
    commandsRun: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'result'],
        properties: {
          command: { type: 'string' },
          result: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
        },
      },
    },
    allResolved: { type: 'boolean' },
    remainingRisk: { type: 'string' },
  },
}

const REAUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clean', 'findings'],
  properties: {
    clean: { type: 'boolean', description: 'true only if NO unresolved or new findings' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'location', 'evidence', 'impact', 'fix'],
        properties: {
          id: { type: 'string', description: 'original F-id if unresolved, or NEW-<short> if newly introduced' },
          kind: { type: 'string', enum: ['unresolved', 'new-regression'] },
          location: { type: 'string', description: 'file:line' },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

// ---- Phase 1: Implementation (parallel, disjoint write sets) ----
phase('Implement')

const IMPL_AGENTS = [
  {
    label: 'impl:core',
    findings: 'F001',
    body: `Own ONLY F001 in libs/core (build/tsconfig/source import specifiers) and the core dist-ESM verifier script.
- Make @diffgazer/core dist importable directly by Node ESM (extensionless relative specifiers currently break it).
- Add a durable verifier modeled on libs/keys/scripts/verify-dist-esm-imports.ts covering dist/index.js, dist/api/index.js, dist/schemas/config/index.js. Wire it into the package's scripts so it runs in CI/build, mirroring how keys does it.
- Ensure scripts/monorepo/benchmark-server.mjs can import the built core API path it uses.
Run and report: pnpm --filter @diffgazer/core build; node -e "import('./libs/core/dist/index.js')"; node -e "import('./libs/core/dist/api/index.js')"; node -e "import('./libs/core/dist/schemas/config/index.js')"; pnpm --filter @diffgazer/core type-check; pnpm --filter @diffgazer/core test.`,
  },
  {
    label: 'impl:keys',
    findings: 'F002',
    body: `Own ONLY F002 in libs/keys source + tests (do NOT edit libs/keys/public/r JSON).
- In libs/keys/src/dom/focusable.ts treat ANY ancestor with aria-hidden="true" as hidden (e.g. element.closest('[aria-hidden="true"]') !== null) so aria-hidden="false" cannot re-expose a hidden subtree.
- Replace the existing test that locks in the wrong behavior with one proving the whole hidden subtree is excluded from focusable AND tabbable.
- Confirm focus-trap/list-navigation callers need no extra fallback.
Run and report: pnpm --filter @diffgazer/keys test -- focusable; pnpm --filter @diffgazer/keys type-check; pnpm --filter @diffgazer/keys build.`,
  },
  {
    label: 'impl:ui',
    findings: 'F005,F006,F007',
    body: `Own ONLY F005, F006, F007 in libs/ui registry hook source + tests + directly-consuming docs examples (do NOT edit libs/ui/public/r JSON).
- F005: make useActiveHeading SSR-safe — remove render-time document/window reads. Resolve doc as ownerDocument ?? (typeof document !== "undefined" ? document : null); no-op effects/scrollTo when doc is null.
- F006: support iframe/cross-realm documents — derive constructors from doc.defaultView (el instanceof doc.defaultView.HTMLElement) consistently in container resolution, heading filtering, and scrollTo.
- F007: preserve the OLD exported positional helper signatures for the floating-position public helpers (use-floating-position / compute-floating-position) — keep exported positional wrappers around the object-form internals. Add tests for the OLD plain-JS positional call shape, not only TS.
- Add behavior tests: an SSR renderToString() test for useActiveHeading, an ownerDocument/cross-realm test (closest jsdom can do + a short comment if needed), and the positional-signature test.
Run and report: pnpm --filter @diffgazer/ui test -- use-active-heading; pnpm --filter @diffgazer/ui test -- floating; pnpm --filter @diffgazer/ui type-check; pnpm --filter @diffgazer/ui validate:registry.`,
  },
  {
    label: 'impl:registry',
    findings: 'F013',
    body: `Own ONLY F013 in libs/registry source + validation tests (do NOT edit generated/public registry output).
- Reject absolute and parent-escaping (..) files[].path values in the public/source registry validation path (refine the shared public registry schema or add a validator that runs before resolve(rootDir, path)).
- Replace the compatibility test that asserts /etc/passwd and ../escape.tsx are ACCEPTED with tests asserting they are REJECTED for the public contract, while valid relative paths remain accepted for copy/shadcn consumers.
- Do not loosen schema types with z.any or broad string fallbacks; do not break source->public registry transforms.
Run and report: pnpm --filter @diffgazer/registry test; pnpm --filter @diffgazer/registry type-check; pnpm --filter @diffgazer/ui validate:registry; pnpm --filter @diffgazer/keys validate:registry.`,
  },
  {
    label: 'impl:server',
    findings: 'F003,F004,F008,F009,F010,F018',
    body: `Own F003, F004, F008, F009, F010, F018 in cli/server, cli/diffgazer server integration, libs/core API helpers ONLY where the contract requires it, and focused server/web tests. (Do NOT touch benchmark/deploy/CI files; do NOT touch libs/ui or libs/keys.)
- F003: restore the standalone \`@diffgazer/server dev\` + web dev API workflow without weakening packaged/CLI-managed token protection. Make server dev and the web dev client agree on the shutdown token automatically (mint+export both DIFFGAZER_SHUTDOWN_TOKEN and VITE_DIFFGAZER_SHUTDOWN_TOKEN), OR scope the /api/* token gate to modes that can provide a token. Add tests for missing-token standalone dev behavior AND protected packaged behavior.
- F004: preserve the event-cap warning after a terminal complete/error event in completed-session SSE replay (reserved slot, or overwrite an older progress event for the terminal event). Add a test: overflow -> terminal -> late SSE subscriber sees both the terminal result AND the cap warning, with the terminal event appearing exactly once.
- F008: make packaged user-facing web mode quiet by default (default log level warn/off) while keeping explicit diagnostic request logging via DIFFGAZER_LOG_LEVEL/dev. Add/adjust tests on logger default level + packaged server mode.
- F009: remove audit-ticket/remediation IDs (e.g. F148, F100, STRUCTURE.md §6) from runtime source comments in cli/server (app.ts, shared/lib/config/store.ts and any others); keep only durable rationale. No behavior change.
- F010: fix active-session lookup for scoped reviews. Decide the contract: either expose the same scope inputs (files/lenses/profile) on ActiveSessionQuerySchema and pass buildScopeKey() into getActiveSessionForProject(), OR redefine active lookup to return any active session for the mode and update dedupe semantics. Implement consistently across schemas, routes, service, and libs/core api/review.ts helpers + app consumers. Add a scoped-create-then-active-lookup test.
- F018: make SIGTERM/SIGINT shutdown abort or complete active sessions and close subscribers before/while closing the HTTP server, then exit after server.close(). Keep parent grace timeout longer than child force-kill delay. Add a test for shutdownSessions() with an active session + subscriber.
Run and report: pnpm --filter @diffgazer/server test; pnpm --filter @diffgazer/server type-check; pnpm --filter diffgazer test; pnpm --filter diffgazer type-check; and if libs/core changed: pnpm --filter @diffgazer/core test + type-check; if web consumers changed: pnpm --filter @diffgazer/web test + type-check.`,
  },
  {
    label: 'impl:ci-deploy',
    findings: 'F011,F012,F014,F015,F016,F019',
    body: `Own F011, F012, F014, F015, F016, F019 in .github, root package.json scripts, scripts/monorepo, deploy/*.Dockerfile, apps/hub build path, apps/landing deploy/build path, and script-contract tests. (Do NOT touch cli/server runtime, libs/ui, libs/keys, libs/core source.)
- F011: remove the npm 'allow: - dependency-type: "direct"' stanza in .github/dependabot.yml (restore transitive lockfile security coverage), keeping intended grouping/scheduling.
- F012: make benchmark strictness apply inside test-ci and release-check — set DIFFGAZER_SMOKE_STRICT_SKIPS=1 for the bench step too (export for the whole sh -c chain or set it directly on \`pnpm run bench\`).
- F014: in scripts/monorepo/benchmark-server.mjs track EVERY non-200 response per scenario (count + first failing status), not only lastStatus; make checkSlo() fail functionally if any response status is not 200. Preserve useful failure output. Update/add script unit tests.
- F015: remove the unusable DIFFGAZER_BENCH_REVIEW opt-in contract (env var in scripts/monorepo/artifacts/env.mjs, benchmark prose/comments, skip output, and tests mentioning the dead opt-in). Keep benchmark docs limited to behavior that exists.
- F016: update deploy/hub.Dockerfile to BUILD @diffgazer/hub and copy apps/hub/dist into nginx (mirror landing), remove the stale "no build step needed" comment, keep nginx SPA fallback.
- F019: restore landing type-checking in the Docker deploy path — either restore apps/landing build to "tsc -b && vite build" or add \`pnpm --filter @diffgazer/landing type-check\` before the build in deploy/landing.Dockerfile. Keep local scripts consistent with sibling apps.
Run and report: pnpm run test:scripts; DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench; pnpm --filter @diffgazer/hub type-check; pnpm --filter @diffgazer/hub build; pnpm --filter @diffgazer/landing type-check; pnpm --filter @diffgazer/landing build. (docker build is optional — if docker is unavailable, document the skip and verify the Dockerfile copies the right dist / runs the type-check.)`,
  },
  {
    label: 'impl:docs',
    findings: 'F017',
    body: `Own ONLY F017 in apps/docs route/sitemap/prerender generation + focused docs tests.
- Include /ui/hooks and /keys/hooks in sitemap/prerender when their hooks/index.mdx pages exist (getPreRenderPages currently skips hooks dirs and only re-adds generated hook item pages). Keep generated hook item pages in the sitemap.
- Add tests for both hook index routes and at least one generated hook item route.
Run and report: pnpm --filter @diffgazer/docs test -- generate-sitemap; pnpm --filter @diffgazer/docs type-check; pnpm --filter @diffgazer/docs build.`,
  },
]

const implResults = await parallel(
  IMPL_AGENTS.map((a) => () =>
    agent(`${PREAMBLE}\n\nYour assignment (findings ${a.findings}):\n${a.body}`, {
      label: a.label,
      phase: 'Implement',
      model: 'opus',
      schema: IMPL_SCHEMA,
    }).then((r) => ({ label: a.label, assigned: a.findings, result: r }))
  )
)

const impl = implResults.filter(Boolean)
log(`Implementation done: ${impl.length}/${IMPL_AGENTS.length} agents returned`)
for (const r of impl) {
  log(`${r.label}: allResolved=${r.result?.allResolved} risk=${(r.result?.remainingRisk || '').slice(0, 80)}`)
}

// ---- Phase 2: Artifacts (single agent, barrier after all impl) ----
phase('Artifacts')

const artifactResult = await agent(
  `You are the artifact integration agent on ${REPO}. Source fixes from 7 parallel workers are now integrated in the working tree.

Read AGENTS.md "Generated Artifacts" + "Artifact and public handoff checklist" in ${SPEC}.

Task:
1. \`git status --short\` to see all current changes.
2. Run \`pnpm run prepare:artifacts\`.
3. Run \`pnpm run validate:artifacts:check\`.
4. Inspect generated/public diffs. KEEP updated committed public registries under libs/ui/public/r and libs/keys/public/r when their source contract changed (F002 keys focusable, F005/F006/F007 ui hooks). Do NOT commit deterministic generated data under libs/ui/docs/generated, libs/keys/docs/generated, or cli/add/src/generated.
5. Run package/copy/direct smoke checks since registry/exports changed: pnpm run smoke:packages; pnpm run smoke:shadcn; pnpm run smoke:cli.
6. \`git diff --check\`.

Report exactly which files changed/generated, which generated changes you kept vs intentionally left uncommitted, every command + pass/fail, and any remaining risk. Do not revert unrelated worker edits.`,
  { label: 'artifacts:regen', phase: 'Artifacts', model: 'opus', schema: IMPL_SCHEMA }
)

log(`Artifacts: allResolved=${artifactResult?.allResolved} risk=${(artifactResult?.remainingRisk || '').slice(0, 100)}`)

// ---- Phase 3+4: Reaudit convergence loop ----
const REAUDIT_PASSES = [
  {
    label: 'reaudit:A',
    scope: `CLI, server, deploy, CI, scripts.
Verify F003, F004, F008, F009, F010, F011, F012, F014, F015, F016, F018, F019 are fixed.
Then audit \`git diff main...HEAD\` for NEW regressions in cli/server, cli/diffgazer, deploy, scripts/monorepo, root package scripts, and CI config.`,
  },
  {
    label: 'reaudit:B',
    scope: `Public libraries, registry, package exports, copy handoff.
Verify F001, F002, F005, F006, F007, F013 are fixed.
Then audit \`git diff main...HEAD\` for NEW regressions in libs/core, libs/keys, libs/ui, libs/registry, public registry JSON, docs examples, package exports, and shadcn/copy consumption paths.`,
  },
  {
    label: 'reaudit:C',
    scope: `Apps, docs routes, React behavior, tests, generated artifacts.
Verify F017 and app-facing fixes for F003, F005, F006, F007, F010, F016, F019.
Then audit \`git diff main...HEAD\` for NEW regressions in apps/web, apps/docs, apps/landing, apps/hub, cli/add, React behavior, accessibility, generated artifact boundaries, and user-facing workflows.`,
  },
]

function reauditPrompt(scope, knownFixed) {
  return `You are a READ-ONLY reauditor on ${REPO}. Do NOT edit files.

Read AGENTS.md, ${AUDIT}, and ${SPEC} first.

Scope:
${scope}

${knownFixed ? `Already-accepted resolutions (deduplicate against these — do not re-report unless you have NEW evidence they regressed):\n${knownFixed}\n` : ''}
Rules:
- Only report a finding if it is genuinely unresolved OR a new high-confidence regression caused by THIS branch (main...HEAD). Every finding needs file:line, the reviewed execution/structural path, impact, and a concrete fix.
- Deduplicate against the original audit findings list. Do not nitpick.
- Set clean=true with an empty findings array if there are no unresolved or new findings.`
}

let round = 0
let converged = false
let accepted = []

while (round < 3 && !converged) {
  round += 1
  phase(round === 1 ? 'Reaudit' : 'Converge')
  const phaseLabel = round === 1 ? 'Reaudit' : 'Converge'

  const knownFixedSummary = accepted.length
    ? accepted.map((f) => `${f.id} (${f.kind}): ${f.location}`).join('\n')
    : ''

  const auditResults = await parallel(
    REAUDIT_PASSES.map((p) => () =>
      agent(reauditPrompt(p.scope, knownFixedSummary), {
        label: `${p.label}:r${round}`,
        phase: phaseLabel,
        model: 'opus',
        schema: REAUDIT_SCHEMA,
      }).then((r) => ({ pass: p.label, ...r }))
    )
  )

  const newFindings = auditResults
    .filter(Boolean)
    .flatMap((r) => (r.findings || []).map((f) => ({ ...f, pass: r.pass })))

  log(`Reaudit round ${round}: ${newFindings.length} unresolved/new findings`)

  if (newFindings.length === 0) {
    converged = true
    break
  }

  accepted.push(...newFindings)

  // Fix the accepted findings, grouped by pass area, then re-validate artifacts.
  const byPass = {}
  for (const f of newFindings) {
    ;(byPass[f.pass] ||= []).push(f)
  }

  await parallel(
    Object.entries(byPass).map(([pass, fs]) => () => {
      const list = fs
        .map((f, i) => `${i + 1}. [${f.id}] ${f.location}\n   evidence: ${f.evidence}\n   impact: ${f.impact}\n   fix: ${f.fix}`)
        .join('\n')
      return agent(
        `${PREAMBLE}\n\nReaudit pass ${pass} (round ${round}) found these unresolved/new findings. Fix ALL of them at the root cause, add behavior tests, and keep within the relevant package boundaries:\n\n${list}\n\nDo NOT regenerate public artifacts (a dedicated agent does that next). Run the narrowest relevant tests for the packages you touch and report pass/fail. End with git diff --check.`,
        { label: `fix:${pass}:r${round}`, phase: 'Converge', model: 'opus', schema: IMPL_SCHEMA }
      )
    })
  )

  // Re-run artifact integration after fixes (source contracts may have changed again).
  await agent(
    `You are the artifact integration agent on ${REPO} (convergence round ${round}). Re-run after fix agents.
Run: pnpm run prepare:artifacts; pnpm run validate:artifacts:check; then smoke:packages, smoke:shadcn, smoke:cli; then git diff --check.
Keep updated committed public registries; do not commit generated docs/cli data. Report files changed and every command pass/fail.`,
    { label: `artifacts:r${round}`, phase: 'Converge', model: 'opus', schema: IMPL_SCHEMA }
  )
}

// ---- Phase 5: Final verification gates ----
phase('Gates')

const gatesResult = await agent(
  `You are the final verification agent on ${REPO}. All fixes and artifacts are integrated.

Run these gates IN ORDER and capture pass/fail + key output for each. Do not stop at the first failure — run them all and report every result:
1. git diff --check
2. pnpm run prepare:artifacts
3. pnpm run validate:artifacts:check
4. DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
5. DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
6. DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test:types
7. pnpm run test:scripts
8. DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
9. DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench
10. pnpm run verify:monorepo

For each command set result to pass/fail/skipped and put the failing summary in evidence. Set allResolved=true ONLY if every gate passed. Record any skip with the exact reason ("took too long" is NOT valid). Do not edit source to make gates pass — only report.`,
  { label: 'gates:final', phase: 'Gates', model: 'opus', schema: IMPL_SCHEMA }
)

return {
  implementation: impl.map((r) => ({
    label: r.label,
    assigned: r.assigned,
    allResolved: r.result?.allResolved,
    findingStatuses: r.result?.findings,
    risk: r.result?.remainingRisk,
    filesChanged: r.result?.filesChanged,
  })),
  artifacts: artifactResult,
  reauditRounds: round,
  converged,
  acceptedDuringReaudit: accepted,
  finalGates: gatesResult,
}
