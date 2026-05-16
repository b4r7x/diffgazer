# SOTA Audit Master Finding Index

Date: 2026-05-16

Status: read-only index spec. No production code was changed while producing this document.

## Goal

Create one flat inventory of every tracked finding from:

- `028-sota-handoff-audit-verification/spec.md`
- `029-sota-audit-reconciliation/spec.md`

This is not a new audit. It is the master index that says where every ID landed after reconciliation: active, merged, downgraded, dropped, or false-positive.

## Source Of Truth Rules

- Spec 028 is the baseline handoff audit.
- Spec 029 is the reconciliation and final severity correction pass.
- For `NEW-021` through `NEW-044`, the raw finding text in spec 029 section 10 is intake only. The final validated status in spec 029 section 11 wins.
- Duplicate IDs are kept in this index only once.
- Merged findings still appear here so there is no hidden loss of audit coverage.

## Hard Handoff Blocker Clusters

These are the clusters that must be resolved before public handoff:

- Release/publication: `REL-001`.
- Consumer safety: `CLI-001`, `CLI-002`, `CLI-003`, `NEW-018`.
- Public install path: `DIST-001`, `NEW-017`.
- Docs/site: `DOCS-001`, `DOCS-002`, `NEW-001`, `NEW-002`, `NEW-003`, `NEW-004`, `NEW-021`.
- Security: `SEC-001`.
- Governance/package: `GOV-001`, `PKG-001`, `PKG-002`, `NEW-025`, `NEW-026`, `NEW-044`.
- User-visible UI readiness: `NEW-022`, `NEW-023`, `NEW-033`.

## Spec 028 Findings

| ID | Final Severity | Final Status | Finding |
|----|----------------|--------------|---------|
| REL-001 | Critical | Active | No provenance-capable publish workflow. |
| CLI-001 | Critical | Active | `dgadd remove` can remove a retained dependency and break copy-mode projects. |
| CLI-002 | High | Active | `dgadd remove` leaves hidden/transitive registry orphans. |
| CLI-003 | High | Active | `dgadd diff` ignores hidden installed dependencies by default. |
| DIST-001 | Critical | Active | `https://diffgazer.com` registry host is not resolvable. |
| DOCS-001 | High | Active | UI API docs are incomplete for 33 of 44 public component docs. |
| DOCS-002 | Critical | Active | Docs production behavior is broken/incomplete. Extended by `NEW-001` through `NEW-004` and `NEW-021`. |
| PKG-001 | High | Active | `@diffgazer/ui` does not export `./package.json`, blocking docs artifact package-mode loading. |
| SEC-001 | High for published CLI, Medium elsewhere | Active | `pnpm audit --prod --audit-level=moderate` reports consumer-facing Hono advisories in published `diffgazer` CLI path. |
| SEC-002 | Medium | Active | CI supply-chain hardening is incomplete: action pinning, dependabot, workflow concurrency, OIDC scoping. |
| KEYS-001 | Medium | Active | `useFocusTrap` is boundary cycling, not a full document-level focus trap. |
| UI-001 | Medium | Active | Overlay hooks assume global `window` / `document` where owner-document behavior is expected. |
| UI-002 | High | Active | Reduced-motion coverage is incomplete. Extended by `NEW-011`. |
| GOV-001 | High | Active | Root OSS governance and license story are incomplete. Extended by `NEW-009` and `NEW-010`. |
| DOCS-003 | Medium | Active | Changelog coverage is incomplete. |
| DOCS-004 | Medium | Active | Docs validation does not catch empty API docs. |
| ART-001 | Low | Active wording fix | Generated artifact policy is mostly correct, but workflow/agent wording is misleading. |
| PKG-002 | Medium, elevated by `NEW-025` | Active, merged | `@diffgazer/ui` package is large because it ships docs/handoff artifacts. Merged with `NEW-025` and `NEW-044`. |
| PKG-003 | Medium | Active | Public React packages lack `engines.node`. |
| TS-001 | Medium | Active | TypeScript baselines are uneven across packages. |
| DEP-001 | Medium | Active | Dependency drift and dedupe drift are not governed. Extended by `NEW-012` through `NEW-015`. |
| WEB-001 | Low | Active cleanup | `apps/web` still hand-rolls some reusable keyboard behavior. Overstated as a defect. |
| WEB-002 | Low | Active cleanup | `apps/web` duplicates some dialog Escape behavior. Mostly harmless/idempotent. Extended by `NEW-020`. |
| WEB-003 | Drop | Dropped | Guarded render-time state updates were reviewed and are a valid React pattern here. |
| I18N-001 | Medium | Active, same as `NEW-006` | Typeahead/search are not locale-grade. |
| KEYS-002 | Medium | Active | `useScrollLock()` default uses global `document.body`; no internal high-impact consumer today. |
| UI-003 | Low/Medium | Active | Typography does not support `h1` through `h6`. |
| UI-004 | Low/Medium | Active, same as `NEW-007` | `useFormReset` re-subscribes on every render and has reset-event semantics gaps. |

## Spec 028 False-Positive Reclassifications

| ID | Final Severity | Final Status | Finding |
|----|----------------|--------------|---------|
| FP-001 | Low via `ART-001` | Reclassified | Generated-files policy contradiction was overstated; residual issue is wording/workflow clarity. |
| FP-002 | None | Clean | `cli/diffgazer/README.md` published-package claim was not a blocker in the way Audit A stated. |
| FP-003 | None | Clean | Keys public registry relative `.js` import-specifier claim was false. |
| FP-004 | None | Clean | Keys copy/shadcn installability was not broadly broken as claimed. |
| FP-005 | None | Clean | `useTypeaheadBuffer` is a UI/public-registry placement issue, not a keys public API gap. |
| FP-006 | Low polish | Partial | Accordion `role="region"` default-on claim was overstated; document the current opt-in contract or rename the prop. |
| FP-007 | None | Clean | Dialog/form primitives were not broadly broken; focused edge cases are tracked separately. |

## Spec 029 New Findings

| ID | Final Severity | Final Status | Finding |
|----|----------------|--------------|---------|
| NEW-001 | Critical | Active | Docs build is broken in both prerender and non-prerender modes due registry alias drift. Extended by `NEW-021`. |
| NEW-002 | High | Active | Docs index routes are client-only `<Navigate>`, leaving SSR/prerender behavior weak. |
| NEW-003 | Medium | Active | Prerender list includes `/docs`, a non-existent route. |
| NEW-004 | Medium | Active | Top-level library index pages are routed inconsistently. |
| NEW-005 | Medium | Active | `useFloatingPosition` scroll-parent walker misses transformed, shadow, and iframe ancestors. Related to `NEW-040`. |
| NEW-006 | Medium | Active, same as `I18N-001` | Typeahead/search lowercasing is not locale-aware. |
| NEW-007 | Medium | Active, same as `UI-004` | `useFormReset` re-subscribes on every render and ignores canceled reset events. |
| NEW-008 | Low/Medium | Active validation item | `DialogShell` scroll-lock issue is CSS-dependent; verify body-lock coverage across browser targets and iOS/custom scroll roots. |
| NEW-009 | Low | Active, extends `GOV-001` | `libs/registry/package.json` declares MIT without a local LICENSE file. |
| NEW-010 | High | Active, extends `GOV-001` | `cli/diffgazer/LICENSE` Apache-2.0 boilerplate lacks the copyright appendix. |
| NEW-011 | Medium | Active, extends `UI-002` | `Stepper.Content` and pulse animations break reduced-motion expectations. |
| NEW-012 | Medium | Active, extends `DEP-001` | Major dependency drift: multiple majors/minors behind. |
| NEW-013 | Medium | Active, extends `DEP-001` | `pnpm dedupe --check` fails and would rewrite lock/importer state. |
| NEW-014 | Low | Active, extends `DEP-001` | `commander` has four majors in lockfile. |
| NEW-015 | Medium | Active, extends `DEP-001` | `@types/node` is split across majors 22 and 25. |
| NEW-016 | Low | Active | Example comment lies about `useFocusTrap` / `useScrollLock` usage. |
| NEW-017 | High | Active | Direct shadcn UI commands do not install or enforce the theme/style contract. |
| NEW-018 | Medium | Active, extends CLI cluster | `dgadd` CSS chunks are not owned, diffed, or removed. |
| NEW-019 | Low | Active package hygiene | Low-priority package hygiene bucket from second pass. |
| NEW-020 | Medium | Active app defect | API key dialog forces remount on close and can bypass Dialog focus-restore lifecycle. |
| NEW-021 | Critical | Active, extends `NEW-001` | Vite aliases miss `aria-utils`, `typeahead`, and `utils`; `utils` silently falls through to a docs shim importing `@diffgazer/ui`. |
| NEW-022 | High | Active | Hover-mode Popover/Tooltip is touch-unreliable for passive/non-button triggers. |
| NEW-023 | High | Active | Default text-control sizing below 16px can trigger iOS Safari/WKWebView focus zoom. |
| NEW-024 | Medium | Active support-contract item | `dialog.showModal()` has no feature detect; critical only if supporting browsers below Safari/iOS 15.4. |
| NEW-025 | High | Active, merged with `PKG-002` and `NEW-044` | UI+keys combined unpacked payload is 31.37 MB; 30.65 MB is docs/handoff artifact payload. |
| NEW-026 | High | Active | `figlet` is a production dependency for optional `./components/logo/figlet`, adding large install footprint. |
| NEW-027 | Low/Medium | Active package hygiene | Button and Toast import Spinner at module top level; small bundle hygiene issue. |
| NEW-028 | Low | Active package hygiene | `@diffgazer/keys` ships source-map/declaration-map files while UI does not. |
| NEW-029 | Medium | Active, corrected | Title SSR drift claim was false; residual issue is description-only `aria-describedby` post-mount drift. |
| NEW-030 | Drop | Dropped | React 19 `useLayoutEffect` SSR warning claim did not reproduce and is false as written. |
| NEW-031 | Medium | Active | Browser support floor is undocumented; Tailwind v4 implies a modern floor; add docs and relevant CSS fallback notes. |
| NEW-032 | High | Active | No real-browser E2E, cross-browser, or visual-regression CI exists. |
| NEW-033 | High | Active | Root-mounted Toast is under native dialog top-layer/backdrop and not reliably visible/reachable while modal is open. |
| NEW-034 | Medium | Active | No global cascade layer order declaration; z-index values are ad hoc. Does not solve native dialog top-layer stacking. |
| NEW-035 | Medium DX | Active polish | `useActionRowNavigation` has loose `actionCount` / `disabledActions` / `onAction(index)` typing. |
| NEW-036 | Medium DX | Active polish | Value/id APIs are not generic over literal unions. |
| NEW-037 | Medium DX | Active polish | Public source/declarations have zero `@example` JSDoc tags; public docs do have examples. |
| NEW-038 | Medium | Active | `Field.Description` and `Field.Error` treat empty string as children and wire empty referenced nodes. |
| NEW-039 | Medium | Active | Tabs with zero enabled triggers resolve to `""` and hide panels silently. |
| NEW-040 | Medium | Active | `useFloatingPosition` can do unbatched layout work and unnecessary commits on scroll/resize. |
| NEW-041 | Low opportunity | Active only if profiled | Command-palette filtering can be profiled for large lists; `useDeferredValue` is not automatically correct. |
| NEW-042 | Low DX | Active polish | `Field.Control` does not preserve concrete child prop/ref typing. |
| NEW-043 | Medium | Active | Popover throws for missing dialog accessible name while Dialog warns and applies fallback. |
| NEW-044 | Merged into `NEW-025` | Merged | Keys handoff payload is evidence under package-artifact bloat, not a separate high finding. |

## Merged And Dropped IDs

Merged:

- `I18N-001` -> `NEW-006`.
- `UI-004` -> `NEW-007`.
- `UI-002` -> `NEW-011`.
- `GOV-001` -> extended by `NEW-009` and `NEW-010`.
- `DEP-001` -> extended by `NEW-012` through `NEW-015`.
- `DOCS-002` -> extended by `NEW-001` through `NEW-004` and `NEW-021`.
- `PKG-002` -> extended by `NEW-025`; `NEW-044` is evidence under the same package-footprint cluster.
- `CLI-001` through `CLI-003` -> extended by `NEW-018`.
- `WEB-002` -> extended by `NEW-020`.

Dropped or clean:

- `WEB-003` dropped.
- `NEW-030` dropped.
- `FP-002`, `FP-003`, `FP-004`, `FP-005`, and `FP-007` clean.
- `FP-001` survives only as `ART-001` wording cleanup.
- `FP-006` survives only as accordion docs/API polish.

## Coverage Check

All tracked IDs from spec 028 and spec 029 are represented above:

- Spec 028 baseline IDs: `REL-001`, `CLI-001`, `CLI-002`, `CLI-003`, `DIST-001`, `DOCS-001`, `DOCS-002`, `PKG-001`, `SEC-001`, `SEC-002`, `KEYS-001`, `UI-001`, `UI-002`, `GOV-001`, `DOCS-003`, `DOCS-004`, `ART-001`, `PKG-002`, `PKG-003`, `TS-001`, `DEP-001`, `WEB-001`, `WEB-002`, `WEB-003`, `I18N-001`, `KEYS-002`, `UI-003`, `UI-004`.
- Spec 028 false-positive IDs: `FP-001` through `FP-007`.
- Spec 029 new IDs: `NEW-001` through `NEW-044`.

Final position: the codebase is strong, but public handoff is blocked until the hard blocker clusters above are resolved.
