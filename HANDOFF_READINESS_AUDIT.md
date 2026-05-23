# Diffgazer Handoff Readiness Audit

Date: 2026-05-22

This is a read-only handoff audit note. It includes the corrected threat model
for the Diffgazer embedded server and iterative subagent reconciliation passes.

## Executive Verdict

The project is not ready to hand to users as a complete public surface yet.

That is not because `cli/server` is a deployed public backend. It is not. It is
a local HTTP server bundled into the installable `diffgazer` app and started on
the user's machine.

The blockers are broader:

- hosted docs/registry/product domains are not live
- registry/docs origin is still the old `docs.diffgazer.b4r7.dev`
- docs UI renders old-host shadcn commands as available
- public copy/shadcn registry entries are incomplete for at least `menu`,
  `navigation-list`, and `code-block`, and broken for at least `stepper` and
  `horizontal-stepper`
- scoped npm packages are not published
- docs deployment mode is unresolved: pure static registry host vs TanStack
  Start/Nitro runtime
- local embedded API needs local-app hardening before public installable handoff
- local config/trust/secret persistence needs fail-closed/durable-save behavior
- provider setup and secret-storage copy contain user-facing correctness/security
  mismatches
- local runtime has additional lifecycle mismatches: TUI custom port, init
  before trust, and drilldown cancellation
- review cancellation and stream ownership have handoff-relevant gaps
- trust semantics diverge between CLI and web
- public registry/package smoke is representative, not exhaustive
- moderate production audit is not clean
- a few public UI contracts need cleanup before API freeze

## False Positive Guardrails

These points were explicitly rechecked to avoid overstating findings.

- The embedded server is not a public internet service.
- Do not require cloud auth, RBAC, OAuth, accounts, multi-user sessions, or
  cookie auth for this local app.
- A token injected into unauthenticated HTML is a browser-origin guard. It does
  not strongly protect against arbitrary same-user local processes, because
  those processes can fetch the HTML and read the token.
- CORS should not be described as "any arbitrary website can read the API".
  Non-localhost origins are denied. The real issue is broad localhost-origin
  access plus missing per-run API guard.
- TanStack Start/Nitro is not inherently wrong. The issue is that the deployment
  mode is undecided while docs are expected to be the stable registry host.
- Docs E2E is not absent from CI. It exists in release-readiness CI. It is absent
  from root local `verify` / `release-check` and from the publish workflow gate.
- `SOTA-AUDIT.md` claims about many unrelated dirty files are stale for this
  pass. Earlier reconciliation passes only showed the two untracked audit files;
  the current worktree also contains `DEPLOYMENT_PLAN.md`.
- The shutdown token is not "useless"; it protects `/api/shutdown`. The real
  issue is that other sensitive routes do not require a similar per-run guard.
- `generateStream` cancellation is not a current production review blocker. The
  review analysis path uses the non-streaming `generate(..., { signal })` API.
- The web home panel first-time trust path does not collapse session trust. The
  confirmed trust lifetime bug is the settings edit path for an existing
  session trust entry.
- TUI code not using `@diffgazer/ui` is a structural split, not a handoff bug.
- `lowlight` is mentioned in generated component docs. The real gap is
  README/governance/MDX docs and package smoke coverage for the optional peer.
- Generated docs under `libs/ui/docs/generated`, `libs/keys/docs/generated`,
  and `cli/add/src/generated` were not tracked in this pass. Treat
  `SOTA-AUDIT.md` claims about committed generated docs as stale unless a future
  `git ls-files` check proves otherwise.
- `SOTA-AUDIT.md` still contains executable examples for the old
  `docs.diffgazer.b4r7.dev` host. The chosen target in this audit is
  `docs.b4r7.dev`.
- `SOTA-AUDIT.md` treats top-level `b4r7.dev` hub work as P0 and gives concrete
  `apps/hub` / `apps/landing` / `@diffgazer/landing` scaffolding. That is not
  the target scope here. The required public product surface is
  `diffgazer.b4r7.dev`; a `b4r7.dev` hub is later IA work unless explicitly
  requested.
- `DEPLOYMENT_PLAN.md` is also untracked and conflicts with this handoff target:
  it introduces `r.b4r7.dev`, four services, and `apps/hub` / `apps/landing`
  scaffolding. Do not execute it alongside this audit without first reconciling
  the routing decision.
- `SOTA-AUDIT.md` contains stale "PASS/ready" wording for `dgadd` and build
  bundling. Treat readiness as partial until the listed exceptions are fixed.

## Embedded Server Threat Model

`cli/server` is an internal server bundled into the installable `diffgazer` app.
Evaluate it as a local app surface, not as a hosted backend.

Trusted:

- the `diffgazer` process
- the same-origin embedded web UI it serves
- the user operating the app

Untrusted:

- arbitrary browser origins
- other localhost apps
- other local processes
- LAN clients if the server listens on a non-loopback interface

Sensitive capabilities:

- reading repository status/diffs/context
- saving trust decisions
- configuring provider credentials
- starting review work
- deleting stored reviews
- shutting down the app

An arbitrary local OS process running as the same user can often read the same
repo/config files directly, so the goal is not a perfect anti-local-malware
boundary. The right goal is:

- do not accidentally expose the server on the LAN
- prevent unrelated browser origins from driving sensitive API routes
- keep packaged-mode API scope tied to the launched project
- keep trust records server-derived and validated against the resolved project

## Embedded Server Findings

### High: Packaged Server Does Not Bind Explicitly To Loopback

`cli/diffgazer/src/lib/servers/embedded-server.ts` starts the server with:

```ts
serve({ fetch: app.fetch, port: config.port }, ...)
```

`@hono/node-server` passes `options.hostname` to `server.listen`. With no
hostname, Node accepts connections on the unspecified IPv6 address `::` when
available, or `0.0.0.0` otherwise. Node also documents that `::` may also listen
on `0.0.0.0` on many systems.

The dev server already defaults to `127.0.0.1`. The packaged embedded server
should do the same.

Fix:

- add a packaged embedded hostname constant, probably `127.0.0.1`
- call `serve({ fetch: app.fetch, port: config.port, hostname })`
- report/open that same address consistently
- add a test that asserts the hostname is passed

### Medium: Packaged Server Startup Does Not Handle Listen Errors

`createEmbeddedServer()` wraps `serve(...)` in a `try/catch`, but listen errors
such as `EADDRINUSE` are emitted asynchronously by the returned server, not
thrown synchronously. No `server.once("error")` handler is attached. The dev
server has explicit listen-error handling and tests; the packaged embedded
server does not.

Confirmed references:

- `cli/diffgazer/src/lib/servers/embedded-server.ts`
- `cli/diffgazer/src/lib/servers/server-factories.ts`
- dev-server contrast: `cli/server/src/dev-server.ts`
- dev-server test: `cli/server/src/dev-server.test.ts`

Impact: a busy port or bind failure can crash or fail without an actionable
recovery path in the installable app.

Fix:

- attach an error handler to the embedded server
- reuse the dev server listen-error formatting/recovery behavior where possible
- add a packaged embedded server test for `EADDRINUSE`

### Medium Alone / High In Combination: Broad Localhost CORS In Packaged Mode

`cli/server/src/app.ts` allows any `http://localhost:*` and
`http://127.0.0.1:*` origin for `/api/*`.

That is useful for Vite dev on a separate port. The packaged web UI is
same-origin with the API, so broad localhost CORS is not needed in packaged
mode.

By itself, this is medium. Combined with missing API token checks and
client-supplied project root, it becomes part of a high-risk local API chain.

Fix:

- keep broad localhost CORS behind explicit dev mode
- in packaged mode, prefer same-origin only
- if cross-origin is required, allow only the launcher-selected origin/port

### High: Sensitive API Routes Do Not Require A Per-Run Browser-Origin Guard

The shutdown token is generated strongly and validated for `/api/shutdown`, but
the rest of the sensitive API is mounted without that guard:

- `/api/settings`
- `/api/config`
- `/api/git`
- `/api/review`

Fix:

- rename the concept from "shutdown token" to a broader per-run API token, or
  introduce `DIFFGAZER_API_TOKEN`
- require it for state-changing and repo-reading endpoints
- optionally leave `/api/health` and the initial HTML unauthenticated
- keep the limitation explicit: HTML-injected token guards browser origins, not
  arbitrary same-user local processes

If a stronger local-process boundary is desired, deliver the token out of band,
for example via a launcher-opened URL fragment or another mechanism not returned
by unauthenticated HTML.

### High: CORS-Denied Simple Requests Can Still Trigger Local Side Effects

The CORS middleware withholds `Access-Control-Allow-Origin` from disallowed
origins, but it does not reject the request before handlers run. Some `POST`
routes use JSON validators and all-optional schemas, so a non-localhost page can
send a simple `text/plain`/form-style request that reaches the handler as `{}`.

Confirmed references:

- `cli/server/src/app.ts`
- `cli/server/src/features/review/router.ts`
- `cli/server/src/features/review/schemas.ts`
- `cli/server/src/features/review/review-routes.ts`
- `cli/server/src/features/review/context-routes.ts`
- `cli/server/src/features/review/context.ts`
- `cli/server/src/features/config/schemas.ts`
- `cli/server/src/features/config/service.ts`
- `cli/server/src/shared/lib/config/store.ts`

Impact: a CORS-denied origin may not read responses, but it can still trigger
local side effects such as default review creation, context refresh writes, or
provider activation when an existing model is present.

Fix:

- require the planned per-run API token on review/config/context routes
- reject unsafe methods unless `Content-Type` is JSON where JSON validation is
  expected
- add regression tests for disallowed-origin simple `POST` requests with
  `text/plain` and form content types

### High: Packaged API Honors Client-Supplied Project Root

The embedded server sets `DIFFGAZER_PROJECT_ROOT`, but request handling prefers
the `x-diffgazer-project-root` header. CORS also allows that header.

In packaged mode, that lets any API caller that passes the guard retarget
repo/context operations to other paths under the user's home directory or other
`.git` roots.

Fix:

- in packaged mode, ignore `x-diffgazer-project-root`
- use the launcher-set project root as the authority
- keep the header only for explicit dev/test mode

### High: Packaged Project Root Can Be A Subdirectory While Git Reads The Whole Repo

Packaged mode passes raw `process.cwd()` to the embedded server, and
`resolveProjectRoot()` returns `DIFFGAZER_PROJECT_ROOT` without walking it to the
Git root. Git commands run from that subdirectory, but `git status` / `git diff`
still inspect the enclosing repository.

Confirmed references:

- `cli/diffgazer/src/lib/servers/server-factories.ts`
- `cli/diffgazer/src/lib/servers/embedded-server.ts`
- `cli/server/src/shared/lib/paths.ts`
- `cli/server/src/shared/lib/git/service.ts`

Impact: launching from `repo/packages/foo` can make the trust UI appear scoped
to that subproject while review and Git endpoints can read sibling/parent repo
changes. This is separate from the client-supplied root header issue because the
launcher itself supplies this root.

Fix:

- normalize packaged launch roots to the resolved Git root before trust/project
  identity creation
- display the actual trusted/reviewed root in UI
- add tests for launching from a nested package directory

### High: Project Identity Resolution Writes State Before Trust Is Granted

The unguarded init route calls `getProjectInfo`, which calls
`readOrCreateProjectFile` and writes `<project>/.diffgazer/project.json`.
The issue is broader than `/api/config/init`: `requireSetup` and
`requireRepoAccess` also call `getProjectInfo` before trust is granted, and git
routes use that guard.

Confirmed references:

- `cli/server/src/features/config/router.ts`
- `cli/server/src/features/config/service.ts`
- `cli/server/src/shared/middlewares/setup-guard.ts`
- `cli/server/src/shared/middlewares/trust-guard.ts`
- `cli/server/src/features/git/router.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/config/state.ts`
- `apps/web/src/app/providers/config-provider.tsx`

Impact: trust UI communicates that repo access/mutation is permissioned, but the
local server can create project identity state before trust exists.

Fix:

- make project identity resolution read-only/transient before trust, not only
  `/api/config/init`
- explicitly scope any pre-trust write as a prompted/accepted bootstrap action
- derive transient project identity without writing until trust is granted
- add regression tests that first page load, git routes, setup guard, and trust
  guard do not mutate an untrusted repo

### Medium: Project-Local `.diffgazer` Artifacts Can Enter Git Status And Review Input

Project identity and context snapshots are written inside the worktree under
`.diffgazer/`. Internal paths are filtered from `getStatusHash()`, but not from
user-visible status or `git diff`.

Confirmed references:

- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/features/review/context.ts`
- `cli/server/src/shared/lib/git/service.ts`

Impact: in repositories that do not already ignore `.diffgazer/`, Diffgazer's
own project id, absolute repo root, and context snapshots can appear in Git
status, be accidentally committed, or be sent to AI if staged.

Fix:

- keep project-local artifacts out of user-visible Git/review inputs
- create or prompt for an ignore entry if project-local state remains the
  storage contract
- add tests where `.diffgazer/*` is unignored and staged

### High: Git Read Paths Can Execute Configured Local Commands

Local trust separates repository read access from `runCommands`, but current
Git "read" paths invoke Git without suppressing configured command helpers.
`git diff` is called without `--no-ext-diff` / `--no-textconv`, and
`git status` is called without disabling fsmonitor/optional lock side effects.

Confirmed references:

- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/features/git/router.ts`
- `cli/server/src/features/review/diff.ts`
- `cli/server/src/features/review/service.ts`
- `libs/core/src/schemas/config/trust-capabilities-model.ts`

Impact: granting only repository read/git metadata access can still execute local
repo/global Git-configured commands on the user's machine. This is local-app
hardening, not a public deployment issue.

Fix:

- centralize Git execution through a hardened runner
- use `git --no-optional-locks -c core.fsmonitor=false status ...`
- use `git diff --no-ext-diff --no-textconv --no-color ...`
- clear inherited Git external-diff/pager env where appropriate
- add regression tests for external diff drivers, textconv, and fsmonitor hooks

### High: Trust Identity Is Too Client-Authoritative

`/api/settings/trust` accepts a full client-supplied `TrustConfig`. A client can
obtain project identity from `/api/config/init`, save a trusted config, then
call repo/review endpoints that only check `readFiles`.

The second pass refined this finding: treat it as part of "server-owned project
identity", not as a cloud-auth issue.

Fix:

- do not accept `projectId`, `repoRoot`, `trustedAt`, or `trustMode` from the
  client as authority
- derive `projectId` and `repoRoot` server-side from the resolved project
- accept only the user's trust decision/capabilities
- validate persisted trust against the resolved repo root

### Medium: Persisted Trust Is Not Bound Back To Resolved Repo Root

The trust guard checks trust by project id and `readFiles`, but does not verify
that `trust.repoRoot` still matches the resolved request root.

Fix:

- require `trust.projectId` and `trust.repoRoot` to match the current resolved
  project
- fail closed if the project file id and trust record disagree

### Medium: Trust Read/List/Delete Are Global And ProjectId-Authoritative

The save path is already documented as too client-authoritative. The read/list
and delete paths have the same scope issue: settings routes read a
caller-supplied `projectId`, list every trusted project, or delete by
caller-supplied `projectId` without deriving the current launched project
server-side.

Confirmed references:

- `cli/server/src/features/settings/router.ts`
- `cli/server/src/features/settings/schemas.ts`
- `cli/server/src/shared/lib/config/store.ts`

Impact: even after adding a per-run local API token, a token-bearing local
client can enumerate trusted repo paths or revoke trust for unrelated projects
instead of staying scoped to the packaged launcher's resolved project.

Fix:

- derive current-project trust read/revoke from the server-resolved project
- remove or explicitly guard `/trust/list` as a global trusted-project manager
- add tests that trust read/delete cannot target unrelated project ids in
  packaged mode

### Medium Before Token Guard / Low After: Raw Internal Error Messages

`refreshContextHandler` returns raw `Error.message` via `getErrorMessage(error)`.

Fix:

- return generic client-facing errors
- log detailed filesystem/provider errors server-side

### Medium: Local Shutdown Can Signal A Stale Inherited PID

The CLI only sets `DIFFGAZER_CLI_PID` when it is absent. If a stale or malicious
value is inherited from the environment, the shutdown service trusts it and
sends `SIGTERM`.

Confirmed references:

- `cli/diffgazer/src/index.tsx`
- `cli/server/src/features/shutdown/service.ts`
- `cli/server/src/app.test.ts`

Impact: this is local embedded runtime process safety, not a deployed-backend
auth issue. It can still terminate the wrong local process if the PID env var is
inherited.

Fix:

- overwrite `DIFFGAZER_CLI_PID` with the current CLI process id in packaged runs
- bind shutdown state to the launcher-created process rather than arbitrary env
- add a test for inherited stale PID behavior

### High: Corrupt Local State Can Be Treated As Missing State

`readJsonFileSync` returns `null` for both absent files and parse/read failures.
Config, trust, secrets, and project-state loaders then treat `null` as absent
state/defaults.

Confirmed references:

- `cli/server/src/shared/lib/fs.ts`
- `cli/server/src/shared/lib/config/state.ts`

Impact: a corrupt local config/trust/secrets/project JSON file can silently load
as defaults, and a later save can replace the user's previous state. For trust
and provider config, that is too permissive for public handoff.

Fix:

- distinguish `ENOENT` from parse/validation/read errors
- fail closed or quarantine corrupt files
- surface a repair/reset action instead of silently defaulting
- add tests for corrupt trust, config, secrets, and project-state files

### Medium: Parseable But Schema-Invalid Local State Is Accepted Instead Of Failing Closed

`loadConfig`, `loadSecrets`, and `loadTrust` cast parsed JSON directly instead
of schema-validating it. Trust capabilities are normalized with `Boolean(...)`,
so string values such as `"false"` become `true` and can satisfy
`requireRepoAccess`.

Confirmed references:

- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/middlewares/trust-guard.ts`

Impact: a migrated, manually edited, or malformed but parseable local trust file
can silently grant repository-read trust. This is distinct from corrupt-file
handling because JSON parsing still succeeds.

Fix:

- validate persisted config, secrets, trust, and project files against schemas
- fail closed or quarantine invalid shapes
- treat non-boolean trust capabilities as invalid, not truthy
- add tests for string/object/unknown capability values

### High: Mutation APIs Can Report Saved Before Durable Persistence

`persistConfig`, `persistTrust`, and `persistFileSecrets` fire async writes and
only warn on failure. API handlers can return success before data is durably
written.

Confirmed references:

- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/features/settings/router.ts`
- `cli/server/src/features/config/router.ts`

Impact: settings, trust, and provider credential changes can appear saved in the
UI but be lost if the write fails.

Fix:

- await persistence before returning success
- serialize writes per file
- write from immutable snapshots
- propagate persistence failures to the client with a recoverable error

### High: Concurrent Embedded Instances Can Clobber Global Trust/Config/Secrets State

`createConfigStore()` loads config, secrets, and trust once per process, then
writes whole in-memory objects back later. There is no file lock, version check,
or reload/merge before persistence.

Confirmed references:

- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/fs.ts`

Impact: two local Diffgazer processes can lose each other's trust/config/secret
changes. More seriously, a stale process can re-persist a trust record that
another process revoked.

Fix:

- add per-file locking or optimistic mtime/version conflict detection for
  `config.json`, `trust.json`, and `secrets.json`
- merge project/provider maps before writing
- treat trust revocation conflicts as fail-closed

### Low: Allowed Path Cache Is A Secondary TOCTOU Risk

`allowedPathCache` is not the primary local API issue, and `SOTA-AUDIT.md`
overstates it. The material path issue is still client-supplied project root in
packaged mode.

If kept, document it narrowly: it caches checks for roots with `.git` children
and can become stale if the filesystem changes. Clear or avoid the cache for
security decisions after fixing packaged project-root authority.

## Trust Semantics Findings

### High: Web Settings Can Collapse Session Trust Into Persistent Trust

This is specifically the web settings edit path.

First-time trust in CLI and web defaults to persistent. The issue is editing an
existing session trust entry:

- the schema supports `trustMode: "session"`
- CLI settings preserves existing `session`
- web settings hardcodes `trustMode: "persistent"`

Impact: editing permissions in web can silently extend trust lifetime.

Fix:

- preserve `trust?.trustMode ?? "persistent"`
- add a regression test for existing session trust in web settings
- consider moving trust draft/save payload construction into shared core logic

### Medium: Session Trust Is Persisted And Enforced Like Persistent Trust

The schema supports `trustMode: "session"`, but server storage and enforcement
do not implement session lifetime. A saved session trust record survives process
reloads/restarts and authorizes repo access the same way as persistent trust.

Confirmed references:

- `libs/core/src/schemas/config/settings.ts`
- `cli/server/src/features/settings/router.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/middlewares/trust-guard.ts`

Fix:

- store session trust in process memory only, or persist it with a session id and
  invalidate it on restart
- make the trust guard check `trustMode`
- add tests for restart/session-boundary behavior

### Medium: Continue Without Trust Leaves History Navigable But Unauthorized

Saving a trust record with `readFiles: false` stops the trust prompt because the
project has a trust record, but `history` remains enabled in the main menu. The
history APIs still require repo access, so users can navigate to History and see
an API error instead of an intentional disabled/empty state.

Confirmed references:

- `apps/web/src/features/home/components/trust-panel.tsx`
- `libs/core/src/navigation/trust-status.ts`
- `libs/core/src/navigation/menu-disabling.ts`
- `libs/core/src/navigation/menu-disabling.test.ts`
- `apps/web/src/features/history/components/page.tsx`
- `cli/server/src/features/review/router.ts`

Impact: the "Continue Without Trust" path is a valid product path, but it leaves
History reachable even though the backing review list/read endpoints are blocked
by `requireRepoAccess`.

Fix:

- disable or reroute History when `readFiles` is not granted
- or make History render a trust-specific empty state before calling protected APIs
- update menu-disabling and History page tests for no-read trust records

### Medium: TUI First-Run Trust Can Persist Disabled `runCommands`

The shared trust capability model marks `runCommands` disabled and normalizes it
to `false`. The TUI first-run trust prompt renders its own enabled checkbox and
saves `runCommands: checked.includes("runCommands")`. Server trust-state loading
preserves that boolean instead of using the shared normalizer.

Confirmed references:

- `libs/core/src/schemas/config/trust-capabilities-model.ts`
- `cli/diffgazer/src/features/home/components/trust-panel.tsx`
- `cli/server/src/shared/lib/config/state.ts`

Impact: the local TUI can store a trust capability the shared product model says
is currently unavailable. Even if no route consumes it today, it creates a stale
permission record for future command-running work.

Fix:

- reuse shared trust capability options/normalizers in the TUI first-run prompt
- force `runCommands: false` at server save/load boundaries until the feature
  exists
- add a first-run TUI trust regression test

### High: TUI First-Run Trust Prompt Cannot Commit Trust

`TrustPanel` renders an active checkbox group, but the primary trust button does
not pass `isActive`. TUI buttons only register Enter while active, so users can
toggle capabilities but cannot keyboard-commit the advertised first-run trust
prompt.

Confirmed references:

- `cli/diffgazer/src/app/screens/home-screen.tsx`
- `cli/diffgazer/src/features/home/components/trust-panel.tsx`
- `cli/diffgazer/src/components/ui/button.tsx`
- `cli/diffgazer/src/components/ui/checkbox.tsx`

Fix:

- make one command in the trust prompt keyboard-active at a time
- add first-run TUI tests for accepting and continuing without trust
- cover disabled/saving states so Enter cannot double-submit

## Web App Product Findings

### Medium: Home/Help Keyboard Shortcut Contract Is Contradictory

Core menu metadata declares `h` for History and `?` for Help. The web home page
filters Help out of the main menu and wires `h` to Help. The Help page also
advertises review shortcuts that home does not wire directly.

Confirmed references:

- `libs/core/src/schemas/ui/navigation.ts`
- `apps/web/src/features/home/components/home-presentation.tsx`
- `apps/web/src/app/routes/help.tsx`

Impact: the keyboard-first local app ships stale shortcut semantics for History,
Help, and review-start workflows.

Fix:

- make core shortcut metadata, home handlers, footer copy, and Help content use
  one source of truth
- restore a reachable Help shortcut that does not conflict with History, or
  intentionally change the shared metadata
- add keyboard tests for home shortcuts and Help copy

### Medium: History Issue Drill-In Drops The Selected Issue

History exposes individual issues as selectable, but selecting an issue only
sets local `highlightedIssueId` and navigates to the review route with the
`reviewId`. The review route search schema has no `issueId`, and review issue
selection falls back to the first filtered issue.

Confirmed references:

- `apps/web/src/features/history/components/history-insights-pane.tsx`
- `apps/web/src/features/history/hooks/use-history-page.ts`
- `apps/web/src/app/router.tsx`
- `apps/web/src/features/review/hooks/use-issue-selection.ts`

Impact: History appears to support issue-level drill-in, including keyboard
selection, but users can land on a different issue in Review.

Fix:

- add an `issueId` route/search/state contract
- initialize Review selection from that issue id when present
- test history-to-review issue focus

### Medium: Web Review Esc/Back Bypasses The Safe Fallback

The global header uses `resolveBackAction()` and falls back to `/` when browser
history is unavailable. Review screens bypass that path: saved/live results bind
Escape directly to `router.history.back()`, and live summary passes
`router.history.back()` as its Back action while advertising `Esc Back`.

Confirmed references:

- `apps/web/src/components/layout/global-layout.tsx`
- `apps/web/src/lib/back-navigation.ts`
- `apps/web/src/features/review/hooks/use-review-results-keyboard.ts`
- `apps/web/src/features/review/components/page.tsx`
- `apps/web/src/features/review/components/review-summary-view.tsx`

Impact: a direct `/review/:id` load, refresh, or first-tab deep link can make the
main keyboard back path do nothing even though the header has a safe route.

Fix:

- route review-level Escape/back through the same safe back action
- or provide a review-local fallback to `/` when `useCanGoBack()` is false
- add focused tests for direct saved-review and live-summary Escape/back

### Medium: Live Activity Log Is Not Exposed As A Live Log Region

The progress view labels a pane "Live Activity Log", but `ActivityLog` renders
an unlabeled `ScrollArea` without `role="log"`, `aria-live`, or
`aria-relevant`. `ScrollArea` only becomes a named keyboard-scrollable region
when it receives an accessible name.

Confirmed references:

- `apps/web/src/features/review/components/review-progress-view.tsx`
- `apps/web/src/features/review/components/activity-log.tsx`
- `libs/ui/registry/ui/scroll-area/scroll-area.tsx`

Impact: screen-reader users may miss streaming review events, and keyboard users
do not get a reliable focusable log region.

Fix:

- label the activity log from the visible heading
- expose appropriate live/log semantics for streaming entries
- add progress-view accessibility tests

### Medium: Light Theme Makes The Global Footer Nearly Unreadable

The global footer uses `bg-tui-fg text-black`. In the light theme,
`--tui-fg` is a dark foreground color, producing black text on a dark background.

Confirmed references:

- `apps/web/src/components/layout/footer.tsx`
- `apps/web/src/styles/theme-overrides.css`
- `apps/web/src/features/settings/components/theme/page.tsx`
- `apps/web/src/app/providers/theme-provider.tsx`

Impact: global shortcut guidance can become inaccessible in light mode across
home, history, review, settings, and provider flows.

Fix:

- use token pairs that preserve contrast in both themes
- add a light-theme visual/a11y assertion for the global footer

### Medium: Theme Settings Save Can Silently Fail After Navigation

The web theme provider updates local state/localStorage and calls
`saveSettings.mutate` without awaiting or handling errors. The theme settings
page immediately navigates back after calling `setTheme`, unlike settings pages
that await `mutateAsync` and surface errors.

Confirmed references:

- `apps/web/src/app/providers/theme-provider.tsx`
- `apps/web/src/features/settings/components/theme/page.tsx`
- `apps/web/src/features/settings/components/storage/page.tsx`

Impact: the UI can imply theme persistence even when the server save fails,
leaving local and durable settings split.

Fix:

- make theme persistence awaitable or report local-only fallback clearly
- keep saving/error state visible until the durable save resolves
- add a failed theme-save regression test

### Low/Medium: Core Product Panes Lack Narrow-Viewport Fallback

The app shell prevents natural page overflow, while providers, history, review
progress/results, and theme settings use fixed side-by-side pane layouts.

Confirmed references:

- `apps/web/src/components/layout/global-layout.tsx`
- `apps/web/src/features/providers/components/page.tsx`
- `apps/web/src/features/history/components/page.tsx`
- `apps/web/src/features/review/components/review-progress-view.tsx`
- `apps/web/src/features/review/components/issue-list-pane.tsx`
- `apps/web/src/features/settings/components/theme/page.tsx`

Impact: small windows and mobile-sized viewports can squeeze or truncate primary
local-app workflows without a coherent fallback.

Fix:

- add responsive pane behavior, tabs, drawers, or documented minimum viewport
- test provider/history/review/settings flows at narrow widths

### Medium: Settings Saves Can Be Escaped While Pending

Non-theme web settings pages disable visible Cancel/Save controls during saving,
but their global Escape handlers remain active. TUI storage/analysis/agent
execution settings have the same shape: `useBackHandler()` defaults active while
the save mutation is pending.

Confirmed references:

- `apps/web/src/features/settings/components/storage/page.tsx`
- `apps/web/src/features/settings/components/analysis/page.tsx`
- `apps/web/src/features/settings/components/agent-execution/page.tsx`
- `libs/keys/src/hooks/use-key.ts`
- `cli/diffgazer/src/hooks/use-back-handler.ts`
- `cli/diffgazer/src/app/screens/settings/storage-screen.tsx`
- `cli/diffgazer/src/app/screens/settings/analysis-screen.tsx`
- `cli/diffgazer/src/app/screens/settings/agent-execution-screen.tsx`

Impact: users can leave the settings screen while save failure feedback is still
pending, even though visible controls imply navigation is blocked during save.

Fix:

- disable Escape/back handlers while save mutations are pending
- or keep pending/error state visible after navigation
- add web and TUI tests for save-pending Escape/back behavior

### Medium: TUI Settings Back Stack Can Resurrect Stale Screens From Home

The TUI navigation stack pushes the current route on every `navigate()`, but
deterministic `goBack()` targets do not pop or clear that stack. After returning
from nested settings screens to Home, `canGoBack` can remain true and Escape on
Home can jump back to stale settings.

Confirmed references:

- `cli/diffgazer/src/app/navigation-context.tsx`
- `cli/diffgazer/src/app/screens/home-screen.tsx`
- `cli/diffgazer/src/hooks/use-back-handler.ts`

Fix:

- clear or pop stack entries when `goBack()` uses deterministic route targets
- make Home a stack boundary for settings flows
- add navigation tests for `home -> settings -> settings/theme -> Esc -> Esc`

### Medium: TUI History Search Footer Advertises Unwired Controls

The History search footer advertises `↓ Timeline` and `Esc Clear Search`, but
the screen has no active search-zone handler for either key. The controlled input
handles text editing only, while the global back handler stays active, so Escape
backs out instead of clearing search.

Confirmed references:

- `cli/diffgazer/src/features/history/hooks/get-history-footer.ts`
- `cli/diffgazer/src/app/screens/history-screen.tsx`
- `cli/diffgazer/src/components/ui/input.tsx`

Fix:

- wire Escape to clear search while the search zone is active
- wire ArrowDown to move focus to the timeline
- prevent the global back handler from stealing search-zone Escape
- add TUI History keyboard tests for search focus

### High: TUI Settings Diagnostics Starts With No Reachable Active Action

`DiagnosticsScreen` uses `useSettingsZone()` for a button-only screen. That hook
starts in `"list"` and only hidden Tab behavior enters `"buttons"`; arrow keys
work only after that. The diagnostics footer advertises `←/→` and Enter, but not
Tab, so the visible actions are inert on entry unless the user guesses the
transition.

Confirmed references:

- `cli/diffgazer/src/app/screens/settings/diagnostics-screen.tsx`
- `cli/diffgazer/src/hooks/use-settings-zone.ts`

Fix:

- start button-only settings screens in the button zone
- or advertise and test Tab as the required zone transition
- add diagnostics keyboard tests for initial Enter/Arrow behavior

### High: TUI Review Details Can Go Blank After Leaving The Patch Tab

The review footer advertises `1-4` tab shortcuts, and `useReviewKeyboard`
supports `onTabSwitch`, but `ReviewResultsView` never passes that callback.
Separately, `IssueDetailsPane` uses uncontrolled `Tabs defaultValue="details"`
while conditionally removing the Patch tab/content. If the internal active tab
remains `"patch"` and the next selected issue has no `suggested_patch`, no tab
content renders.

Confirmed references:

- `cli/diffgazer/src/features/review/components/review-results-view.tsx`
- `cli/diffgazer/src/features/review/hooks/use-review-keyboard.ts`
- `cli/diffgazer/src/features/review/components/issue-details-pane.tsx`
- `cli/diffgazer/src/components/ui/tabs.tsx`

Fix:

- wire number shortcuts to tab selection or remove them from footer copy
- reset/derive active tab when the selected issue changes and Patch is absent
- add TUI review tests for switching from a patched issue to a non-patched issue

### Medium: TUI Review Renders Keyboard-Inert Fix Plan And Agent Filter Controls

`FixPlanChecklist` and `AgentFilterBar` both implement `useInput` behind an
`isActive` prop, but their parents never pass an active state. The UI renders
checkbox-like fix-plan rows and agent filter chips whose state handlers exist
but are unreachable by keyboard.

Confirmed references:

- `cli/diffgazer/src/features/review/components/fix-plan-checklist.tsx`
- `cli/diffgazer/src/features/review/components/issue-details-pane.tsx`
- `cli/diffgazer/src/features/review/components/review-results-view.tsx`
- `cli/diffgazer/src/features/review/components/agent-filter-bar.tsx`
- `cli/diffgazer/src/features/review/components/review-progress-view.tsx`

Fix:

- add explicit focus ownership for fix-plan rows and agent filters
- pass `isActive` only to the focused interactive group
- or render them as non-interactive summaries until they are wired

### Medium: TUI Review Severity Filters And Issue Navigation Both Handle `j/k`

When the review issue pane is in its local `"filter"` subzone, `IssueListPane`
handles `j`/Down to leave the filter row. The parent `ReviewResultsView` still
keeps `useReviewKeyboard()` active and treats the same `j/k` keys as issue
navigation for the whole list zone.

Confirmed references:

- `cli/diffgazer/src/features/review/components/issue-list-pane.tsx`
- `cli/diffgazer/src/features/review/components/review-results-view.tsx`
- `cli/diffgazer/src/features/review/hooks/use-review-keyboard.ts`

Impact: trying to move between the filter row and issue list can also move the
selected issue.

Fix:

- lift the filter subzone into the parent review keyboard model
- or disable parent issue navigation while the filter row is active
- add an Ink test for `k` into filters, then `j` back without changing the
  selected issue

### Medium: TUI Global Shortcuts Can Escape First-Run Onboarding And Double-Handle Menu Hotkeys

The root TUI registers global `q`/`s`/`?` shortcuts through its keyboard
provider, while many TUI controls use direct Ink `useInput`. Ink input handlers
do not stop propagation between hooks, so Home hotkeys can trigger both menu and
global actions. The same global shortcuts also remain active during forced
onboarding.

Confirmed references:

- `cli/diffgazer/src/app/index.tsx`
- `cli/diffgazer/src/components/ui/menu.tsx`
- `cli/diffgazer/src/hooks/use-config-guard.ts`

Impact: first-run terminal users can navigate out of setup with unsaved wizard
state, and regular Home hotkeys can double-handle the same key event.

Fix:

- gate global shortcuts by route and config/onboarding state
- route Home hotkeys through one input owner
- add Ink tests for forced onboarding and Home shortcut dispatch

### Medium: TUI Server Retry Key Can Produce An Unhandled Failed Promise

The disconnected screen advertises `r` retry and calls `void retry()`. That retry
function returns a React Query refetch with `throwOnError: true`, so a still-down
server can reject from the only recovery key path without a catch.

Confirmed references:

- `cli/diffgazer/src/app/index.tsx`
- `libs/core/src/api/hooks/server.ts`

Fix:

- do not throw from the disconnected-screen retry path
- or catch the rejection in `HealthGate` and let query state render the error
- add a retry-while-server-down TUI test

### Medium: TUI Review Activity Log Is Neither A Tail Nor Keyboard-Scrollable

The progress pane labels the log as `tail -f agent.log`, but it renders
`ActivityLog` without `isActive`. The shared TUI `ScrollArea` only scrolls while
active, so long reviews can show the oldest entries with no keyboard path to the
live tail.

Confirmed references:

- `cli/diffgazer/src/features/review/components/review-progress-view.tsx`
- `cli/diffgazer/src/features/review/components/activity-log.tsx`
- `cli/diffgazer/src/components/ui/scroll-area.tsx`

Fix:

- add an explicit log focus zone with footer shortcuts
- or auto-tail the progress log while streaming
- add long-review log behavior coverage

### Medium: Shared TUI `ScrollArea` Can Blank Panes After Content Shrinks

The TUI `ScrollArea` keeps `scrollOffset` but does not clamp or reset it when
children or height changes. If a user scrolls a long panel and then navigates to
shorter content, the slice can start beyond the new content length.

Confirmed references:

- `cli/diffgazer/src/components/ui/scroll-area.tsx`
- `cli/diffgazer/src/features/history/components/history-insights-pane.tsx`
- `cli/diffgazer/src/features/review/components/issue-details-pane.tsx`

Impact: history insights or review details can appear empty after navigation.
This is distinct from the already-recorded patch-tab blank state.

Fix:

- clamp `scrollOffset` to the current maximum offset
- or reset/key scroll regions by content identity when panes change
- add tests for navigating from long to short scroll content

### High: TUI Onboarding Navigation Can Fire Back And Next Together

On non-first onboarding steps, both Back and Next/Complete buttons receive the
same active nav state. Each active TUI `Button` subscribes to Enter
independently, so one Enter key can invoke both handlers.

Confirmed references:

- `cli/diffgazer/src/features/onboarding/components/onboarding-wizard.tsx`
- `cli/diffgazer/src/components/ui/button.tsx`

Impact: first-run terminal setup navigation can cancel its own step movement, or
Complete can run while Back also fires.

Fix:

- model nav as an indexed action row with exactly one active button
- add tests for Enter on Back, Next, and Complete from each step

## Provider Config And Secrets Findings

### High: Env Credential Paths Store Sentinel Or Env Var Name As The API Key

The onboarding payload stores `apiKey: "env"` when the user selects environment
variable import. Provider settings have separate web/TUI paths that persist the
environment variable name itself as `apiKey`; the input method is discarded.
Provider credential storage then saves those strings, and the AI runtime reads
them back as the provider API key.

Confirmed references:

- `apps/web/src/components/shared/api-key-method-selector.tsx`
- `cli/diffgazer/src/features/providers/components/api-key-method-selector.tsx`
- `libs/core/src/onboarding/save-wizard.ts`
- `apps/web/src/features/onboarding/hooks/use-onboarding.ts`
- `apps/web/src/features/providers/hooks/use-api-key-form.ts`
- `apps/web/src/features/providers/components/page.tsx`
- `apps/web/src/features/providers/hooks/use-provider-management.ts`
- `apps/web/src/app/providers/config-provider.tsx`
- `cli/diffgazer/src/features/providers/components/api-key-overlay.tsx`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/ai/client.ts`

Impact: public setup can report provider configuration as complete while runtime
requests use `"env"` or the env var name itself as the credential instead of
reading the configured environment variable.

Fix:

- represent env-based credentials explicitly, for example `{ source: "env",
  envVarName }`
- resolve the environment variable server-side at use time
- do not persist `"env"` or env var names as secret values
- add web/TUI onboarding, provider-settings, and runtime provider tests

### High: Web Provider API-Key Dialog Can Carry An Unsubmitted Key Across Providers

`useApiKeyForm()` keeps `method` and `keyValue` state until successful submit.
`ProvidersPage` reuses one `ApiKeyDialog` as `selectedProvider` changes. A user
can type one provider's key, cancel, switch providers, reopen the dialog, and
save that stale value to the wrong provider.

Confirmed references:

- `apps/web/src/features/providers/hooks/use-api-key-form.ts`
- `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx`
- `apps/web/src/features/providers/components/page.tsx`
- related TUI state shape:
  `cli/diffgazer/src/features/providers/components/api-key-overlay.tsx`

Impact: one provider's credential can be persisted under another provider and
later disclosed to the wrong external API at runtime.

Fix:

- reset API-key form state when the provider or dialog open state changes
- key the dialog by provider id or move form state inside the provider-specific
  overlay lifecycle
- add web provider-switch/cancel/save tests

### Medium: Setup Readiness Can Be True Without A Usable API Key

`getSetupStatus()` derives `isConfigured` from secrets storage, active provider,
model, and trust state, but does not verify that `getProviderApiKey()` returns a
usable key. Web guards and the server setup guard consume that weaker status;
the AI runtime then fails later with `API_KEY_MISSING`.

Confirmed references:

- `cli/server/src/features/config/service.ts`
- `libs/core/src/schemas/config/providers.ts`
- `apps/web/src/lib/config-guards.ts`
- `apps/web/src/app/providers/config-provider.tsx`
- `cli/server/src/shared/middlewares/setup-guard.ts`
- `cli/server/src/shared/lib/ai/client.ts`
- test gap: `cli/server/src/features/config/service.test.ts`

Impact: routes/UI can proceed as configured even though the active provider has
no retrievable credential, producing a later review-time failure instead of a
setup-time correction.

Fix:

- make setup readiness check the active provider secret can be read
- distinguish missing key from keyring/read errors
- add tests for active provider with missing file/keyring secret

### High: Model Selection Can Activate A Provider With No API Key

Provider activation validates that a model is selected, but not that the
provider has credentials. Web and TUI model selection can therefore activate a
static provider before an API key exists.

Confirmed references:

- `cli/server/src/features/config/service.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/config/providers-state.ts`
- `apps/web/src/features/providers/components/provider-details.tsx`
- `apps/web/src/features/providers/hooks/use-provider-management.ts`
- `cli/diffgazer/src/features/providers/components/provider-details.tsx`
- `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`

Impact: users can create a state where setup looks configured while review
runtime still fails on a missing API key. This is a concrete path into the
readiness mismatch documented below.

Fix:

- refuse activation when the target provider has no resolvable key
- or split "selected model" from "active provider" until credentials exist
- add server, web, and TUI tests for selecting a model before storing a key

### Medium: Readiness Checks Disagree Across Web, TUI, And Server

The server setup guard uses `getSetupStatus().isReady`, while web and TUI guard
paths also use config-check/init data flows. A partial config can be considered
configured by one surface while review endpoints still reject it for missing
trust, model, secrets storage, or readable key.

Confirmed references:

- `cli/server/src/features/config/service.ts`
- `apps/web/src/lib/config-guards.ts`
- `cli/diffgazer/src/hooks/use-config-guard.ts`
- `cli/diffgazer/src/features/review/hooks/use-review-lifecycle.ts`
- `cli/server/src/shared/middlewares/setup-guard.ts`

Impact: users can be routed out of guided onboarding but still hit
setup-required review failures later, with different messages per surface.

Fix:

- make one shared readiness contract drive web, TUI, and server route guards
- separate "configured", "trusted", and "review-ready" states in copy/UI
- add cross-surface tests for partial config states

### Medium: Provider/Model Compatibility Is Bypassed By Config APIs

`UserConfigSchema` defines provider/model compatibility rules: Gemini models must
be Gemini models, Z.AI providers must use GLM models, and OpenRouter accepts
arbitrary model ids. The save and activate API schemas only require a non-empty
model string, and the service/store persist or activate that model without
reusing the compatibility check.

Confirmed references:

- `libs/core/src/schemas/config/providers.ts`
- `libs/core/src/schemas/config/providers.test.ts`
- `cli/server/src/features/config/schemas.ts`
- `cli/server/src/features/config/service.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/features/config/service.test.ts`

Impact: an invalid provider/model pair can be saved as active config and fail
later at provider runtime, despite a shared schema already declaring the pair
invalid.

Fix:

- expose/reuse the compatibility validator in save and activate paths
- keep OpenRouter as the explicit arbitrary-model exception
- add route/service tests for invalid Gemini/Z.AI model combinations

### Medium: Whitespace-Only API Keys And Model IDs Can Be Saved As Configured

Onboarding, provider settings, and config API schemas check string length but do
not trim or reject whitespace-only API keys/model ids. The AI client only checks
truthiness of `apiKey`, so whitespace survives until provider calls fail.

Confirmed references:

- `libs/core/src/onboarding/can-proceed.ts`
- `libs/core/src/onboarding/save-wizard.ts`
- `apps/web/src/features/providers/hooks/use-api-key-form.ts`
- `cli/diffgazer/src/features/providers/components/api-key-overlay.tsx`
- `libs/core/src/schemas/config/providers.ts`
- `cli/server/src/features/config/schemas.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/ai/client.ts`

Impact: onboarding/settings can report success while persisting an
operationally invalid key or model string. This is separate from the env
credential sentinel issue.

Fix:

- trim and validate API keys/model ids at schema boundaries
- preserve intentional OpenRouter custom-model flexibility while rejecting blank
  model ids
- add web, TUI, and API tests for whitespace-only values

### High: First-Time OpenRouter Onboarding Is Deadlocked

OpenRouter has no default model. Provider selection therefore clears the wizard
model to `null`, and the model step cannot proceed until a model is selected.
However, OpenRouter model loading requires an already-saved OpenRouter API key,
while onboarding saves provider credentials only at completion after the model
step.

Confirmed references:

- `libs/core/src/schemas/config/providers.ts`
- `apps/web/src/features/onboarding/hooks/use-onboarding.ts`
- `libs/core/src/onboarding/use-wizard-state.ts`
- `libs/core/src/onboarding/can-proceed.ts`
- `cli/server/src/features/config/service.ts`
- `apps/web/src/features/onboarding/components/steps/model-step.tsx`
- `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx`
- `libs/core/src/onboarding/save-wizard.ts`

Impact: first-time OpenRouter setup can block in both embedded web and TUI
because model selection depends on a credential that the wizard has not saved
yet.

Fix:

- allow temporary model fetching with the API key entered in the wizard
- or persist/validate OpenRouter credentials before the model step and clean up on
  cancellation
- or provide a manual model-id entry path that can complete without fetching
  provider models
- add web and TUI onboarding tests for first-time OpenRouter setup

### Medium: OpenRouter Model Cache Can Mask Invalid Credentials

OpenRouter model fetching uses a global model cache. When cache is warm,
`getOpenRouterModelsWithCache` can return cached models before proving the
current API key is still valid. Without cache, invalid credential failures are
returned through the config route as a generic internal error.

Confirmed references:

- `cli/server/src/shared/lib/ai/openrouter-models.ts`
- `cli/server/src/features/config/service.ts`
- `cli/server/src/features/config/router.ts`
- `libs/core/src/providers/use-openrouter-models-mapped.ts`
- `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx`

Impact: a stale cached model list can make an invalid or revoked OpenRouter key
look usable through model selection, then fail later at review runtime.

Fix:

- validate credentials when changing/saving OpenRouter keys, not only when cache
  misses
- distinguish invalid-key errors from generic internal model-load failures
- add tests for warm-cache invalid credentials

### Medium: OpenRouter Compatibility Filtering Fails Open When Metadata Is Absent

`useOpenRouterModelsMapped()` filters by `supportedParameters` only when at
least one model has parameter metadata. If no returned or cached model includes
that metadata, every model is treated as compatible. Existing tests lock this in
as current behavior.

Confirmed references:

- `libs/core/src/providers/use-openrouter-models-mapped.ts`
- `libs/core/src/providers/use-openrouter-models-mapped.test.ts`
- `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx`
- `apps/web/src/features/onboarding/components/steps/model-step.tsx`
- `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`

Impact: web onboarding, web provider settings, and TUI provider settings can
show unsupported OpenRouter models if provider/cache metadata lacks
`supported_parameters`, then fail later when structured output is required.
This is distinct from the TUI onboarding raw-list bypass.

Fix:

- treat missing compatibility metadata as unknown/unsupported for structured
  output paths, or require explicit user override
- surface "metadata unavailable" separately from compatible/incompatible
- update tests that currently expect fail-open filtering

### Medium: OpenRouter Structured-Output Compatibility Is Not Enforced At Runtime

Web and TUI filter/label OpenRouter models as structured-output compatible, but
the server creates the runtime model with plain `openrouter.chat(modelId)` and
then calls `generateObject()` with a schema. OpenRouter routing can send
requests to providers that ignore unsupported parameters unless parameter
requirements are enforced.

Confirmed references:

- `cli/server/src/shared/lib/ai/client.ts`
- OpenRouter provider routing docs:
  `https://openrouter.ai/docs/guides/routing/provider-selection`
- OpenRouter AI SDK provider docs:
  `https://github.com/OpenRouterTeam/ai-sdk-provider`

Impact: a model can pass Diffgazer's selection UI yet route to an endpoint that
ignores structured-output parameters and fails later during review generation.

Fix:

- pass OpenRouter routing/provider options for structured-output review calls,
  especially `require_parameters: true`
- test the OpenRouter model factory/runtime options

### Medium: Custom OpenRouter Model IDs Can Be Silently Overwritten

Web can save a custom OpenRouter model id, but reopening the model dialog and
confirming only preserves ids present in the fetched/filtered list; otherwise it
falls back to the first listed model. The TUI overlay has the same preservation
gap if a custom model already exists in config.

Confirmed references:

- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`

Fix:

- preserve existing/custom OpenRouter ids even when they are not in the fetched
  list
- require explicit user selection before replacing a custom model id
- add web and TUI tests for reopening model selection with custom ids

### Medium: OpenRouter Model Search And Display Ignore Exact Model IDs

OpenRouter's model API uses `id` as the selectable runtime identifier, but the
shared model filter searches only name and description. Web and TUI model lists
also render the name/description without the exact id, while using the id as the
selected value.

Confirmed references:

- `libs/core/src/providers/models.ts`
- `apps/web/src/features/providers/components/model-select-dialog/model-list-item.tsx`
- `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`
- `cli/diffgazer/src/features/providers/components/model-list-item.tsx`

Impact: users searching by the documented/runtime OpenRouter model id can get
no result, and similarly named models can be hard to distinguish before public
handoff.

Fix:

- include `model.id` in shared filtering
- render the exact id as secondary metadata in web and TUI lists
- add shared filter plus web/TUI behavior tests for id search

### Medium: OpenRouter Model Fetch Can Throw Past Its Result Contract

`fetchOpenRouterModels()` wraps the network request, but not JSON parsing.
`getOpenRouterModelsWithCache()` also writes cache data synchronously after a
successful fetch without converting write failures into the declared `Result`
error contract.

Confirmed references:

- `cli/server/src/shared/lib/ai/openrouter-models.ts`
- `cli/server/src/features/config/service.ts`
- `cli/server/src/app.ts`

Impact: malformed provider responses become generic server 500s, and a cache
write failure can discard an otherwise successful model fetch.

Fix:

- wrap JSON parsing and cache persistence inside structured `Result` errors
- return fetched models even when cache persistence fails, with a warning if
  needed
- add tests for invalid JSON and unwritable cache paths

### Medium: Onboarding Completion Is Non-Atomic Across Settings And Provider Config

Onboarding saves settings before provider config. If provider save fails after
settings/storage migration succeeds, first-run setup leaves durable settings
changed while provider configuration remains incomplete.

Confirmed references:

- `libs/core/src/onboarding/save-wizard.ts`
- `apps/web/src/features/onboarding/hooks/use-onboarding.ts`
- `cli/diffgazer/src/features/onboarding/hooks/use-onboarding-wizard.ts`
- `cli/server/src/shared/lib/config/store.ts`

Fix:

- make onboarding save transactional at the server boundary
- or make partial completion explicit and recoverable in web/TUI
- test provider-save failure after settings save

### Medium: Provider Tier Metadata Is Internally Stale

`glm-4.7-flash` is still marked `tier: "free"`, but its own description says the
promotional free usage lasted through `2026-03-31`. On the current audit date,
`2026-05-23`, free-tier filtering and badges can therefore mislead users without
needing any external pricing lookup.

Confirmed references:

- `libs/core/src/schemas/config/providers.ts`
- `libs/core/src/providers/models.ts`

Fix:

- update static provider metadata to match its own dated description
- avoid hardcoded expiring pricing/tier claims unless there is a freshness
  process
- add a metadata check for expired promo dates if these labels stay static

### Medium: Provider Dialog Claims OS Keychain Encryption Regardless Of Storage Backend

The web provider API-key dialog says keys are encrypted in the OS keychain. File
storage is a valid/effective backend and defaults when `secretsStorage` is unset;
file-backed secrets are plaintext JSON with mode `0600`.

Confirmed references:

- `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx`
- `cli/server/src/shared/lib/config/providers-state.ts`
- `cli/server/src/shared/lib/config/state.ts`

Impact: users can be told their key is in the OS keychain when the active
storage backend is local file storage.

Fix:

- derive the dialog copy from the effective secrets backend
- keep keychain encryption claims only for keyring mode
- test copy for file and keyring modes

### Medium: Config APIs Persist Secrets To Implicit File Storage While Storage Is Unset

Default settings store `secretsStorage: null`, and setup status treats storage
as missing. Provider storage helpers still coerce `null` to `"file"`, so
`POST /api/config` can write API keys to file-backed secrets before the user has
made an explicit storage choice.

Confirmed references:

- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/lib/config/providers-state.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/features/config/service.ts`
- `libs/core/src/schemas/config/providers.ts`
- `cli/server/src/features/settings/schemas.ts`

Impact: setup/reporting can say storage is missing while a secret has already
been persisted to the file backend.

Fix:

- require an explicit secrets-storage backend before accepting provider secrets
- or make file storage the explicit default in setup status and user-facing copy
- add tests for saving provider credentials with `secretsStorage: null`

### Medium: `DELETE /api/config` Cannot Clear Stale Active Provider State Without A Secret

`getConfig()` returns `null` when the active provider has no readable API key.
`deleteConfig()` uses `getConfig()` as its existence check and returns
`CONFIG_NOT_FOUND` in that state instead of clearing the active provider/model
configuration.

Confirmed references:

- `cli/server/src/features/config/service.ts`

Impact: users lose a recovery/reset path for stale provider config after secret
loss, migration failure, or manual key deletion.

Fix:

- let delete/reset operate on active provider state even when the secret is
  missing
- distinguish "no active provider" from "active provider has no readable secret"
- add recovery tests for stale active provider without key

### Medium: Last File-Secret Cleanup Can Throw Outside The Provider `Result` Path

When the file-backed provider secret map becomes empty, `persistFileSecrets()`
calls `removeSecretsFile()` synchronously. `removeFileSync()` rethrows
non-`ENOENT` failures. Delete/stale-cleanup paths mutate in-memory secret state
before this call, so a filesystem removal failure can throw past the provider
`Result` contract.

Confirmed references:

- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/fs.ts`

Impact: the API can return a generic 500 after mutating memory, leaving disk,
config, and memory out of sync.

Fix:

- make file-secret deletion return a structured `Result`
- persist from immutable snapshots or roll back memory on failure
- add tests for failed final-secrets-file removal

### High: Web Provider Mutations Can Report Success After Failed API Calls

`ConfigProvider` wraps activate, save, and delete mutations in `try/catch` and
swallows rejected `mutateAsync` calls. `useProviderManagement` awaits those
actions and then closes dialogs or shows success toasts.

Confirmed references:

- `apps/web/src/app/providers/config-provider.tsx`
- `apps/web/src/features/providers/hooks/use-providers.ts`
- `apps/web/src/features/providers/hooks/use-provider-management.ts`

Impact: provider setup/settings can say "API Key Saved", "Provider Activated",
or "Model Selected" after the server rejected the mutation, leaving local config
unusable while the UI communicates success.

Fix:

- let mutation failures reject to callers that show success
- centralize error state if needed, but keep success UI contingent on actual
  server success
- add tests for failed save/activate/delete provider mutations

### Medium: Provider List Shows Default Model Instead Of Selected Model

The web provider list computes its subtitle from `provider.defaultModel` whenever
`provider.model` exists. The details panel correctly renders `provider.model`.

Confirmed references:

- `apps/web/src/features/providers/components/provider-list.tsx`
- `apps/web/src/features/providers/components/provider-details.tsx`
- `libs/core/src/providers/list.ts`

Impact: selecting a non-default or custom model can make the provider list and
provider details disagree about the active model.

Fix:

- render the selected model in the list when `provider.model` exists
- reserve default-model copy for unconfigured/default fallback states
- add a provider settings test for non-default selected models

### Medium: TUI Lacks Web's Custom OpenRouter Model ID Path

Web model selection supports using a typed custom OpenRouter model id. TUI model
selection only selects from loaded/filtered model rows, so private/new/unlisted
OpenRouter models are unreachable from terminal setup/settings.

Confirmed references:

- `apps/web/src/features/providers/components/model-select-dialog/model-search-input.tsx`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`
- `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx`

Fix:

- add a TUI "Use ID" action with validation matching web
- support the path in onboarding and provider settings
- test model-list failure recovery with manual model id

### Medium: TUI OpenRouter Onboarding Bypasses The Structured-Output Filter

TUI onboarding uses raw `useOpenRouterModels()` output and maps every returned
model into the radio list. Web onboarding, web provider settings, and TUI
provider settings use the shared mapped model hook/filter that hides OpenRouter
models without structured-output support.

Confirmed references:

- `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx`
- `libs/core/src/providers/use-openrouter-models-mapped.ts`
- `libs/core/src/api/openrouter-utils.ts`
- `apps/web/src/features/onboarding/components/steps/model-step.tsx`
- `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx`
- `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`

Impact: a TUI onboarding path with an already stored OpenRouter key can activate
a model that does not advertise `response_format` or `structured_outputs`, then
fail later when review generation expects structured output.

Fix:

- use `useOpenRouterModelsMapped()` or the same compatibility filter in TUI
  onboarding
- show filtered/unsupported model states consistently across web and TUI
- add a TUI onboarding test with an incompatible OpenRouter model

### High: File Secret Storage Is Advertised As Encrypted But Writes Plaintext JSON

Both web and TUI storage selectors describe file storage as an encrypted file.
The implementation writes JSON with mode `0600`; it does not encrypt the secret
payload.

Confirmed references:

- `apps/web/src/components/shared/storage-selector-content.tsx`
- `cli/diffgazer/src/features/settings/components/storage-selector.tsx`
- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/lib/fs.ts`

Impact: users are promised encrypted API-key storage, but receive plaintext file
storage protected only by filesystem permissions. This is a public security copy
and expectation mismatch.

Fix:

- either implement actual encryption/key management
- or change all user-facing copy to "local file with OS file permissions"
- prefer system keyring as the recommended secure option
- add docs that clearly explain the storage tradeoff

### High: Secret-Store Migration Can Delete Old Secrets Before New Config Is Durable

The migration order has crash-safety comments for keyring-to-file, but the
file-to-keyring path can remove the old secrets file before the new config state
is durably persisted. The generic async persistence finding covers the broader
pattern; this is the concrete secret-loss/mismatch case.

Confirmed references:

- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/config/secrets-migration.ts`

Impact: a crash or config write failure during storage migration can leave
config pointing at the old storage after old secrets were removed, or leave file
secrets behind while reporting keyring storage.

Fix:

- make migration a durable two-phase operation
- persist config and new secrets before deleting old secrets
- recover or roll forward from interrupted migrations
- add tests for crash/write-failure windows in both directions

### Medium: Keyring Availability Can Be Pinned False For A Server Run

`isKeyringAvailable()` caches the first availability result, and
`requireKeyring()` reuses it for later read/write/delete calls. If the first
check fails because the OS keyring is locked or temporarily unavailable, later
retries in the same Diffgazer run still return `KEYRING_UNAVAILABLE`.

Confirmed references:

- `cli/server/src/shared/lib/config/keyring.ts`
- `cli/server/src/shared/lib/config/secrets-migration.ts`

Fix:

- cache module loading separately from transient availability
- retry availability checks after failures, possibly with short backoff
- add tests for recovery after an initial unavailable result

### Medium: Keyring-Backed Provider Status Can Report Stored When No Key Is Readable

For non-file storage, provider sync returns the stored provider records
unchanged. `getProviders()` exposes cached `hasApiKey` without probing keyring,
and the web/TUI provider lists map that bit to configured/stored state.

Confirmed references:

- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/features/config/service.ts`
- `cli/server/src/features/config/router.ts`
- `libs/core/src/providers/list.ts`
- `apps/web/src/features/providers/components/provider-details.tsx`

Impact: if an OS keychain entry is deleted, locked, or unreadable after config
says `hasApiKey: true`, the UI can still present active and inactive providers
as configured until a runtime path actually tries to read the secret.

Fix:

- verify keyring presence/readability when returning provider status
- or return an explicit `secretStatus` such as stored, missing, unavailable, or
  unknown
- add provider status tests for missing/unreadable keyring secrets

### Medium: File-To-Keyring Migration Can Orphan Invalid Provider Secrets

`loadSecrets()` accepts the raw `providers` map from `secrets.json`, while
provider status sync hides invalid provider ids. File-to-keyring migration writes
every raw entry using `api_key_${providerId}`. Config routes only accept
`AIProviderSchema`, so invalid migrated provider secrets have no normal API/UI
deletion path afterward.

Confirmed references:

- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/lib/config/secrets-migration.ts`
- `cli/server/src/features/config/schemas.ts`
- `cli/server/src/shared/lib/config/store.ts`

Fix:

- validate provider ids before migrating secrets
- quarantine or delete invalid unmanaged entries with explicit warnings
- add migration tests for invalid provider ids in `secrets.json`

### High: TUI API-Key Paste Input Cannot Be Focused

The TUI `ApiKeyMethodSelector` initializes `inputFocused` to `false` and only
sets it back to `false` from method/highlight handlers. Its `Input` receives
`isActive={isActive && inputFocused}`, so the paste/env input never accepts
characters. The onboarding copy says Tab focuses the input, but the wizard Tab
handler only toggles the broader focus area.

Confirmed references:

- `cli/diffgazer/src/features/providers/components/api-key-method-selector.tsx`
- `cli/diffgazer/src/features/onboarding/components/onboarding-wizard.tsx`
- `cli/diffgazer/src/components/ui/input.tsx`

Impact: first-run TUI setup cannot enter a typed/pasted API key through the
default paste path, pushing users toward the already documented broken env path
or blocking setup entirely.

Fix:

- add a real focus state transition into the input
- make Tab/Enter behavior explicit between method list and text input
- add an Ink interaction test for typing an API key in onboarding

### Medium: TUI API-Key Paste Input Drops Multi-Character Paste Payloads

After the focus bug is fixed, the TUI paste path still uses the shared
password/controlled `Input`. `ManualTextEdit` only appends input when the
received chunk is a single character; terminal paste commonly arrives as a
multi-character string.

Confirmed references:

- `cli/diffgazer/src/features/providers/components/api-key-method-selector.tsx`
- `cli/diffgazer/src/components/ui/input.tsx`

Impact: "Paste API key directly" can no-op for full-key terminal paste in both
TUI onboarding and provider settings.

Fix:

- accept non-control multi-character chunks in `ManualTextEdit`
- add an Ink interaction test that pastes a full API key

### High: TUI Provider Settings Actions Are Keyboard-Inert

The TUI provider settings screen exposes only list selection shortcuts. The
detail-panel buttons and API-key overlay buttons do not pass `isActive`, while
the shared TUI `Button` defaults `isActive` to `false` and registers `onPress`
only when active.

Confirmed references:

- `cli/diffgazer/src/app/screens/settings/providers-screen.tsx`
- `cli/diffgazer/src/features/providers/components/provider-details.tsx`
- `cli/diffgazer/src/features/providers/components/api-key-overlay.tsx`
- `cli/diffgazer/src/components/ui/button.tsx`

Impact: `diffgazer --tui` can list/select providers, but keyboard users cannot
configure keys, select models, save/cancel the overlay, or remove credentials
from the settings flow.

Fix:

- introduce focus management between provider list, detail actions, and overlays
- pass `isActive` only to the currently focused action group
- test provider settings keyboard flows end to end

## Review, Streaming, And AI Runtime Findings

### Medium: TUI Custom Port Can Split Server And API Client

Production server factories honor `PORT` through `parsePortEnv`, but the TUI API
singleton is hardcoded to `http://127.0.0.1:3000`. Running with a custom port can
start the embedded server on one port while the TUI health/API calls another.

Confirmed references:

- `cli/diffgazer/src/lib/servers/server-factories.ts`
- `cli/diffgazer/src/lib/api.ts`
- `cli/diffgazer/src/app/index.tsx`

Impact: `PORT=4567 diffgazer --tui` can start the server on `4567` while the
client still calls `3000`, making the installable app look broken.

Fix:

- derive the TUI API base URL from the same server config/port
- pass the selected base URL through `ApiProvider`
- add a TUI/server integration test for custom `PORT`

### Medium: Public `--dev` Mode Depends On Repo-Relative Source Paths

The packaged CLI help advertises `--dev`, and `--dev` switches runtime mode.
That mode resolves `apps/web` and `cli/server` relative to the installed `dist`
location, then starts `npx tsx src/dev.ts` from that source path. Package smoke
only checks `diffgazer --help`.

Confirmed references:

- `cli/diffgazer/src/cli-options.ts`
- `cli/diffgazer/src/config.ts`
- `cli/diffgazer/src/lib/servers/api-server.ts`
- `scripts/monorepo/smoke-package-install.mjs`

Impact: an installable package exposes a public flag that likely only works in
the monorepo source checkout, not in a normal consumer install.

Fix:

- hide or mark `--dev` as internal/source-only in public help
- or make dev mode resolve installed package assets correctly
- add package smoke coverage if the flag remains public

### Medium: TUI Resume Can Start The Wrong Review

The TUI home screen checks `useActiveReviewSession()` without passing a mode,
and the server defaults that query to `unstaged`. The `resume-review` menu
action navigates to review without `reviewId` or `mode`; `ReviewScreen`
defaults to `unstaged`, and `ReviewContainer` ignores its `reviewId` prop when
starting/resuming.

Confirmed references:

- `cli/diffgazer/src/app/screens/home-screen.tsx`
- `cli/server/src/features/review/router.ts`
- `cli/diffgazer/src/features/home/lib/create-home-menu-action.ts`
- `cli/diffgazer/src/app/screens/review-screen.tsx`
- `cli/diffgazer/src/features/review/components/review-container.tsx`
- `cli/diffgazer/src/features/review/hooks/use-review-lifecycle.ts`

Impact: staged active sessions are invisible to TUI resume, and a missing or
history-review fallback can launch a new unstaged review instead of resuming or
reporting not found.

Fix:

- query active sessions by mode or return all active sessions
- pass `reviewId` and mode through the resume route
- make `ReviewContainer` honor `reviewId` for resume-only flows
- test staged and unstaged active session resume behavior

### High: TUI Review Back/Cancel Can Strand Users In Loading State

TUI review Back/Cancel calls `reset()`, but does not navigate away and does not
reset `ReviewContainer`'s one-shot `hasStarted` ref. After reset, lifecycle state
can render "Checking for changes..." while the start effect refuses to run again.
Some secondary Back buttons also render without `isActive`.

Confirmed references:

- `cli/diffgazer/src/features/review/components/review-container.tsx`
- `cli/diffgazer/src/features/review/hooks/use-review-lifecycle.ts`
- `libs/core/src/review/lifecycle-helpers.ts`
- `cli/diffgazer/src/features/review/components/api-key-missing-view.tsx`
- `cli/diffgazer/src/features/review/components/no-changes-view.tsx`

Impact: terminal users can get stuck after cancel, no-diff/API-key states, or
backing out of review summaries.

Fix:

- make reset either navigate to a stable screen or reset all start guards
- ensure every Back/Cancel command has explicit active focus ownership
- add TUI tests for cancel/no-diff/missing-key/back flows

### High: Review Cancel Does Not Cancel Server Work

Esc/cancel in the web review flow aborts the client SSE reader and navigates
home, but it does not call the server cancel endpoint or abort the server-side
`ActiveSession.controller`.

Confirmed references:

- `apps/web/src/features/review/hooks/use-review-progress-keyboard.ts`
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts`
- `libs/core/src/api/hooks/use-review-stream.ts`
- `cli/server/src/features/review/service.ts`
- `cli/server/src/features/review/sessions.ts`
- `cli/server/src/features/review/router.ts`

Impact: a detached analysis can continue running and spend provider quota after
the user believes it was cancelled.

Fix:

- wire the client cancel action to `DELETE /api/review/reviews/:id` or a
  dedicated cancel command
- abort the active server controller
- persist/emit a cancelled terminal state
- add an integration test that cancellation stops analysis work

### High: Web View Results Can Finalize A Live Review With Partial Streamed State

The web review container passes `onViewResults` while streaming is still active.
The progress keyboard handler enables Enter whenever that handler exists; the
lifecycle then stops the client stream and promotes the current partial state to
summary/results while the embedded server can continue and persist a different
completed review.

Confirmed references:

- `apps/web/src/features/review/components/review-container.tsx`
- `apps/web/src/features/review/components/review-progress-view.tsx`
- `apps/web/src/features/review/hooks/use-review-progress-keyboard.ts`
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts`
- `libs/core/src/api/hooks/use-review-stream.ts`
- `libs/core/src/api/hooks/use-review-completion.ts`
- `apps/web/src/features/review/components/page.tsx`
- `cli/diffgazer/src/features/review/components/review-progress-view.tsx`

Fix:

- expose View Results only after a terminal complete event
- make Enter ignored while `isRunning`
- test that active streaming cannot be promoted to final results

### Medium: Stale `?live=true` Review URLs Bypass Saved Results After Session Expiry

Live review navigation writes `search: { live: true }`. `ReviewPage` suppresses
saved-review loading while it considers the route live. Completed active
sessions are deleted after five minutes; refreshing or bookmarking the same
`?live=true` URL later gets a stream 404 and navigates home even when the saved
review artifact exists.

Confirmed references:

- `apps/web/src/features/home/components/home-presentation.tsx`
- `apps/web/src/features/review/components/page.tsx`
- `cli/server/src/features/review/sessions.ts`
- `cli/server/src/features/review/session-resume.ts`
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts`

Impact: users can lose the visible path to a completed saved result by revisiting
the live URL after active-session retention expires. This is the saved-result
fallback gap behind the broader deleted-session replay issue.

Fix:

- after live stream 404/not-found, fall back to loading the saved review by id
  before navigating home
- clear `live=true` when a review reaches terminal saved state
- add refresh/bookmark tests for completed live reviews after session cleanup

### High: Live Completed Reviews Can Show Raw Streamed Issues Instead Of Final Results

The server emits `issue_found` events before final dedupe, severity filtering,
validation, sorting, and enrichment. It later emits the authoritative terminal
`complete.result`, and the stream parser captures that result. The core API hook
path discards it, so live web completion builds the results page from accumulated
raw `issue_found` state.

Confirmed references:

- `cli/server/src/shared/lib/review/analysis.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`
- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/features/review/service.ts`
- `libs/core/src/review/stream-review.ts`
- `libs/core/src/api/review.ts`
- `libs/core/src/api/hooks/use-review-stream.ts`
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts`
- `apps/web/src/features/review/components/page.tsx`

Impact: even after normal terminal completion, live Results can differ from
History by showing duplicate, filtered-out, invalid, or non-enriched streamed
issues.

Fix:

- propagate terminal `complete.result` through the core API/hook layer
- replace accumulated provisional issues with the final server result
- test live completion against deduped/enriched final review output

### Medium/High: Review Stream Hook Can Clear The Active Abort Controller

`useReviewStream` stores the active `AbortController` in a ref, but the
`finally` block clears `abortControllerRef.current` unconditionally. If an older
`resume()` settles after a newer `resume()` starts, the older call can erase the
newer controller.

Confirmed references:

- `libs/core/src/api/hooks/use-review-stream.ts`

Current callers appear mostly serialized, so this is not a proven production
data-loss bug. It is still a public review-flow correctness risk.

Fix:

- only clear the ref if it still points to the controller owned by that call
- add an overlapping-resume regression test

### Medium: AI Provider Calls Have No Bounded Retry Policy

`DEFAULT_MAX_RETRIES` is `0`. A single retryable provider, network, or rate-limit
failure can fail a lens/all review.

Confirmed reference:

- `cli/server/src/shared/lib/ai/client.ts`

Fix:

- add bounded retries for clearly retryable failures
- keep cancellation immediate
- keep non-retryable provider/config errors fast-fail
- expose retry attempts in review events/logs

### Medium: New Git Repositories With No `HEAD` Cannot Start Reviews

Review creation and session resume call `git rev-parse HEAD` before diff
collection and treat failure as an internal generation failure. A repository on
an unborn branch can still have staged initial files that are reviewable, but
Diffgazer fails before reaching the staged diff.

Confirmed references:

- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/features/review/service.ts`
- `cli/server/src/features/review/session-resume.ts`

Impact: first-run repositories and initial commits are a normal local developer
case, but the installable review flow cannot handle them.

Fix:

- represent unborn `HEAD` explicitly in review identity
- allow staged initial diffs without a commit hash
- add tests for new repos with staged initial files

### Medium: Drilldown AI Calls Are Not Request-Cancellable

The main review analysis path passes an `AbortSignal` to AI generation. The
drilldown path calls `client.generate(...)` without passing `c.req.raw.signal`.
If the client disconnects, the provider call can continue and persist a
drilldown result.

Confirmed references:

- `cli/server/src/features/review/router.ts`
- `cli/server/src/features/review/review-routes.ts`
- `cli/server/src/features/review/drilldown.ts`
- `cli/server/src/shared/lib/ai/client.ts`

Fix:

- pass the request signal through the drilldown handler/service stack
- avoid persisting drilldown output after cancellation
- add a cancellation regression test for drilldown

### Medium: Active Review Reuse Ignores Request Scope

The create-review API accepts `mode`, `profile`, `lenses`, and `files`, but
active-session reuse only matches `projectPath`, `headCommit`, `statusHash`, and
`mode`.

Confirmed references:

- `cli/server/src/features/review/schemas.ts`
- `libs/core/src/api/review.ts`
- `cli/server/src/features/review/service.ts`
- `cli/server/src/features/review/sessions.ts`

Impact: a second review request with different files, lenses, or profile can
receive an existing review created for a different scope.

Fix:

- include files/lenses/profile in the active-session reuse key
- or decline reuse when the incoming scope differs from the active session
- add integration coverage for same mode/status/hash with different request
  scope

### Medium: Empty Lens Arrays Can Produce A Successful Empty Review

The create-review API and settings schema allow `lenses: []` / empty
`defaultLenses`. Because the review pipeline uses nullish fallback, an explicit
empty array bypasses profile/default fallback. Orchestration then runs with zero
lens tasks and can emit a successful completion with no analysis.

Confirmed references:

- `cli/server/src/features/review/schemas.ts`
- `libs/core/src/schemas/config/settings.ts`
- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`

Impact: a bad settings state or API caller can produce a "successful" review that
did not run any analysis lenses.

Fix:

- require non-empty lens arrays in API/settings schemas
- or normalize empty arrays to the default lens set at one boundary
- add service/orchestration tests for explicit empty lens arrays

### High: Duplicate Lens Arrays Can Amplify Provider Calls

The create-review API and settings schema accept unbounded lens arrays with
duplicates. The pipeline preserves the array, `getLenses()` maps every entry,
and orchestration creates/runs one analysis task per entry. In parallel mode,
concurrency is derived from `activeLenses.length`.

Confirmed references:

- `cli/server/src/features/review/schemas.ts`
- `libs/core/src/schemas/config/settings.ts`
- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/shared/lib/review/lenses.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`

Impact: a configured/trusted local session can submit or persist many repeated
lens ids, causing duplicated external AI requests for one review. That can burn
user API quota, trigger rate limits, and flood review session events.

Fix:

- constrain lens arrays to a non-empty unique subset of `LENS_IDS`
- cap maximum lens count to the known lens set
- de-dupe at the service boundary before concurrency is computed

### High: All-Lens AI Failure Is Saved As A Completed Review

The review pipeline calls orchestration with `partialOnAllFailed: true`. When
every lens fails, orchestration returns `ok` with empty issues, failed lens stats,
and an "analysis incomplete" summary instead of a terminal error. The review
service then finalizes, stores, and completes the review. Existing tests lock the
fallback behavior behind `partialOnAllFailed`.

Confirmed references:

- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`
- `cli/server/src/features/review/service.ts`
- `cli/server/src/shared/lib/review/orchestrate.test.ts`

Impact: a complete provider outage or all-lens failure can appear as a completed
review artifact instead of a failed review, which can mislead history, summaries,
and downstream gating.

Fix:

- treat all-lens failure as a terminal review error by default
- if partial all-failed artifacts are desired, mark them with an explicit failed
  status distinct from successful completion
- add service-level coverage for all-lens failures and stored review status

### Medium: Review Identity Ignores Dirty File Contents

Review freshness uses `headCommit` plus `statusHash`, but `statusHash` hashes
only `git status --porcelain` lines. Editing an already-dirty file can keep the
same status line and therefore the same hash, even though the actual diff sent
to AI has changed. That same hash gates active-session reuse, stale-session
cancellation, active-session lookup, resume freshness, and context cache reuse.

Confirmed references:

- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/features/review/service.ts`
- `cli/server/src/features/review/review-routes.ts`
- `cli/server/src/features/review/session-resume.ts`
- `cli/server/src/features/review/sessions.ts`
- `cli/server/src/features/review/context.ts`

Impact: after editing a file that was already dirty, the local UI/API can reuse
or resume a review for older diff contents instead of forcing a new review.

Fix:

- derive review identity from HEAD plus the relevant diff contents or a stable
  diff hash
- include the selected review scope in that identity
- add regression coverage for mutating an already-dirty file without changing
  the porcelain status lines

### Medium: `git status` Hash Failures Are Treated As Clean State

`getStatusHash()` returns the empty string for a clean tree and also when the
`git status` command fails. That value feeds active review reuse and SSE/session
freshness checks.

Confirmed references:

- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/features/review/service.ts`
- `cli/server/src/features/review/session-resume.ts`

Impact: if `git status` times out or fails, Diffgazer can reuse or resume a
review with unknown worktree state instead of failing closed.

Fix:

- make status hashing return a structured `Result`
- use a distinct clean-tree sentinel or real clean hash
- fail review create/resume when status cannot be inspected

### Medium: Review Context Cache Can Survive Clean HEAD Changes

Review setup feeds AI with `buildProjectContextSnapshot(projectPath)`. The
context cache is reused when `cached.meta.statusHash === currentHash`, but the
metadata does not include `headCommit`. `getStatusHash` hashes working-tree
status lines, not HEAD.

Confirmed references:

- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/features/review/context.ts`
- `libs/core/src/schemas/context/context.ts`
- `cli/server/src/shared/lib/git/service.ts`

Impact: after checkout, pull, or reset to a different clean commit, the status
hash can remain unchanged, so AI review context may be stale until forced
refresh.

Fix:

- include HEAD commit in context metadata and cache invalidation
- invalidate on relevant project/dependency file changes even when status is
  clean
- add a regression test for clean commit changes

### Medium: Project-Context Build Failures Are Reported As Completed Context Steps

`resolveReviewConfig()` emits `step_start("context")`, catches any
`buildProjectContextSnapshot()` failure, substitutes empty context, then still
emits `step_complete("context")`. The context builder can fail while creating
or writing `.diffgazer/context.*`.

Confirmed references:

- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/features/review/context.ts`

Impact: the live UI and event log can claim project context succeeded while the
AI review ran without it.

Fix:

- emit a warning/error context event when context capture fails
- distinguish "context unavailable, continuing" from successful context
  completion in UI and saved metadata
- add tests for unwritable `.diffgazer` / context write failures

### Medium: Review Context Discovery Misses Actual Workspace Roots

The AI context snapshot discovers workspace packages only under `apps` and
`packages`. This workspace's actual `pnpm-workspace.yaml` roots are `apps/*`,
`cli/*`, and `libs/*`.

Confirmed references:

- `cli/server/src/features/review/context.ts`
- `pnpm-workspace.yaml`
- `cli/server/src/features/review/context.test.ts`

Impact: even with a fresh cache, local AI review context can omit `cli/*` and
`libs/*`, including the embedded server, CLI runtime, keys, UI, registry, and
core packages. Existing tests reinforce the stale assumption by covering
`apps/web` and `packages/core`.

Fix:

- parse workspace roots from `pnpm-workspace.yaml` or package-manager metadata
- support `cli/*` and `libs/*` in addition to common `apps/*` / `packages/*`
  layouts
- update context tests to match this monorepo shape

### Medium: Review Enrichment Context Is Read From `HEAD`, Not Reviewed Diff

The pipeline enriches issues before saving, but enrichment calls
`gitService.getFileLines()`, which reads `git show HEAD:<file>`. Review input is
the staged/unstaged diff, so enrichment can point at pre-change committed lines or
be empty for newly added files.

Confirmed references:

- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/features/review/enrichment.ts`
- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/features/review/enrichment.test.ts`

Fix:

- derive enrichment context from the parsed reviewed diff or working tree version
  matching the review mode
- persist enough reviewed content to make history context stable
- add tests for added files and changed unstaged/staged lines

### Medium: Review Enrichment Can Read Files Outside The Reviewed Diff

The enrichment path does not first constrain `issue.file` to the parsed reviewed
diff or selected file scope. A prompt-influenced model result can name an
unrelated committed repo file; enrichment then runs blame/file-line reads for
that path and persists surrounding lines in the saved review.

Confirmed references:

- `libs/core/src/schemas/review/issues.ts`
- `cli/server/src/shared/lib/review/issues.ts`
- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/features/review/enrichment.ts`
- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/shared/lib/storage/reviews.ts`

Impact: a review of one diff can persist context from another committed file,
including sensitive local repository content unrelated to the reviewed change.

Fix:

- pass the parsed reviewed file set into enrichment
- skip/reject enrichment when `issue.file` is not in the reviewed file set and
  active file scope
- add a regression test where the model returns `secret.txt` while the diff only
  contains `reviewed.ts`

### Medium: AI/Repo-Controlled Issue Filenames Reach `git blame` Without `--`

Review issues accept arbitrary `file` strings, enrichment passes that string
into blame, and `getBlame()` appends it directly after options without a path
sentinel. A value beginning with `-` is parsed as a Git option, not a path.

Confirmed references:

- `libs/core/src/schemas/review/issues.ts`
- `cli/server/src/features/review/enrichment.ts`
- `cli/server/src/shared/lib/git/service.ts`

Impact: valid dash-prefixed filenames can break blame, and option-shaped issue
files can make Git read option-specified local files such as ignore-revs files,
with fragments surfacing in local errors/logs. This is not shell execution, but
it is an avoidable local path-safety issue.

Fix:

- call `git blame ... -- <file>`
- constrain enrichment to parsed reviewed file paths
- add tests for dash-prefixed filenames and option-shaped issue paths

### Medium: Fallback Evidence Excerpts Can Point At The Wrong Diff Lines

When model output lacks evidence, fallback evidence construction indexes directly
into hunk content. Hunk content includes the `@@` header and deletion lines that
do not consume new-line numbers, while current tests only assert range metadata.

Confirmed references:

- `cli/server/src/shared/lib/review/issues.ts`
- `cli/server/src/shared/lib/review/issues.test.ts`

Impact: saved and live review details can show misleading evidence snippets for
otherwise valid findings, especially around deletions and hunk headers.

Fix:

- walk hunk lines with a new-line counter before selecting fallback excerpts
- cover context/add/delete cases in tests
- assert exact excerpt text, not only line ranges

### Medium: Project Context Is Trusted More Than Diff Content In Prompts

Review prompts include README/project-context excerpts inside
`<project-context>`, and those excerpts are XML-escaped. The security hardening
prompt explicitly says to ignore instructions inside `<code-diff>`, but it does
not give the same untrusted-content treatment to `<project-context>`.

Confirmed references:

- `cli/server/src/features/review/context.ts`
- `cli/server/src/shared/lib/review/prompts.ts`
- `cli/server/src/shared/lib/review/prompts.test.ts`

Impact: a repository README or metadata file can contain prompt-like instructions
that are outside the currently named untrusted boundary and can influence review
output.

Fix:

- label project context as untrusted repository-provided context
- extend the security hardening instruction to cover both `<code-diff>` and
  `<project-context>`
- add prompt tests for hostile README/context text

### Medium: Normal Review Prompts Send Absolute Local Project Path To AI Providers

The project context snapshot includes `Root: ${projectPath}`. The review
pipeline passes that markdown into prompt construction, and prompts embed it
inside `<project-context>`.

Confirmed references:

- `cli/server/src/features/review/context.ts`
- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/shared/lib/review/prompts.ts`

Impact: normal review requests can disclose local filesystem layout and usernames
to external AI providers even when the reviewed diff does not reveal them. This
is distinct from `.diffgazer` artifact leakage because it happens on the normal
provider-bound prompt path.

Fix:

- omit absolute roots from provider-bound context
- or replace them with a stable non-sensitive project label/package name
- add prompt/context tests asserting home/root paths are absent

### Medium: Review Prompts Do Not Fully Treat Filenames As Untrusted

Review prompt construction embeds changed file names in two places:

- `<files-changed>` uses the raw `f.filePath`
- `<code-diff file="...">` XML-escapes `&`, `<`, and `>`, but not quotes

That means a hostile repository file name can alter prompt structure or break
the `file` attribute boundary even though diff body text is escaped. This is a
local app, but review prompts are sent to an external AI provider, so repository
metadata must be treated as untrusted prompt input.

Confirmed references:

- `cli/server/src/shared/lib/review/prompts.ts`

Impact: unusual but valid file names can influence the prompt framing around the
reviewed diff and increase prompt-injection risk.

Fix:

- escape attribute values with a function that handles quotes
- escape or otherwise structure filenames in `<files-changed>`
- add prompt tests with filenames containing quotes, angle brackets, and
  instruction-like text

### Medium: Drilldown Treats Saved Issue Text As Instruction-Bearing Context

`buildDrilldownPrompt` places first-pass issue fields and related issue
summaries inside `<issue>` and `<other-issues>`. The XML escaping prevents tag
breakout, but the hardening instruction only names `<code-diff>` as untrusted.
Issue text is model-produced and can also include repository-derived content, so
drilldown should not treat it as authoritative prompt instruction.

Confirmed references:

- `cli/server/src/shared/lib/review/prompts.ts`
- `cli/server/src/features/review/drilldown.ts`

Impact: a hostile first-pass finding title/rationale/recommendation can steer
the drilldown analysis for that issue or surrounding issues.

Fix:

- mark `<issue>` and `<other-issues>` as untrusted context in the drilldown
  prompt
- keep analysis instructions outside untrusted blocks
- add drilldown prompt tests with hostile first-pass issue text

### Medium: Drilldown Falls Back To Current Diff When Saved Review Has No Diff

`SavedReview.diff` is optional. When it is absent, drilldown re-fetches `git diff`
from the current project and analyzes that against the saved issue/result.
Existing tests preserve this legacy fallback.

Confirmed references:

- `libs/core/src/schemas/review/storage.ts`
- `cli/server/src/features/review/drilldown.ts`
- `cli/server/src/features/review/drilldown.test.ts`

Impact: drilldown for older or malformed stored reviews can analyze today's
unrelated local diff against yesterday's saved issue, then persist that mismatch
into review history.

Fix:

- require stored parsed diff for drilldown on saved reviews
- or mark legacy reviews without diff as unsupported for drilldown
- add a regression test that current working-tree changes are not used for saved
  review drilldown

### Medium: Concurrent Drilldowns Can Lose Saved Results

Each drilldown persistence path reads the full review JSON, mutates the
`drilldowns` array, and rewrites the full review without version/merge guards.
Concurrent drilldowns for different issues can therefore race with
last-writer-wins behavior.

Confirmed references:

- `cli/server/src/features/review/drilldown.ts`
- `cli/server/src/shared/lib/storage/reviews.ts`
- `cli/server/src/shared/lib/storage/persistence.ts`
- `cli/server/src/shared/lib/storage/reviews.test.ts`

Fix:

- serialize writes per review id or use optimistic retry/merge semantics
- preserve both results when concurrent drilldowns target different issues
- add concurrent drilldown storage tests

### High: Files Mode Without Files Reviews All Unstaged Changes

The create-review schema allows `mode: "files"` without `files`. Git diff
retrieval intentionally treats `files` mode as plain `git diff`, and filtering is
skipped when `files` is missing or empty.

Confirmed references:

- `cli/server/src/features/review/schemas.ts`
- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/features/review/diff.ts`
- `cli/server/src/features/review/service.ts`
- `libs/core/src/api/review.ts`

Impact: a caller or UI bug can request a file-scoped review but send all
unstaged changes to the review pipeline and external AI provider. This is a
correctness issue and a local privacy boundary issue.

Fix:

- require a non-empty file list whenever `mode === "files"` at API/schema
  boundaries
- reject empty/missing file lists before fetching the full diff
- add route and service tests for `mode: "files"` with missing and empty `files`

### Medium: File-Scoped Review Fetches The Whole Diff Before Filtering

The API exposes `files`, but review diff collection calls `gitService.getDiff`
without pathspecs and filters the parsed full diff afterward. `files` mode
intentionally falls through to full unstaged `git diff`.

Confirmed references:

- `libs/core/src/api/review.ts`
- `cli/server/src/features/review/diff.ts`
- `cli/server/src/shared/lib/git/service.ts`

Impact: selecting one file can still read unrelated local changes, hit the
global diff buffer/timeout, or fail before filtering. File-scoped review should
bound work and failure modes to the selected files.

Fix:

- pass pathspecs into git diff retrieval for file-scoped review
- keep staged/unstaged semantics explicit when pathspecs are used
- add tests with unrelated large diffs outside the selected file set

### Medium: Git Diffs With Quoted Paths Are Parsed As No Files

The diff parser recognizes only unquoted `diff --git a/... b/...` and
`--- a/...` / `+++ b/...` forms. Git emits quoted paths for valid filenames such
as tabs and default-quoted non-ASCII paths. A nonempty diff with quoted paths can
parse as `files: []`, then orchestration returns `NO_DIFF`.

Confirmed references:

- `cli/server/src/shared/lib/diff/parser.ts`
- `cli/server/src/features/review/diff.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`

Impact: real changed files with quoted Git paths can be reported as no
reviewable diff.

Fix:

- parse Git's quoted path syntax correctly
- add parser fixtures for tabs, spaces, quotes, and non-ASCII paths
- keep path matching compatible with file-scoped review filtering

### Medium: Untracked Files Count As Changes But Are Not Reviewable Diff Input

`getStatus()` sets `hasChanges` when untracked files exist, but `getDiff()`
uses only `git diff` / `git diff --cached`. A repository with only new untracked
files can look reviewable to the UI/API and then produce an empty diff path.

Confirmed references:

- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/features/review/diff.ts`

Impact: first-time changes in new files can be shown as available work, but the
review pipeline either has no content to analyze or returns a misleading
no-diff message.

Fix:

- either exclude untracked-only state from review-start readiness
- or include untracked file content deliberately and safely in review input
- show explicit UI/API copy that untracked files must be staged/tracked if that
  is the intended contract

### Medium: SSE Event Cap Can Drop Live Progress And Replay History

Terminal events are preserved, but non-terminal events after the 10,000-event
cap are dropped before `notifySubscribers`. This means connected clients can
stop receiving non-terminal live progress after the cap, and reconnecting
clients lose that progress history until a terminal event arrives.

Confirmed references:

- `cli/server/src/features/review/sessions.ts`
- `cli/server/src/features/review/sessions.test.ts`

Fix:

- make the retention policy explicit in UX/docs
- emit compact snapshots/checkpoints for reconnects
- or raise/split the cap by event type

### Medium: Session Eviction/Timeout Can End SSE Without A Terminal Event

Session eviction and stale-session cleanup abort the session controller, mark the
session complete, clear subscribers, and notify completion, but they do not add
or send an `error` event. `streamActiveSessionToSSE` then resolves when
completion fires and no terminal event exists, which makes the client surface the
generic "Stream ended without complete event" error instead of a specific
timeout/eviction reason.

Confirmed references:

- `cli/server/src/features/review/sessions.ts`
- `cli/server/src/features/review/sse-replay.ts`
- `cli/server/src/features/review/service.test.ts`
- `libs/core/src/review/stream-review.ts`

Impact: a long-running or evicted local review can disappear from the live UI
without an actionable terminal event, and reconnect/resume cannot recover a
specific failure reason.

Fix:

- convert eviction and timeout into stored/notified terminal `error` events
- keep terminal events replayable even when removing session bookkeeping
- update SSE replay tests so silent completion is not the expected user-visible
  contract

### Medium: Fallback SSE Internal Errors Are Schema-Invalid And Dropped

`resumeStreamById()` catches stream failures and writes an SSE `error` event
using shared `INTERNAL_ERROR`. Review stream events validate errors against
review-specific codes only, and the client parser ignores schema-invalid events.

Confirmed references:

- `cli/server/src/features/review/session-resume.ts`
- `cli/server/src/shared/lib/http/sse.ts`
- `libs/core/src/schemas/review/issues.ts`
- `libs/core/src/schemas/errors.ts`
- `libs/core/src/review/stream-review.ts`

Impact: the server attempts to send a terminal error, but the client can discard
it and surface generic `Stream ended without complete event` instead.

Fix:

- use a review-stream-valid error code for fallback SSE failures
- or widen `ReviewErrorSchema` deliberately to include shared internal errors
- add client/server SSE tests for fallback stream errors

### Medium: Large Single SSE Events Can Drop Terminal Completion

The server emits the final `complete` result as one SSE `data:` record. The
client parser has a hard 1 MiB buffer cap and cancels the reader before parsing
when the current event line exceeds it. A large but successfully saved review can
therefore fail only in the live stream with `Stream ended without complete
event`.

Confirmed references:

- `cli/server/src/features/review/sse-replay.ts`
- `cli/server/src/features/review/service.ts`
- `libs/core/src/streaming/sse-parser.ts`
- `libs/core/src/review/stream-review.ts`

Fix:

- stream or chunk large terminal results, or increase/shape the cap deliberately
- keep terminal completion recoverable through saved-review fetch after overflow
- add tests for large final results and buffer-overflow behavior

### Medium: SSE Replay Can Miss Events Between Replay And Subscribe

`streamActiveSessionToSSE` replays `session.events`, captures
`replayCursor = session.events.length`, and only then subscribes to future
events. Events appended after the replay loop but before subscription are not
sent through the replay loop or the live subscriber.

Confirmed references:

- `cli/server/src/features/review/sse-replay.ts`
- `cli/server/src/features/review/sessions.ts`

Impact: reconnecting clients can miss progress or a terminal event in a narrow
but real race window, which can make resumed review streams hang or surface
generic stream-end errors.

Fix:

- subscribe before replaying from a captured cursor
- or protect session event replay/subscription with a single event-queue
  critical section
- add a regression test that appends an event between initial replay and live
  subscription

### Medium: Saved Review Artifacts Discard The Reviewed Commit

Review creation resolves `headCommit` for session identity, but persistence
passes `commit: null` into `saveReview`. Storage and public schemas already
support `gitContext.commit`.

Confirmed references:

- `cli/server/src/features/review/service.ts`
- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/shared/lib/storage/reviews.ts`
- `libs/core/src/schemas/review/storage.ts`

Impact: review history cannot tell the user which immutable revision a review
was based on after checkout, reset, pull, or later working-tree edits.

Fix:

- pass the resolved review commit into the pipeline persistence boundary
- represent unborn/no-HEAD reviews explicitly
- add history/storage tests that persist and display the reviewed commit

### Medium: Project-Scoped Review APIs Read Global Reviews Before Ownership Checks

Project-scoped list calls `reviewStore.list()` across the global review
directory, filters to the current `projectPath`, and returns global
parse/read warnings unchanged. Single-review read/delete paths call
`getStoredReview(id)` before comparing stored `metadata.projectPath`, and that
read can migrate/background-write legacy reviews before the route rejects a
cross-project id.

Confirmed references:

- `cli/server/src/shared/lib/storage/reviews.ts`
- `cli/server/src/features/review/review-routes.ts`

Impact: corrupt or unreadable reviews from another project can leak
warning/id/path-shaped errors into the current project's history response, and
legacy cross-project review reads can perform migration writes before ownership
is enforced.

Fix:

- add project-scoped storage operations that validate ownership before full
  read/migration/write/delete
- do not return global parse/read warnings from project-scoped list APIs
- add cross-project corrupt/legacy review fixtures

### Medium: Partial Lens Failures Are Live-Only And Disappear From Saved Reviews

Orchestration produces structured `lensStats` and `failedLenses`, and live
progress can show a partial-analysis warning. The pipeline reduces the outcome
to only `{ issues, summary }` before persistence, and `SavedReviewSchema` has no
structured lens-status field. Saved review and history paths then render only
issue/severity data.

Confirmed references:

- `cli/server/src/shared/lib/review/types.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`
- `cli/server/src/features/review/pipeline.ts`
- `libs/core/src/schemas/review/storage.ts`
- `cli/server/src/shared/lib/storage/reviews.ts`
- `apps/web/src/features/review/components/review-progress-view.tsx`
- `apps/web/src/features/review/components/page.tsx`
- `apps/web/src/features/history/hooks/use-history-page.ts`

Impact: a review where one lens failed and others succeeded can later look like
a complete successful review in saved/history views.

Fix:

- persist structured lens run status with saved reviews
- expose partial-failure state through saved review/history responses
- render saved/history partial analysis state from persisted data

### Medium: Deleted Reviews Can Be Replayed From In-Memory Sessions

`DELETE /api/review/reviews/:id` deletes the persisted review JSON, but it does
not clear a matching in-memory session. Completed sessions remain in memory for
five minutes, stream resume looks up only the session id, and the web review page
falls back from saved-review `404` to stream mode.

Confirmed references:

- `cli/server/src/features/review/review-routes.ts`
- `cli/server/src/features/review/sessions.ts`
- `cli/server/src/features/review/session-resume.ts`
- `cli/server/src/features/review/sse-replay.ts`
- `apps/web/src/features/review/components/page.tsx`

Impact: deleting a just-completed review from History is not authoritative for
several minutes. Opening `/review/:id` can replay the deleted review result from
the live-session cache.

Fix:

- clear the matching session on successful persisted-review deletion
- make saved-review `404` fallback to stream only for intentional live/session
  routes
- add a delete-then-open regression test

## Docs, Registry Host, And Domain Findings

### Blocker: Registry/Docs Host Is Still The Old Origin

The desired host is `https://docs.b4r7.dev`, but source, generated/public
registry JSON, docs copy, robots, sitemap generation, tests, and governance
still reference `https://docs.diffgazer.b4r7.dev`.

Current reconciliation count: 344 non-audit host references across 342 matching
lines in 62 files still reference the old host. `libs/ui/public/r` accounts for
318 of those occurrences across 49 files. `libs/keys/public/r` was clean in this
pass.

Confirmed examples:

- `libs/registry/src/constants.ts`
- `Dockerfile`
- `docker-compose.yml`
- `apps/docs/src/lib/seo.ts`
- `apps/docs/scripts/generate-sitemap.mjs`
- `apps/docs/public/robots.txt`
- `apps/docs/src/lib/consumption-metadata.ts`
- `README.md`
- `libs/ui/README.md`
- `libs/keys/README.md`
- public registry JSON under `libs/ui/public/r`

Fix all install URLs, registry dependencies, canonical URLs, robots/sitemap
URLs, tests, README snippets, and governance together.

### Blocker: Docs UI Renders Old-Host Shadcn Commands As Available

The docs consumption metadata marks shadcn copy paths available and emits
commands using the old unresolved host. `ConsumptionBlock` renders the command
when a path is available.

Fix:

- either gate hosted shadcn commands until the host is live
- or change them to `docs.b4r7.dev` and deploy before public handoff

### Blocker: Hosted Domains Are Not Live

Read-only DNS checks on 2026-05-22 returned NXDOMAIN for:

- `docs.b4r7.dev`
- `diffgazer.b4r7.dev`
- `docs.diffgazer.b4r7.dev`

`b4r7.dev` itself resolved and served a Hostinger parked page. Treat
`docs.b4r7.dev` as the chosen canonical docs/registry host and
`diffgazer.b4r7.dev` as the chosen product/install host; this is no longer an
open naming decision.

Add post-deploy checks for:

- `https://docs.b4r7.dev/r/ui/registry.json`
- representative UI item JSON
- representative keys item JSON
- `/schema/*`
- `/robots.txt`
- `/sitemap.xml`
- `https://diffgazer.b4r7.dev/`

### High: Docs Deployment Mode Is Not Decided

The docs app intentionally uses TanStack Start + Nitro and emits server output.
It also previews/tests `.output/public` statically. Server functions remain in
docs routes, search, and library switching.

This is not a "server functions are bad" issue.

Current deployment support is docs-only Docker/Nitro:

- `Dockerfile` builds and runs `.output/server/index.mjs`
- `docker-compose.yml` maps `${PORT:-3000}:3000`

Correction from the second reconciliation pass: `.github/workflows/release.yml`
does not build or push the docs image. It runs `release-check` and Changesets
version/publish work. Docs Docker/Nitro deployment exists as local repo support,
not as confirmed release automation.

If this runs behind Nginx on a VPS, bind the container to loopback or an
internal Docker network. Do not expose the docs runtime on all interfaces unless
that is intentional.

If pure static hosting is the target:

- replace runtime server-function behavior with generated/client data
- ensure registry/schema/assets are real files
- configure fallback to `index.html` only for app routes

If TanStack Start/Nitro runtime is accepted:

- deploy the server output intentionally
- run E2E against the selected Nitro adapter/runtime, not only
  `vite preview --outDir .output/public`
- account for the runtime moderate audit findings before handoff

### High: Docker/Nitro Runtime Can 404 The Generated Sitemap

The docs build runs `vite build` before `generate:sitemap`, and sitemap writing
defaults to `.output/public`. The Docker image runs Nitro's
`.output/server/index.mjs`. In the current generated output, the Nitro server's
asset map can miss `sitemap.xml` because it was written after the server output
was generated.

Confirmed references:

- `apps/docs/package.json`
- `apps/docs/scripts/generate-sitemap.mjs`
- `Dockerfile`
- `apps/docs/.output/server/index.mjs`

Impact: a deployed docs/registry host can serve registry/schema files while
returning 404 for `/sitemap.xml`, even though robots and SEO expectations point
to it. Static preview of `.output/public` does not catch this Nitro runtime
failure.

Fix:

- generate the sitemap before Nitro snapshots server/static assets, or include
  it in the static asset map explicitly
- add Docker/Nitro runtime checks for `/sitemap.xml`
- keep static-preview and deployed-runtime checks separate

### Medium: Sitemap `lastmod` Is Unstable For Generated Docs Pages

`generate-sitemap.mjs` uses filesystem `mtime` for source-backed pages. Most UI
and keys docs pages are copied into ignored generated directories during artifact
sync, so their `mtime` can become prepare/build time rather than content-change
time.

Confirmed references:

- `apps/docs/scripts/generate-sitemap.mjs`
- `libs/registry/src/docs/sync-operations.ts`
- ignored generated docs under `apps/docs/content/docs/ui/` and
  `apps/docs/content/docs/keys/`

Impact: sitemap freshness can churn between builds without content changes,
weakening crawl signals and making deploy diffs noisy.

Fix:

- derive generated-page `lastmod` from source artifact timestamps or Git
  metadata, not copied output mtime
- use a stable fallback for generated pages when source timestamps are unknown
- add a sitemap regression for unchanged generated docs

### Medium/High If Nitro Is Public: Docs Server Functions Leak Internal Errors

Docs server functions use identity `inputValidator` callbacks. When called
directly with malformed/missing data against the existing Nitro output, handlers
can execute with invalid `data` and return serialized internal `TypeError`
details with HTTP 200.

Confirmed references:

- `apps/docs/src/features/search/hooks/use-search.ts`
- `apps/docs/src/routes/$lib/docs/$.tsx`
- `apps/docs/src/routes/$lib/docs.tsx`
- `apps/docs/src/layouts/header.tsx`
- `apps/docs/.output/server/_ssr/index.mjs`

Impact: this matters only if Nitro remains the public docs runtime. Static
deployment would avoid these server-function endpoints; public Nitro deployment
should treat them as a real runtime validation/error-shaping surface.

Fix:

- use real runtime validators for server-function input
- return structured client-safe errors for invalid direct calls
- or convert eligible docs data paths to static/generated data
- add Nitro runtime tests for malformed `_serverFn` calls

### High: Docs Docker Origin Args Are Incomplete And Ordered Too Late

Docs SEO and sitemap generation consume `VITE_PUBLIC_ORIGIN`. The current root
Dockerfile and compose config only pass `REGISTRY_ORIGIN`; runtime env sets only
`NODE_ENV` and `PORT`.

There is a second, more concrete Docker build problem: the root Dockerfile builds
`@diffgazer/keys` and `@diffgazer/ui` before declaring/exporting
`REGISTRY_ORIGIN`. Those package builds produce the public registry artifacts
that docs later sync, so a Docker build override cannot reach the artifact
producers. The docs sync path also asserts that source-origin placeholders were
rewritten.

Confirmed references:

- `apps/docs/src/lib/seo.ts`
- `apps/docs/scripts/generate-sitemap.mjs`
- `Dockerfile`
- `docker-compose.yml`
- `libs/registry/src/shadcn/build.ts`
- `libs/registry/src/docs/sync-operations.ts`

Impact: a Docker/Coolify build for the new host can fail during docs artifact
sync, or ship old registry/canonical/sitemap hosts instead of `docs.b4r7.dev`.

Fix:

- move the origin build args/env before artifact-producing UI/keys builds
- pass `VITE_PUBLIC_ORIGIN` as a Docker build arg/env in the docs deploy path
- keep registry origin and public docs origin intentionally separate in config
- add a Docker/build validation that checks emitted registry JSON, canonical,
  and sitemap hosts

### High: Turbo Build Cache Is Origin-Blind For Docs/Registry Output

`turbo.json` passes only `DIFFGAZER_SKIP_ARTIFACT_PREPARE`. A local dry run of
`pnpm exec turbo run build --filter=@diffgazer/docs --dry=json` showed
`@diffgazer/docs#build` running in strict env mode with no configured or inferred
env keys. The build output depends on `REGISTRY_ORIGIN`, `VITE_PUBLIC_ORIGIN`,
`DOCS_PRERENDER`, and `DIFFGAZER_DEV` through artifact sync, sitemap, SEO, and
docs build scripts.

Turborepo's official environment-variable guidance says build-affecting env
vars need to be accounted for in task hashes with `env` / `globalEnv`, and
strict mode filters vars not declared there.

Confirmed references:

- `turbo.json`
- `apps/docs/package.json`
- `apps/docs/scripts/sync-artifacts.mjs`
- `apps/docs/scripts/generate-sitemap.mjs`
- `apps/docs/src/lib/seo.ts`
- `scripts/monorepo/artifacts/config.mjs`
- Turborepo docs: `https://turborepo.com/docs/crafting-your-repository/using-environment-variables`

Impact: root `turbo run build` can restore or emit docs/registry/canonical
output for the wrong host, especially during the `docs.b4r7.dev` origin move.

Fix:

- add origin and docs mode env vars to the docs build task hash/runtime
- use `env` / `globalEnv` for variables that affect output, not only
  passthrough
- add a build summary or smoke check that confirms emitted hosts match the
  requested build env

### Medium: Docs Docker Build Forces Workspace Artifact Mode

The root Dockerfile sets `DIFFGAZER_DEV=1` before the docs build. Artifact sync
resolves that env value to `"workspace"` mode, so the deployable docs image is
built from workspace artifacts even where package-mode handoff is expected to be
proved.

Confirmed references:

- `Dockerfile`
- `apps/docs/scripts/sync-artifacts.mjs`
- `scripts/monorepo/artifacts/config.mjs`

Impact: the docs image can succeed while package-mode artifact consumption is
still broken or untested. This is separate from the package-artifact tarball
issue: the deploy path itself opts out of package-mode validation.

Fix:

- make Docker docs artifact mode explicit and intentional
- run at least one release/deploy validation in package mode
- avoid `DIFFGAZER_DEV=1` in production Docker builds unless workspace mode is
  the chosen deployment contract

### Medium: Docs Type-Check Depends On Ignored Generated Route Tree

`apps/docs/src/router.tsx` imports `./routeTree.gen`, but
`apps/docs/.gitignore` ignores `src/routeTree.gen.ts`. The docs `type-check`
script runs `prepare:generated` before `tsc --noEmit`, but that prepare script
does not generate TanStack's route tree.

Confirmed references:

- `apps/docs/src/router.tsx`
- `apps/docs/.gitignore`
- `apps/docs/package.json`

Impact: a fresh clone or release environment can depend on a local ignored
artifact for docs type-checking.

Fix:

- generate the route tree as part of docs type-check/build preparation
- or commit the generated route tree intentionally
- add a fresh-archive/fresh-clone docs type-check check

### Medium: Docs `test:e2e` Can Run Against Stale Static Output

The package-level `test:e2e` script runs only `playwright test`. Playwright
previews the existing `.output/public`; CI happens to build first, but the script
itself is not self-contained and can pass against stale output or fail on a clean
tree.

Confirmed references:

- `apps/docs/package.json`
- `apps/docs/playwright.config.ts`
- `.github/workflows/release-readiness.yml`

Impact: local and package-level E2E results can prove an old docs build instead
of the current source tree. This is distinct from the static-vs-Nitro runtime
coverage gap.

Fix:

- add a `pretest:e2e` build/freshness guard
- or split scripts into `test:e2e:built` and a full build-and-test command
- make CI use the full command explicitly

### Medium: Docs Dev Artifact Rebuild Watcher Points Outside The Repo

`vite-plugin-docs-rebuild.ts` sets `APP_ROOT` to `apps/docs`, then resolves
`WORKSPACE_ROOT` with `../../..`, which points one directory above the repo. The
watched artifact paths therefore miss the real `libs/ui/dist/artifacts` and
`libs/keys/dist/artifacts` directories. The prepare script uses the correct
`../..` root shape.

Confirmed references:

- `apps/docs/vite-plugin-docs-rebuild.ts`
- `apps/docs/config/docs-libraries.json`
- `apps/docs/scripts/prepare-generated.mjs`

Impact: `DIFFGAZER_DEV=1 vite dev` can appear live while docs content, registry,
or demo artifacts do not auto-rebuild after library artifact changes.

Fix:

- resolve workspace root as `resolve(APP_ROOT, "../..")`
- add a unit/probe for computed watch paths

### High: Registry Schema Host Is Split Between CLI And Served Schema

`apps/docs/public/schema/diffgazer.json` still declares the old
`https://diffgazer.com/schema/diffgazer.json` `$id`, while `dgadd init` derives
the `$schema` URL from `REGISTRY_ORIGIN`, which currently points to the old docs
host.

Confirmed references:

- `apps/docs/public/schema/diffgazer.json`
- `cli/add/src/commands/init.ts`
- `libs/registry/src/constants.ts`

Fix after moving to `docs.b4r7.dev`:

- align the generated `$schema` URL and served schema `$id`
- or explicitly document a legacy stable identifier if the `$id` intentionally
  remains separate from the hosting URL

### High: Hosted Diffgazer Schema Rejects CLI-Owned Manifest Metadata

The hosted `diffgazer.json` schema allows only `installedAt`, `integrationMode`,
and `keysVersion` under `installedComponents`, with `additionalProperties:
false`. The CLI schema and add workflow support and write `installedAs`,
`cssChunks`, and per-file ownership metadata. Since `dgadd init` writes a
`$schema` URL pointing at the hosted schema, normal `dgadd add` output can become
schema-invalid.

Confirmed references:

- `apps/docs/public/schema/diffgazer.json`
- `cli/add/src/context.ts`
- `cli/add/src/commands/add/manifest.ts`
- `cli/add/src/commands/init.ts`

Impact: editors, CI, or users validating the generated config against the public
schema can see false schema errors immediately after successful `dgadd` commands.

Fix:

- generate/sync the hosted schema from the CLI config schema
- include ownership metadata fields in `installedComponents`
- add a fixture that validates post-`dgadd add` config against the served schema

### Medium: Hosted Diffgazer Schema Under-Validates Aliases Compared With The CLI

The hosted schema allows any string for `aliases.*`, while the CLI validates
aliases with `aliasPathSchema`, requiring an alias or relative-path prefix. A
config can validate in editors/CI against the hosted schema and still be rejected
by `dgadd`.

Confirmed references:

- `apps/docs/public/schema/diffgazer.json`
- `cli/add/src/context.ts`
- `libs/registry/src/cli/config.ts`

Fix:

- generate/sync the hosted schema from the CLI Zod schema
- or add the same alias path pattern constraints manually
- add schema fixtures for invalid absolute/bare aliases

### Medium: `dgadd` Accepts Relative Alias Values That Produce Broken Copied Imports

The CLI alias schema accepts relative alias values such as
`"./src/components/ui"`. That can be a valid project file path, but copy-mode
import rewriting treats aliases as import-specifier prefixes. A copied source
file can therefore receive imports that are relative to the consumer project
root instead of relative to the copied file.

Confirmed references:

- `libs/registry/src/cli/config.ts`
- `cli/add/src/context.ts`
- `cli/add/src/utils/transform.ts`

Impact: a user can pass CLI validation, install a component, and receive source
that TypeScript cannot resolve from the copied file location.

Fix:

- either reject relative alias values for import-specifier rewrites
- or normalize them into file-relative import specifiers per copied target file
- add a copy-mode fixture with `aliases.components: "./src/components/ui"`
  that imports another copied registry dependency

### Medium: Docs Footer Advertises Shortcuts That Are Not Wired

The docs footer advertises `/`, `mod+k`, `j/k`, `c`, and `Esc Back`.
Search shortcuts are wired, but `j/k`, `c`, and `Esc Back` were not found as
implemented docs-level shortcuts in this pass.

Confirmed references:

- `apps/docs/src/layouts/footer.tsx`
- `apps/docs/src/features/search/components/search-dialog.tsx`

Fix:

- implement the advertised shortcuts accessibly
- or remove them from visible footer copy before public handoff

### Medium: Docs Copy Buttons Drop Contextual Accessible Names

`CopyButton` renders contextual visible labels such as "Copy Full Source" and
`Copy ${hook.title}`, but it always sets the accessible name to generic
`Copy to clipboard` or `Copied`.

Confirmed references:

- `apps/docs/src/components/copy-button.tsx`
- `apps/docs/src/components/source-viewer.tsx`
- `apps/docs/src/components/hook-source.tsx`
- `apps/docs/src/components/docs-mdx/blocks/source-viewer-block.tsx`

Impact: source/hook docs can expose multiple indistinguishable copy buttons to
assistive technology users.

Fix:

- include the contextual label in the accessible name
- keep copied state as status text or `aria-live` feedback rather than replacing
  the control name with only `Copied`
- add an accessibility test for multiple copy buttons on one page

### Medium: Generated Docs SEO Descriptions Can Diverge From Rendered Content

The docs route loader fetches generated component/hook metadata, but `head`
builds the SEO description from route/frontmatter data. The page body later
prefers generated docs descriptions. A generated component page can therefore
render one description while exposing a different search/social snippet.

Confirmed references:

- `apps/docs/src/routes/$lib/docs/$.tsx`
- generated component docs such as
  `libs/ui/registry/component-docs/code-block.ts`
- matching MDX frontmatter under `apps/docs/content/docs/ui/components/`

Impact: public snippets can describe stale or different API behavior than users
see on the page.

Fix:

- build route SEO from the same generated docs metadata used by the page body
- add a metadata parity check for generated component/hook pages

### Medium: Docs CTAs Nest Buttons Inside Links

The public docs app has several TanStack `Link` anchors that wrap
`@diffgazer/ui` `Button` components. `Button` renders a native `<button>` by
default; the UI docs describe a render-prop form for router-aware elements, but
these call sites do not use it.

Confirmed references:

- `libs/ui/registry/ui/button/button.tsx`
- `apps/docs/src/routes/index.tsx`
- `apps/docs/src/routes/__root.tsx`
- `apps/docs/src/components/not-found.tsx`
- `apps/docs/src/components/docs-not-found.tsx`

Impact: nested interactive HTML can break focus, click, and assistive-technology
semantics in the public docs entrypoint and error pages.

Fix:

- use the `Button` render-prop pattern to style the router `Link`
- or render `Button as="a"` where a real anchor is appropriate
- add an accessibility/DOM regression for no nested interactive controls

### Medium: Closed Mobile Docs Sidebar Remains Focusable

The mobile docs sidebar is always rendered and closed with only
`-translate-x-full`. It contains focusable nav links, and the closed region is
not `hidden`, `inert`, or `aria-hidden`.

There is a second state issue: the docs layout wraps a custom translated drawer
around `DocsSidebar`, but `DocsSidebar` also creates an unmanaged public
`Sidebar` whose provider defaults to `open`. On mobile, that primitive can
activate its own dialog/focus-trap behavior independently of the outer
`sidebarOpen` state.

Confirmed references:

- `apps/docs/src/layouts/docs-content-layout.tsx`
- `apps/docs/src/layouts/sidebar.tsx`
- `apps/docs/registry/ui/sidebar/sidebar.tsx`
- `apps/docs/registry/ui/sidebar/sidebar-provider.tsx`

Impact: keyboard and screen-reader users can reach offscreen navigation while
the sidebar is visually closed, and mobile docs can have two independent sidebar
state machines fighting over modal/focus behavior.

Fix:

- use one source of truth for the mobile docs sidebar
- either let the public `Sidebar.Provider` / `Sidebar.Trigger` own the mobile
  sheet, or control the primitive state from `sidebarOpen`
- set `inert` or remove/hide the sidebar from the accessibility tree when
  closed on mobile
- keep desktop sidebar behavior unchanged
- manage focus when opening/closing the mobile nav
- test tab order for closed and open states

### Medium: Docs Sidebar Active Auto-Scroll Targets Are Overwritten

`DocsSidebar` queries `[data-value="${pathname}"]` to scroll the active item into
view. The rendered `Link` sets `data-value={url}`, but then spreads
`itemProps` afterward. `SidebarItem` render props also provide `data-value`, so
the URL value is overwritten by a generated item id.

Confirmed references:

- `apps/docs/src/layouts/sidebar.tsx`
- `apps/docs/registry/ui/sidebar/sidebar-item.tsx`

Impact: deep-linked long docs pages may not scroll the active sidebar item into
view, making navigation state harder to find.

Fix:

- preserve a separate `data-path`/`data-docs-path` for URL lookup
- or spread `itemProps` before the route `data-value` if that does not break the
  sidebar navigation contract
- add a docs sidebar deep-link test

### Medium: Pending Docs Navigation Can Ship Unstable Busy And Label State

`usePendingDocsRoute()` treats any router pending state as docs pending. That
state feeds `aria-busy` on docs landmarks and lets the sidebar mark the pending
URL active while replacing the link label with only a spinner.

Confirmed references:

- `apps/docs/src/lib/hooks/use-pending-docs-route.ts`
- `apps/docs/src/layouts/header.tsx`
- `apps/docs/src/layouts/docs-content-layout.tsx`
- `apps/docs/src/layouts/sidebar.tsx`

Impact: assistive technology can see a current navigation link named only
"Loading" instead of the page title. Generated static/Nitro output can also
serialize settled content with busy landmarks if pending state leaks into the
build output.

Fix:

- keep the sidebar item label rendered during pending states
- make the spinner decorative or expose status outside the link
- add prerender/Nitro HTML regression coverage for no settled
  `aria-busy="true"` and active links retaining page names

### Medium: Stepper Docs Mix Two Public Install Targets On One Page

`stepper.mdx` binds the page to `component: "stepper"` and renders one
`ConsumptionBlock`, so commands/import captions describe only `ui/stepper` and
`@diffgazer/ui/components/stepper`. The same page documents
`HorizontalStepper`, and its displayed example imports
`@/components/ui/horizontal-stepper`. Public handoff treats
`horizontal-stepper` as a separate registry/package item.

Confirmed references:

- `apps/docs/content/docs/ui/components/stepper.mdx`
- `apps/docs/src/components/docs-mdx/blocks/consumption-block.tsx`
- `apps/docs/src/lib/consumption-metadata.ts`
- `libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-default.tsx`
- `libs/ui/registry/ui/stepper/index.ts`
- `libs/ui/registry/ui/horizontal-stepper/index.ts`
- `libs/ui/package.json`
- `libs/ui/registry/registry.json`

Impact: users following the Stepper page can install/copy `stepper` and still
fail to run the horizontal examples shown on that same page.

Fix:

- give `horizontal-stepper` its own docs/consumption block
- or add explicit install/import instructions for both items on the Stepper page
- or intentionally merge/export horizontal stepper through the `stepper` public
  item

### Medium: Docs Default `dgadd` Command Is Publish-Gated But Shown As Available

Component docs default to the `dgadd` tab and render commands like
`pnpm exec dgadd add ...`. The package path carries a publish-gate note, but the
`dgadd` path does not.

Confirmed references:

- `apps/docs/src/lib/consumption-metadata.ts`
- `apps/docs/src/components/docs-mdx/blocks/consumption-block.tsx`
- `PACKAGE_GOVERNANCE.md`

Impact: a clean public consumer app cannot use `pnpm exec dgadd` unless `dgadd`
is already available locally. Before public handoff, the command should use the
published package runner, for example `pnpm dlx @diffgazer/add ...` or
`npx @diffgazer/add ...`, and stay gated until `@diffgazer/add` is published.

Fix:

- gate `dgadd` docs the same way as package commands while unpublished
- switch public commands to the final published package runner
- add docs tests/snapshots for publish-gated command rendering

### Medium: `dgadd list --installed` Disagrees With `diff` And `remove` For Unmanaged UI Files

`list --installed` falls back to physical file existence for `ui/*` items when
no manifest entry exists. Default `diff` reads only manifest keys, and `remove`
expansion is also manifest-driven.

Confirmed references:

- `cli/add/src/utils/namespaces.ts`
- `libs/registry/src/cli/command-helpers.ts`
- `cli/add/src/commands/diff.ts`
- `cli/add/src/commands/remove.ts`

Impact: direct shadcn/manual-copy consumers can see `ui/button` as installed,
but `dgadd diff` reports no installed items and `dgadd remove ui/button` removes
nothing. This is separate from the `remove --force` missing-metadata recovery
gap because the false installed state is normal physical-file detection.

Fix:

- decide whether unmanaged physical files are first-class installed items
- if yes, make `diff` and `remove` use the same detection or adopt metadata
  before removal
- if no, make `list --installed` manifest-owned only and expose a separate
  physical-file diagnostic
- add CLI fixture coverage for unmanaged copied UI files

### Medium: `dgadd remove` Leaves Stale Ownership When Owned Files Are Already Missing

Installed checks treat a manifest entry as installed without verifying files.
Removal skips missing files and only marks an item removed when at least one file
is removable. If no files are collected, it returns before manifest cleanup.

Confirmed references:

- `libs/registry/src/cli/command-helpers.ts`
- `libs/registry/src/cli/workflows/remove.ts`

Impact: after users manually delete an item's files, `dgadd remove --force` can
leave the stale `installedComponents[...]` owner behind.

Fix:

- allow manifest cleanup even when owned files are already missing
- report missing files separately from "not installed"
- add a fixture where an installed item's files are manually deleted before
  remove

### Medium: `dgadd diff/remove` Can Be Blocked By Stale Manifest Item Names

Default `diff` and `remove` still resolve manifest item keys through the current
registry. If a public registry item is renamed or removed after a user has it in
`installedComponents`, stale manifest records can make drift/removal paths throw
or fail before cleanup.

Confirmed references:

- `cli/add/src/commands/diff.ts`
- `cli/add/src/utils/namespaces.ts`
- `cli/add/src/commands/remove.ts`

Impact: users can lose the normal cleanup path for old installs after registry
evolution, exactly when a recovery path is most needed.

Fix:

- separate manifest records from current registry records
- make default `diff` skip/report unknown manifest entries instead of throwing
- make `remove --force` able to delete unknown manifest metadata and any
  still-owned recorded files, with an explicit warning

### Medium: Shadcn Namespace Docs Point At Root `/r/{name}.json` Paths

The shadcn namespace docs template maps `@ui` and `@diffgazer-keys` to
`https://<host>/r/{name}.json`, but committed public artifacts are emitted under
`/r/ui/*` and `/r/keys/*`.

Confirmed references:

- `libs/ui/docs/content/utils/shadcn-namespace.mdx`
- `libs/ui/scripts/build-publish-artifacts.ts`
- `libs/keys/scripts/build-publish-artifacts.ts`
- generated docs public artifacts under `apps/docs/public/r/ui/` and
  `apps/docs/public/r/keys/`

Impact: even after the host is live, users following namespace docs can configure
URLs that miss committed item JSON paths. This is distinct from the old-host
finding.

Fix:

- update namespace docs to include `/r/ui/{name}.json` and
  `/r/keys/{name}.json`
- add a docs/artifact test that namespace examples resolve to committed public
  registry files

### Medium: Public Shadcn Registry Catalogs Expose Hidden/Internal Items

The committed public `registry.json` catalogs include `meta.hidden: true` items
such as UI `dialog-shell` and keys `focusable`. Internal Diffgazer registry
consumers filter those through `getPublicItems()`, but shadcn treats
`registry.json` as the namespace/search catalog and does not define
`meta.hidden` as a public hiding control.

Confirmed references:

- `libs/ui/public/r/registry.json`
- `libs/keys/public/r/registry.json`
- `libs/registry/src/cli/registry.ts`
- `cli/add/src/utils/namespaces.ts`
- shadcn registry docs:
  `https://ui.shadcn.com/docs/registry/getting-started`

Impact: namespace consumers can discover or top-level install dependency-only
internals such as `@ui/dialog-shell`, `@ui/typeahead-buffer`,
`@ui/use-is-mobile`, or `@diffgazer-keys/focusable`, despite docs and `dgadd`
treating them as internal.

Fix:

- emit public catalog indexes with only non-hidden items
- still serve hidden item JSON where explicit registry dependencies need it
- add validation that `public/r/registry.json` excludes hidden items

### Medium: Shadcn Smoke Rewrites Registry JSON Instead Of Validating Static Bytes

`smoke-shadcn-install.mjs` rewrites every registry URL in served JSON to the
temporary smoke server before shadcn sees it. The committed public JSON still
carries absolute transitive dependency URLs generated from the registry origin.

Confirmed references:

- `scripts/monorepo/smoke-shadcn-install.mjs`
- `libs/ui/scripts/transform-public-registry-keys-imports.ts`

Impact: the consumer matrix can pass while actual static registry artifacts
would resolve transitive dependencies from a different origin. This is separate
from the old-host finding because the smoke itself mutates what it serves.

Fix:

- add a byte-for-byte static registry smoke path
- or split canonical direct-URL artifacts from namespace-preserving artifacts
- keep the current rewritten smoke only as a dev convenience, not release proof

### Medium: Shadcn `registry:style` Files Can Install Without Effective CSS Imports

Several public shadcn items include `registry:style` files targeting
`~/styles/*.css`, but those files are not imported by the installed component
tree or the base style seed. The smoke currently papers over at least one path
by manually appending a dialog CSS import before build.

Confirmed references:

- `libs/ui/public/r/dialog-shell.json`
- `libs/ui/public/r/code-block.json`
- `libs/ui/public/r/diff-view.json`
- `libs/ui/public/r/command-palette.json`
- `libs/ui/public/r/sidebar.json`
- `libs/ui/styles/styles.css`
- `scripts/monorepo/smoke-shadcn-install.mjs`

Impact: direct shadcn consumers can install/build successfully but miss required
component CSS unless they discover and import files such as `styles/dialog.css`,
`styles/code-block.css`, or `styles/diff-view.css` manually.

Fix:

- make shadcn-installed `styles/styles.css` import installed component style
  files, or keep side-effect CSS imports where shadcn can resolve them
- document/test explicit per-component style imports if that is the intended
  contract
- extend smoke to assert selectors for every installed `registry:style` target
  without manually importing them first

### Medium: Public Entrypoint IA Needs Product Split Completion

The target architecture is good:

- `docs.b4r7.dev`: docs plus registry host
- `diffgazer.b4r7.dev`: separate static product/install page for the local app
- future apps: `<app>.b4r7.dev`

Current gap:

- docs root is a thin library picker
- `diffgazer` docs are configured but disabled
- no separate `diffgazer.b4r7.dev` app/page/deploy config was found
- product/install content exists under the UI theme docs tree:
  `apps/docs/content/docs/ui/theme/diffgazer.mdx`

This is acceptable only if the separate product/install page is shipped and the
surfaces link intentionally.

### Medium: Diffgazer Product Install Content Is Indexed Under UI Theme Docs

`apps/docs/content/docs/ui/theme/diffgazer.mdx` is a Diffgazer quick-start page,
and the UI theme `meta.json` includes it in the Theme navigation. The sitemap
generator includes MDX routes, so the docs host can advertise product install
content under the UI theme path even after `diffgazer.b4r7.dev` exists.

Confirmed references:

- `apps/docs/content/docs/ui/theme/diffgazer.mdx`
- `apps/docs/content/docs/ui/theme/meta.json`
- `apps/docs/scripts/generate-sitemap.mjs`

Impact: product SEO and IA can split between `docs.b4r7.dev` and
`diffgazer.b4r7.dev`, with install instructions living in a UI-theme route.

Fix:

- move product/install content to the product host or a deliberate docs product
  section
- remove the UI-theme route from sitemap/nav if it is only a temporary preview
- set canonical links intentionally if duplicate docs/product content remains

### High: Missing Docs Pages Render As Indexable 200 Responses

The docs catch-all route returns `null` when an MDX page is missing, renders a
docs-not-found block, and emits normal SEO/canonical metadata for the requested
path instead of throwing a router 404. Root-level unknown routes return 404, but
missing docs pages under a library path can be crawled as successful canonical
pages.

Confirmed references:

- `apps/docs/src/routes/$lib/docs/$.tsx`
- `apps/docs/content/docs/ui/hooks/meta.json`
- `apps/docs/scripts/generate-sitemap.mjs`

Impact: broken docs URLs, including generated/navigation entries without MDX
content, can be indexed as real pages. This compounds the existing public
`floating-indicator` docs gap.

Fix:

- throw TanStack Router `notFound()` or otherwise return HTTP 404 for missing
  docs pages
- avoid canonical links for missing content
- add runtime tests for missing docs paths under each library

### Medium: Keys Introduction Links To Non-Page Section Routes

The Keys introduction links to `/keys/docs/hooks` and `/keys/docs/guides`, but
those directories contain only `meta.json` plus child pages, not `index.mdx`
pages.

Confirmed references:

- `apps/docs/content/docs/keys/index.mdx`
- `apps/docs/content/docs/keys/hooks/meta.json`
- `apps/docs/content/docs/keys/guides/meta.json`

Impact: public docs entry links can route users to section URLs with no actual
page content, relying on missing-doc fallback behavior.

Fix:

- add section index pages for hooks/guides
- or link directly to real child pages such as `/keys/docs/hooks/use-key` and
  `/keys/docs/guides/navigation`
- add docs link validation for all hand-authored MDX links

### Medium: SEO Metadata Needs Host And Card Cleanup

Confirmed issues:

- old canonical origin
- robots sitemap URL points to old host
- root defaults emit no canonical / `og:url`
- `summary_large_image` is emitted without `twitter:image` / `og:image`
- sitemap `lastmod` falls back to `new Date()` for source-less pages

Fix:

- update canonical origin to `docs.b4r7.dev`
- add root canonical and `og:url`
- add real social images or downgrade to `summary`
- use stable `lastmod` values or omit `lastmod` for source-less pages

### Low/Medium: Typography Is Brand-Consistent But Risky For Public Docs

The full docs app uses mono styling, `Typography` defaults to `font-mono
text-sm`, and MDX paragraphs are `text-sm`.

This can fit the brand, but public documentation prose is harder to scan.

Recommendation:

- keep mono for chrome, labels, code, and component identity
- use readable sans/base-size prose for long public docs

## Package And Registry Findings

### Blocker: Public Copy/Shadcn Registry Items Are Incomplete Or Broken

`SOTA-AUDIT.md` P0-1 is confirmed. At least three public UI registry entries
omit real imported source files from their `files[]`, so copy/shadcn/dgadd
installs can emit broken imports.

Confirmed incomplete entries:

- `menu`: `registry.json` omits `menu-group`, `menu-label`,
  `menu-item-checkbox`, `menu-item-radio`, and `menu-sub`; the omissions are
  imported by `libs/ui/registry/ui/menu/index.ts`, and `menu.tsx` also imports
  the checkbox/radio/sub files
- `navigation-list`: `registry.json` omits group/progress files imported by
  `libs/ui/registry/ui/navigation-list/index.ts`; it also omits
  `navigation-list-group-context.tsx`, imported by `navigation-list-item.tsx`
- `code-block`: `registry.json` omits `inline-code`, while
  `libs/ui/registry/ui/code-block/index.ts` imports it

Additional public copy break found in the third reconciliation pass:

- `stepper` and `horizontal-stepper` import `../shared/stepper.css` from their
  entry barrels
- both entries depend on `stepper-variants`
- `stepper-variants` installs that CSS as `~/styles/stepper.css`, not as a
  sibling `../shared/stepper.css`
- generated public JSON still contains the relative CSS import
- the shadcn smoke subset excludes both entries

Additional confirmed dependency gaps:

- `menu-sub` imports `floating-panel`, but `menu` does not declare that registry
  dependency
- `navigation-list-group` imports `icons`, but `navigation-list` does not
  declare that registry dependency
- `overflow-text` imports `popover` directly, but `overflow` declares only
  `tooltip` and relies on `tooltip`'s transitive `popover` dependency instead of
  declaring its direct registry closure

The validator also has a blind spot: `validate-registry-metadata.ts` skips
undeclared local imports when `namesByFile.get(importedPath)` is undefined, so
`pnpm --filter @diffgazer/ui validate:registry` can still pass.

Fix:

- add every imported local file to the owning registry item or split it into an
  explicit dependency item
- declare missing registry dependencies
- make registry validation fail on existing local imports that are not covered
  by the item or a declared dependency
- make validation catch CSS import target mismatches after registry target
  rewriting
- add regression tests for undeclared local imports

### Medium: `select` Registry Copy Relies On A Transitive Floating Dependency

`SelectContent` imports `FloatingSide` / `FloatingAlign` from
`@/hooks/use-floating-position` directly, but the `select` registry item declares
only `floating-panel`. `floating-position` arrives only as a transitive
dependency of `floating-panel`.

Confirmed references:

- `libs/ui/registry/ui/select/select-content.tsx`
- `libs/ui/registry/registry.json`
- `libs/ui/public/r/select.json`

Impact: the copied `select` source depends on a direct local hook that the item
does not declare. That is fragile for direct registry/copy validation and
belongs to the same closure class as other undeclared local imports.

Fix:

- declare `floating-position` as a direct registry dependency of `select`
- or avoid the direct source import from `SelectContent`
- extend validation to catch direct source imports satisfied only transitively

### Medium: `popover` Registry Copy Relies On A Transitive Floating Dependency

`PopoverContent` imports `FloatingSide` / `FloatingAlign` directly from
`@/hooks/use-floating-position`, but the `popover` registry item declares
`floating-panel`, not `floating-position`. The public item mirrors the same
closure gap.

Confirmed references:

- `libs/ui/registry/ui/popover/popover-content.tsx`
- `libs/ui/registry/registry.json`
- `libs/ui/public/r/popover.json`

Impact: copied `popover` source depends on a direct local hook that the item does
not declare. This is the same closure class as `select`, but it needs its own
registry fix and regression.

Fix:

- declare `floating-position` as a direct registry dependency of `popover`
- or avoid the direct source import from `PopoverContent`
- extend validation to catch all direct source imports satisfied only
  transitively

### Blocker: Scoped Npm Packages Are Not Published

Current npm state checked on 2026-05-22:

- `diffgazer`: published as `0.1.3`
- `@diffgazer/ui`: E404
- `@diffgazer/keys`: E404
- `@diffgazer/add`: E404

Local manifests look structurally prepared for publication, but public npm
commands must remain gated until `npm view` succeeds and post-publish consumer
checks pass.

### High: `dgadd --integration keys` Defaults To A Non-Resolvable Pending Keys Range

The CLI default for `--keys-version` is `^0.1.1`, and docs publish the same
default. The pending public release state reports `@diffgazer/keys -> 0.2.0`
while `@diffgazer/add` is `0.1.1`. Semver `^0.1.1` does not admit `0.2.0`, so
package-mode keyboard integration can fail even after scoped packages are
published. Current smoke coverage avoids the default by overriding
`--keys-version` with a local link.

Confirmed references:

- `cli/add/src/utils/add-integration.ts`
- `cli/add/src/commands/add.ts`
- `cli/add/README.md`
- `libs/ui/docs/content/cli/add.mdx`
- `scripts/monorepo/smoke-cli.mjs`
- `pnpm changeset status --verbose`

Fix:

- make the default keys range match the release-resolved `@diffgazer/keys`
  version before publishing
- update docs and CLI help together
- add smoke/dry-run coverage for `--integration keys` without a
  `--keys-version` override against packed/release-versioned artifacts

### Medium: `@diffgazer/keys` Tarball Ships Unexported Test Helpers

`@diffgazer/keys` exports only the package root and `./package.json`, but its
package files include the whole `dist` directory. The TypeScript build includes
`src/testing`, so `dist/testing/navigation-behavior.*` and
`dist/testing/test-utils.*` are emitted and packed. Those helpers import
Testing Library and Vitest/user-event APIs.

Confirmed references:

- `libs/keys/package.json`
- `libs/keys/tsconfig.json`
- `libs/keys/src/testing/navigation-behavior.ts`
- `libs/keys/dist/testing/navigation-behavior.js`
- `libs/keys/dist/testing/test-utils.js`

Impact: normal package consumers are protected by the export map, but the first
public tarball still contains an accidental test-only surface with dev/test
runner imports.

Fix:

- exclude `dist/testing/**` from package files
- or intentionally export a testing API and document/depend on its test-library
  requirements
- add tarball-content validation for test-only build outputs

### Medium: `@diffgazer/keys` Packs Incomplete Raw Registry/Docs Metadata

`libs/keys/package.json` intentionally packs `registry`, `public/r`, and
`internal-docs-manifest.json`, but the packed raw registry points to `src/...`
files that are not in the tarball. The internal docs manifest points to
`docs/content` and `docs/assets`, which are also not packed.

Confirmed references:

- `libs/keys/package.json`
- `libs/keys/registry/registry.json`
- `libs/keys/internal-docs-manifest.json`

Impact: normal package exports and `public/r` are separate, but consumers or
tooling that inspect the packed raw registry/docs metadata receive paths that
cannot resolve.

Fix:

- remove raw internal manifests from package `files`
- or pack the referenced source/docs paths deliberately
- add tarball-reference validation for every packed manifest

### Medium: `@diffgazer/ui` Packs Hidden Registry Hook/Lib Outputs

The UI package intentionally omits hidden registry items from package exports,
but `tsup.config.ts` emits every non-theme registry item, including
`meta.hidden` entries. `libs/ui/package.json` packs all of `dist` except a small
known denylist, so hidden hook/lib outputs are included in the npm tarball even
though they are not public exports.

Confirmed references:

- `libs/ui/tsup.config.ts`
- `libs/ui/package.json`
- `libs/ui/registry/registry.json`
- `scripts/monorepo/validate-artifacts.mjs`
- `scripts/monorepo/artifacts/pack-surface.mjs`

Impact: the first public tarball can expose hidden internal hook/lib build
outputs such as `use-is-mobile`, `typeahead-buffer`, and shared variant/search
helpers as unexported package files.

Fix:

- skip `item.meta?.hidden` during UI package entry generation
- or explicitly exclude hidden outputs from package `files`
- extend pack-surface validation to reject hidden registry outputs

### High: Package-Mode Artifacts Are Excluded From Published Tarballs

Governance says `@diffgazer/ui` and `@diffgazer/keys` build docs/registry
artifacts into `dist/artifacts` and that docs can sync from packages when
resolvable. Package-mode artifact loading requires
`dist/artifacts/artifact-manifest.json` inside the installed package, but both
package manifests exclude `dist/artifacts` from publication.

Confirmed references:

- `PACKAGE_GOVERNANCE.md`
- `libs/registry/src/artifact-loader.ts`
- `libs/ui/package.json`
- `libs/keys/package.json`

Impact: workspace docs artifact sync can pass while real installed package-mode
artifact consumption fails after publish because the artifact manifest is absent
from the tarball.

Additional reconciliation correction: the current artifact validator explicitly
rejects packed `dist/artifacts/` files, so the "include `dist/artifacts` in
package files" option below requires changing the validator and governance
contract together. It is not a one-line package manifest fix.

Confirmed additional references:

- `scripts/monorepo/artifacts/pack-surface.mjs`
- `scripts/monorepo/validate-artifacts.mjs`
- `PACKAGE_GOVERNANCE.md`

Fix:

- either include `dist/artifacts` in publishable package files and update the
  pack-surface validator to allow that intentional artifact surface
- or change docs/package artifact handoff to consume a separately published
  artifact surface
- add `pnpm pack --dry-run` or tarball-content checks to release validation

### Medium: UI Package Declarations Leak Internal CSS Imports

`@diffgazer/ui` exposes package component declarations that re-export internal
registry declarations. For CSS-backed components such as `callout`, `panel`,
`stepper`, and `horizontal-stepper`, those internal `.d.ts` files still contain
side-effect imports like `../shared/panel.css`. Package mode documents
centralized CSS imports through `@diffgazer/ui/sources.css` and
`@diffgazer/ui/styles.css`, not internal registry CSS paths.

Confirmed references:

- `libs/ui/package.json`
- `libs/ui/dist/components/callout.d.ts`
- `libs/ui/dist/_types/registry/ui/callout/index.d.ts`
- `libs/ui/dist/_types/registry/ui/panel/index.d.ts`
- `libs/ui/dist/_types/registry/ui/stepper/index.d.ts`
- `libs/ui/scripts/build-declarations.ts`
- `libs/ui/README.md`

Impact: npm package consumers can hit strict TypeScript/bundler/declaration
validation failures from unresolved internal CSS imports, even when following
the documented package CSS contract.

Fix:

- strip CSS side-effect imports from package declarations, or rewrite them to
  the public package CSS contract
- keep copy-mode registry CSS imports separate from npm declaration output
- add declaration-surface validation for unresolved `.css` imports

### High: Public Registry Installability Is Representative, Not Exhaustive

Current smoke tests prove representative flows:

- direct URL / namespace shadcn install subset
- `dgadd` subset
- package smoke subset

They do not exhaustively install/build every public item across every intended
path. The second pass counted 58 visible UI items and 4 visible keys items, while
the shadcn smoke covers a smaller hardcoded subset.

Fix:

- keep representative smoke for PR speed
- add slower release/nightly all-item matrix
- cover direct URL, namespace, `dgadd`, package, and copy-from-source paths

Do not make the all-item matrix an every-PR blocker unless runtime is acceptable.

### Medium: Registry Dependency Allowlist Governance Is Missing

Generated public `registryDependencies` are currently localizable URLs, but
schemas accept arbitrary strings and validation does not enforce an all-item
allowed-origin/path policy.

Fix:

- allow only approved origins
- allow only `/r/{ui,keys}/{item}.json` paths by default
- block arbitrary external registry URLs unless explicitly approved
- fail validation before public artifacts are committed

### Medium: Governance Points Schema Gating At Wrong Registry Surface

`PACKAGE_GOVERNANCE.md` says JSON `$schema` references at
`https://diffgazer.com/schema/diffgazer.json` inside
`libs/{ui,keys}/public/r/*.json` are shadcn machine references. The actual
public registry item JSON uses the shadcn schema
`https://ui.shadcn.com/schema/registry-item.json`. The Diffgazer schema is the
served `dgadd` config schema at `apps/docs/public/schema/diffgazer.json`, and
`dgadd init` points generated configs at the registry origin.

Confirmed references:

- `PACKAGE_GOVERNANCE.md`
- `libs/ui/public/r/button.json`
- `libs/keys/public/r/navigation.json`
- `apps/docs/public/schema/diffgazer.json`
- `cli/add/src/commands/init.ts`

Impact: release governance can focus schema gating on a surface that does not
exist in the public registry artifacts while missing the real `dgadd`
configuration-schema host and compatibility checks.

Fix:

- remove or correct the stale governance claim
- document shadcn registry item schemas separately from the Diffgazer config
  schema
- add release checks for `apps/docs/public/schema/diffgazer.json` and generated
  `dgadd init` `$schema` URLs

### High: `dgadd init` Then `dgadd add` Can Duplicate Component CSS

`dgadd init` writes component CSS without dgadd ownership markers, while
`dgadd add` detects only marker-wrapped chunks. Running `init` and then adding
items that include the same CSS can duplicate CSS in the consumer project.

Confirmed references:

- `cli/add/src/commands/init.ts`
- `cli/add/src/commands/add/css-ops.ts`

Fix:

- write initial copied CSS with the same marker/ownership metadata
- or make add-time CSS detection recognize the unmarked init block safely
- add an init-then-add regression test

### Medium: `dgadd add` Can Leave Files Without Ownership Metadata

Install plan application writes files and handles dependency work before the
`onApplied` callback records `installedComponents`. If config/manifest writing
fails afterward, copied files can remain without ownership metadata.

Confirmed references:

- `libs/registry/src/cli/workflows/apply-install-plan.ts`
- `cli/add/src/commands/add.ts`
- `cli/add/src/commands/add/manifest.ts`
- `libs/registry/src/cli/config.ts`

Impact: later `dgadd remove`, `list --installed`, and ownership-safe cleanup can
miss files that were actually written.

Fix:

- stage manifest/config updates atomically with file writes
- or roll back files/deps if ownership metadata cannot be written
- test a writable target tree with an unwritable config file

### Medium: `dgadd diff` Reports Installed CSS Chunks As Missing

`dgadd add` skips registry `.css` files as normal component file writes and
installs their contents as marked chunks in the configured CSS file. `dgadd
diff` maps every `item.files` entry, including `.css`, to a normal local file
path, then also adds CSS chunk drift checks. Correctly installed CSS-backed items
can therefore report their raw CSS files as "not installed".

Confirmed references:

- `cli/add/src/commands/add/file-ops.ts`
- `cli/add/src/commands/add/css-ops.ts`
- `cli/add/src/commands/diff.ts`
- `libs/registry/src/cli/workflows/diff.ts`
- `libs/ui/registry/registry.json`

Impact: the public drift/update workflow can produce false missing-file reports
for components such as `code-block`, `dialog-shell`, `sidebar`,
`command-palette`, `callout`, `panel`, or `stepper-variants`.

Fix:

- exclude CSS registry files from normal file diff mapping when they are managed
  as chunks
- keep CSS chunk drift checks as the source of truth for managed CSS
- add a `dgadd add` then `dgadd diff` regression test for CSS-backed items

### Medium: `dgadd remove` Preview And Confirmation Omit CSS Edits

The shared remove workflow previews and confirms only the file set it receives.
The `@diffgazer/add` command removes owned CSS chunks afterward and writes the
configured CSS entry file outside that preview/confirmation plan.

Confirmed references:

- `libs/registry/src/cli/workflows/remove.ts`
- `cli/add/src/commands/remove.ts`
- `cli/add/src/commands/add/css-ops.ts`

Impact: for CSS-backed public copy installs, `dgadd remove --dry-run` and the
interactive confirmation can omit the fact that the Tailwind/CSS entry file will
also be modified.

Fix:

- include planned CSS chunk removals in dry-run output and confirmation copy
- treat the CSS entry write as a first-class remove operation
- add dry-run/interactive tests for CSS-backed removals

### Medium: `dgadd remove` Can Orphan CSS After Manifest Ownership Is Deleted

The shared remove workflow deletes component files and updates manifest ownership
before the CLI-specific CSS cleanup writes the CSS entry file. If that later CSS
write fails, the manifest entry is gone while the `dgadd:css` chunk remains in
user CSS.

Confirmed references:

- `libs/registry/src/cli/workflows/remove.ts`
- `cli/add/src/commands/remove.ts`
- `cli/add/src/commands/add/css-ops.ts`

Fix:

- plan CSS edits before confirmation
- make file, manifest, and CSS changes transactional or recoverable
- preserve ownership metadata when CSS cleanup fails

### Medium: CSS Chunk Updates Are Append-Only

CSS chunk identity is only the content hash. On reinstall, missing hashes are
appended, while the manifest preserves old hashes alongside new ones. `dgadd
diff` compares only hashes already in the manifest and cannot map an old chunk
to its upstream replacement when the source CSS changed.

Confirmed references:

- `cli/add/src/commands/add/css-ops.ts`
- `cli/add/src/commands/add/manifest.ts`
- `cli/add/src/commands/diff.ts`

Impact: when public registry CSS changes between releases, rerunning `dgadd add`
can accumulate stale CSS chunks instead of replacing them, and `dgadd diff`
cannot present the old-to-new CSS replacement accurately.

Fix:

- track CSS chunks by stable source identity as well as content hash
- replace/update owned chunks for the same source path instead of only appending
- add upgrade tests for changed registry CSS

### Medium: `dgadd remove` Can Lose Manifest Ownership After Partial Delete Failure

The remove workflow logs `rmSync` failures but removes planned manifest entries.
If a file delete fails, ownership metadata can be lost while the file remains.

Confirmed reference:

- `libs/registry/src/cli/workflows/remove.ts`

Fix:

- only update the manifest after successful file operations
- keep a recoverable failure state for partially removed items
- test filesystem failure behavior

### Medium: `dgadd remove` Feedback Can Be Misleading For Partially Blocked Items

If one owned file was modified, `collectFilesToRemove` can skip the whole item.
The command can then report that no installed files were found instead of
explaining that removal was blocked by local modifications.

Confirmed reference:

- `libs/registry/src/cli/workflows/remove.ts`

Fix:

- report blocked files separately from missing files
- keep retained manifest state explicit
- add a test for one-modified-file blocks

### Medium: `dgadd remove --force` Cannot Recover Missing Ownership Metadata

The remove help says `--force` removes files even when ownership metadata is
missing, but `cli/add` first expands removals only from manifest entries. If
`installedComponents` is missing, `toRemove` is empty and the shared workflow
returns before the force bypass in `canRemoveFile` can run.

Confirmed references:

- `libs/registry/src/cli/command-factories.ts`
- `cli/add/src/commands/remove.ts`
- `libs/registry/src/cli/workflows/remove.ts`
- `cli/add/src/commands/cli-behavior.test.ts`

Impact: users cannot use the advertised force recovery path after manifest
ownership metadata is lost; the command can exit successfully while leaving
installed files in place.

Fix:

- make force mode resolve candidate files from the registry item paths when
  manifest ownership is absent
- distinguish "not installed" from "metadata missing"
- add a regression test for force removal after deleting `installedComponents`

### Medium: Orphan Dependency Guidance Ignores Integration Mode

The remove command prints orphan npm dependency guidance without considering
whether the project used copy, package, direct registry, or another integration
mode.

Confirmed references:

- `cli/add/src/commands/remove.ts`
- `libs/registry/src/cli/workflows/remove.ts`
- `cli/add/src/utils/add-integration.ts`

Fix:

- include integration mode in remove planning
- only print dependency advice that applies to that mode

### Low/Medium: Concurrent Manifest Writes Can Race

`updateManifest` performs read-modify-write without a lock or optimistic
version. Concurrent `dgadd` operations can lose manifest updates.

Confirmed reference:

- `libs/registry/src/cli/config.ts`

Fix:

- serialize manifest writes
- or add optimistic conflict detection and retry

### Medium: `lowlight` Optional Peer Is Undocumented And Under-Tested

`@diffgazer/ui` declares `lowlight` as an optional peer and lazy-loads it for
code-block highlighting. README/governance document `figlet`, but not
`lowlight`.

Severity correction: this is not a common import blocker because code block
highlighting can render plain text without a lowlight instance. It is a
docs/test gap.

The nineteenth reconciliation pass tightened this: copy/shadcn registry metadata
currently installs `lowlight` unconditionally for the base `code-block` item,
while public docs say the dependency is optional and the highlighted example
uses `CodeBlockHighlight` without passing a `lowlight` instance. That example
therefore renders plain text despite being the syntax-highlighting path.

Confirmed additional references:

- `libs/ui/registry/registry.json`
- `libs/ui/public/r/code-block.json`
- `libs/ui/registry/component-docs/code-block.ts`
- `libs/ui/registry/examples/code-block/code-block-highlighted.tsx`
- `libs/ui/registry/ui/code-block/code-block-highlight.tsx`
- `libs/ui/registry/ui/code-block/code-block.test.tsx`

Fix:

- document when users need `lowlight`
- add package smoke for the optional lowlight path
- keep copy-mode and package-mode docs aligned

## UI, Keys, And Public Contract Findings

### Medium: Keys Navigation Drops Mixed Selector Groups

`getNavigationItems` supports data-contract selectors, role selectors, and native
selectors, while docs describe role plus `data-value` and
`getNavigationItemProps()` as interchangeable item contracts. The implementation
returns only the first non-empty selector group, so a mixed list can silently
drop later role/native items from keyboard navigation instead of preserving DOM
order.

Confirmed references:

- `libs/keys/src/dom/navigation-items.ts`
- `libs/keys/src/dom/navigation-items.test.ts`
- `apps/docs/content/docs/ui/integrations/keys-navigation.mdx`

Impact: consumers mixing documented navigation item contracts in one list can get
partial keyboard navigation, with only data-contract items selected and later
role/native items skipped.

Fix:

- merge all supported selector matches, de-duplicate, and sort by DOM order
- keep typed data-contract filtering so mixed widget types remain separated
- update docs/tests to state and enforce the exact mixed-contract behavior

### Medium: Keys Listbox Examples Expose Visual Highlight Without Active-Option Semantics

Public `useNavigation`, `useScopedNavigation`, and `useFocusZone` examples use
`role="listbox"` / `role="option"` and update `aria-selected`, but they neither
move DOM focus to the active option nor set `aria-activedescendant` from the
focused listbox. One guide snippet also lacks `tabIndex`, so the copied listbox
is not keyboard-focusable.

Confirmed references:

- `libs/keys/docs/content/guides/navigation.mdx`
- `libs/keys/registry/examples/use-navigation/use-navigation-basic.tsx`
- `libs/keys/registry/examples/use-scoped-navigation/use-scoped-navigation-basic.tsx`
- `libs/keys/registry/examples/use-focus-zone/use-focus-zone-basic.tsx`
- `libs/keys/src/hooks/use-navigation.ts`

Impact: keyboard state can change visually while assistive tech has no active
option relationship.

Fix:

- either move focus to the active option or use listbox
  `aria-activedescendant`
- ensure copied listbox containers are focusable
- add docs/example a11y tests for active-option exposure

### Medium: Keys Tabs Examples Omit Required Tab/Panel Relationships

Public tabs examples demonstrate roving focus and `aria-selected`, but tabs have
no stable `id`, no `aria-controls`, and the tabpanel has no `aria-labelledby`.

Confirmed references:

- `libs/keys/registry/examples/use-navigation/use-navigation-tabs.tsx`
- `libs/keys/docs/content/guides/navigation.mdx`

Impact: copy consumers get an incomplete accessible tabs pattern from the
handoff examples.

Fix:

- add stable ids, `aria-controls`, and panel `aria-labelledby`
- or route examples through the public Tabs primitive if that is the intended
  pattern
- add an example test for tab/panel relationships

### High: Command Palette/Search Examples Are Keyboard-Inert While The Input Is Focused

`KeyboardProvider` ignores editable targets unless a registration opts into
input handling. `useScopedNavigation` does not expose or pass an `allowInInput`
option, while the playground command-palette and global-search demos autofocus
an input and advertise Escape, Arrow, and Enter handling.

Confirmed references:

- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/src/hooks/use-scoped-navigation.ts`
- `libs/keys/examples/playground/src/demos/command-palette.tsx`
- `libs/keys/examples/playground/src/demos/global-shortcuts.tsx`

Impact: the visible keyboard contract does not work in the state users naturally
enter first. This also conflicts with the ARIA combobox/search pattern class,
where navigation keys are expected to be handled while focus remains in the
input.

Fix:

- expose/pass an explicit `allowInInput` option for scoped navigation cases that
  own the input interaction
- or wire owned input `onKeyDown` handlers directly for these examples
- add keyboard tests that start with focus in the search/command input

### Medium: Public `useKey` Docs Teach Browser-Reserved Shortcuts Without `preventDefault`

The public docs say `preventDefault` defaults to `false`, but examples bind
browser-reserved shortcuts such as `mod+k`, `ctrl+u`, and arrow keys without
passing options that prevent the browser/default text-editing behavior.

Confirmed references:

- `libs/keys/docs/api.md`
- `libs/keys/docs/content/api/hotkey-format.mdx`
- `libs/keys/registry/examples/use-key/use-key-basic.tsx`
- `libs/keys/registry/examples/use-key/use-key-map.tsx`

Impact: copied examples can produce unreliable shortcuts, browser chrome
conflicts, or unexpected input/page behavior even when the hook itself behaves
as documented.

Fix:

- add `preventDefault: true` where examples intentionally own reserved keys
- or switch docs examples to non-reserved shortcuts
- add docs/example validation for shortcuts that require default prevention

### Medium: Duplicate Scope Names Do Not Isolate Layer Instances

`KeyboardProvider` routes by active scope name and then looks up all handlers
registered under that string. `useScope()` returns only the name, while docs say
scopes are exclusive layers and mention unique internal IDs.

Confirmed references:

- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/src/hooks/use-scope.ts`
- `libs/keys/docs/content/guides/scopes.mdx`

Impact: two nested scopes with the same name, for example two `"modal"` layers,
share a handler namespace. Outer-layer shortcuts can still fire while the inner
same-named layer is active.

Fix:

- route registrations through a scope instance token
- or document same-name scopes as intentionally shared and require unique names
  for nested layers
- add nested same-name scope behavior tests

### Medium: `useFocusZone.getKeyOptions()` Cannot Preserve `scope: null`

`UseKeyOptions.scope = null` is the public escape hatch for "do not register".
`useFocusZone().getKeyOptions()` merges with `extra?.scope ?? scope`, so an
explicit `null` is replaced by the focus-zone scope.

Confirmed references:

- `libs/keys/src/hooks/use-key.ts`
- `libs/keys/src/hooks/use-focus-zone.ts`

Impact: the helper violates the normal `useKey` contract for conditional
registrations and can register shortcuts the consumer explicitly disabled.

Fix:

- preserve `extra.scope` when the property exists, including `null`
- add a behavior test for `getKeyOptions({ scope: null })`

### Medium: Dialog/Modal Examples Teach Incomplete Dialog Semantics

The focus-and-scroll guide and playground dialog examples render modal-looking
`role="dialog"` regions without complete modal semantics such as `aria-modal`,
an accessible name, and consistent focus behavior.

Confirmed references:

- `libs/keys/docs/content/guides/focus-and-scroll.mdx`
- `libs/keys/examples/playground/src/demos/focus-trap.tsx`
- `libs/keys/examples/playground/src/demos/scoped-dialog.tsx`

Impact: public examples teach incomplete dialog patterns at the same layer where
the library is trying to establish keyboard/focus primitives.

Fix:

- add labelled titles, `aria-modal="true"`, and tested focus movement/trapping
  where examples are modal
- or avoid `role="dialog"` for non-modal temporary panels
- add example-level accessibility checks

### Low/Medium: Utility Docs Put An Option Data Contract On A Native Button

The utilities docs demonstrate
`<button {...getNavigationItemProps("option", "activity")}>`. That teaches an
option-typed navigation item on native button semantics outside a listbox
pattern.

Confirmed reference:

- `libs/keys/docs/content/api/utilities.mdx`

Fix:

- use `"button"` for a native button example
- or show `"option"` only inside a labelled/focusable listbox with matching
  option semantics

### Medium: Public Navigation Copy Teaches A Non-Existent Data Attribute

Source comments/examples in public navigation hooks still tell consumers to use
`data-nav-item`, while the actual exported data contract is
`data-diffgazer-navigation-item`. The source comments are embedded in the public
copy registry output.

Confirmed references:

- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/hooks/use-scoped-navigation.ts`
- `libs/keys/src/dom/navigation-items.ts`
- `libs/keys/public/r/navigation.json`

Impact: copy-mode consumers can follow public source guidance and write markup
that only works accidentally through role fallback, not through the documented
data contract.

Fix:

- update comments/examples to use `data-diffgazer-navigation-item`
- or direct consumers to `getNavigationItemProps()` only
- add docs/source validation for stale data-contract names

### High: `useActionRowNavigation` Does Not Fire `onAction` For Documented Button Examples

The public hook docs say Enter/Space activates the focused action, and examples
show native buttons without their own `onClick`. The implementation returns early
when focus is already on the registered action, so `onAction` does not fire in
that documented setup. Existing tests pass because the fixture wires `onClick`
manually.

Confirmed references:

- `libs/keys/src/hooks/use-action-row-navigation.ts`
- `libs/keys/docs/content/hooks/use-action-row-navigation.mdx`
- `libs/keys/src/hooks/use-action-row-navigation.test.tsx`

Impact: package-mode consumers can get focus movement but no activation when
following the public example.

Fix:

- either fire `onAction` for focused registered actions
- or change docs/examples to require explicit button handlers
- add a behavior test matching the documented button example

### High: `matchesHotkey` Ignores Unsupported Modifier Segments

The hotkey parser stores every pre-key segment in `mods`, normalizes only
`mod`, then compares only `ctrl`, `meta`, `shift`, and `alt`. Unsupported or
typoed modifiers are silently ignored, so strings such as `cmd+k`, `control+s`,
or `shifted+Enter` can match bare `k`, `s`, or Enter.

Confirmed references:

- `libs/keys/src/dom/keyboard-utils.ts`
- `libs/keys/docs/content/api/hotkey-format.mdx`
- `libs/keys/docs/api.md`
- `libs/keys/public/r/navigation.json`

Impact: public package/copy consumers can ship typoed shortcuts that fire more
broadly than intended.

Fix:

- reject unknown modifier segments or make `matchesHotkey` return false
- document supported aliases explicitly if more aliases are desired
- add tests for typoed modifiers and unsupported aliases

### Medium: Equivalent Hotkey Aliases Bypass Last-Registered Priority

KeyboardProvider docs promise last-registered-to-first handler priority. The
dispatcher iterates raw hotkey map entries in insertion order and reverses only
entries for the same raw string. Equivalent aliases such as `esc` and `Escape`
can therefore run in raw-string insertion order instead of global registration
order.

Confirmed references:

- `libs/keys/docs/content/api/keyboard-provider.mdx`
- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/src/dom/keyboard-utils.ts`

Impact: an earlier `useKey("esc")` fallback can win over a later
`useKey("Escape")` primary handler even though both match the same event.

Fix:

- canonicalize hotkeys at registration
- or collect all matching entries and sort by registration id before dispatch
- add alias-priority tests for `esc`/`Escape` and other supported aliases

### Medium: Shifted Printable Punctuation Hotkeys Are Documented But Not Matchable

Public source advertises strings like `shift+/`, but `KeyboardEvent.key`
contains the shifted printable character, so Shift+/ arrives as `?`, not `/`.
The same `+`-delimited parser cannot represent `+` itself.

Confirmed references:

- `libs/keys/src/hooks/use-key.ts`
- `libs/keys/src/dom/keyboard-utils.ts`
- MDN `KeyboardEvent.key`

Impact: documented shortcuts such as `shift+/`, plus-key shortcuts, and similar
punctuation bindings can fail to fire while appearing valid in public API docs.

Fix:

- add an escaped delimiter or key descriptor format
- or support explicit aliases such as `question` and `plus`
- add tests for shifted punctuation and plus-key shortcuts

### Medium: Public `useScope` Examples Teach Broken Unscoped `useKey` For Conditional Layers

The `useScope` JSDoc and focus/scroll guide show `useScope("dialog",
{ enabled: open })` followed by unscoped `useKey`. `useKey` binds to the current
scope at registration time; when a layer is mounted while closed, the handler can
register globally and then fail to fire after the layer opens. The scopes guide
already contains the safer pattern: pass the returned scope into `useKey`.

Confirmed references:

- `libs/keys/src/hooks/use-scope.ts`
- `libs/keys/docs/content/guides/focus-and-scroll.mdx`
- `libs/keys/src/hooks/use-key.ts`
- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/docs/content/guides/scopes.mdx`

Fix:

- update examples to `const scope = useScope(...); useKey(..., { scope })`
- add a docs/example behavior test for mounted-closed layers

### Medium: Focus Zone Null-Transition Docs Contradict Behavior

`useFocusZone` docs say returning `null` blocks movement. The implementation
returns `DECLINE` when the transition is null/invalid, and tests lock that in as
falling through to lower-priority listeners.

Confirmed references:

- `libs/keys/src/hooks/use-focus-zone.ts`
- `libs/keys/src/hooks/use-focus-zone.test.ts`
- `libs/keys/docs/content/guides/focus-zones.mdx`
- `libs/keys/docs/hook-docs/use-focus-zone.ts`

Impact: public keyboard docs teach consumers that `null` stops boundary handling,
while the hook intentionally lets lower-priority/global handlers run.

Fix:

- update docs to say `null` declines zone handling and allows fallthrough
- or change implementation/tests if blocking is the intended public contract
- add docs/API signature tests for transition semantics

### Low/Medium: Keys Docs Understate Nullable Highlight And Owner-Document APIs

`useNavigation` and `useScopedNavigation` source types allow nullable highlight
callbacks and imperative clearing with `highlight(null)`, but docs publish
`(value: string) => void`. `useFocusRestore.capture` accepts an optional
`ownerDocument`, but docs omit that parameter.

Confirmed references:

- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/hooks/use-scoped-navigation.ts`
- `libs/keys/src/hooks/use-focus-restore.ts`
- `libs/keys/docs/hook-docs/use-navigation.ts`
- `libs/keys/docs/hook-docs/use-focus-restore.ts`
- `libs/keys/docs/api.md`

Impact: docs consumers miss public contracts for clearing highlight and
owner-document-safe focus capture in iframe/alternate-document cases.

Fix:

- align generated/hand-authored docs with source signatures
- add docs validation for nullable callback parameters and optional args

### Medium: Public Keys Root Exports Are Missing From Docs Tables

`isEditableElement` and `isInputElement` are exported from the keys package root
and declaration output, but README/API utility tables omit them.

Confirmed references:

- `libs/keys/src/index.ts`
- `libs/keys/dist/index.d.ts`
- `libs/keys/src/dom/keyboard-utils.ts`
- `libs/keys/README.md`
- `libs/keys/docs/content/api/utilities.mdx`

Fix:

- document the exact public contract for both helpers
- or remove them from the root export before public handoff
- add docs/export parity validation

### Medium: Keys Registry Handoff Test Misses Package-Only API Leakage In Item JSON

The handoff test checks `public/r/registry.json`, whose file entries do not
contain copied file content. Real content lives in per-item JSON files. Current
`focus-trap.json` exposes `useKey` in copied JSDoc even though `useKey` is
package-only; this is comment-only today, but the gate would also miss future
real imports.

Confirmed references:

- `libs/keys/src/registry-handoff.test.ts`
- `libs/keys/public/r/focus-trap.json`
- `libs/keys/src/hooks/use-focus-trap.ts`
- `libs/keys/README.md`

Fix:

- load each `public/r/*.json` item when scanning public copied content
- validate actual imports/identifiers instead of prose words
- add a fixture that fails if package-only exports appear in public copy content

### Medium: Provider-Backed Key Handling Is Not Owner-Document Safe

`KeyboardProvider` filters events against a container's owner view, but installs
the actual `keydown` listener only on the host `window`. Hooks that accept an
iframe-owned `containerRef` therefore do not receive key events originating in
that container's `ownerDocument`.

Confirmed references:

- `libs/keys/src/providers/keyboard-provider.tsx`

Impact: `useKey`, `useScopedNavigation`, and `useFocusZone` can appear to support
alternate-document containers while silently ignoring their keyboard events.

Fix:

- install listeners on the relevant owner document/window for registered
  container refs
- or document single-document support and reject alternate-document refs
- add iframe/ownerDocument tests for provider-backed hooks

### Medium: `useFocusRestore` Stack Is Global Across Documents

`useFocusRestore` keeps one module-level stack. Captures from independent owner
documents can suppress each other because restore succeeds only for the global
top entry.

Confirmed references:

- `libs/keys/src/hooks/use-focus-restore.ts`

Impact: overlays in a main document and iframe/alternate document can make an
otherwise valid restore return false or restore the wrong stack order.

Fix:

- keep restore stacks per owner document
- add iframe/alternate-document restore tests

### High: `useFocusTrap` Does Not Suspend Older Traps

`useFocusTrap` comments say `useFocusRestore` keeps outer traps dormant while an
inner trap is active, but every enabled trap installs owner-document capture
listeners. The outer trap's `focusin` handler recaptures any focus target
outside its own container and has no top-active-trap guard.

Confirmed references:

- `libs/keys/src/hooks/use-focus-trap.ts`
- `libs/keys/registry/registry.json`
- `libs/keys/docs/content/guides/focus-and-scroll.mdx`
- `libs/ui/registry/ui/shared/dialog-shell.tsx`

Impact: public copy/package consumers of the `focus-trap` hook can get focus
bounced back to an outer dialog when opening nested or portaled overlays. The UI
`DialogShell` works around this locally with its own top-shell gate, but the
public keys hook and docs still expose the weaker behavior.

Fix:

- add a stack/top-active-trap guard inside `useFocusTrap` itself
- update docs that currently describe listener placement/nested behavior
- add nested and portaled trap tests for the public hook, not only UI wrappers

### High: `StepperTrigger` Drops Consumer `onFocus`

`StepperTriggerProps` inherits native button `onFocus`, and the component
destructures `onFocus`, but it never calls or forwards it.

This is a public prop contract bug.

Fix:

- call `onFocus?.(event)` in the rendered button handler
- add a behavior test that consumer `onFocus` fires

### Medium: Stepper Reimplements Generic Keyboard Navigation In `libs/ui`

`Stepper` owns roving tab index and Arrow/Home/End navigation locally. The
behavior is tested, but it is generic keyboard-first navigation that likely
belongs in `@diffgazer/keys` or should be explicitly justified as separate
Stepper semantics.

Fix:

- route through `@diffgazer/keys` public navigation utilities, including copy
  registry dependencies
- or document why Stepper owns different behavior

### Medium: `NavigationList.Group` Collapse Is Mouse-Only

NavigationList docs explicitly describe group expand/collapse as mouse-only.
Implementation renders group headers as `div aria-hidden="true"` with `onClick`
only, while the public API exposes `expanded`, `defaultExpanded`, and
`onExpandedChange`.

Confirmed references:

- `libs/ui/registry/component-docs/navigation-list.ts`
- `libs/ui/registry/ui/navigation-list/navigation-list-group.tsx`

Impact: a collapsed public navigation group can hide items with no keyboard or
screen-reader path to reopen it. This is separate from the already documented
`navigation-list` registry missing-file issue.

Fix:

- make group toggles keyboard-operable and exposed with correct semantics
- or remove collapsed-group public API before handoff
- add keyboard/a11y tests for collapsed and expanded groups

### Medium: Tooltip Docs Examples Are Not Keyboard-Reachable

Tooltip docs claim the tooltip shows on focus and hides on blur, but the basic
and placement examples use plain `span` triggers. The passive hover trigger path
keeps noninteractive spans non-focusable, so those examples cannot demonstrate
the documented keyboard behavior.

Confirmed references:

- `libs/ui/registry/component-docs/tooltip.ts`
- `libs/ui/registry/examples/tooltip/tooltip-basic.tsx`
- `libs/ui/registry/examples/tooltip/tooltip-placement.tsx`
- `libs/ui/registry/ui/popover/popover-trigger.tsx`

Impact: public docs teach copyable tooltip usage that is hover/touch reachable
but not Tab/focus reachable, conflicting with the documented accessibility
contract.

Fix:

- use native focusable triggers for public tooltip examples
- or make passive noninteractive tooltip triggers focusable with explicit
  semantics where appropriate
- add a docs/example accessibility smoke for tooltip focus behavior

### Medium: Disabled Tooltip Example Bypasses Disabled-Native Wrapper

The interactive tooltip example renders a disabled native button through the
render-prop trigger path. That path passes hover/focus handlers directly to the
disabled button and bypasses the non-render-prop disabled-native wrapper, so the
example trigger cannot receive focus or pointer events that would show the
tooltip.

Confirmed references:

- `libs/ui/registry/examples/tooltip/tooltip-interactive.tsx`
- `libs/ui/registry/ui/popover/popover-trigger.tsx`

Impact: the public disabled-control tooltip example appears to demonstrate a
supported accessibility pattern but does not work through the intended event
surface.

Fix:

- update the example to use the normal child path that wraps disabled native
  controls
- or support disabled-native wrapping in the render-prop API explicitly
- add a regression test for disabled tooltip triggers

### Medium: `CodeBlock.Content` Can Emit Dangling Accessible-Name References

`CodeBlock.Content` falls back to `context.labelId` for `aria-labelledby` when
no explicit name is passed. The bare code-block example renders no label, and
`CodeBlock.Header` returns `null` for bare variants. Because `ScrollArea`
promotes named content to a focusable region, public examples can produce a
keyboard-focusable code region with a dangling `aria-labelledby`.

Confirmed references:

- `libs/ui/registry/ui/code-block/code-block-content.tsx`
- `libs/ui/registry/examples/code-block/code-block-bare.tsx`
- `libs/ui/registry/ui/code-block/code-block-header.tsx`
- `libs/ui/registry/ui/code-block/code-block.tsx`
- `libs/ui/registry/component-docs/code-block.ts`
- `libs/ui/registry/ui/scroll-area/scroll-area.tsx`

Impact: public docs/examples can break accessible names despite docs promising
label fallback behavior.

Fix:

- only emit `aria-labelledby` when a rendered label exists
- use the root fallback label for bare/no-label content
- add a bare code-block accessibility test

### Medium: Toast Persistence Is Overridden By Capacity Eviction

Toast docs and store comments say loading/error/action toasts can persist
indefinitely, but `resolveNextToasts` unconditionally evicts the oldest toast
when more than five are present.

Confirmed references:

- `libs/ui/registry/ui/toast/toast-store.ts`
- `libs/ui/registry/component-docs/toast.ts`
- `libs/ui/registry/ui/toast/toast.test.tsx`

Impact: bursty notifications can silently remove persistent error/loading/action
toasts, contradicting the public accessibility/time-to-read contract.

Fix:

- exempt persistent/actionable toasts from simple oldest-first eviction
- or document capacity eviction as stronger than persistence
- add tests for error/loading/action toasts under capacity pressure

### Medium: `BlockBar` Example Teaches An Ignored Accessibility Prop

The multi-segment example passes `aria-valuetext`, but `BlockBarProps` omits that
prop and the component overwrites it with derived text unless `valueText` is
used. Component docs correctly document `valueText`.

Confirmed references:

- `libs/ui/registry/examples/block-bar/block-bar-multi-segment.tsx`
- `libs/ui/registry/ui/block-bar/block-bar.tsx`
- `libs/ui/registry/component-docs/block-bar.ts`

Impact: the public example appears to provide a segment summary, but rendered
output exposes the derived numeric text instead.

Fix:

- update the example to use `valueText`
- add example/a11y coverage for multi-segment value text

### Medium: `Popover` Docs Contradict Unnamed-Dialog Behavior

Popover docs say `role="dialog"` requires `aria-label` / `aria-labelledby` and
throws otherwise. The implementation warns and applies fallback
`aria-label="Popover"`, and tests assert that fallback behavior.

Confirmed references:

- `libs/ui/registry/component-docs/popover.ts`
- `libs/ui/registry/ui/popover/popover-content.tsx`
- `libs/ui/registry/ui/popover/popover.test.tsx`

Fix:

- either update docs to describe warn/fallback behavior
- or enforce the documented hard failure and update tests

### High: `useListbox` Usage Snippet Is Broken For Copy Consumers

The docs snippet renders options with `id`, `role`, and `aria-selected`, but
omits `data-value` and does not pass `items`. DOM-mode listbox selection and
keyboard activation require resolvable DOM items; the working example and tests
include `data-value`.

Confirmed references:

- `libs/ui/registry/hook-docs/listbox.ts`
- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/keys/src/dom/navigation-items.ts`
- `libs/ui/registry/examples/listbox/listbox-basic.tsx`
- `libs/ui/registry/hooks/testing/use-listbox.test.tsx`

Fix:

- update the snippet to use `getEncodedListboxItemId` and `data-value`
- or pass explicit `items` to the hook in the example
- add docs/example validation for listbox keyboard activation

### Medium: `SearchInput` Keyboard Example Lacks Active-Option Semantics

The example forwards arrow navigation from a focused search input into a sibling
`role="listbox"`, but the input remains a plain searchbox with no
`aria-controls`, `aria-expanded`, or `aria-activedescendant`. The listbox itself
is not focused, so arrow keys update visual `aria-selected` without an
assistive-technology relationship from the focused control.

Confirmed references:

- `libs/ui/registry/component-docs/search-input.ts`
- `libs/ui/registry/examples/search-input/search-input-keyboard.tsx`
- `libs/ui/registry/ui/search-input/search-input.tsx`

Fix:

- model the example as a combobox/searchbox with active-descendant semantics
- or move focus into the listbox for list navigation
- add an accessibility test for the keyboard example

### Medium: `FloatingPanel` Custom Menu Example Lacks Menu Keyboard Behavior

`FloatingPanel` docs say the primitive is headless and consumers own dismiss and
focus management, but the custom menu example advertises a `role="menu"` panel
with `role="menuitem"` buttons and no menu keyboard/focus behavior.

Confirmed references:

- `libs/ui/registry/component-docs/floating-panel.ts`
- `libs/ui/registry/examples/floating-panel/floating-panel-custom-menu.tsx`
- `libs/ui/registry/ui/floating-panel/floating-panel.tsx`

Impact: copying the example creates menu semantics without roving focus,
Escape/dismiss handling, active-descendant wiring, or focus handoff.

Fix:

- use the real `Menu` primitive for menu examples
- or wire full menu keyboard/focus behavior in the example
- keep `FloatingPanel` examples headless unless behavior is implemented

### Low/Medium: `FloatingPanel` Warning Under-Enforces Its Documented A11y Contract

Docs say consumers must provide both a role and accessible name. The warning only
fires when both are missing, and tests explicitly allow role-only and
label-only cases.

Confirmed references:

- `libs/ui/registry/component-docs/floating-panel.ts`
- `libs/ui/registry/ui/floating-panel/floating-panel.tsx`
- `libs/ui/registry/ui/floating-panel/floating-panel.test.tsx`

Fix:

- align docs to the current warning behavior
- or warn when either required role/name side is missing
- update tests to match the chosen public contract

### Medium: `Card interactive` Is Pointer-Only

`interactive` adds pointer, hover, and focus-visible styling, but `Card` renders
only non-interactive container elements and does not add role, tab stop,
keyboard handling, anchor/button rendering, or an `asChild` contract. The public
interactive example renders default `div` cards with pointer affordances only.

Confirmed references:

- `libs/ui/registry/ui/card/card.tsx`
- `libs/ui/registry/component-docs/card.ts`
- `libs/ui/registry/examples/card/card-interactive.tsx`

Impact: docs teach an interaction affordance that keyboard users cannot reach,
and consumers adding `onClick` create non-semantic clickable containers.

Fix:

- rename the prop to visual hover-only semantics
- or support semantic interactive rendering through button/anchor/asChild
- update examples and a11y tests

### Medium: `Label` Wrapper Examples Promise Implicit Association For Custom Controls

Label docs say wrapper mode renders a native `<label>` around the form control,
which provides implicit association without `htmlFor` / `id`. The horizontal
example wraps the custom div-based `Checkbox`, not a labelable native control.
The Checkbox public API already has its own `label` / `description` props.

Confirmed references:

- `libs/ui/registry/examples/label/label-horizontal.tsx`
- `libs/ui/registry/component-docs/label.ts`
- `libs/ui/registry/ui/label/label.tsx`
- `libs/ui/registry/ui/checkbox/checkbox.tsx`

Impact: the example can produce an unnamed checkbox, and clicking the visible
label text may not toggle the custom `role="checkbox"` control.

Fix:

- use `Checkbox label`, explicit `aria-labelledby`, or `Field` wiring for custom
  controls
- keep wrapper-mode docs limited to native labelable controls
- add example a11y tests for custom checkbox labeling

### Medium: `DiffView maxHeight` Creates An Unnamed Vertical Scroll Container

`DiffView` accepts `maxHeight` and applies overflow to the internal shared diff
container, but that scroll region is not named and is not made keyboard
focusable. Existing tests assert the style only.

Confirmed references:

- `libs/ui/registry/ui/diff-view/diff-view.tsx`
- `libs/ui/registry/ui/shared/diff-view.css`
- `libs/ui/registry/ui/diff-view/diff-view-unified.tsx`
- `libs/ui/registry/ui/diff-view/diff-view-split.tsx`
- `libs/ui/registry/ui/diff-view/diff-view.test.tsx`

Impact: keyboard and assistive-technology users can receive a clipped diff with
no obvious scroll target or accessible region name, especially in constrained
docs/app panels.

Fix:

- name the scroll region when `maxHeight` creates overflow
- make the region keyboard-scrollable with an intentional tab stop, or delegate
  scrolling to an already focusable outer region
- add a behavior/a11y test for constrained diff navigation

### Medium: `Breadcrumbs.Item current` Custom Content Can Miss `aria-current`

Breadcrumb docs describe `current` as an item-level prop, but implementation
adds `aria-current` only for string/number children or for `Breadcrumbs.Link`.
Custom content can therefore render visually current while missing the semantic
current-page marker.

Confirmed references:

- `libs/ui/registry/component-docs/breadcrumbs.ts`
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs-item.tsx`
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs-link.tsx`
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs.test.tsx`

Impact: public consumers can follow the documented API and ship breadcrumbs
that are visually correct but not announced as the current page.

Fix:

- make `Breadcrumbs.Item current` own the semantic marker for all render paths
- or narrow the public contract so only `Breadcrumbs.Link current` promises
  `aria-current`
- add a test for custom child content under a current item

### Medium: `AvatarImage` Consumer Handlers Can Override Internal Status Handling

`AvatarImage` sets internal `onLoad`/`onError` handlers and then spreads
consumer image props afterward. A consumer-provided native handler can replace
the internal status update path.

Confirmed references:

- `libs/ui/registry/ui/avatar/avatar-image.tsx`
- `libs/ui/registry/ui/avatar/avatar.tsx`
- `libs/ui/registry/component-docs/avatar.ts`

Impact: documented `onStatusChange` lifecycle and fallback rendering can break
as soon as a consumer attaches native image handlers.

Fix:

- compose consumer `onLoad`/`onError` with internal handlers
- add behavior tests for custom handlers preserving status/fallback behavior

### Medium: `OverflowText` Drops Consumer Handlers In The Overflowing Tooltip Path

The plain `OverflowText` path spreads consumer props, but once text overflows the
tooltip trigger render path spreads tooltip handlers after those props. Consumer
click, focus, blur, pointer, and keyboard handlers can be replaced only in the
overflowing state.

Confirmed references:

- `libs/ui/registry/ui/overflow/overflow-text.tsx`
- `libs/ui/registry/ui/popover/popover-trigger.tsx`
- `libs/ui/registry/ui/overflow/overflow.test.tsx`

Impact: a consumer can get different event behavior depending on whether the
same text currently overflows, which is a fragile public primitive contract.

Fix:

- merge external handlers with trigger handlers in the overflow branch
- add tests that consumer handlers still run for overflowing and non-overflowing
  text

### Medium: `TrustPanel` Reaches Into `TrustPermissionsContent` Internals

Home `TrustPanel` queries child DOM attributes and hardcodes the `readFiles`
permission to restore focus.

Fix:

- keep the widget in `apps/web`
- move boundary/focus behavior behind a semantic `TrustPermissionsContent` API
  or callback

### Medium: Docs TypeScript And Vite Resolve Different `@/lib/utils`

Docs type-check `@/lib/utils` against the package shim but Vite builds the
registry copy-mode source.

Fix:

- align TS and Vite aliases to the same implementation
- keep app-only utilities on explicit package imports

### Medium/High: `DialogShell` Fallback Weakens Public `HTMLDialogElement` Contract

The fallback appears intentional and tested. Do not call it accidental dead
code. The issue is the public ref/event type contract.

`DialogShell` exposes `HTMLDialogElement` props and refs, but fallback rendering
can hand consumers a `div` through that type contract.

Fix:

- require native dialog/polyfill behavior
- or widen/document the fallback contract honestly

### Medium: Searchable `Select` Breaks `Field` Label/Description Wiring

`Field.Control` injects `id`, `aria-labelledby`, and `aria-describedby` into its
child. `SelectTrigger` receives and merges those props, but when `SelectSearch`
is present, the actual combobox is the search input and the trigger becomes a
toggle. The search input uses a generic `aria-label="Search options"` and does
not receive the `Field` label/description ids.

Confirmed references:

- `libs/ui/registry/ui/field/field.tsx`
- `libs/ui/registry/ui/select/select-trigger.tsx`
- `libs/ui/registry/ui/select/select-search.tsx`
- `libs/ui/registry/component-docs/select.ts`

Impact: `Field` plus searchable `Select` can expose the focused form control to
assistive tech as "Search options" instead of the field label, and helper/error
text can be associated with the inactive toggle instead of the combobox.

Fix:

- propagate field label/description/invalid ids to the searchable combobox
  input when `SelectSearch` owns the combobox role
- keep the trigger and search-input relationships non-duplicative
- add accessibility tests for `Field` composed with searchable `Select`

### Medium: Public Searchable Inputs Miss Mobile 16px Font-Size Guard

Base `Input`/`Textarea` variants document and apply the iOS Safari focus-zoom
mitigation by bumping small inputs to `16px` on mobile. Searchable `Select` and
`CommandPalette` still render public text inputs at compact sizes without that
mobile guard.

Confirmed references:

- `libs/ui/registry/lib/input-variants.ts`
- `libs/ui/registry/ui/select/select-search.tsx`
- `libs/ui/registry/ui/command-palette/command-palette-input.tsx`
- `libs/ui/registry/ui/shared/command-palette.css`
- public copy artifacts `libs/ui/public/r/select.json` and
  `libs/ui/public/r/command-palette.json`

Impact: searchable Select and CommandPalette can trigger iOS/WKWebView focus
zoom despite the public input contract already fixing this class of issue for
base controls.

Fix:

- share the same mobile font-size guard across all public text-entry controls
- ensure copied registry artifacts receive the same classes/tokens
- add mobile viewport or CSS contract tests for searchable public inputs

### Medium: `Panel` And `Dialog.Content` Drop External `aria-describedby`

`Panel` and `Dialog.Content` generate description IDs when their description
subcomponents are present, but they overwrite consumer-provided
`aria-describedby` instead of merging it. `Field` already has merge behavior for
ARIA relationship IDs, so these public components are inconsistent with the UI
library contract.

Confirmed references:

- `libs/ui/registry/ui/panel/panel.tsx`
- `libs/ui/registry/ui/dialog/dialog-content.tsx`
- `libs/ui/registry/ui/field/field.tsx`

Impact: consumers cannot reliably attach external help/error text to panels or
dialogs without losing either their own description IDs or the generated
component description ID.

Fix:

- destructure external `aria-describedby`
- merge it with the generated description ID when both are present
- add behavior tests that preserve external and generated descriptions together

### Low/Medium: `Select` Has Assertion-Heavy Public-To-Internal Bridge

Public union types are covered and runtime shape guards exist. The issue is that
the root bridges public union props into a non-generic internal state machine
with broad casts.

Fix before API freeze:

- make the state bridge generic/overloaded
- or isolate the cast in one tested adapter

### Low/Medium: `SidebarProvider` Controlled State API Needs Release Decision

`SidebarProvider` exposes `state`, `defaultState`, and `onStateChange`, and docs
teach those names. The repo public UI contract prefers `value`, `defaultValue`,
and `onChange(value)` for public value controls, with semantic callback names for
non-value state. `state` may be intentional domain language, but this needs an
explicit pre-release decision instead of becoming accidental public API.

Confirmed references:

- `AGENTS.md`
- `libs/ui/registry/ui/sidebar/sidebar-provider.tsx`
- `libs/ui/registry/component-docs/sidebar.ts`

Fix:

- either rename to `value` / `defaultValue` / `onChange`
- or document sidebar visibility as a semantic state exception before public
  package/docs handoff
- update docs, examples, registry artifacts, and package declarations together

### Medium: `Sidebar` Rail Mode Has Docs And Accessible-Name Drift

Sidebar docs say `Sidebar.Content` is hidden, `aria-hidden`, and inert in
rail/hidden state. The implementation only hides `state === "hidden"` and keeps
rail content mounted for icon-only navigation. Separately, `SidebarItemLabel`
hides label text in rail and comments that the parent `title` preserves the
accessible name, but `SidebarItem` does not derive that title or accessible name
from its label in default or render-prop paths. The rail example manually adds
`title`, but the public API/docs do not make that requirement explicit.

Confirmed references:

- `libs/ui/registry/component-docs/sidebar.ts`
- `libs/ui/registry/ui/sidebar/sidebar-content.tsx`
- `libs/ui/registry/ui/sidebar/sidebar-item-label.tsx`
- `libs/ui/registry/ui/sidebar/sidebar-item.tsx`
- `libs/ui/registry/examples/sidebar/sidebar-rail.tsx`

Impact: rail-mode docs overstate hiding semantics, and public sidebar consumers
can create icon-only rail items with no reliable accessible name unless they
manually remember to add `title` or another label.

Fix:

- align docs with actual rail behavior
- derive an accessible label from `SidebarItemLabel` where practical, or require
  `aria-label`/`title` in rail mode and document it clearly
- add rail-mode a11y tests for default and render-prop items

### Medium: `Button` Render-Prop Mode Weakens Loading/Disabled Contract

Button docs say `loading` shows a spinner and disables click activation, and
`disabled` stops `onClick`. Native button and `as="a"` paths implement those
behaviors internally, but the render-prop path only passes computed props to the
consumer. It does not render `ButtonContent` for the spinner/bracket behavior or
guard activation itself. The public render-prop example demonstrates `loading`
with an anchor.

Confirmed references:

- `libs/ui/registry/component-docs/button.ts`
- `libs/ui/registry/ui/button/button.tsx`
- `libs/ui/registry/examples/button/button-render-prop.tsx`
- `libs/ui/registry/ui/button/button.test.tsx`

Impact: copyable public docs imply render-prop buttons preserve the same loading
and disabled behavior, but consumers can get a visually styled anchor with no
spinner and no internal click prevention.

Fix:

- either make render-prop props include a safe activation handler/content contract
- or document render-prop mode as caller-owned behavior and remove misleading
  loading example usage
- add render-prop tests for loading/disabled semantics if the contract is meant
  to be preserved

### Medium: `MenuItemRadio.value` Is Documented But Not Used

`MenuItemRadio` docs describe `value` as the required form-submission value, but
the component renders a `div`, never reads `value`, and writes `data-value={id}`.
The prop is required in TypeScript and examples pass it, but it has no runtime or
form-submission effect.

Confirmed references:

- `libs/ui/registry/component-docs/menu.ts`
- `libs/ui/registry/ui/menu/menu-item-radio.tsx`
- `libs/ui/registry/examples/menu/menu-checkbox-radio.tsx`

Impact: public docs promise native-like form semantics for radio menu items that
the component does not provide.

Fix:

- either remove/rename the unused `value` prop and document `id` as the selection
  value
- or implement hidden input/form-submission semantics if that is intended
- update docs/examples and type tests before public handoff

### Medium: `MenuSubTrigger` Can Inherit `menuitemradio` Without `aria-checked`

Selectable `Menu` switches its item role to `menuitemradio`. `MenuSubTrigger`
consumes that role from menu context and renders it on a submenu trigger, but it
does not set `aria-checked`; it sets popup/expanded state instead.

Confirmed references:

- `libs/ui/registry/ui/menu/menu.tsx`
- `libs/ui/registry/ui/menu/menu-sub.tsx`
- `libs/ui/registry/component-docs/menu.ts`

Impact: a submenu inside a selectable menu can expose an invalid/confusing radio
menuitem contract while also acting as a popup trigger.

Fix:

- keep submenu triggers as `menuitem` even inside selectable menus
- or disallow/document submenu triggers inside selectable menus before release
- add menu a11y tests for selectable menus containing submenus

### Medium: Tabs Variant Docs Are Stale Against Implementation

Tabs docs list only `"default" | "underline"` and say the default is
`"default"`. The shared segmented variants also support `"bracket"` and
`"pill"`, and the Tabs root defaults to `"underline"`.

Confirmed references:

- `libs/ui/registry/component-docs/tabs.ts`
- `libs/ui/registry/lib/segmented-variants.ts`
- `libs/ui/registry/ui/tabs/tabs.tsx`

Fix:

- align docs with all supported variants and the real default
- or remove unsupported-looking variants from the public Tabs contract
- add docs/API tests that compare documented variants to component types

### Medium: ToggleGroup Disabled-Item Docs Contradict Behavior

ToggleGroup docs say disabled items remain in navigation order with
`aria-disabled`. The implementation renders native disabled buttons and
keyboard navigation filters to enabled selectable items; tests explicitly assert
that disabled items are skipped during arrow navigation.

Confirmed references:

- `libs/ui/registry/component-docs/toggle-group.ts`
- `libs/ui/registry/ui/toggle-group/toggle-group-item.tsx`
- `libs/ui/registry/ui/toggle-group/toggle-group.tsx`
- `libs/ui/registry/ui/toggle-group/toggle-group.test.tsx`

Fix:

- update docs to say disabled items are skipped
- or change implementation to keep disabled items focusable with `aria-disabled`
  if that is the intended public a11y contract
- keep docs/tests aligned before handoff

### Low/Medium: `Button` Highlighted Docs Mention Missing Data Attribute

Button docs say `highlighted` marks the button with a `data-highlighted`
attribute. The implementation only adds ring classes and does not emit that data
attribute.

Confirmed references:

- `libs/ui/registry/component-docs/button.ts`
- `libs/ui/registry/ui/button/button.tsx`

Fix:

- either emit `data-highlighted` consistently
- or remove that claim from docs before public handoff

### Medium: `MenuItemCheckbox` Callback Conflicts With Public UI API Contract

Repo API rules require boolean form controls to use `onChange(checked)`, and
pre-release API cleanup should rename rather than alias. `MenuItemCheckbox`
exposes `onCheckedChange` and docs/examples teach that public name.

Confirmed references:

- `AGENTS.md`
- `libs/ui/registry/ui/menu/menu-item-checkbox.tsx`
- `libs/ui/registry/component-docs/menu.ts`
- `libs/ui/registry/examples/menu/menu-checkbox-radio.tsx`
- `libs/ui/package.json`

Impact: the public package surface conflicts with the documented boolean-control
contract before first public release.

Fix:

- rename to `onChange(checked)` and update docs/examples/registry/package output
- avoid adding deprecated aliases before first public release
- add public API/type tests if this contract is release-critical

### Medium: `Select variant="card"` Fails Selected-State Contrast In Dark Themes

`SelectItem` uses `bg-muted-foreground text-white` for the selected card
variant. In the base dark theme and web dark override, that is roughly
white-on-mid-gray and falls below normal text contrast expectations.

Confirmed references:

- `libs/ui/registry/ui/select/select-item.tsx`
- `libs/ui/styles/theme.css`
- `apps/web/src/styles/theme-overrides.css`

Fix:

- use a semantic selected background/foreground pair
- test contrast in both package theme and web override theme

### Medium: `MenuSubContent` Overrides Floating Z-Index Tokens

`MenuSubContent` includes `z-50`, overriding the reusable `FloatingPanel`
z-index token contract. That can place submenus below popover-level surfaces in
some compositions.

Confirmed references:

- `libs/ui/registry/ui/menu/menu-sub.tsx`
- `libs/ui/styles/theme-base.css`

Fix:

- remove `z-50`
- route submenu stacking through `--ui-floating-z` or the established popover
  token
- add a z-index contract test/story if this remains public

### Medium: `AgentBoard` Progress Bars Lack Progress Semantics

The review agent board renders visual progress bars without progressbar roles or
values.

Confirmed reference:

- `apps/web/src/features/review/components/agent-board.tsx`

Fix:

- add `role="progressbar"`
- add `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and a label/value text
- test with accessible queries

### Medium: Web Review Log Re-Enables Blinking Cursor Under Reduced Motion

`@diffgazer/ui` disables animation tokens under `prefers-reduced-motion`, but
the web app imports `theme-overrides.css` after UI styles and redeclares the
cursor blink animation without a matching reduced-motion override. The review
activity log uses that class.

Confirmed references:

- `apps/web/src/styles/index.css`
- `libs/ui/styles/theme-base.css`
- `apps/web/src/styles/theme-overrides.css`
- `apps/web/src/features/review/components/activity-log.tsx`

Impact: users who request reduced motion can still see a blinking cursor in the
review log.

Fix:

- add a web-level `prefers-reduced-motion` override for `.cursor-blink`
- or route cursor animation through the shared UI animation tokens
- test reduced-motion CSS for app overrides

### Medium: Programmatic Smooth Scroll Ignores Reduced Motion

The shared `useActiveHeading` hook switches scroll behavior to `auto` when
`prefers-reduced-motion: reduce` is set, but other programmatic scroll paths
force `behavior: "smooth"` directly.

Confirmed references:

- reduced-motion-aware path: `libs/ui/registry/hooks/use-active-heading.ts`
- docs hash navigation: `apps/docs/src/router.tsx`
- docs TOC auto-scroll: `apps/docs/src/components/toc.tsx`
- web review details scroll: `apps/web/src/features/review/hooks/use-issue-details-tabs.ts`
- keyboard trigger path: `apps/web/src/features/review/hooks/use-review-results-keyboard.ts`

Impact: users who request reduced motion can still get smooth scrolling in docs
navigation and keyboard-driven review details.

Fix:

- centralize a reduced-motion-aware scroll behavior helper
- use it for hash navigation, TOC auto-scroll, and review keyboard scroll
- add reduced-motion regression coverage

### Medium: Public CommandPalette Card Footer Has Light-Theme Contrast Risk

`CommandPalette` is a public export. Its card footer uses 11px muted text over a
hardcoded translucent black background instead of theme tokens. In the light
theme this can land below normal-text contrast expectations.

Confirmed references:

- `libs/ui/package.json`
- `libs/ui/registry/ui/shared/command-palette.css`
- `libs/ui/styles/theme.css`

Fix:

- replace hardcoded translucent black with tokenized footer background/border
- check both light and dark themes
- add a focused visual/a11y regression for the public command palette footer

### Low/Medium: Public `usePresence` Can Double-Call Exit Completion

Built-in consumers appear safe. The public hook can still double-call
`onExitComplete` if a consumer supplies `ref` and also wires returned animation
handlers.

Confirmed references:

- `libs/ui/registry/hooks/use-presence.ts`
- safe built-in usage in `libs/ui/registry/ui/shared/dialog-shell.tsx`

Fix:

- guard the synthetic path when `ref` is supplied
- or document mutually exclusive usage and add a public hook test

### Low/Medium: Shiki Dual-Theme CSS Only Maps Light Variables

Current docs use the same Shiki theme for light/dark, so this is latent. If
distinct code themes are later adopted, the CSS only maps light variables.

Confirmed references:

- `apps/docs/source.config.ts`
- `libs/ui/styles/theme-base.css`

Fix:

- add `[data-theme="dark"] .shiki` mappings to `--shiki-dark`
- or keep a single theme and document that as the public contract

### Low: `MenuSubContent` Contains Dead Animation Utility Classes

`MenuSubContent` includes `tailwindcss-animate` style classes that do not emit
CSS in this repo. `FloatingPanel` already supplies fade animation.

Confirmed references:

- `libs/ui/registry/ui/menu/menu-sub.tsx`
- `libs/ui/styles/theme-base.css`

Fix:

- delete the dead classes
- or replace them with the existing token/reduced-motion animation contract

### Medium: OpenRouter Adapter Uses Double Assertion

The OpenRouter adapter uses `as unknown as LanguageModel`, partially guarded by
runtime checks for `doGenerate` and `doStream`.

This is not a public UI handoff blocker by itself, but should be made explicit.

Fix:

- keep it as a small compatibility adapter
- add negative tests for rejected provider shapes
- prefer aligning SDK versions when possible

### Low/Medium: Backward-Compat Hook Docs Are Generated Before First Release

Aggregate files such as `ui-hooks.json` and `keys-hooks.json` exist for
backward compatibility.

If they have not shipped publicly, remove the compat outputs and artifact
manifest references before first public handoff. Keep per-hook JSON and hook
lists as the docs contract.

### Medium: `floating-indicator` Appears Public But Lacks Hand-Authored Docs

`floating-indicator` appears in public/generated registry data but lacks a
hand-authored docs page.

Fix:

- add the MDX/consumption page
- or mark it as generated-only/hidden with an explicit tested exemption

## Verification And Release Gate Findings

### Confirmed Gate Gaps

Root local `verify` and `release-check` are not full handoff gates.

Missing from those local/publish gates:

- docs build and docs Playwright E2E
- hosted registry DNS/curl checks
- deployed `diffgazer.b4r7.dev` check
- full all-item registry install/build matrix
- Docker/Nitro runtime E2E if Nitro is the chosen deploy target
- coverage thresholds for release-critical registry/CLI/server flows
- moderate production audit cleanliness

CI release-readiness does run more:

- production audit at high level
- build
- strict verify
- package smoke
- pack dry-runs
- docs build
- Playwright E2E

But publish workflow only runs `release-check`, so do not treat publish as
proving docs E2E or hosted registry availability unless branch protection
enforces the release-readiness workflow.

### Medium: `release-check` Can Pass With Dirty Generated Public Artifacts

`release-check` runs `prepare:artifacts` and `validate:artifacts:check`, but its
only final git guard is `git diff --check`, which checks whitespace, not whether
tracked files changed. The dirty-tree guard for generated registry artifacts
exists in `release-readiness.yml`; the publish workflow runs `release-check`
before Changesets publish.

Confirmed references:

- `AGENTS.md`
- `package.json`
- `.github/workflows/release.yml`
- `.github/workflows/release-readiness.yml`

Impact: stale committed public registry artifacts can be regenerated during the
publish gate without failing that gate, unless branch protection separately
requires release-readiness.

Fix:

- add a tracked dirty-tree check after artifact preparation in `release-check`
- or make the publish workflow require/reuse the release-readiness job
- keep `git diff --check` as whitespace validation, not artifact freshness
  validation

### Medium: Release-Readiness Dirty-Tree Guard Is Not Final

The stricter `release-readiness.yml` workflow does contain a dirty-tree check,
but it runs after `pnpm run build` and before `pnpm run verify`. Root `verify`
starts with `prepare:artifacts`, so tracked public artifacts can still be
regenerated after the only dirty-tree check in that workflow.

Confirmed references:

- `.github/workflows/release-readiness.yml`
- `package.json`

Impact: even the release-readiness workflow can miss artifact churn introduced
by the later verify step.

Fix:

- run the dirty-tree check after the last artifact-preparing command
- or make verify artifact preparation check-only in release-readiness after the
  first build/prepare phase
- keep publish and release-readiness artifact freshness rules aligned

### Medium: Publish-Time Lifecycle Rebuilds Artifacts After The Release Gate

The publish workflow runs `pnpm run release-check`, then Changesets runs
`pnpm run release`. During npm publish, `@diffgazer/ui` and `@diffgazer/keys`
still run `prepublishOnly`; those scripts rebuild packages and run root
`validate:artifacts`, which prepares artifacts again after the explicit release
gate.

Confirmed references:

- `.github/workflows/release.yml`
- `package.json`
- `libs/ui/package.json`
- `libs/keys/package.json`

Impact: even if the earlier release gate is tightened, publish lifecycle scripts
can mutate or rebuild publish inputs after it passes unless a post-lifecycle
dirty/tarball-content assertion runs before upload.

Fix:

- avoid artifact-generating lifecycle scripts during publish, or make them
  check-only
- add a final dirty-tree/tarball-content assertion after lifecycle rebuilds
- align `release-check`, `release-readiness`, and `prepublishOnly` semantics

### Medium: Publish Smoke Is Not Network-Backed

The publish workflow runs `pnpm run release-check`, but `release-check` sets
`DIFFGAZER_SMOKE_STRICT_SKIPS` without `DIFFGAZER_SMOKE_ALLOW_NETWORK`. The
package smoke runner uses offline `link:` overrides when network mode is absent.

Confirmed references:

- `.github/workflows/release.yml`
- `package.json`
- `scripts/monorepo/smoke-package-runner.mjs`

Impact: the actual publish gate can pass without proving registry-style package
dependency resolution for package-mode consumers.

Fix:

- run publish package smoke with
  `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1`
- or split local offline smoke from CI/publish network smoke
- document which gate proves package-mode consumer installability

### Medium: Packaged `@diffgazer/add` Smoke Only Checks Help

The tarball smoke for `@diffgazer/add` runs only `pnpm exec dgadd --help`. The
real `dgadd add` workflow is exercised against the workspace dist CLI, not the
installed package tarball that must include generated registry bundles.

Confirmed references:

- `scripts/monorepo/smoke-package-install.mjs`
- `scripts/monorepo/smoke-cli.mjs`
- `cli/add/src/context.ts`
- `cli/add/src/utils/integration.ts`

Impact: packaged-tarball regressions in generated bundle inclusion, pathing, or
copy/install behavior can survive the release gate.

Fix:

- install the packed `@diffgazer/add` tgz into a temp app
- run `dgadd init/add/list/diff` plus typecheck/build from that installed
  package
- reuse existing workspace fixture logic without switching back to source dist

### Medium: Governance Claims Hosted Registry CI Smoke That Is Not Present

`PACKAGE_GOVERNANCE.md` describes hosted registry CI smoke, but the current
workflow set does not contain a host/curl check for the deployed registry.

Confirmed references:

- `PACKAGE_GOVERNANCE.md`
- `.github/workflows/release.yml`

Fix:

- add the hosted registry checks to release/nightly CI
- or change governance docs so they describe the actual gate

### Medium: Docs E2E Exercises Static Output, Not The Docker/Nitro Runtime

The docs Playwright config serves `.output/public`. The Dockerfile runs
`.output/server/index.mjs`. If Nitro remains the deployment target, the current
docs E2E does not prove the same runtime that will be deployed.

Confirmed references:

- `apps/docs/playwright.config.ts`
- `Dockerfile`

Fix:

- keep static E2E if static hosting is the final deploy mode
- otherwise add Docker/Nitro runtime E2E before release

### Low/Medium: CLI Package Does Not Bundle `@diffgazer/keys` Explicitly

`cli/diffgazer` imports `@diffgazer/keys`, while its tsup config explicitly
bundles core/server through `noExternal`. This is not a proven runtime bug, but
it is worth hardening before package handoff if the CLI binary relies on fully
bundled internal packages.

Confirmed references:

- `cli/diffgazer/src/lib/highlight-navigation.ts`
- `cli/diffgazer/tsup.config.ts`

Fix:

- include `@diffgazer/keys` in the intended bundle policy
- or document why it should remain external and ensure the package manifest
  installs it correctly

### Moderate Production Audit Is Not Clean

`pnpm audit --prod --audit-level=moderate` currently fails with 4 moderate and 1
low advisory.

Exact advisory list checked with `pnpm audit --prod --audit-level=moderate
--json` on 2026-05-22:

- Moderate `h3` via
  `apps__docs>@tanstack/react-start>@tanstack/start-server-core>h3`:
  `GHSA-4hxc-9384-m385`
- Moderate `h3` via the same docs runtime path:
  `GHSA-q5pr-72pq-83v3`
- Moderate `@tanstack/start-server-core` via docs runtime path:
  `GHSA-9m65-766c-r333`
- Moderate `ws@8.20.0` via `cli__diffgazer>ink>ws`:
  `GHSA-58qx-3vcg-4xpx`
- Low `h3` via docs runtime path:
  `GHSA-2j6q-whv2-gh6w`

If docs deploy becomes fully static, docs runtime advisories are lower runtime
risk, but the audit is still not moderate-clean.

### Medium: Review Route-To-Stream Integration Coverage Is Missing

Tests cover router validation and unit stream replay, but not the full flow:

1. configured/trusted Hono request
2. `POST /api/review/reviews`
3. returned `reviewId`
4. `GET /api/review/reviews/:id/stream`
5. stream events and persisted review

Add stale-session and project-mismatch stream coverage too.

### Corrections From `SOTA-AUDIT.md` Reconciliation

Do not carry these stale or overbroad claims into the handoff blocker list:

- the current worktree did not contain the many dirty files listed in
  `SOTA-AUDIT.md`; the first reconciliation passes only had `SOTA-AUDIT.md`
  and `HANDOFF_READINESS_AUDIT.md` untracked, while the current worktree also
  has `DEPLOYMENT_PLAN.md` untracked
- changeset state was not "first release 0.2.0"; `pnpm changeset status
  --verbose` reported `@diffgazer/ui -> 1.0.0` in the reconciliation pass
- package audit should distinguish high-level gate cleanliness from
  moderate-level cleanliness; high-level audit passed earlier, moderate-level
  audit failed
- `SOTA-AUDIT.md` still contains old-host deploy snippets and a "DECISION
  REQUIRED" domain framing. Use `docs.b4r7.dev` as the target docs/registry
  host for this plan.
- `SOTA-AUDIT.md` says generated docs files are committed, but this pass found
  no tracked files under `libs/ui/docs/generated`, `libs/keys/docs/generated`,
  or `cli/add/src/generated`.
- `SOTA-AUDIT.md` has internal stale readiness wording: `dgadd` and build
  bundling are not simply PASS while CSS duplication, manifest races, and
  `@diffgazer/keys` bundling questions remain.
- For `MenuSubContent`, source supports the dead animation-class finding, not
  the claim that those zoom animations currently fire unconditionally.
- For `Select`, source supports the dark/default theme contrast issue, not the
  light-mode wording from `SOTA-AUDIT.md`.
- The executable fix checklist in `SOTA-AUDIT.md` omits later high blockers
  now present in this handoff audit: session trust lifetime, env credential
  persistence, plaintext file-secret copy, secret migration durability, and
  server-side review cancellation.
- `SOTA-AUDIT.md` uses `CRITICAL` for the AbortController race, config
  corruption, and async persist failures. This handoff audit uses the corrected
  local-app severity model: high for state-loss/security/user-trust risks and
  medium/high for the stream-controller race because current callers are mostly
  serialized.
- `SOTA-AUDIT.md` still says docs content and CI/CD are PASS in places, but the
  missing `floating-indicator` docs and release gate gaps remain material.
- `SOTA-AUDIT.md` P0 wording for a top-level hub/landing scaffold is out of
  scope for this handoff unless separately requested. Do not implement
  `apps/hub`, `apps/landing`, or `@diffgazer/landing` just because SOTA lists
  them; the current target is docs/registry on `docs.b4r7.dev` and a
  Diffgazer product/install page on `diffgazer.b4r7.dev`.
- `DEPLOYMENT_PLAN.md` is a conflicting untracked execution plan. It introduces
  a separate registry subdomain (`r.b4r7.dev`) and four-service deploy shape,
  while this audit treats `docs.b4r7.dev` as the docs/registry host and
  `diffgazer.b4r7.dev` as the product/install page.
- If `DEPLOYMENT_PLAN.md` is later used intentionally, reconcile its registry
  path layout with generated artifacts first. The plan verifies `/ui/...` and
  `/keys/...`, while generated dependencies and `dgadd` schema URLs use
  `/r/ui/...`, `/r/keys/...`, and `/schema/...`.
- Also update its artifact inventory before execution. It says "49 UI + 5 keys"
  registry JSON files, but current public artifact counts are 76 files under
  `libs/ui/public/r` and 6 files under `libs/keys/public/r`. The "49 UI" number
  in this audit is only the subset of UI public files containing old-host
  references, not the total registry artifact count.
- Its landing watch paths also need reconciliation. The proposed landing
  Dockerfile builds from root manifests and shared `libs/`, but the Coolify
  landing resource only watches `apps/landing/**`. Changes to shared libraries,
  root package/lock/turbo files, or deploy Docker/Nginx files could leave
  `diffgazer.b4r7.dev` stale.
- The same watch-path issue applies to docs. The docs resource uses the root
  `Dockerfile`, whose build inputs include root manifests, `apps/`, `cli/`,
  `libs/`, and `scripts/`, but the plan watches only
  `apps/docs/**,libs/**,scripts/**`.
- Reconcile its non-root runtime claims before using it. The registry snippet
  says "run as non-root" but only `chown`s files, and the docs checklist says
  the docs container runs as non-root. Neither the plan snippets nor the current
  `Dockerfile` include a `USER` directive.
- Reconcile its proposed landing app package-mode setup before using it. The plan
  depends on `@diffgazer/ui` but omits the required `@diffgazer/keys` peer, and
  its CSS entry imports UI theme/styles without the required
  `@diffgazer/ui/sources.css`. Current package/governance docs require both for
  package-mode consumers.
- Reconcile its docs Docker origin wiring before execution. The plan expects
  `VITE_PUBLIC_ORIGIN=https://docs.b4r7.dev` for SEO/sitemap output, but the
  current Dockerfile/compose path only passes `REGISTRY_ORIGIN`.

## Verification Run During This Audit

First pass passed:

- `pnpm run validate:artifacts:check`
- `pnpm run verify:monorepo`
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
- `pnpm audit --prod --audit-level=high`
- `npm audit signatures`
- `git diff --check`

Second pass checked:

- `npm view diffgazer version dist-tags --json`: `0.1.3`
- `npm view @diffgazer/ui version --json`: E404
- `npm view @diffgazer/keys version --json`: E404
- `npm view @diffgazer/add version --json`: E404
- `host docs.b4r7.dev`: NXDOMAIN
- `host diffgazer.b4r7.dev`: NXDOMAIN
- `host docs.diffgazer.b4r7.dev`: NXDOMAIN
- `pnpm audit --prod --audit-level=moderate`: failed with 4 moderate and 1 low
- `git diff --check`: passed

SOTA reconciliation pass checked:

- first reconciliation agents found registry, security, docs, UI, CI, and CLI
  gaps now written above
- second reconciliation agents found additional provider/secrets, UI/a11y, docs
  command, and SOTA-staleness gaps now written above
- third reconciliation agents found additional stepper registry CSS, TUI port,
  pre-trust init write, drilldown cancellation, and audit-recording gaps now
  written above; one UI agent reported no new material findings
- fourth reconciliation agents found additional stale SOTA execution target,
  TUI resume, provider-dialog copy, and docs copy-button accessible-name gaps
  now written above; one registry/release agent reported no new material
  findings
- fifth reconciliation agents found `DEPLOYMENT_PLAN.md` conflict,
  project-identity pre-trust write undercoverage, active-review reuse scope,
  and review context cache invalidation gaps now written above; registry/release
  and UI agents reported no new material findings
- sixth reconciliation agents found packaged server listen-error handling and
  Stepper docs install-target gaps now written above; registry/release and
  adversarial meta agents reported no new material findings
- seventh reconciliation agents found review context workspace-root discovery
  gap now written above; registry/release, UI, and adversarial meta agents
  reported no new material findings
- eighth reconciliation agents found docs nested-interactive/sidebar a11y gaps
  and future `DEPLOYMENT_PLAN.md` registry path/schema mismatch now written
  above; registry/release and local-runtime agents reported no new material
  findings
- ninth reconciliation agents found provider setup readiness/key handling,
  mobile sidebar double-state, and `DEPLOYMENT_PLAN.md` stale artifact count
  gaps now written above; registry/release agent reported no new material
  findings
- tenth reconciliation agents found `DEPLOYMENT_PLAN.md` landing watch-path
  staleness, reduced-motion smooth-scroll gaps, publish dirty-artifact gate gap,
  stale shutdown PID handling, and packaged `--dev` source-path dependency now
  written above
- eleventh reconciliation agents found future `DEPLOYMENT_PLAN.md` non-root and
  docs watch-path mismatches plus public `NavigationList.Group` and
  `MenuItemCheckbox` contract gaps now written above; package/release and
  local-runtime agents reported no new material findings
- twelfth reconciliation agents found review identity/status-hash,
  file-mode, session eviction/timeout SSE, overflow direct dependency,
  tooltip example a11y, disabled tooltip example, and sidebar API-decision gaps
  now written above; package/registry reported no new material findings; the
  first UI agent failed technically and was replaced
- thirteenth reconciliation agents found Button render-prop/highlighted docs,
  hosted schema/package artifact handoff, empty-lenses, provider/model validation,
  no-read History navigation, and future `DEPLOYMENT_PLAN.md` landing package-mode
  gaps now written above
- fourteenth reconciliation agents found first-time OpenRouter onboarding,
  TUI `runCommands` trust, stale provider tier metadata, mixed keys selector,
  Sidebar rail a11y/docs, and docs Docker origin-wiring gaps now written above;
  one adversarial agent reported no new material findings
- fifteenth reconciliation agents found all-lens failure completion,
  project-context prompt hardening, MenuItemRadio value, Tabs variant docs, and
  ToggleGroup disabled docs gaps now written above; package/registry and
  adversarial agents reported no new material findings
- sixteenth reconciliation agents found Panel/Dialog `aria-describedby` merge
  gaps, filename and drilldown prompt-hardening gaps, SSE replay race,
  untracked-file review mismatch, Docker origin-arg ordering/incomplete env
  wiring, and governance schema-surface mismatch now written above
- seventeenth reconciliation agents found trust read/list/delete scope,
  provider mutation success masking, TUI provider keyboard blockers, unborn
  `HEAD` review startup, file-scoped diff overfetch, missing persisted review
  commit, Turbo origin-env cache gaps, Docker workspace artifact mode, product
  install content under UI theme docs, `@diffgazer/keys` test-helper tarball
  leakage, `dgadd diff` CSS false positives, focus-trap nesting, searchable
  Select/Field wiring, MenuSubTrigger radio role, web shortcut, light-footer
  contrast, package-artifact validator conflict, and release-readiness final
  dirty-tree gaps now written above
- eighteenth reconciliation agents found provider-readiness drift, whitespace
  provider values, OpenRouter cache credential masking, duplicate lens-array AI
  amplification, deleted-review session replay, Docker/Nitro sitemap and missing
  docs-page runtime gaps, UI declaration CSS leaks, `dgadd remove` CSS preview
  and CSS update limitations, keys public-doc drift, history issue drill-in,
  live-log semantics, theme-save persistence, narrow-layout fallback,
  `CodeBlock.Content` accessible-name, toast persistence eviction, and
  `Card interactive` semantics now written above; one adversarial agent reported
  no new material findings
- nineteenth reconciliation agents found Git read-path command execution risk,
  TUI trust/onboarding/review keyboard blockers, provider activation without API
  key, OpenRouter fetch Result leakage, non-atomic onboarding save, TUI missing
  custom OpenRouter model ids, web partial View Results, drilldown diff/storage
  races, enrichment-from-HEAD drift, `@diffgazer/keys` raw metadata tarball gap,
  publish lifecycle rebuilds, `dgadd add/remove` durability gaps, expanded
  `menu`/`navigation-list` registry omissions, `CodeBlockHighlight` dependency
  contradiction, and keys owner-document/action-row contract gaps now written
  above; docs agent reported no new material findings
- twentieth reconciliation agents found report count/evidence corrections,
  settings pending-save escape/back leakage, docs Nitro server-function validation
  leaks, live completed review final-result mismatch, TUI OpenRouter structured
  output filter bypass, hidden UI tarball outputs, BlockBar/Popover docs-example
  contract drift, enrichment out-of-diff file reads, `dgadd remove --force`
  missing-metadata gap, hotkey modifier parsing, and broken `useScope` examples
  now written above
- twenty-first reconciliation agents found CORS-denied simple-request side
  effects, TUI stale back-stack and History search footer gaps, keys export docs
  drift, keyring availability/recovery and invalid-secret migration gaps,
  quoted-path diff parsing, large terminal SSE overflow, docs route-tree and
  keys intro link gaps, and UI listbox/search/floating-panel docs-example
  contract gaps now written above; registry and package agents reported no new
  material findings
- twenty-second reconciliation agents found nested packaged-root scope leakage,
  schema-invalid local state acceptance, unignored `.diffgazer` artifact
  leakage, stale provider-key dialog state, implicit file-secret writes before
  storage selection, OpenRouter compatibility fail-open behavior, stale
  `?live=true` saved-review bypass, schema-invalid fallback SSE errors, context
  failure success events, web review back-fallback bypass, keys hotkey alias and
  shifted punctuation gaps, keys registry handoff test undercoverage, mobile
  searchable-input sizing gaps, docs sitemap/E2E/schema/namespace gaps, and
  unmanaged `dgadd list --installed` drift now written above; package and primary
  registry agents reported no new material findings
- twenty-third reconciliation agents found project-scoped review storage reads
  before ownership checks, absolute local roots in provider-bound prompts,
  hidden/internal items exposed in public shadcn catalogs, keys listbox/tabs
  example a11y gaps, OpenRouter runtime routing enforcement gaps, TUI API-key
  paste chunk handling, Label custom-control example drift, `select` transitive
  dependency leakage, default `dgadd --integration keys` version mismatch,
  TUI diagnostics/review keyboard blockers, and docs SEO/sidebar drift now
  written above; primary registry and review-runtime agents reported no new
  material findings
- twenty-fourth reconciliation agents found relative alias copy-mode breakage,
  `popover` transitive dependency leakage, shadcn smoke static-byte masking,
  stale `dgadd remove` ownership for missing files, docs dev watcher root
  drift, concurrent embedded state clobbering, missing `git blame --`, custom
  OpenRouter model-id overwrite, stale-provider config delete failure,
  file-secret cleanup throwing outside the `Result` path, partial lens-failure
  persistence loss, TUI `j/k` severity-filter conflict, keys command/search
  input keyboard inertness, reserved-shortcut docs without default prevention,
  DiffView constrained-scroll a11y, and Breadcrumbs current custom-content
  a11y drift now written above; package dry-run and CLI-help agents reported no
  new material findings
- twenty-fifth reconciliation agents found stale-manifest registry item
  cleanup gaps, shadcn style-file import gaps, publish package-smoke network
  and `@diffgazer/add` tarball behavior gaps, keyring-backed provider status
  staleness, OpenRouter model-id search/display gaps, status-hash failure
  clean-state conflation, fallback evidence line drift, pending docs
  busy/sidebar-label serialization, Avatar/OverflowText handler composition
  gaps, duplicate scope-name isolation gaps, `useFocusZone` `scope: null`
  drift, dialog/modal and utility docs semantics gaps, TUI global shortcut,
  retry, activity-log, and ScrollArea gaps, plus report/fix-order coverage
  corrections now written above; embedded local-server agent reported no new
  material findings
- each completed reconciliation agent reported `git diff --check` passed in its
  read-only workspace
- round nineteen package agent also reported `pnpm run validate:artifacts:check`
  and `pnpm run verify:monorepo` passed; keys agent reported focused
  `@diffgazer/keys` tests and type-check passed
- round twenty agents additionally reported focused docs Nitro runtime probes,
  `@diffgazer/add`, `@diffgazer/keys`, `@diffgazer/server`, and `@diffgazer/ui`
  focused tests/type-checks where relevant
- round twenty-one agents additionally reported registry validation/artifact
  checks, package dry-run pack checks, focused `@diffgazer/keys`,
  `@diffgazer/ui`, and `@diffgazer/add` tests/type-checks where relevant, and
  repeated `git diff --check` in their read-only workspaces
- round twenty-two agents additionally reported public registry/import/CSS
  probes, shadcn/package/CLI smoke scripts, package dry-run pack checks,
  artifact validation, focused `@diffgazer/keys` and `@diffgazer/ui` checks, and
  repeated `git diff --check` in their read-only workspaces
- round twenty-three agents additionally reported registry validation, artifact
  validation, package dry-run checks, `dgadd` dry-run package/copy probes,
  focused static docs metadata probes, and repeated `git diff --check` in their
  read-only workspaces
- round twenty-four agents additionally reported package dry-run pack checks,
  artifact validation, CLI help probes, targeted registry/CLI copy smoke
  fixtures, targeted docs watcher probes, focused keyboard/a11y source checks,
  and repeated `git diff --check` in their read-only workspaces
- round twenty-five agents additionally reported package/release smoke probes,
  targeted registry stale-manifest and `registry:style` checks, provider model
  and keyring-status checks, docs generated-output checks, UI/keys accessibility
  and handler-composition checks, TUI Ink keyboard checks, adversarial report
  consistency checks, and repeated `git diff --check` in their read-only
  workspaces
- local `pnpm audit --prod --audit-level=moderate --json` was rerun to capture
  the exact advisory list above

Not run in this second pass:

- full `pnpm run release-check`
- root `type-check` / `test` / `test:types`
- strict smoke
- docs build
- docs Playwright E2E
- full all-item public registry install matrix

Current untracked files as of the twenty-fifth reconciliation pass:

- `DEPLOYMENT_PLAN.md`
- `HANDOFF_READINESS_AUDIT.md`
- `SOTA-AUDIT.md`

## Suggested Fix Order

1. Decide docs deployment mode: fully static preferred for registry reliability,
   TanStack Start/Nitro runtime only if intentionally hosted, runtime-validated,
   and tested, including malformed server-function calls.
2. Fix the confirmed broken public registry entries (`menu`,
   `navigation-list`, `code-block`, `stepper`, `horizontal-stepper`) and make
   validation fail on undeclared local imports and broken CSS target rewrites;
   fix `dgadd add/remove` manifest/CSS durability and `remove --force`
   missing-metadata recovery plus unmanaged `list --installed` drift, hidden
   public shadcn catalog exposure, relative alias copy-mode rewrites, missing
   owned-file manifest cleanup, stale/unknown manifest item cleanup,
   `registry:style` import coverage, static-byte shadcn smoke coverage, and
   `select`/`popover` direct dependency closure in the same pass.
3. Move canonical host, schema URLs, and all registry/docs commands to
   `docs.b4r7.dev`; fix shadcn namespace docs, schema alias validation, sitemap
   `lastmod`, docs E2E freshness, docs dev artifact watcher roots, generated
   SEO description parity, pending-route busy/sidebar label output, and sidebar
   active-item auto-scroll while doing the host/schema pass.
4. Deploy `docs.b4r7.dev` and add hosted registry checks.
5. Build/deploy `diffgazer.b4r7.dev` as a static product/install page.
6. Harden packaged embedded API:
   - loopback bind
   - listen-error handling
   - dev-only broad localhost CORS
   - reject CORS-denied simple requests before state-changing handlers run
   - reject non-JSON unsafe requests where JSON validators are expected
   - per-run browser-origin token on sensitive routes
   - ignore client project-root header in packaged mode
   - resolve packaged nested launch roots to the Git root before trust/review
   - server-derived trust identity
   - trust root validation
   - keep `.diffgazer` artifacts out of status/diff/review input
   - shutdown PID binding
   - hardened Git read runner that disables external diff/textconv/fsmonitor
7. Make local config/trust/secrets persistence fail closed and durable, including
   schema validation for parseable but invalid local state and cross-process or
   concurrent-instance write protection.
8. Fix provider setup and secret-storage semantics:
   - env credentials must resolve actual env vars, not persist `"env"` or env
     var names
   - provider API-key dialogs must reset stale unsubmitted values across
     providers
   - setup readiness must verify the active provider key is retrievable
   - model selection must not activate providers without credentials
   - custom OpenRouter model ids must survive dialog reopen/confirm flows
   - OpenRouter model loading must return structured errors for JSON/cache
     failures
   - OpenRouter compatibility filtering must not fail open on missing metadata
   - OpenRouter runtime calls must enforce structured-output routing
   - onboarding save must not leave partial settings/provider state
   - TUI needs the same custom OpenRouter model-id path as web
   - TUI OpenRouter onboarding must use the shared structured-output
     compatibility filter
   - TUI API-key inputs must accept full pasted key chunks
   - provider secrets must not persist before an explicit storage backend exists
   - file storage copy must stop claiming encryption unless encryption exists
   - provider dialog copy must reflect file vs keyring storage
   - provider status must verify or explicitly classify keyring-backed secret
     readability
   - config deletion must be able to clear stale active-provider state even
     when its secret is missing
   - last-file-secret cleanup must be transactional or remain inside the
     provider `Result` path
   - storage migration must be crash-safe and durable
   - keyring availability must recover after transient failures
   - file-to-keyring migration must quarantine invalid provider ids
   - OpenRouter model search/display must expose exact model ids
   - session trust must actually expire with the session
9. Wire review cancel to server-side cancellation and fix stream controller
   ownership, including drilldown cancellation, active-review scope matching,
   status-hash failure handling, context cache invalidation on HEAD changes,
   workspace-root discovery, partial View Results gating, drilldown storage
   concurrency, saved-review diff requirements, terminal `complete.result`
   propagation, enrichment alignment with reviewed diff contents, rejection of
   out-of-diff enrichment files, `git blame --` path separation, fallback
   evidence excerpt line mapping, quoted-path diff parsing, partial lens failure
   persistence, large terminal SSE completion events, stale `?live=true`
   saved-review fallback, fallback SSE error schema, route-to-stream integration
   coverage, and context-build failure reporting. Also scope stored review reads
   before migration/warnings and remove absolute local roots from provider-bound
   prompts.
10. Align TUI/server port configuration and stop `/api/config/init` from
    mutating repos before trust; fix TUI resume mode/review-id behavior. The
    pre-trust mutation fix must cover all project-identity resolution paths, not
    only `/api/config/init`. Also fix first-run trust commit, onboarding nav,
    review Back/Cancel keyboard state in the TUI, settings pending-save
    Escape/back behavior, stale settings back-stack behavior, and History search
    footer keyboard wiring. Fix diagnostics initial action focus, review detail
    tab state/number shortcuts, fix-plan/agent-filter keyboard activation, and
    the review severity-filter versus issue-navigation `j/k` collision. Gate
    global shortcuts during onboarding, catch disconnected retry failures, make
    the review activity log tail/scroll contract explicit, and clamp/reset
    shared TUI scroll offsets when content shrinks.
11. Hide or fix packaged `--dev` mode before public CLI handoff.
12. Fix web app product UX/accessibility gaps before public handoff: session
    trust preservation, Home/Help shortcut source of truth, History issue
    drill-in, live activity log semantics, light-theme footer contrast, durable
    theme-save feedback, narrow-viewport fallbacks, and review Escape/back safe
    fallback.
13. Fix `StepperTrigger` `onFocus`.
14. Add all-item registry install/build matrix for release/nightly.
15. Publish scoped packages and run post-publish consumer checks; reject hidden
    registry outputs in package tarballs before publish, and make the default
    `dgadd --integration keys` version range match the published keys release.
    Publish/package gates must run network-backed package smoke and installed
    `@diffgazer/add` init/add/list/diff behavior smoke, not only source-dist or
    help checks.
16. Clean public contract/doc gaps: `lowlight`, `DialogShell`, docs alias,
    Stepper navigation ownership, `NavigationList.Group`, `MenuItemCheckbox`,
    `floating-indicator`, hook compat artifacts, `useActionRowNavigation`,
    hotkey modifier parsing, hotkey alias priority, shifted punctuation support,
    `useScope`, duplicate scope-name isolation, `useFocusZone` `scope: null`,
    owner-document keyboard/focus restore behavior, public keys root-export
    docs, keys public-registry leakage tests, keys listbox/tabs/dialog/utility
    example a11y semantics, `BlockBar`, `Popover`, `useListbox`, `SearchInput`,
    `FloatingPanel`, `Label` custom-control examples, `AvatarImage` and
    `OverflowText` handler composition, mobile searchable input sizing, docs
    nested-interactive controls, mobile sidebar focus state, docs generated
    route-tree handling, keys intro links, command/search input keyboard
    ownership, reserved-shortcut `preventDefault` examples, DiffView
    constrained-scroll a11y, Breadcrumbs current semantics, and reduced-motion
    scroll behavior.
17. Make moderate production audit either clean or explicitly documented with
    accepted risk and runtime rationale.

## Sources Checked

Local source:

- `cli/diffgazer/src/lib/servers/embedded-server.ts`
- `cli/server/src/app.ts`
- `cli/server/src/features/settings/router.ts`
- `cli/server/src/features/shutdown/router.ts`
- `cli/server/src/features/shutdown/service.ts`
- `cli/server/src/features/git/router.ts`
- `cli/server/src/dev-server.ts`
- `cli/server/src/dev-server.test.ts`
- `cli/server/src/shared/lib/http/request.ts`
- `cli/server/src/shared/lib/paths.ts`
- `cli/server/src/shared/middlewares/trust-guard.ts`
- `cli/server/src/shared/middlewares/setup-guard.ts`
- `cli/server/src/shared/lib/fs.ts`
- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/lib/config/store.ts`
- `cli/server/src/shared/lib/config/providers-state.ts`
- `cli/server/src/shared/lib/config/secrets-migration.ts`
- `cli/server/src/shared/lib/ai/openrouter-models.ts`
- `cli/server/src/features/config/service.test.ts`
- `cli/server/src/features/config/schemas.ts`
- `cli/server/src/features/config/router.ts`
- `cli/server/src/features/review/service.ts`
- `cli/server/src/features/review/sessions.ts`
- `cli/server/src/features/review/review-routes.ts`
- `cli/server/src/features/review/drilldown.ts`
- `cli/server/src/features/review/schemas.ts`
- `cli/server/src/features/review/pipeline.ts`
- `cli/server/src/features/review/diff.ts`
- `cli/server/src/features/review/sse-replay.ts`
- `cli/server/src/features/review/context.ts`
- `cli/server/src/features/review/context.test.ts`
- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/shared/lib/review/prompts.ts`
- `cli/server/src/shared/lib/review/lenses.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`
- `cli/server/src/shared/lib/storage/reviews.ts`
- `cli/server/src/app.test.ts`
- `libs/core/src/api/hooks/use-review-stream.ts`
- `libs/core/src/api/review.ts`
- `libs/core/src/onboarding/can-proceed.ts`
- `libs/core/src/onboarding/save-wizard.ts`
- `libs/core/src/schemas/config/settings.ts`
- `libs/core/src/schemas/config/providers.ts`
- `libs/core/src/schemas/context/context.ts`
- `libs/core/src/schemas/review/storage.ts`
- `cli/diffgazer/src/lib/servers/server-factories.ts`
- `cli/diffgazer/src/lib/api.ts`
- `cli/diffgazer/src/index.tsx`
- `cli/diffgazer/src/cli-options.ts`
- `cli/diffgazer/src/config.ts`
- `cli/diffgazer/src/lib/servers/api-server.ts`
- `cli/diffgazer/src/app/index.tsx`
- `cli/diffgazer/src/app/screens/home-screen.tsx`
- `cli/diffgazer/src/app/screens/review-screen.tsx`
- `cli/diffgazer/src/features/home/lib/create-home-menu-action.ts`
- `cli/diffgazer/src/features/providers/components/api-key-method-selector.tsx`
- `cli/diffgazer/src/features/providers/components/api-key-overlay.tsx`
- `cli/diffgazer/src/features/providers/components/provider-details.tsx`
- `cli/diffgazer/src/features/onboarding/components/onboarding-wizard.tsx`
- `cli/diffgazer/src/features/review/components/review-container.tsx`
- `cli/diffgazer/src/features/review/hooks/use-review-lifecycle.ts`
- `cli/diffgazer/src/hooks/use-config-guard.ts`
- `cli/add/src/commands/init.ts`
- `cli/add/src/commands/remove.ts`
- `cli/add/src/commands/diff.ts`
- `cli/add/src/commands/add/css-ops.ts`
- `cli/add/src/commands/add/file-ops.ts`
- `cli/add/src/commands/add/manifest.ts`
- `libs/registry/src/cli/workflows/remove.ts`
- `libs/registry/src/cli/workflows/diff.ts`
- `libs/registry/src/cli/config.ts`
- `apps/web/src/app/providers/theme-provider.tsx`
- `apps/web/src/app/router.tsx`
- `apps/web/src/components/layout/global-layout.tsx`
- `apps/web/src/features/settings/components/trust-permissions/page.tsx`
- `apps/web/src/features/settings/components/theme/page.tsx`
- `apps/web/src/features/settings/components/storage/page.tsx`
- `apps/web/src/components/shared/api-key-method-selector.tsx`
- `apps/web/src/components/shared/storage-selector-content.tsx`
- `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx`
- `apps/web/src/features/providers/hooks/use-api-key-form.ts`
- `apps/web/src/features/providers/hooks/use-providers.ts`
- `apps/web/src/features/providers/components/page.tsx`
- `apps/web/src/features/providers/components/provider-list.tsx`
- `apps/web/src/features/providers/components/provider-details.tsx`
- `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx`
- `apps/web/src/features/providers/hooks/use-provider-management.ts`
- `apps/web/src/lib/config-guards.ts`
- `apps/web/src/styles/theme-overrides.css`
- `apps/web/src/features/history/components/page.tsx`
- `apps/web/src/features/history/components/history-insights-pane.tsx`
- `apps/web/src/features/history/hooks/use-history-page.ts`
- `apps/web/src/features/review/components/page.tsx`
- `apps/web/src/features/review/components/review-progress-view.tsx`
- `apps/web/src/features/review/components/issue-list-pane.tsx`
- `apps/web/src/features/review/components/activity-log.tsx`
- `apps/web/src/features/review/components/agent-board.tsx`
- `apps/web/src/features/review/hooks/use-issue-selection.ts`
- `apps/web/src/features/review/hooks/use-issue-details-tabs.ts`
- `apps/web/src/features/review/hooks/use-review-results-keyboard.ts`
- `apps/docs/src/components/copy-button.tsx`
- `apps/docs/src/components/source-viewer.tsx`
- `apps/docs/src/components/hook-source.tsx`
- `apps/docs/src/router.tsx`
- `apps/docs/src/components/toc.tsx`
- `apps/docs/src/routes/index.tsx`
- `apps/docs/src/routes/__root.tsx`
- `apps/docs/src/routes/$lib/docs/$.tsx`
- `apps/docs/src/components/not-found.tsx`
- `apps/docs/src/components/docs-not-found.tsx`
- `apps/docs/src/layouts/docs-content-layout.tsx`
- `apps/docs/src/layouts/sidebar.tsx`
- `apps/docs/registry/ui/sidebar/sidebar.tsx`
- `apps/docs/registry/ui/sidebar/sidebar-provider.tsx`
- `apps/docs/src/lib/seo.ts`
- `apps/docs/src/lib/consumption-metadata.ts`
- `apps/docs/content/docs/ui/components/stepper.mdx`
- `apps/docs/content/docs/ui/hooks/meta.json`
- `apps/docs/src/components/docs-mdx/blocks/consumption-block.tsx`
- `apps/docs/scripts/generate-sitemap.mjs`
- `apps/docs/vite.config.ts`
- `apps/docs/playwright.config.ts`
- `apps/docs/src/layouts/footer.tsx`
- `apps/docs/public/schema/diffgazer.json`
- `libs/registry/src/constants.ts`
- `libs/registry/src/shadcn/build.ts`
- `libs/registry/src/docs/sync-operations.ts`
- `libs/ui/registry/registry.json`
- `libs/ui/scripts/validate-registry-metadata.ts`
- `libs/ui/scripts/transform-public-registry-keys-imports.ts`
- `libs/ui/public/r/button.json`
- `libs/keys/public/r/navigation.json`
- `libs/ui/registry/ui/menu/index.ts`
- `libs/ui/registry/ui/navigation-list/index.ts`
- `libs/ui/registry/component-docs/navigation-list.ts`
- `libs/ui/registry/ui/navigation-list/navigation-list-group.tsx`
- `libs/ui/registry/ui/card/card.tsx`
- `libs/ui/registry/component-docs/card.ts`
- `libs/ui/registry/examples/card/card-interactive.tsx`
- `libs/ui/registry/ui/code-block/index.ts`
- `libs/ui/registry/ui/code-block/code-block.tsx`
- `libs/ui/registry/ui/code-block/code-block-content.tsx`
- `libs/ui/registry/ui/code-block/code-block-header.tsx`
- `libs/ui/registry/component-docs/code-block.ts`
- `libs/ui/registry/examples/code-block/code-block-bare.tsx`
- `libs/ui/registry/ui/toast/toast-store.ts`
- `libs/ui/registry/component-docs/toast.ts`
- `libs/ui/registry/ui/toast/toast.test.tsx`
- `libs/ui/registry/ui/scroll-area/scroll-area.tsx`
- `libs/ui/registry/ui/stepper/index.ts`
- `libs/ui/registry/ui/horizontal-stepper/index.ts`
- `libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-default.tsx`
- `libs/ui/public/r/stepper.json`
- `libs/ui/public/r/horizontal-stepper.json`
- `libs/ui/registry/ui/stepper/stepper-trigger.tsx`
- `libs/ui/registry/ui/shared/dialog-shell.tsx`
- `libs/ui/dist/components/callout.d.ts`
- `libs/ui/dist/_types/registry/ui/callout/index.d.ts`
- `libs/ui/dist/_types/registry/ui/panel/index.d.ts`
- `libs/ui/dist/_types/registry/ui/stepper/index.d.ts`
- `libs/ui/scripts/build-declarations.ts`
- `libs/ui/registry/ui/panel/panel.tsx`
- `libs/ui/registry/ui/dialog/dialog-content.tsx`
- `libs/ui/registry/ui/field/field.tsx`
- `libs/ui/registry/ui/select/select.tsx`
- `libs/ui/registry/ui/select/select-item.tsx`
- `libs/ui/registry/ui/menu/menu-sub.tsx`
- `libs/ui/registry/ui/menu/menu-item-checkbox.tsx`
- `libs/ui/registry/component-docs/menu.ts`
- `libs/ui/registry/examples/menu/menu-checkbox-radio.tsx`
- `libs/ui/registry/ui/button/button.tsx`
- `libs/ui/registry/ui/shared/command-palette.css`
- `libs/ui/registry/hooks/use-presence.ts`
- `libs/ui/registry/hooks/use-active-heading.ts`
- `libs/ui/styles/theme.css`
- `libs/ui/styles/theme-base.css`
- `Dockerfile`
- `docker-compose.yml`
- `.github/workflows/release.yml`
- `PACKAGE_GOVERNANCE.md`
- `DEPLOYMENT_PLAN.md`
- `pnpm-workspace.yaml`
- registry/package/docs files referenced above

Additional round-19 local source:

- `cli/diffgazer/src/features/home/components/trust-panel.tsx`
- `cli/diffgazer/src/components/ui/button.tsx`
- `cli/diffgazer/src/components/ui/checkbox.tsx`
- `cli/diffgazer/src/features/review/components/api-key-missing-view.tsx`
- `cli/diffgazer/src/features/review/components/no-changes-view.tsx`
- `cli/diffgazer/src/features/review/components/review-progress-view.tsx`
- `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx`
- `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`
- `apps/web/src/features/review/components/review-container.tsx`
- `apps/web/src/features/review/hooks/use-review-progress-keyboard.ts`
- `apps/web/src/features/review/hooks/use-review-lifecycle.ts`
- `apps/web/src/features/review/components/review-progress-view.test.tsx`
- `apps/web/src/features/providers/components/model-select-dialog/model-search-input.tsx`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `apps/web/src/features/onboarding/hooks/use-onboarding.ts`
- `libs/core/src/api/hooks/use-review-completion.ts`
- `libs/core/src/review/lifecycle-helpers.ts`
- `cli/server/src/features/review/enrichment.ts`
- `cli/server/src/features/review/enrichment.test.ts`
- `cli/server/src/features/review/drilldown.test.ts`
- `cli/server/src/shared/lib/storage/persistence.ts`
- `cli/server/src/shared/lib/storage/reviews.test.ts`
- `libs/registry/src/cli/workflows/apply-install-plan.ts`
- `libs/keys/package.json`
- `libs/keys/registry/registry.json`
- `libs/keys/internal-docs-manifest.json`
- `libs/keys/src/hooks/use-action-row-navigation.ts`
- `libs/keys/src/hooks/use-action-row-navigation.test.tsx`
- `libs/keys/docs/content/hooks/use-action-row-navigation.mdx`
- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/src/hooks/use-focus-restore.ts`
- `libs/ui/public/r/navigation-list.json`
- `libs/ui/public/r/code-block.json`
- `libs/ui/registry/ui/navigation-list/navigation-list-item.tsx`
- `libs/ui/registry/ui/navigation-list/navigation-list-group-context.tsx`
- `libs/ui/registry/ui/menu/menu.tsx`
- `libs/ui/registry/examples/code-block/code-block-highlighted.tsx`
- `libs/ui/registry/ui/code-block/code-block-highlight.tsx`
- `libs/ui/registry/ui/code-block/code-block.test.tsx`

Additional round-20 local source:

- `apps/docs/src/features/search/hooks/use-search.ts`
- `apps/docs/src/routes/$lib/docs.tsx`
- `apps/docs/src/layouts/header.tsx`
- `apps/docs/.output/server/_ssr/index.mjs`
- `apps/web/src/features/settings/components/analysis/page.tsx`
- `apps/web/src/features/settings/components/agent-execution/page.tsx`
- `cli/diffgazer/src/hooks/use-back-handler.ts`
- `cli/diffgazer/src/app/screens/settings/storage-screen.tsx`
- `cli/diffgazer/src/app/screens/settings/analysis-screen.tsx`
- `cli/diffgazer/src/app/screens/settings/agent-execution-screen.tsx`
- `cli/server/src/shared/lib/review/analysis.ts`
- `cli/server/src/shared/lib/review/issues.ts`
- `libs/core/src/review/stream-review.ts`
- `libs/core/src/schemas/review/issues.ts`
- `libs/core/src/api/openrouter-utils.ts`
- `libs/core/src/providers/use-openrouter-models-mapped.ts`
- `apps/web/src/features/onboarding/components/steps/model-step.tsx`
- `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx`
- `libs/ui/tsup.config.ts`
- `scripts/monorepo/artifacts/pack-surface.mjs`
- `libs/ui/registry/examples/block-bar/block-bar-multi-segment.tsx`
- `libs/ui/registry/ui/block-bar/block-bar.tsx`
- `libs/ui/registry/component-docs/block-bar.ts`
- `libs/ui/registry/component-docs/popover.ts`
- `libs/ui/registry/ui/popover/popover-content.tsx`
- `libs/ui/registry/ui/popover/popover.test.tsx`
- `libs/registry/src/cli/command-factories.ts`
- `cli/add/src/commands/cli-behavior.test.ts`
- `libs/keys/src/dom/keyboard-utils.ts`
- `libs/keys/docs/content/api/hotkey-format.mdx`
- `libs/keys/src/hooks/use-scope.ts`
- `libs/keys/docs/content/guides/focus-and-scroll.mdx`
- `libs/keys/docs/content/guides/scopes.mdx`

Additional round-21 local source:

- `cli/server/src/features/review/context-routes.ts`
- `cli/server/src/shared/lib/config/keyring.ts`
- `cli/server/src/shared/lib/config/secrets-migration.ts`
- `cli/server/src/shared/lib/config/state.ts`
- `cli/server/src/shared/lib/diff/parser.ts`
- `libs/core/src/streaming/sse-parser.ts`
- `apps/docs/src/router.tsx`
- `apps/docs/.gitignore`
- `apps/docs/content/docs/keys/index.mdx`
- `apps/docs/content/docs/keys/hooks/meta.json`
- `apps/docs/content/docs/keys/guides/meta.json`
- `cli/diffgazer/src/app/navigation-context.tsx`
- `cli/diffgazer/src/features/history/hooks/get-history-footer.ts`
- `cli/diffgazer/src/app/screens/history-screen.tsx`
- `cli/diffgazer/src/components/ui/input.tsx`
- `libs/ui/registry/hook-docs/listbox.ts`
- `libs/ui/registry/hooks/use-listbox.ts`
- `libs/ui/registry/examples/listbox/listbox-basic.tsx`
- `libs/ui/registry/hooks/testing/use-listbox.test.tsx`
- `libs/ui/registry/component-docs/search-input.ts`
- `libs/ui/registry/examples/search-input/search-input-keyboard.tsx`
- `libs/ui/registry/ui/search-input/search-input.tsx`
- `libs/ui/registry/component-docs/floating-panel.ts`
- `libs/ui/registry/examples/floating-panel/floating-panel-custom-menu.tsx`
- `libs/ui/registry/ui/floating-panel/floating-panel.tsx`
- `libs/ui/registry/ui/floating-panel/floating-panel.test.tsx`
- `libs/keys/dist/index.d.ts`
- `libs/keys/README.md`
- `libs/keys/docs/content/api/utilities.mdx`
- `apps/docs/src/lib/docs-library.test.ts`

Additional round-22 local source:

- `cli/diffgazer/src/lib/servers/server-factories.ts`
- `cli/server/src/shared/lib/git/service.ts`
- `apps/web/src/features/providers/hooks/use-api-key-form.ts`
- `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx`
- `apps/web/src/features/providers/components/page.tsx`
- `cli/diffgazer/src/features/providers/components/api-key-overlay.tsx`
- `libs/core/src/providers/use-openrouter-models-mapped.ts`
- `libs/core/src/providers/use-openrouter-models-mapped.test.ts`
- `apps/web/src/features/home/components/home-presentation.tsx`
- `apps/web/src/features/review/hooks/use-review-results-keyboard.ts`
- `apps/web/src/features/review/components/review-summary-view.tsx`
- `apps/web/src/lib/back-navigation.ts`
- `apps/web/src/components/layout/global-layout.tsx`
- `cli/server/src/features/review/session-resume.ts`
- `cli/server/src/shared/lib/http/sse.ts`
- `cli/server/src/features/review/pipeline.ts`
- `libs/keys/docs/content/api/keyboard-provider.mdx`
- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/src/registry-handoff.test.ts`
- `libs/keys/public/r/focus-trap.json`
- `libs/ui/registry/lib/input-variants.ts`
- `libs/ui/registry/ui/select/select-search.tsx`
- `libs/ui/registry/ui/command-palette/command-palette-input.tsx`
- `libs/ui/registry/ui/shared/command-palette.css`
- `libs/ui/public/r/select.json`
- `libs/ui/public/r/command-palette.json`
- `apps/docs/scripts/generate-sitemap.mjs`
- `apps/docs/playwright.config.ts`
- `apps/docs/public/schema/diffgazer.json`
- `libs/ui/docs/content/utils/shadcn-namespace.mdx`
- `libs/ui/scripts/build-publish-artifacts.ts`
- `libs/keys/scripts/build-publish-artifacts.ts`
- `cli/add/src/utils/namespaces.ts`
- `cli/add/src/commands/diff.ts`
- `cli/add/src/commands/remove.ts`
- `libs/registry/src/cli/command-helpers.ts`

Additional round-23 local source:

- `cli/server/src/shared/lib/storage/reviews.ts`
- `cli/server/src/features/review/review-routes.ts`
- `cli/server/src/shared/lib/review/prompts.ts`
- `libs/ui/public/r/registry.json`
- `libs/keys/public/r/registry.json`
- `cli/add/src/utils/add-integration.ts`
- `cli/add/src/commands/add.ts`
- `cli/add/README.md`
- `libs/ui/docs/content/cli/add.mdx`
- `libs/keys/registry/examples/use-navigation/use-navigation-basic.tsx`
- `libs/keys/registry/examples/use-navigation/use-navigation-tabs.tsx`
- `libs/keys/registry/examples/use-scoped-navigation/use-scoped-navigation-basic.tsx`
- `libs/keys/registry/examples/use-focus-zone/use-focus-zone-basic.tsx`
- `libs/keys/docs/content/guides/navigation.mdx`
- `cli/server/src/shared/lib/ai/client.ts`
- `cli/diffgazer/src/app/screens/settings/diagnostics-screen.tsx`
- `cli/diffgazer/src/hooks/use-settings-zone.ts`
- `cli/diffgazer/src/features/review/components/review-results-view.tsx`
- `cli/diffgazer/src/features/review/hooks/use-review-keyboard.ts`
- `cli/diffgazer/src/features/review/components/issue-details-pane.tsx`
- `cli/diffgazer/src/features/review/components/fix-plan-checklist.tsx`
- `cli/diffgazer/src/features/review/components/agent-filter-bar.tsx`
- `cli/diffgazer/src/features/review/components/review-progress-view.tsx`
- `libs/ui/registry/examples/label/label-horizontal.tsx`
- `libs/ui/registry/component-docs/label.ts`
- `libs/ui/registry/ui/label/label.tsx`
- `libs/ui/registry/ui/checkbox/checkbox.tsx`
- `libs/ui/registry/ui/select/select-content.tsx`
- `apps/docs/content/docs/ui/components/code-block.mdx`
- `apps/docs/src/layouts/sidebar.tsx`
- `apps/docs/registry/ui/sidebar/sidebar-item.tsx`

Additional round-24 local source:

- `cli/add/src/utils/transform.ts`
- `libs/ui/public/r/popover.json`
- `libs/keys/examples/playground/src/demos/command-palette.tsx`
- `libs/keys/examples/playground/src/demos/global-shortcuts.tsx`
- `libs/keys/src/hooks/use-scoped-navigation.ts`
- `libs/keys/docs/api.md`
- `libs/keys/registry/examples/use-key/use-key-basic.tsx`
- `libs/keys/registry/examples/use-key/use-key-map.tsx`
- `cli/server/src/shared/lib/fs.ts`
- `cli/server/src/shared/lib/git/service.ts`
- `cli/server/src/shared/lib/review/orchestrate.ts`
- `libs/core/src/schemas/review/storage.ts`
- `scripts/monorepo/smoke-shadcn-install.mjs`
- `libs/ui/registry/ui/diff-view/diff-view.tsx`
- `libs/ui/registry/ui/shared/diff-view.css`
- `libs/ui/registry/ui/diff-view/diff-view-unified.tsx`
- `libs/ui/registry/ui/diff-view/diff-view-split.tsx`
- `libs/ui/registry/ui/diff-view/diff-view.test.tsx`
- `libs/ui/registry/component-docs/breadcrumbs.ts`
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs-item.tsx`
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs-link.tsx`
- `libs/ui/registry/ui/breadcrumbs/breadcrumbs.test.tsx`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `cli/server/src/features/config/service.ts`
- `apps/docs/vite-plugin-docs-rebuild.ts`
- `apps/docs/config/docs-libraries.json`

Additional round-25 local source:

- `cli/add/src/commands/diff.ts`
- `cli/add/src/commands/remove.ts`
- `cli/add/src/utils/namespaces.ts`
- `libs/ui/public/r/dialog-shell.json`
- `libs/ui/public/r/code-block.json`
- `libs/ui/public/r/diff-view.json`
- `libs/ui/public/r/command-palette.json`
- `libs/ui/public/r/sidebar.json`
- `libs/ui/styles/styles.css`
- `scripts/monorepo/smoke-package-runner.mjs`
- `scripts/monorepo/smoke-package-install.mjs`
- `scripts/monorepo/smoke-cli.mjs`
- `cli/add/src/utils/integration.ts`
- `cli/server/src/features/config/router.ts`
- `libs/core/src/providers/list.ts`
- `libs/core/src/providers/models.ts`
- `apps/web/src/features/providers/components/model-select-dialog/model-list-item.tsx`
- `cli/diffgazer/src/features/providers/components/model-list-item.tsx`
- `cli/server/src/features/review/session-resume.ts`
- `cli/server/src/shared/lib/review/issues.ts`
- `cli/server/src/shared/lib/review/issues.test.ts`
- `apps/docs/src/lib/hooks/use-pending-docs-route.ts`
- `apps/docs/src/layouts/docs-content-layout.tsx`
- `libs/ui/registry/ui/avatar/avatar-image.tsx`
- `libs/ui/registry/ui/avatar/avatar.tsx`
- `libs/ui/registry/component-docs/avatar.ts`
- `libs/ui/registry/ui/overflow/overflow-text.tsx`
- `libs/ui/registry/ui/popover/popover-trigger.tsx`
- `libs/ui/registry/ui/overflow/overflow.test.tsx`
- `libs/keys/src/hooks/use-focus-zone.ts`
- `libs/keys/docs/content/api/utilities.mdx`
- `libs/keys/examples/playground/src/demos/focus-trap.tsx`
- `libs/keys/examples/playground/src/demos/scoped-dialog.tsx`
- `cli/diffgazer/src/components/ui/menu.tsx`
- `cli/diffgazer/src/hooks/use-config-guard.ts`
- `libs/core/src/api/hooks/server.ts`
- `cli/diffgazer/src/features/review/components/activity-log.tsx`
- `cli/diffgazer/src/components/ui/scroll-area.tsx`
- `cli/diffgazer/src/features/history/components/history-insights-pane.tsx`

External/current behavior references:

- Node.js `server.listen` host behavior:
  `https://nodejs.org/api/net.html#serverlisten`
- MDN CORS overview:
  `https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS`
- WICG Local Network Access draft:
  `https://wicg.github.io/local-network-access/`
- shadcn registry documentation
- Vite build/static deploy documentation
- TanStack Router/Start documentation
- npm provenance and Trusted Publishing documentation
- Turborepo environment variable and task-hash documentation:
  `https://turborepo.com/docs/crafting-your-repository/using-environment-variables`
- MDN `KeyboardEvent.key`:
  `https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key`
- OpenRouter provider routing docs:
  `https://openrouter.ai/docs/guides/routing/provider-selection`
- OpenRouter AI SDK provider docs:
  `https://github.com/OpenRouterTeam/ai-sdk-provider`
- WAI-ARIA APG combobox pattern:
  `https://www.w3.org/WAI/ARIA/apg/patterns/combobox/`
- WAI-ARIA APG modal dialog pattern:
  `https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/`
- OpenRouter list available models API:
  `https://openrouter.ai/docs/api-reference/list-available-models`

## Skills And Subagents

Skills applied:

- `sota`
- `code-audit`
- `clean-code`
- `code-quality`
- `anti-slop`
- `security-review`
- `test-behavior-not-implementation`
- React rules applied manually where named React skills were not installed

Second pass subagent focus areas:

- embedded local API security
- registry/shadcn/copy/package readiness
- docs/domain/routing/SEO
- verification gates and CI
- UI/keys/public contracts and React quality
- CLI add/remove/SSE/AI runtime edge cases

`SOTA-AUDIT.md` reconciliation subagent focus areas:

- registry/shadcn/dgadd/package comparison
- local API/security comparison
- docs/domain/routing/deploy/SEO comparison
- UI/keys/web React/accessibility/styling comparison
- CI/release/build/test/package-gate comparison
- CLI/add/remove/SSE/AI/dgadd comparison

Iterative second reconciliation pass focus areas:

- registry/release/docs command gates
- local embedded server/provider/secrets/review runtime
- UI/accessibility/styling
- adversarial meta-check for stale or contradictory audit claims

Iterative third reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative fourth reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative fifth reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative sixth reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative seventh reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative eighth reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative ninth reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative tenth reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative eleventh reconciliation pass focus areas:

- registry/release gate closure
- local embedded server/provider/secrets/review runtime closure
- UI/accessibility/styling closure
- adversarial meta-check for stale or contradictory audit claims

Iterative twelfth through twenty-fifth reconciliation pass focus areas:

- registry/copy/shadcn/package closure
- local embedded server security and local-state durability closure
- provider/secrets/OpenRouter runtime closure
- review/SSE/history/drilldown/runtime closure
- docs/domain/schema/SEO/build/deployment-mode closure
- UI/keys/accessibility/public-contract closure
- TUI keyboard/navigation closure
- adversarial meta-checks for stale, duplicated, or false-positive audit claims
