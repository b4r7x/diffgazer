# Hono / Small Node Backend Service Structure — Best Practices (2026)

Research agent: T-server. Date: 2026-06-04.
Scope: structure of `cli/server` (`@diffgazer/server`), the embedded, CLI-internal Hono backend
(review pipeline, git, config, shutdown token), bundled into the `diffgazer` binary via tsup `noExternal`.

Read-only on the codebase. This is the only file written outside the research dir is not allowed; this file lives under `.nuke/2026-06-04-structure/research/`.

---

## What the repo already does (ground truth, read from source)

`cli/server/src` is already feature-foldered and layered inside each feature:

```
src/
  app.ts                         # createApp() factory: global middleware + app.route() mounts + notFound/onError
  index.ts                       # public entry: re-exports createApp + shutdownSessions
  dev.ts                         # dev runner
  http-server.ts                 # @hono/node-server wiring (serve)
  features/
    health/router.ts
    config/   router.ts schemas.ts service.ts (+ tests)
    settings/ router.ts schemas.ts (+ tests)
    git/      router.ts schemas.ts service.ts (+ tests)
    shutdown/ router.ts service.ts
    review/   router.ts schemas.ts service.ts types.ts errors.ts
              review-routes.ts context-routes.ts        # HTTP handlers, split by sub-area
              session-resume.ts sse-replay.ts           # SSE transport seam
              pipeline.ts orchestrate(via shared) enrichment.ts drilldown.ts summary.ts
              sessions.ts step-events.ts stream-events.ts diff.ts file-tree.ts
              context.ts workspace-discovery.ts trace.ts abort.ts
  shared/
    lib/      ai/ config/ diff/ git/ http/ review/ storage/ testing/ + errors.ts fs.ts log.ts paths.ts validation.ts crypto.ts
    middlewares/  body-limit.ts rate-limit.ts request-logger.ts setup-guard.ts trust-guard.ts
```

Key observed seams (these are GOOD and align with consensus below):

- `app.ts` exports `createApp(): Hono<AppEnv>` — a factory, not a module-level singleton. Tests build a fresh
  app (`new Hono().route("/api/review", reviewRouter)`), which is exactly the testability split the literature pushes
  (separate "app" from "serve"). Global middleware (request logger, host allow-list, security headers, CSRF-ish origin
  check, shutdown-token auth, CORS) is registered on the factory; feature routers are mounted with `app.route("/api/...", router)`.
- Each feature `router.ts` is a `new Hono()` that: applies per-route middleware (body-limit, rate-limit, setup-guard,
  trust-guard), runs `zValidator(..., schema, zodErrorHandler)`, then delegates to a handler. Handlers either live inline
  (small `config/router.ts`) or are imported from `review-routes.ts`/`context-routes.ts` (larger `review`).
- Domain logic lives in `service.ts` / `shared/lib/**` and returns `Result<T, AppError>`; routes map results to HTTP via
  `errorResponse`. No business logic throws into `app.onError` by contract.
- SSE seam: `router.ts` (validation/middleware) -> `session-resume.ts` (`streamSSE(c, ...)` + freshness check + try/catch
  + `writeSSEError`) -> `sse-replay.ts` (`streamActiveSessionToSSE`: subscribe-before-snapshot, buffer/drain, dedupe) ->
  `sessions.ts` (in-memory session registry: `Map<id, ActiveSession>` with `subscribers: Set<...>`, `onSessionComplete`,
  abort controller, caps `MAX_SESSIONS=50`, `MAX_EVENTS_PER_SESSION=10_000`, `SESSION_TIMEOUT_MS=30m`) <- `pipeline.ts`
  (domain event production via `EmitFn`). The pipeline emits events; transport reads them. This is the textbook
  pub/sub decoupling (see Q4).

This means the audit question for diffgazer is mostly "is the current structure SOTA and does it fit the owner's naming
rules?" rather than "what should we adopt from scratch?". Findings below answer per question and then say what to change.

---

## Q1 — Official Hono "Best Practices": structure, controllers, app.route(), RPC

Source: https://hono.dev/docs/guides/best-practices (fetched full).

Load-bearing points and quotes:

- **Avoid Rails-like controllers.** The doc explicitly says to use `app.route()` "to build a larger application without
  creating 'Ruby on Rails-like Controllers'."
- **Why:** path params can't be inferred in an extracted controller function without complex generics. Quote:
  "the path parameter cannot be inferred in the Controller without writing complex generics." So a controller written as
  `const getAuthor = (c) => c.json(...)` loses the `:id` type that an inline handler keeps. Write handlers directly after
  the path so TypeScript infers params.
- **Recommended modular pattern:** one `Hono` instance per route group in its own file (`authors.ts`, `books.ts`), each
  with its routes, then mount in `index.ts`: `app.route('/authors', authors)`, `app.route('/books', books)`.
- **Escape hatch if you still want controllers:** `factory.createHandlers()` from `hono/factory` preserves inference for
  extracted handlers. (So extraction is allowed; the doc's objection is specifically to *type-erasing* extraction, not to
  separating logic per se.)
- **Lambda/runtime-split file shape** (from the same doc family / DeployHQ recap): `app.ts` holds the Hono app (domain
  routing), `handler.ts` re-exports it through a runtime adapter (e.g. Lambda), `index.ts` runs it as a Node server.
  The principle: keep the *app definition* separate from the *runtime entry*.
- **RPC is optional**, presented as a feature for sharing API types client<->server, not a required architecture
  (confirmed on the RPC page, Q-RPC below).

Applicability to diffgazer: `app.ts`/`index.ts`/`http-server.ts` already implement this split — `app.ts` = app definition
+ `createApp()`, `http-server.ts` = node-server runtime, `index.ts` = library entry. The per-feature `router.ts` = the
`authors.ts`/`books.ts` pattern. `review/review-routes.ts` extracts handlers, but they are passed `c` and the already-
validated value `(c) => createReviewHandler(c, c.req.valid("json"))`, so the router file keeps the typed `c.req.valid`
call at the route site and the extracted function takes plain typed args. That sidesteps the "controllers erase param
types" objection — it is NOT a Rails controller, it's a thin typed delegate. This is fine and arguably better than inline
for the large review feature.

---

## Q2 — Routes/handlers/services layout for SMALL embedded servers (a few dozen routes)

Cross-checked sources:
- Official Hono best practices (above): per-group file + `app.route()`. No layer dirs prescribed for small apps.
- freeCodeCamp deep dive (https://www.freecodecamp.org/news/build-production-ready-web-apps-with-hono/): shows
  `src/index.ts` + `src/routes/{posts,authors}.ts`. Handlers inline. NO service layer, NO repositories in examples.
  Quote: "For larger applications, you should organize your routes into logical groups. The `app.route()` method is
  perfect for this." It deliberately stays unopinionated about where business logic lives.
- Medium "Production-Ready Hono APIs" (Yannick Burkard): the *opposite* — a full layer-folder layout
  (`schemas/ controllers/ services/ middlewares/ models/ core/ exceptions/ crons/ db/`), thin controllers that
  "validate input, call services, and return responses," services are "pure business logic (no HTTP details)" reusable
  from crons/CLI.
- Node+TS 2025 guide (https://dev.to/pramod_boda/recommended-folder-structure-for-nodets-2025-39jl): "I personally
  follow feature-based architecture" grouping `auth.controller.ts auth.service.ts auth.route.ts auth.model.ts` under
  `features/auth/`. Calls the pure layer-folder layout "bit common and confusion." Reasons given for feature folders:
  scalability, "you can delete an entire feature folder when it's no longer needed," team isolation.
- Colocation roundup (Next/React/Express colocation articles): consensus that grouping by feature/colocation beats
  grouping by type for anything past trivial size; shared/reused logic graduates UP to a `lib/`-style shared folder to
  avoid duplication. Quote: route-specific schema can live in a colocated `schema.ts`, "but when such logic is reused
  across multiple routes, it's better placed in a shared top-level folder like `lib/`."
- Fastify (https://fastify.dev/docs/latest/Guides/Plugins-Guide/ + @fastify/autoload): the small-service idiom is
  filesystem-based: `plugins/` (shared, `encapsulate:false`) + `routes/` (encapsulated per folder), with `autohooks`
  applying middleware per directory. Different framework, same instinct: feature/route folders + a shared layer, with
  encapsulation boundaries.

Where sources DISAGREE (real controversy, not platitude):
1. **Layer folders vs feature folders.** The single most popular Hono blog (Medium) uses LAYER folders
   (`controllers/ services/ schemas/`). The Node 2025 guide and the colocation literature explicitly prefer FEATURE
   folders and call layer folders confusing. Official Hono docs take neither side — they only mandate "one Hono per
   route group, mount with `app.route()`," which is compatible with both. Strongest layer-folder argument: uniform place
   for each concern, easy to enforce "controllers stay thin." Strongest feature-folder argument: deletability, locality
   of change, lower cognitive load, scales without a tangle. For a ~dozen-route embedded server the feature-folder camp
   wins on KISS+locality; diffgazer already does this.
2. **Service layer at all, for small apps.** freeCodeCamp/official examples inline handlers with no service layer (YAGNI
   for a few routes). Medium/Node-2025 insist on a service layer always. Resolution from the colocation rule: start
   inline; extract a `service.ts` only when (a) the logic is non-trivial, (b) it's reused by CLI/TUI/cron, or (c) it has
   its own tests. diffgazer's `config`/`git`/`review` have real reuse (CLI consumes the same logic) and heavy tests, so a
   service layer is justified there; `health`/`shutdown` correctly stay thin.

Concrete answer for a "few dozen routes" embedded server: feature folders (one `router.ts` per feature mounted via
`app.route()`), handlers inline for trivial features, a `service.ts` only where logic is non-trivial/reused/tested, and a
shared `lib/` for cross-feature primitives. This is precisely diffgazer's shape.

---

## Q3 — Where middleware, Zod schemas, and route registration live (idiomatic Hono)

Cross-checked:
- **Route registration:** Hono official — each feature is a `new Hono()`; the root app mounts them with
  `app.route(prefix, router)`. Global middleware via `app.use('*' | '/api/*', mw)` on the root app. Confirmed in
  freeCodeCamp and Medium too.
- **Per-route middleware:** chained positionally before the handler: `app.post('/x', mw1, mw2, zValidator(...), handler)`.
  diffgazer's `review/router.ts` does exactly this (`bodyLimitMiddleware, reviewCreationLimit, requireSetup,
  requireRepoAccess, zValidator(...), handler`).
- **Middleware location:** all sources put shared middleware in a dedicated folder. Medium: `src/middlewares/`
  (`auth.middleware.ts`). Node-2025: `src/middleware/`. Fastify: `plugins/` (shared) vs per-folder `autohooks`. diffgazer:
  `shared/middlewares/` (body-limit, rate-limit, request-logger, setup-guard, trust-guard) — idiomatic. Truly
  app-global, one-off middleware (host allow-list, security headers, CSRF origin check, shutdown-token auth) is defined
  inline in `createApp()` in `app.ts`, which is also idiomatic (Hono examples register app-wide middleware inline on the
  instance).
- **Zod schemas:** strong consensus to colocate request/param/query schemas next to the routes that use them
  (`schemas.ts` per feature), wired with `@hono/zod-validator`'s `zValidator('json'|'param'|'query', Schema)`. Quote
  (Medium): treat "Zod schemas as your single source of truth"; `zValidator` "intercepts requests before the handler
  runs; invalid data never reaches services." diffgazer matches: per-feature `schemas.ts` + `zValidator(..., zodErrorHandler)`.
  Schemas that are part of the *domain contract shared with the client/CLI* (config, review, events) correctly live in
  `@diffgazer/core/schemas/*` (the colocation rule's "graduate shared schemas up to a shared lib" — here the shared lib
  is `libs/core`). This is the right boundary: transport-shaped request schemas stay in `cli/server`, domain/contract
  schemas live in `libs/core`.

Disagreement worth recording: whether to adopt `@hono/zod-openapi` / `OpenAPIHono` so the schema is the single source for
validation AND an OpenAPI doc (Medium strongly pushes this; "most production APIs need typed input validation, an OpenAPI
spec, and a type-safe client"). For diffgazer this is YAGNI: the server is CLI-internal (not a public API surface), the
client is the bundled SPA/TUI in the same repo, and the contract is already shared via `libs/core` Zod types. Adding
`OpenAPIHono` would add type-instantiation cost (see Q-RPC) for no external consumer. Recommendation: do NOT add OpenAPI.

---

## Q4 — SSE/streaming + long-running pipeline: separating transport (HTTP) from domain pipeline

Sources:
- Hono streaming helper docs (https://hono.dev/docs/helpers/streaming): `streamSSE(c, cb)` gives `stream.writeSSE({data,
  event,id})`, `stream.sleep(ms)`, `stream.aborted`, `stream.onAbort(cb)`; `stream()` gives `write`, `pipe`, `onAbort`,
  `aborted`. CRITICAL official warning (load-bearing): "If the callback function of the streaming helper throws an error,
  the `onError` event of Hono will not be triggered" — pass a custom error handler as the third arg, or catch inside.
- DEV.to "SSE Is the Right Answer More Often Than You Think — A Hono + TypeScript Reference Service"
  (https://dev.to/sendotltd/...-3p74): the most concrete SSE-architecture source. Key load-bearing patterns:
  - **Encoder separate from handler:** a `formatEvent`/wire-format module (`sse.ts`) holds the `event:/data:/id:/retry:`
    encoding; routes don't hand-roll the wire format.
  - **Domain is a protocol-agnostic pub/sub:** `Map<string, Set<Subscriber>>`, `type Subscriber = (payload) => void`.
    "The pub-sub interface is three methods" — so you can "replace the class with one that publishes to Redis Streams or
    NATS. The rest of the service doesn't need to change." Transport subscribes; domain publishes.
  - **Cleanup in `finally`:** "the connection counter `dec('tick')` lives in a `finally` block. This is the disconnect
    handling trap, and it's the single thing most 'my SSE server leaks connections' bug reports boil down to."
    "The unsubscribe call MUST run when the client disconnects. It lives in a `finally` right next to the connection
    counter dec, because both have the same lifetime."
  - **Reconnection/replay:** "`id:` — echoed back by the browser as `Last-Event-ID` on reconnect. Perfect for
    resumption." Assign incrementing ids; a replay buffer enables resume.
  - **Abort discipline:** `while (!stream.aborted) { await stream.sleep(interval); if (stream.aborted) break; ... }`.
  - **Heartbeats:** "Fire one every 15 seconds — well under every reasonable proxy timeout." `X-Accel-Buffering: no` to
    stop nginx buffering.
  - **Backpressure/DoS:** clamp client-controllable interval (e.g. 100–10000ms) via Zod, 422 on violation.
- honojs Discussion #3472 ("Improving SSE handling for better extensibility") + community: long-running watchers need an
  event-emitter/subscription bridge because the raw `streamSSE` loop expects `sleep()` between writes; the idiomatic
  decoupling is exactly emitter -> stream writer, with `onAbort` for teardown.

The consensus seam (3 layers) — and how diffgazer maps onto it:

| Layer            | Responsibility                                              | diffgazer file(s) |
|------------------|-------------------------------------------------------------|-------------------|
| HTTP transport   | route, validate, auth/freshness, open `streamSSE`, try/catch + `writeSSEError`, `onAbort`/`finally` | `review/router.ts`, `review/session-resume.ts` |
| Stream adapter   | turn domain events into SSE frames; replay buffer + live drain + dedupe; terminal-event detection | `review/sse-replay.ts`, `review/stream-events.ts`, `review/step-events.ts`, `shared/lib/http/sse.ts` (`writeSSEError`) |
| Domain pipeline  | produce events via an `EmitFn`; no `Context`, no `Response`, no SSE knowledge | `review/pipeline.ts`, `shared/lib/review/orchestrate.ts`, `review/enrichment.ts`, `review/summary.ts` |
| Session registry | in-memory pub/sub: `Map<id, ActiveSession>` + `subscribers: Set`, completion listeners, AbortController, caps/TTL | `review/sessions.ts` |

This is the reference architecture done right. Specific confirmations in the code:
- `pipeline.ts` takes `EmitFn` and `ReviewAbort` and returns `Result<ReviewOutcome>` — zero HTTP types. Transport-agnostic
  by construction, so the same pipeline is reusable from the Ink TUI (`cli/diffgazer`) without HTTP. This is the literal
  payoff the DEV.to author describes ("the rest of the service doesn't need to change").
- `sessions.ts` is the protocol-agnostic pub/sub with bounded memory (`MAX_SESSIONS`, `MAX_EVENTS_PER_SESSION`,
  `SESSION_TIMEOUT_MS`) — the bounded version of the DEV.to `Map<string, Set<Subscriber>>`.
- `session-resume.ts` wraps the stream body in try/catch and emits `writeSSEError` — directly mitigating the official
  "streamSSE throw bypasses onError" warning.
- `sse-replay.ts` subscribes BEFORE reading the snapshot, buffers live events during replay, then drains with reference
  dedupe — this closes the snapshot/subscribe race and supports resume, beyond what the DEV.to article shows (it only
  hints at a replay buffer).

Minor gaps to verify (not necessarily defects): explicit periodic heartbeat/keepalive frames and `X-Accel-Buffering: no`
are nginx-proxy concerns; since this server is loopback-only behind the CLI (host allow-list to localhost), proxy buffering
is a non-issue, so omitting them is correct YAGNI. The abort path is handled via `AbortController`/`c.req.raw.signal` and
`cancelSession`, which is the stronger of the two abort idioms.

---

## RPC / type-instantiation (cross-cutting, affects naming + structure decisions)

Source: https://hono.dev/docs/guides/rpc.
- "When using RPC, the more routes you have, the slower your IDE will become." Cause: "massive amounts of type
  instantiations are executed to infer the type of your app"; `tsserver` redoes this on every reference.
- Mitigations, doc's priority: (1) compile types ahead of time + export `hcWithType` ("Compiling your client including the
  server app gives you the best performance"); (2) TypeScript project references for separated FE/BE; (3) split into
  multiple apps and a client per app; (4) manual type arguments.
- RPC is OPTIONAL; "Using RPC with larger applications" guidance applies only if you already use RPC.

diffgazer relevance: the server is consumed by the SPA over a hand-written/`libs/core` API client, NOT via `hc<AppType>`
RPC. So the IDE/type-instantiation tax does not apply, and splitting into multiple apps for RPC reasons is unnecessary.
The current `app.route()` mounting (no exported `AppType` chain) is the right call. Do NOT introduce RPC just to "be typed";
the typing is already provided by shared `libs/core` Zod schemas.

---

## Naming-convention cross-check (for the owner's strict "at most one hyphen / single-word" rule)

Observed in the wild for backend files: dot-suffix conventions dominate — `auth.controller.ts`, `user.service.ts`,
`post.route.ts`, `user.schema.ts` (Node-2025 guide, Medium). These are NOT hyphenated multiword names; the dot is the
separator. diffgazer instead uses single-word files inside feature folders (`router.ts`, `service.ts`, `schemas.ts`,
`types.ts`, `errors.ts`) — which is the same idea (the *folder* supplies the feature name, the *file* supplies the role)
but cleaner: no repeated `feature.` prefix, perfectly satisfies "single word file name." diffgazer's only hyphenated
server files use exactly one hyphen and name a real compound concept: `review-routes.ts`, `context-routes.ts`,
`session-resume.ts`, `sse-replay.ts`, `step-events.ts`, `stream-events.ts`, `file-tree.ts`, `body-limit.ts`,
`rate-limit.ts`, `request-logger.ts`, `setup-guard.ts`, `trust-guard.ts`, `models-dev-catalog.ts` (TWO hyphens),
`openrouter-models.ts`, `providers-state.ts`, `secrets-migration.ts`, `secrets-store.ts`, `trust-store.ts`,
`disk-cache.ts`. `models-dev-catalog.ts` is the lone two-hyphen offender; "models-dev" is a proper noun (models.dev), so
either keep it (proper noun exception) or rename the folder concept. Everything else honors the one-hyphen rule.

`.test.ts` colocated vs separate `tests/`: sources split. Node-2025 guide uses a separate `tests/` dir; the broader 2025
JS/TS testing consensus (Vitest/Jest defaults, colocation literature) colocates `*.test.ts` next to source. diffgazer
colocates (`router.test.ts`, `service.test.ts`), which is the modern default and is correct. The `.test.ts` suffix is a
universal, tooling-recognized convention (Vitest/Jest globs) and should be treated as exempt from the single-word rule.

---

## What this means for diffgazer (`cli/server`)

Verdict: the existing `cli/server` structure is already at or near SOTA for a small embedded Hono service. It correctly
implements every consensus item: factory `createApp()`, one `Hono` per feature mounted with `app.route()`, no Rails
controllers, colocated per-feature `schemas.ts` + `zValidator`, shared `middlewares/`, a `Result`-based domain layer that
never throws into `onError`, and a clean 4-layer SSE seam (transport -> adapter -> pipeline -> session pub/sub) that keeps
the review pipeline HTTP-agnostic and reusable by the TUI. This is better than the most-cited Hono blog (which uses layer
folders and inline-in-handler logic).

Concrete, repo-applicable recommendations:
1. KEEP the feature-folder + per-feature single-word-role-file naming (`router.ts`/`service.ts`/`schemas.ts`/`types.ts`).
   It satisfies the owner's "single-word file" goal better than the industry `feature.role.ts` dot-suffix convention while
   meaning the same thing. Document this as the repo rule so apps/web and other workspaces follow it.
2. KEEP handlers thin and typed at the route site. For the large `review` feature, the `review-routes.ts`/`context-routes.ts`
   delegate pattern (`(c) => handler(c, c.req.valid("json"))`) is the right way to extract without becoming a Rails
   controller. For trivial features (`health`, `shutdown`) keep handlers inline — do not add a `service.ts` for YAGNI.
3. Treat `.test.ts` (colocated) and the one-hyphen compound names as conventions exempt from "single word." Add an
   exception note for proper nouns: `models-dev-catalog.ts` keeps two hyphens because `models.dev` is a product name;
   otherwise no two-hyphen file names.
4. DO NOT adopt RPC (`hc<AppType>`) or `@hono/zod-openapi`/`OpenAPIHono` for this server. The consumer is the in-repo SPA/TUI,
   the contract already lives in `libs/core` Zod schemas, and RPC's many-routes type-instantiation tax (official warning)
   buys nothing here. This keeps `pnpm type-check` fast and the binary small.
5. Keep the app-definition vs runtime-entry split (`app.ts` = `createApp()`, `http-server.ts` = node-server serve,
   `index.ts` = library exports). This matches Hono's `app.ts`/`handler.ts`/`index.ts` guidance and is why tests can build
   a fresh app without binding a port. Do not collapse them.
6. SSE: keep the 4-layer seam; the pipeline's `EmitFn`-only interface (no `Context`) is the load-bearing decoupling that
   lets the TUI reuse it. Maintain the `try/catch + writeSSEError` inside `streamSSE` (official: throws in stream callbacks
   bypass `onError`). The missing heartbeat/`X-Accel-Buffering` are correctly omitted because the server is loopback-only.
7. Minor consolidation candidate (audit, not mandate): `review/` is large (~30 files). If any sub-area grows further,
   promote `review/context*` or `review/sse*` into nested sub-feature folders (`review/context/`, `review/stream/`) rather
   than flattening more single-file modules into one dir. Consensus (colocation literature, Fastify encapsulation) favors
   nesting a coherent sub-feature over a wide flat folder once it crosses ~a dozen files.

Boundary note (AGENTS.md): `cli/server` is CLI-internal, not a reusable primitive. None of the above suggests extracting
server pieces into `libs/*`; the pipeline reuse for the TUI is achieved by keeping `pipeline.ts` HTTP-agnostic within
`cli/server` and importing domain primitives from `libs/core`, which is the intended boundary.

---

## Sources consulted (URLs)

- https://hono.dev/docs/guides/best-practices  (official: avoid Rails controllers, app.route(), factory.createHandlers, app.ts/handler.ts/index.ts split)
- https://hono.dev/docs/guides/rpc  (official: RPC optional; many-routes IDE slowdown + mitigations)
- https://hono.dev/docs/helpers/streaming  (official: streamSSE API; throw-in-callback bypasses onError warning)
- https://www.freecodecamp.org/news/build-production-ready-web-apps-with-hono/  (routes/ folder, app.route(), inline handlers, no service layer)
- https://medium.com/@yannick.burkard/building-production-ready-hono-apis-a-modern-architecture-guide-fed8a415ca96  (layer-folder camp: controllers/services/schemas/middlewares, thin controllers, OpenAPI push)
- https://dev.to/pramod_boda/recommended-folder-structure-for-nodets-2025-39jl  (feature-folder camp; .controller/.service/.route/.model suffix naming; kebab-case; separate tests/)
- https://dev.to/sendotltd/sse-is-the-right-answer-more-often-than-you-think-a-hono-typescript-reference-service-3p74  (SSE transport/domain separation; pub/sub; finally cleanup; Last-Event-ID; heartbeat; clamp)
- https://github.com/orgs/honojs/discussions/3472  (long-running SSE watchers need emitter->stream bridge + onAbort)
- https://github.com/honojs/hono/issues/4121  (enterprise structure RFC: feature folders + layered-within-feature; opened, no maintainer consensus in-thread)
- https://fastify.dev/docs/latest/Guides/Plugins-Guide/  +  https://github.com/fastify/fastify-autoload  (small-service idiom: plugins/ shared + routes/ encapsulated; per-folder autohooks — cross-framework cross-check)
- Colocation roundup: https://nextjs.org/docs/app/getting-started/project-structure , https://ambitioussolutions.mk/blog/organizing-code-by-feature-how-colocation-makes-your-codebase-easier-to-work-with/ , https://www.zacfukuda.com/blog/express-file-folder-structure  (feature/colocation > type folders; graduate shared logic to lib/)
