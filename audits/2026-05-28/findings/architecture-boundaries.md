# Findings: architecture-boundaries

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 1 | 0 | 1 | 0 |
| Medium | 4 | 0 | 4 | 0 |
| Low | 3 | 0 | 3 | 0 |
| **Total** | **8** | **0** | **8** | **0** |

---

## Critical

_No critical findings._

---

## High

### F333 — [NEW] [architecture] AGENTS.md incomplete: 5 packages undocumented (stale governance contract)

- **file:line** — `AGENTS.md:31-38`
- **What** — AGENTS.md documents only 6 of 11 packages: libs/keys, libs/ui, libs/registry, apps/web, cli/add, cli/server. Five packages are entirely undocumented: apps/docs, apps/hub, apps/landing, libs/core (implicit only), and cli/diffgazer (implicit only). This violates the governance contract stated in AGENTS.md line 3-4.
- **Why** — AGENTS.md is the stated repository contract for all coding agents, so packages it omits have no documented ownership boundary and their architecture can drift without governance.
- **How** — Add explicit boundary sections for each package: (1) libs/core — document what schemas/hooks/formats/utilities it owns and that it is private business logic shared between CLI and apps; (2) apps/landing — document that it's a simple landing page using only libs/ui; (3) apps/docs — document that it's a docs + registry browser using all libs; (4) apps/hub — clarify if this is active (currently only …
- **Effort** — low

---

## Medium

### F92 — [NEW] [architecture] useActiveHeading hook uses ambient document/window without ownerDocument pattern

- **file:line** — `libs/ui/registry/hooks/use-active-heading.ts:10, 37, 114, 155, 208`
- **What** — The useActiveHeading hook assumes a single global document and window, making it incompatible with multi-document scenarios (iframes, portals, shadow DOM). It hardcodes window and document references instead of deriving them from element.ownerDocument.
- **Why** — Hardcoding the global document binds the hook to a single document context, so it breaks in iframe, portal, or shadow DOM scenarios where the element lives in another document.
- **How** — Refactor the hook to accept a containerRef parameter and use containerRef.current.ownerDocument to access the correct document. Update all usages and documentation to reflect this change. Add tests for iframe/shadow DOM scenarios if the hook is used in such contexts.
- **Effort** — medium

### F93 — [NEW] [architecture] No AGENTS.md documentation for apps/{docs,hub,landing} architecture boundaries

- **file:line** — `AGENTS.md:31-39`
- **What** — AGENTS.md defines extraction rules and boundaries for libs/keys, libs/ui, apps/web, libs/registry, and cli/add, but does not describe the ownership and boundaries for apps/docs, apps/hub, and apps/landing. These apps have grown without documented governance contracts.
- **Why** — Without documented boundaries for these apps, contributors lack a governance reference and may misplace app-specific logic or extract it into shared libs incorrectly.
- **How** — Add sections to AGENTS.md defining: (1) apps/docs owns documentation, examples, registry display, and search - no app-specific domain logic; (2) apps/landing owns marketing/onboarding - no product logic; (3) apps/hub owns future app index - clarify current stub state. Specify what each can and cannot import from libs/core.
- **Effort** — low

### F334 — [NEW] [architecture] AGENTS.md ambiguous on libs/core ownership and re-export model

- **file:line** — `AGENTS.md:31-38`
- **What** — AGENTS.md never explicitly states what libs/core owns. It is mentioned only implicitly in package.json export lists and appears to house schemas, hooks, formats, business logic, and API types — but the boundary between 'schema/utility reusable code' vs 'app-specific logic' is not defined. The document also does not clarify whether apps/web and apps/docs should both import from the same libs/core e…
- **Why** — An undefined libs/core boundary leaves the line between reusable code and app-specific logic ambiguous, so app concerns can leak into the shared package without a contract to catch it.
- **How** — Add a boundary section for libs/core. State: 'libs/core is a private package that owns: (1) schemas (Zod + types) for config, review, events, presentation, git, context; (2) business logic: result/error types, format/string utilities, review state machines, provider filtering, API client factories; (3) React hooks for forms, API calls, theme/navigation derived state. It must not import from apps o…
- **Effort** — low

### F335 — [NEW] [architecture] cli/diffgazer public CLI role not documented in AGENTS.md

- **file:line** — `AGENTS.md:31-38`
- **What** — cli/diffgazer is a published public package (v0.1.4, npm registry, bin entry 'diffgazer') but AGENTS.md does not describe it. It embeds the web SPA build, exposes a TUI via Ink.js, and imports from libs/core and libs/server. No explicit role statement means contributors may not understand: (a) that it is public API; (b) that it is a binary, not a library; (c) what level of abstraction the TUI shou…
- **Why** — cli/diffgazer is a published public binary, so the absence of a documented role lets contributors misjudge its public-API status and place app-specific logic in it without a boundary to prevent it.
- **How** — Add to AGENTS.md: 'cli/diffgazer owns the public diffgazer CLI binary. It exposes two modes: web (embedding the built @diffgazer/web SPA with a local Hono server from cli/server) and TUI (Ink.js terminal UI orchestrating review flows). It is version-locked to 0.1.x during pre-release. It consumes libs/core, libs/keys, libs/server, and should remain thin — app-specific features belong in web or ser…
- **Effort** — low

---

## Low

### F91 — [NEW] [architecture] Public Label component overlaps with Field form ownership boundary

- **file:line** — `libs/ui/package.json:92`
- **What** — The public registry exports a bare Label component that duplicates form-field semantic functionality already owned by Field. This creates confusion about whether Label or Field should be used for form wiring.
- **Why** — A bare Label exposing form-field semantics overlaps the Field ownership boundary, giving consumers two competing paths for form wiring and undermining the single documented composition path.
- **How** — Demote Label from the public registry, or narrow its API to be a pure styled label element (remove form-related props). Move form-label examples to Field documentation. Review and consolidate field-wiring patterns in docs/registry so there is one clear path for form field composition.
- **Effort** — medium

### F336 — [NEW] [architecture] apps/landing and apps/docs not explicitly scoped in AGENTS.md

- **file:line** — `AGENTS.md:31-38`
- **What** — AGENTS.md documents apps/web but not apps/landing (4 src files, Vite app using only libs/ui) or apps/docs (83 src files, TanStack Start app using all libs). Without explicit scoping, contributors may extract landing-specific components into libs/ui or docs-specific utilities into libs/core.
- **Why** — Without explicit scoping for these apps, contributors have no boundary reference and may extract landing- or docs-specific code into shared libs, eroding the extraction rules.
- **How** — Add: 'apps/landing owns the marketing landing page. It uses only libs/ui components without app-specific composition; all copy and layout are landing-only. apps/docs owns the component + hook documentation site. It consumes libs/core, libs/keys, libs/registry, and libs/ui to build a docs browser with searchable registry, theme visualizer, and consumption examples. Extract from docs only utilities …
- **Effort** — low

### F337 — [NEW] [architecture] apps/hub stub has no defined purpose; may be dead code

- **file:line** — `AGENTS.md (missing)`
- **What** — apps/hub is a stub package (package.json only, no src/ directory, description: 'b4r7.dev hub — project portfolio'). It is mentioned in AGENTS.md nowhere. It has no scripts, dependencies, or build output. It appears to be inactive placeholder code.
- **Why** — An undocumented stub package with no source or build output is indistinguishable from dead code, so its purpose and retention rationale cannot be verified by contributors.
- **How** — Either: (1) Add to AGENTS.md: 'apps/hub is a planned personal portfolio app (not yet implemented; stub only)'; or (2) if no longer needed, delete the package and document the reason in the commit. If it is being preserved as a template, explain in AGENTS.md what template it is for.
- **Effort** — low
