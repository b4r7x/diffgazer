export const meta = {
  name: 'remediation-final-reaudit',
  description: 'Independent holistic re-audit of the full cumulative remediation diff: per-slice finding re-confirmation + adversarial new-issue hunt + cross-phase interaction scan',
  phases: [
    { title: 'Hunt', detail: 'parallel adversarial hunters per diff-slice + cross-cutting interaction scan' },
  ],
}

const BASE = 'a42db394'
const AUDIT = 'audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md'

const SLICES = [
  {
    key: 'server-cli',
    paths: 'cli/server cli/diffgazer',
    ids: 'N01, N03, N04, N07, N34, N35, N36, N37, N50, N51, and the server-side half of the F010 scope removal (N19/N25/N27 server schema/route)',
    focus: 'graceful shutdown wiring (shutdownSessions in packaged embedded stop()), grace>kill timer ordering, ready-URL print, onError single-log + header behavior, HTML-shell token escaping against </script>/<!-- breakout, dead-code removals (readOrCreateProjectFile alias, rewriteRequestPath), and that no SSE/abort path regressed.',
  },
  {
    key: 'core',
    paths: 'libs/core',
    ids: 'N10, N11, N12, N13, N25, N27, N30, N31, N44, N45, N49, and the P4 carryover getBreakpointTierFromPx removal',
    focus: 'literal error-code union (no string widening), dead emoji removal, RESET-on-stale-resume terminal transition in useReviewStream, schema-derived isStepEvent set, display.ts comment accuracy, dist-ESM guard, removed scope client surface, and that getBreakpointTierFromPx is gone with zero references. Confirm NO libs/core import of apps/* or cli/*.',
  },
  {
    key: 'ui-registry',
    paths: 'libs/ui libs/registry',
    ids: 'N05, N08, N09, N16, N17, N18, N26, N28, N29, N32, N33',
    focus: 'registry file.target + public INDEX files[] path-traversal guards (the real security fix), cross-realm floating-position (realm-derived HTMLElement + ResizeObserver), scroll-spy settle timer, removal of object-form *From indirection, and that libs/ui/public/r is byte-synced to source (compare a public/r JSON to its source hook). Confirm the cross-realm tests use a TRUE second realm (new JSDOM), not same-realm. Confirm no libs/ui import of app code.',
  },
  {
    key: 'keys',
    paths: 'libs/keys',
    ids: 'N14, N15, N52',
    focus: 'navigation-items uses shared realm-safe documentOrder (no global Node), isNode wired into use-focus-trap + keyboard-provider, ticket-id-free comments, and that libs/keys/public/r reflects source (focus-restore.json/focus-trap.json/navigation.json).',
  },
  {
    key: 'web',
    paths: 'apps/web',
    ids: 'N06, N21, N38, N46, N53',
    focus: 'deferred blob-URL revoke (download not aborted in WebKit), isApiError imported directly (no app-local re-export hops), removed dead clearScopedRouteState calls (and the REAL /settings clear preserved), and useViewportBreakpoint + @/hooks barrel fully deleted with zero importers.',
  },
  {
    key: 'scripts-deploy',
    paths: 'scripts apps/hub apps/landing deploy package.json docker-compose.yml',
    ids: 'N20, N23, N24, N40, N41, N42, N43, N48',
    focus: 'cli/add ownedFileHash single-read (N20 is in cli/add — also inspect cli/add/src/commands/remove.ts), hub tsconfig noEmit + tsconfig.test.json + test:types + vitest typecheck block, VITE_DOCS_ORIGIN wired through landing Dockerfile + compose, REVERSE_PROXY.md content/watch-paths, release-readiness strict-bench test, release-check no double smoke:packages, and checkSlo clean-pass test. Also inspect cli/add/src/commands/remove.ts for N20.',
  },
  {
    key: 'docs',
    paths: 'apps/docs',
    ids: 'release-gate, N22, N39, N47',
    focus: 'the large biome reformat must be BEHAVIOR-NEUTRAL. Spot-check the 8 hand-applied a11y changes (preview-inset-pane header->div, docs-content-layout backdrop div->button, header.tsx button type + sr-only label, variable-diagram role=img/aria-hidden) are sound and do not break visual/keyboard behavior; breadcrumbs.tsx template literal yields identical href; vite.config node:path; biome.json includes scripts; .d.mts robotsTarget; breadcrumbs test comment matches its hard assertion. Flag ANY reformat hunk that changed runtime behavior (moved side-effect import, altered logic).',
  },
]

const HUNT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slice', 'verdict', 'findingsReconfirmed', 'newIssues', 'summary'],
  properties: {
    slice: { type: 'string' },
    verdict: { type: 'string', enum: ['CLEAN', 'ISSUES'] },
    findingsReconfirmed: {
      type: 'array',
      description: 'one entry per assigned finding id',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'stillResolved', 'evidence'],
        properties: {
          id: { type: 'string' },
          stillResolved: { type: 'boolean', description: 'true if the original audit evidence path no longer reproduces' },
          evidence: { type: 'string', description: 'file:line proof from current source' },
        },
      },
    },
    newIssues: {
      type: 'array',
      description: 'NEW problems introduced by the remediation diff (regressions, new bugs, new slop, weakened/deleted tests, registry drift, boundary violations). Empty if none.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'title', 'fileLine', 'evidence', 'owningPhase'],
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          title: { type: 'string' },
          fileLine: { type: 'string' },
          evidence: { type: 'string' },
          owningPhase: { type: 'string', description: 'P0..P5 phase that should fix it' },
          recommendedFix: { type: 'string' },
        },
      },
    },
    weakenedTests: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

function huntPrompt(s) {
  return [
    `You are an INDEPENDENT, ADVERSARIAL re-auditor for the "${s.key}" slice of the completed Diffgazer 2026-06-01 remediation. Be skeptical: your job is to find what is still broken or newly broken, not to rubber-stamp.`,
    '',
    `Diff base is ${BASE} (the pre-remediation HEAD). Review the slice with: \`git --no-pager diff ${BASE} -- ${s.paths}\` and \`git status --short\` for new/deleted files in these paths. Read the CURRENT source of any file you judge — do not trust the diff alone.`,
    `The original findings are documented in ${AUDIT} (each has file:line evidence + recommended fix).`,
    '',
    `TASK 1 — Re-confirm each assigned finding no longer reproduces. Assigned ids: ${s.ids}. For each, read the cited file(s) in the CURRENT tree and decide stillResolved (true = the original audit evidence path is gone/fixed). If ANY assigned finding's original defect still reproduces, set stillResolved=false with proof.`,
    '',
    `TASK 2 — Adversarially hunt for NEW issues the remediation introduced in this slice: regressions, new bugs, new anti-slop (ticket-id comments, dead code, misleading/inaccurate comments), weakened or deleted tests (a test that no longer fails when the bug is reintroduced, or an assertion silently dropped), public-registry drift (public/r vs source), and architecture-boundary violations. Slice focus: ${s.focus}`,
    '',
    'Rules: report a newIssue only with concrete file:line evidence you verified. Distinguish severity honestly (high=correctness/security/release-blocker; medium=real defect, narrow blast radius; low=slop/hygiene). For weakenedTests, name the test and what it stopped guarding. Do NOT propose edits — only report.',
    '',
    'Return the structured verdict. verdict=CLEAN only if every assigned finding stillResolved=true AND newIssues is empty AND weakenedTests is empty. Otherwise verdict=ISSUES.',
  ].join('\n')
}

const CROSS_PROMPT = [
  `You are an INDEPENDENT, ADVERSARIAL re-auditor looking ONLY for CROSS-PHASE INTERACTION bugs in the completed Diffgazer remediation — defects that a single-package reviewer would miss because they span packages.`,
  `Diff base ${BASE}. Use \`git --no-pager diff ${BASE} -- libs cli apps scripts deploy package.json\` (skip the apps/docs formatting churn; focus on behavioral changes).`,
  '',
  'Specifically investigate these interaction risks and prove each is safe OR broken with file:line evidence:',
  '1. F010 scope removal (libs/core client + cli/server schema/route/router): does any remaining caller, test, or route still reference the removed scope params / ActiveReviewSessionOptions / csvToArray? Is getActiveSessionForProject still called consistently (empty scopeKey matches created sessions)? Did router.ts and review-routes.ts stay in sync?',
  '2. shutdownSessions export (cli/server/src/index.ts) + embedded-server import: does the @diffgazer/server public entry now export it, does embedded-server.ts import path resolve, and did adding the export change any other consumer or the package surface unexpectedly?',
  '3. Registry regeneration (libs/ui + libs/keys public/r) vs source after the N14/N16/N17/N32/N52 source edits: pick 2-3 changed hooks and confirm the public/r JSON content matches the current source (no stale registry). Confirm copy-mode import specifiers are still valid (no relative .js breakage).',
  '4. N14 documentOrder export from focusable.ts now imported by navigation-items.ts: confirm the export exists, the import is correct, and navigation.json copy-mode specifier is the bare form.',
  '5. The N46 deletion of useViewportBreakpoint + the P5 removal of getBreakpointTierFromPx: confirm nothing (web or core barrel) still imports either, and core type-check/build is unaffected.',
  '6. Any test that was DELETED across the whole diff (git diff --stat for *.test.* with net-negative): confirm each deletion removed only a now-invalid assertion (e.g. a scope test for removed scope), not real coverage.',
  '',
  'Return the structured verdict (slice="cross-cutting"). findingsReconfirmed may be empty; concentrate on newIssues. verdict=CLEAN only if no interaction bug found.',
].join('\n')

phase('Hunt')

const thunks = SLICES.map((s) => () =>
  agent(huntPrompt(s), { label: `reaudit:${s.key}`, phase: 'Hunt', agentType: 'general-purpose', schema: HUNT_SCHEMA }),
)
thunks.push(() =>
  agent(CROSS_PROMPT, { label: 'reaudit:cross-cutting', phase: 'Hunt', agentType: 'general-purpose', schema: HUNT_SCHEMA }),
)

const results = (await parallel(thunks)).filter(Boolean)

const allNew = results.flatMap((r) => (r.newIssues || []).map((i) => ({ ...i, slice: r.slice })))
const regressed = results.flatMap((r) =>
  (r.findingsReconfirmed || []).filter((f) => f.stillResolved === false).map((f) => ({ ...f, slice: r.slice })),
)
const weakened = results.flatMap((r) => (r.weakenedTests || []).map((t) => ({ slice: r.slice, test: t })))

return {
  overall: allNew.length === 0 && regressed.length === 0 && weakened.length === 0 ? 'CLEAN' : 'ISSUES',
  slices: results.map((r) => ({ slice: r.slice, verdict: r.verdict, summary: r.summary })),
  regressedFindings: regressed,
  newIssues: allNew,
  weakenedTests: weakened,
}
