# SOTA Audit Reconciliation

Date: 2026-05-16

Status: read-only verification spec. No production code was changed while producing this document. Follow-up to `028-sota-handoff-audit-verification`.

## Goal

Reconcile the prior SOTA audit (referred to here as "Audit A") with the spec 028 follow-up (referred to here as "Audit B"). For each disputed claim, dispatch an independent verification agent, capture file:line evidence, and produce one merged source of truth before fixes begin.

This spec:

- Confirms which Audit B claims are correct (and what Audit A got wrong).
- Confirms which Audit B "false positive" reclassifications are correct (and what Audit A overstated).
- Records new findings surfaced during the verification pass that neither prior audit captured.
- Resets severities where verification changed the picture.
- Produces a final, deduplicated fix-order for handoff.

## Inputs

- Audit A: prior end-to-end SOTA audit (22 parallel agents).
- Audit B: `libs/ui/specs/028-sota-handoff-audit-verification/spec.md`.
- Verification pass: 12 independent agents, each given one disputed claim or new claim and instructed to verify or disprove with file:line evidence.
- Secondary verification pass: 10 requested follow-up agents after this spec was written. One old stuck thread limited the first wave to 9 fresh agents; after closing those, a tenth reconciliation-only agent was started and completed. Findings from all 10 follow-up agents plus local validation are folded into this revision.
- Final third-pass validation: 9 fresh agents completed focused validation of the later `NEW-021` through `NEW-044` claims. The missing 10th workstream was covered locally because an old stuck thread still occupied an agent slot. Final reconciled status is in §§11-13.
- Local validation: actual `pnpm audit`, `pnpm dedupe --check`, `pnpm outdated -r`, `pnpm dev` HTTP probes, `dgadd add/remove/diff` repro in `/tmp`, npm registry checks, DNS lookups.

## Verdict

Audit B's overall judgment ("not yet SOTA handoff-ready") stands and is more accurate than Audit A's framing. Audit B caught real correctness bugs Audit A missed (`dgadd remove`, DNS failure, `@diffgazer/ui` package-mode block, `pnpm audit --prod`, owner-document gap in UI overlay hooks). It also correctly downgraded several Audit A claims that were overstated.

Verification surfaced additional issues neither audit captured. They are recorded in §3.

The clean way to think about it: the codebase is structurally strong, the publishable libraries are close, the CLI has a critical correctness defect, the docs site does not build prerender today, the published `diffgazer` CLI ships known-vulnerable hono versions, and `diffgazer.com` does not resolve. Audit B's fix-order is approximately correct; this spec adds the new findings and severity adjustments.

## 1. Where Audit B is Right (Audit A Wrong or Incomplete)

### REL-001 — No publish workflow (CONFIRMED)

Audit A flagged this as critical. Audit B confirmed. No change.

### CLI-001 / CLI-002 / CLI-003 — `dgadd remove` bugs (CONFIRMED, Audit A wrong)

Audit A: "dgadd is publish-ready and SOTA." That was wrong.

Reproduced live in `/tmp`:

- `add ui/dialog` → manifest gains `ui/button`, `ui/dialog-shell`, `ui/portal`, `keys/focus-restore`, `ui/kbd`, `ui/compose-refs`, `ui/controllable-state`, `ui/presence`, `ui/spinner`.
- `remove ui/button --yes` → CLI prints "Removed 2 file(s) (ui/button)." `button/` deleted. `src/components/ui/dialog/dialog-close.tsx:5` and `dialog-action.tsx:5` still import `Button` → consumer's build broken, no warning.
- `remove ui/dialog --yes` → `src/components/ui/{button,kbd,shared,spinner}`, `src/hooks/{use-controllable-state,use-focus-restore,use-presence,utils/dom,utils/focus-restore}.ts` all left on disk, no orphan notice.
- `dgadd diff` (default) ignores manifest entries that are not on the public install names list — drift in `src/components/ui/shared/portal.tsx` does NOT show up.

Root cause:

- `libs/registry/src/cli/workflows/remove.ts:194-212` — `collectRemovalTargets` builds `retainedItems` from `getAllItems()` which `cli/add/src/commands/remove.ts:94-101` filters to public install names. Hidden installed items never participate as retainers.
- The only reverse-dependency guard (`cli/add/src/commands/remove.ts:62-86`) is keys→copy-mode-ui only, not ui→ui.
- `cli/add/src/commands/diff.ts:30-35` — default scope is `publicInstallNames().filter(isInstalled)`, manifest-only items excluded.
- `libs/registry/src/cli/workflows/remove.ts:20-43` — `findOrphanedNpmDeps` only walks npm packages, not registry items.

This is a data-corrupting class of bug for a CLI whose entire value proposition is safe component management. Severity confirmed CRITICAL.

### DIST-001 — `https://diffgazer.com` is not resolvable (CONFIRMED, Audit A missed)

`curl -I https://diffgazer.com/r/ui/button.json` → connection failed. `host diffgazer.com` → `NXDOMAIN`. Every shadcn install snippet in `README.md`, `libs/ui/README.md`, `libs/keys/README.md`, and the docs site references this host. None work for an external consumer today. Audit A treated the URL as cosmetic; Audit B is right that this is a HIGH blocker.

### PKG-001 — `@diffgazer/ui` does not export `./package.json` (CONFIRMED, Audit A missed)

`grep '"./package.json"' libs/ui/package.json` → no match. `libs/keys/package.json:21` does have `"./package.json": "./package.json"`. `apps/docs/config/docs-libraries.json` declares `@diffgazer/ui` as an artifact package; the loader resolves package roots through `${packageName}/package.json`. Package-mode docs loading is blocked for `@diffgazer/ui` until the export is added.

### SEC-001 — `pnpm audit --prod --audit-level=moderate` reports 43 advisories (CONFIRMED, Audit A understated)

Exact counts (re-run locally):

- prod-only: 0 critical, 14 high, 27 moderate, 2 low, total 43 advisories across 39 distinct CVEs.
- prod + dev: 0 critical, 17 high, 28 moderate, 2 low.

Severity reassessment: the headline "43 vulnerabilities" overstates handoff risk slightly. Per agent verification:

- 18 of 43 advisories reach end users via the published `diffgazer` CLI through `hono@4.12.0` (16 advisories) and `@hono/node-server@1.19.9` (2 advisories). Includes 2 high (auth bypass via IP spoofing CVSS 8.2; arbitrary file access via serveStatic CVSS 7.5) and 1 high in `@hono/node-server` (auth bypass CVSS 7.5).
- The remaining advisories affect repo maintainers and private/server-side packages (vite, undici, rollup, picomatch, postcss, path-to-regexp, h3, @tanstack/start-server-core, and the same hono stack in private `libs/server`).
- `@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/add` have ZERO audit findings.

Largest single-fix wins:

1. Bump `hono` to `>=4.12.18` in `cli/diffgazer` and `libs/server` — closes 16 advisories.
2. Bump `@hono/node-server` to `>=1.19.13` — closes 2 high+moderate advisories.

Steps 1–2 are mandatory pre-handoff. Remaining steps close dev-tooling noise; not consumer-blocking.

### KEYS-001 — `useFocusTrap` is boundary cycling, not a full trap (CONFIRMED, Audit A partially wrong)

Audit A's overlay agent claimed "PASS (with bubble-vs-capture noted)." That was wrong on the trap contract.

`libs/keys/src/hooks/use-focus-trap.ts:102` attaches `keydown` to `container` in bubble phase. Not on `container.ownerDocument`, not capture. Consequences:

- Focus escaped outside container → next Tab not intercepted (listener never fires because Tab event walks from focused element).
- Descendant calls `event.stopPropagation()` on keydown → trap bypassed silently.
- Cross-iframe / shadow DOM descendants → propagation/retargeting breakage.
- If there are no focusable children and the container itself lacks `tabIndex`, `pickInitialTarget()` falls back to the container and `.focus()` is a no-op. Focus can remain outside, so the container listener never receives Tab.

Reference comparison (verified from source):

- `focus-trap` npm: document-level capture + focusin recapture.
- `@radix-ui/react-focus-scope`: document-level + focusin recapture + MutationObserver.
- `@react-aria/focus` `FocusScope`: same shape.

What Audit A's overlay agent got right: `container.ownerDocument.activeElement` is used as the read source. What it conflated: that does not mean the listener is on the owner document. The `addEventListener` call is on `container` itself.

Practical impact today: zero in `libs/ui` because `Dialog` and `CommandPalette` use native `<dialog>.showModal()` (browser-native focus trap). Real impact for downstream copy/package consumers who call `useFocusTrap` expecting Radix semantics.

Also: `libs/ui/registry/examples/keyscope-copy-mode/keyscope-copy-mode.tsx:74` comment "Confirm dialog (uses useFocusTrap + useScrollLock internally)" is FALSE. Confirm dialog uses neither. Fix the comment.

Severity: downgrade from HIGH to MEDIUM in light of "no internal consumer in `libs/ui`" — but rename to `useFocusBoundary` or fix before any "full trap" claim in docs.

### UI-001 — Overlay hooks use global `window` / `document` (CONFIRMED, Audit A partially wrong)

Verified usages (all in `libs/ui/registry/hooks/` and `libs/ui/registry/ui/popover/`, NOT in `libs/keys`):

- `use-floating-position.ts:180` — `window.innerWidth, window.innerHeight`.
- `use-floating-position.ts:222-231` — `window.addEventListener("scroll" | "resize")`.
- `use-outside-click.ts:160-205` — `document.addEventListener("pointerdown" | "touchstart" | "mousedown" | "keydown")`.
- `use-popover-behavior.ts:93-94, 96-97` — `window.addEventListener("scroll" | "resize")` for hover-mode auto-close.
- `portal.tsx:14` — fallback container is ambient `document.body`; Select/Popover content can portal into the wrong document for iframe/popout consumers.
- `use-active-heading.ts` uses ambient `document`/`window` for heading lookup, resize, mutation observation, and scrolling. This is a public hook, so it should either accept a root/owner document or document the limitation.

Audit A's overlay agent declared "owner-document discipline (use-focus-trap, use-focus-restore, focus-restore use ownerDocument)" — that was about `libs/keys` hooks (correct) and got conflated with overlay UI hooks (wrong). The keys library IS disciplined; the overlay UI hooks are not.

Iframe usage in repo: `rg iframe apps/` → zero source results. Practical impact today: zero. Impact for downstream consumers using iframes/popouts: real.

Severity: downgrade Audit B's HIGH to MEDIUM. Fix is local (3 files, ~50 lines) but the libraries' AGENTS contract ("Focus utilities must respect `ownerDocument`") should extend to overlay listeners.

### FP-005 — `useTypeaheadBuffer` is a UI hook, not a keys hook (CONFIRMED, Audit A wrong)

`find . -name "use-typeahead-buffer*"` confirms it lives at `libs/ui/registry/hooks/use-typeahead-buffer.ts`, not `libs/keys`. It is not exported from `libs/keys/src/index.ts`. Audit A incorrectly claimed it was an orphan in keys public registry. It IS a hidden UI registry hook with simple ASCII lowercase matching and an i18n gap (`.toLowerCase()` vs `.toLocaleLowerCase()`), so the i18n criticism in Audit A still stands, but the placement claim was wrong.

### FP-007 — Dialog/checkbox/radio/select tests are NOT broadly broken (CONFIRMED, Audit A overstated)

132 test files / 1564 tests passing. Per-primitive verification (full audit by independent agent):

- **Dialog** (658 LOC): role+aria-modal, labelledby/describedby wiring, ESC via cancel, backdrop hit-test, return-focus to trigger AND to previously focused when no trigger, nested-dialog close ordering, portal mounting, fallback `aria-label="Dialog"` warning, 4 axe checks.
- **Checkbox** (677 LOC): `aria-checked` true/false/`mixed`, Space + Enter toggle, disabled blocks both, hidden native input form submission incl. `value=""`, indeterminate, label-click, controlled+uncontrolled, native `form.reset()`, `reportValidity()` focuses visible control, nested group scoping, 3 axe checks.
- **Radio** (822 LOC): arrow nav, wrapping + boundary, manual activation, roving tabindex, same-name uncontrolled coordination, normalization, required validation, 2 axe checks.
- **Select** (907 LOC): combobox/listbox/`aria-haspopup`, search-mode trigger reduction, unique option ids, stale `aria-activedescendant` cleared, `Enter`/`Tab` commit, single + multiple + empty-string value, hidden native validity, 1 axe `it.each` ×2 modes.
- **Field** (227 LOC): aria-invalid/required/disabled propagation, custom `controlId`, describedby ordering, label-click focus, composition with `InputGroup`/`Textarea`/`Select.Trigger`, external aria-labelledby merging, 3 axe checks.
- **Input/Textarea**: native `onChange(event)`, aria-invalid variants, InputGroup prefix/suffix accessibility, 5 axe checks.

Gaps (all minor, next-version polish):

1. `select.test.tsx` near line 198 doesn't directly assert `aria-multiselectable="true"` on listbox (attribute IS set; axe passes).
2. `input.test.tsx`/`textarea.test.tsx` don't have `createRef` ref-forwarding assertion (pattern exists in `select.test.tsx:326-340`).

Audit A's "form primitives" agent hit rate-limit so coverage was thin from my side. Audit B's "stale/overstated" verdict is correct.

### ART-001 / FP-001 — Generated files contradiction (CONFIRMED, Audit A wrong)

After `pnpm run build`: gitignored paths (`libs/ui/docs/generated`, `libs/keys/docs/generated`, `cli/add/src/generated`) are populated but not surfaced by `git status`. Committed paths (`libs/{ui,keys}/public/r/*.json`) are regenerated; clean tree because content matches. No contradiction.

Audit A conflated:

- "Do not commit deterministic generated docs/CLI artifacts" (gitignored).
- The workflow's "clean tree" check (validates committed public registry freshness against fresh build).

These are different invariants. Real fix is cosmetic: rename the workflow step from "Generated files are committed" to "Public registry is up to date".

### FP-002 — `diffgazer` is published (CONFIRMED, Audit A wrong)

`npm view diffgazer version` → `0.1.3`. `cli/diffgazer/README.md:36` is correct that `diffgazer` is published. Audit A misread this. Other scoped packages (`@diffgazer/keys`, `@diffgazer/ui`, `@diffgazer/add`) are still gated.

### FP-003 — Public registry `.js` import specifiers (CONFIRMED CLEAN, Audit A's first claim was wrong)

`grep -h '"content"' libs/{ui,keys}/public/r/*.json | grep -oE 'from \\?"[^"]*\.js\\?"' | wc -l` → 0 in both registries. Audit A's public-registry agent had it right; Audit A's later release-pipeline agent re-flagged this incorrectly. Audit B is correct.

### FP-006 — Accordion `role="region"` default (PARTIAL, both audits inaccurate)

WAI-ARIA APG normative language: **"Optionally, each element that serves as a container for panel content has role region"** and **"Avoid using the region role in circumstances that create landmark region proliferation"**. APG says MAY, not MUST. Audit A's "should default ON per APG" was wrong on the spec citation.

Reference implementations (verified from source):

- Radix Primitives accordion: `role="region"` always.
- Mantine v7: `role="region"` always.
- React Aria Components Disclosure: `role="group"` default; `'region'` opt-in via prop.
- Headless UI Disclosure: no `role` attribute (different pattern).

Diffgazer's opt-in IS APG-conformant. Real defect: `region` prop is undocumented in `apps/docs/content/docs/ui/components/accordion.mdx` and `apps/docs/registry/component-docs/accordion.ts`. Users have no way to discover the choice. Severity: polish + docs gap, not blocker.

## 2. Where Audit B Overstated or Got Wrong

### WEB-003 — Guarded render-time state updates (DISPUTED)

Audit B flagged `use-history-page.ts`, `trust-permissions/page.tsx`, `review-progress-view.tsx`.

Verification: all three are React's documented "adjusting state during render based on prop change" pattern. Examples:

- `use-history-page.ts:114-119`: `if (prevIssueRunId !== selectedRunId) { setPrevIssueRunId(...); setHighlightedIssueId(null); }`
- `trust-permissions/page.tsx:66-68`: `if (draft.editorKey !== editorKey) setDraft(...)`
- `review-progress-view.tsx:155-158`: once-only auto-expansion via guarded setState.

These are the React-team-blessed alternatives to `useEffect` for derived state and align with AGENTS.md "Derive values during render when possible. Do not sync derived state with useEffect." Not anti-patterns. Drop WEB-003 from the spec.

### WEB-001 — App hooks duplicate `useActionRowNavigation` (PARTIAL, severity overstated)

Audit B lists four hooks: `use-providers-keyboard`, `use-model-dialog-keyboard`, `use-api-key-dialog-keyboard`, `use-trust-form-keyboard`.

Verification:

- `use-trust-form-keyboard.ts` already composes `useScopedNavigation` cleanly. NOT a hand-roll. Drop from list.
- `use-providers-keyboard.ts` buttons zone (lines 81-89, 100-109, 187-205, 242-251) IS a hand-roll. Replaceable with `useActionRowNavigation`.
- `use-model-dialog-keyboard.ts` footer zone (lines 130-150, 310-329) IS a hand-roll.
- `use-api-key-dialog-keyboard.ts` footer block (lines 182-201) IS a hand-roll.

The duplication is real but contained (~30-50 lines per hook). App-specific flow logic (cycle filter, method-aware input transitions, needs-model skipping) IS legitimately app-specific. Severity: LOW (cleanup), not MEDIUM. Not a publish blocker.

### WEB-002 — Apps/web duplicates dialog escape (PARTIAL)

Verification:

- `use-api-key-dialog-keyboard.ts:203` `useKey("Escape", onClose, ...)` IS a duplicate of `DialogContent.onCancel`. Harmless because `onOpenChange(false)` is idempotent.
- `use-model-dialog-keyboard.ts:339-347` `handleSearchEscape` clears search query first → app-specific, NOT a duplicate.
- `use-model-dialog-keyboard.ts:337` `useKey("Escape", handleCancel, ...)` non-search Escape IS a duplicate.
- `use-providers-keyboard.ts:207` `useKey("Escape", () => navigate({ to: "/settings" }))` → page-level, navigates instead of closing. NOT a duplicate.

Severity: LOW (hygiene cleanup), not MEDIUM. Idempotent double-call is not a real bug.

### KEYS-002 — `useScrollLock()` default uses global `document.body` (CONFIRMED but severity overstated)

Default IS `document.body`. Refcount is correct. iOS rubber-band and scrollbar-gutter compensation ARE missing. BUT: no internal consumer in `libs/ui` uses `useScrollLock` — `Dialog` uses native `<dialog>.showModal()`. Practical impact in this repo: zero.

Severity reconciliation: MEDIUM is correct for what spec wrote (default-target gap). Audit A's HIGH was correct for "complete SOTA scroll lock" framing. Pick the contract being shipped — minimal primitive (MEDIUM, document gaps) vs. full SOTA scroll lock (HIGH, implement parity with `react-remove-scroll`).

## 3. New Findings (Neither Audit Captured)

### NEW-001 — Docs build is broken in both prerender and non-prerender modes (CRITICAL)

`pnpm --filter @diffgazer/docs build:prerender` and the default `DOCS_PRERENDER=0 vite build` both abort before output. The first visible failure is:

```
[vite:load-fallback] Could not load .../src/lib/aria-utils
  (imported by registry/ui/select/select-trigger.tsx)
```

Root cause: `apps/docs/registry/ui/select/select-trigger.tsx:4` imports `@/lib/aria-utils`, but `apps/docs/vite.config.ts:121-134` aliases map does not include `aria-utils`. The same Vite alias map is also missing `@/lib/typeahead`, which is imported by `apps/docs/registry/ui/select/select-content.tsx` and `apps/docs/registry/hooks/use-listbox.ts`.

This compounds DOCS-002 from spec 028: after the aliases are fixed, the default docs build still disables prerender via `apps/docs/package.json` (`DOCS_PRERENDER=0 vite build`), but today the build itself is broken in both modes.

Severity: CRITICAL for diffgazer.com deploy.

### NEW-002 — Docs index routes are client-only `<Navigate>` (HIGH)

`apps/docs/src/routes/$lib/docs/index.tsx:8-23` renders `<Navigate to="/$lib/docs/$" replace>` only. There is no SSR-renderable content. `GET /ui/docs` returns HTTP 200 with 36680 bytes whose only visible text is `Skip to content`. Same for `/keys/docs`. Empty SSR shells get cached by CDNs and crawlers.

### NEW-003 — Prerender list includes `/docs` (non-existent route) (MEDIUM)

`apps/docs/vite.config.ts:18-22` unconditionally pushes `{ path: '/docs' }` into `getPreRenderPages()`. The router has no top-level `/docs` route. At runtime returns 404. Even if prerender were working, this entry would fail.

### NEW-004 — Top-level library index pages are routed inconsistently (MEDIUM)

The first wording of this finding was wrong. The prerender walker does include nested section `index.mdx` pages by stripping `/index`, so routes such as `/ui/docs/cli`, `/keys/docs/cli`, `/keys/docs/getting-started`, and `/keys/docs/api` are included.

The real issue: top-level `apps/docs/content/docs/ui/index.mdx` and `apps/docs/content/docs/keys/index.mdx` become `/ui/docs/index` and `/keys/docs/index`, while `/ui/docs` and `/keys/docs` render only the client-side `<Navigate>` route from NEW-002. That makes the library intro pages odd/orphaned instead of serving them as the library root.

### NEW-005 — `useFloatingPosition` scroll-parent walker misses transformed/shadow/iframe ancestors (MEDIUM)

`libs/ui/registry/hooks/use-floating-position.ts:211-217` walks only `parentElement` and checks `scrollHeight > clientHeight` / `scrollWidth > clientWidth` without checking `overflow`. Misses:

- Elements that overflow but don't scroll (`overflow: visible` with oversized children) → wasteful listeners.
- Elements with `transform`/`filter`/`perspective` that create a new containing block.
- Shadow DOM hosts.
- Iframe boundaries.

Floating UI's `getScrollParents` handles all three. Practical impact: popover/select mispositioning when trigger lives inside a transformed wrapper.

### NEW-006 — Typeahead/search lowercasing is not locale-aware (MEDIUM)

`libs/ui/registry/hooks/use-typeahead-buffer.ts:27` lowercases the typed query with `.toLowerCase()`. Matching also lowercases labels in `libs/ui/registry/lib/typeahead.ts:35`, and `libs/ui/registry/lib/search.ts:2` lowercases both value and query. Fixing only the buffer leaves mismatches. Add locale-aware normalization across the buffer, typeahead matcher, and search helper, with Turkish-I coverage.

### NEW-007 — `useFormReset` re-subscribes on every render and ignores canceled reset events (MEDIUM)

`libs/ui/registry/hooks/use-form-reset.ts` (already in spec 028 as UI-004) uses `useEffectEvent`, but the layout effect has no dependency array, so it still removes/adds the native `reset` listener on every render. The docs claim the listener stays stable; that claim is inaccurate.

More importantly, the listener ignores the `reset` event and calls `onReset(resetValue)` synchronously. Native form resets are cancelable; if a consumer prevents the reset, the custom control still resets and diverges from native form state. Correct shape: receive the event, defer until the reset decision is final, skip when `event.defaultPrevented`, then reset custom state.

### NEW-008 — `DialogShell` scroll-lock finding is overstated; residual risk is CSS-dependent locking (LOW-MEDIUM)

Native `<dialog>.showModal()` does not itself guarantee body scroll locking, but `libs/ui/registry/ui/shared/dialog.css:33-36` already adds `body:has(dialog[open]) { overflow: hidden; scrollbar-gutter: stable; }`, and the dialog shell registry item includes that CSS. The original "body always leaks scroll" claim is therefore too strong.

Residual risk: locking is CSS-import dependent, applies only to `body`, and does not handle custom scroll roots or older/selective `:has()` environments. Decide whether that is the supported contract or whether `DialogShell` should own JS-level scroll locking.

### NEW-009 — `libs/registry/package.json` declares `"license": "MIT"` without a LICENSE file (LOW)

`libs/registry/package.json` lists `MIT` but no `libs/registry/LICENSE` exists. Even though `private: true`, the declaration is inconsistent.

### NEW-010 — `cli/diffgazer/LICENSE` Apache-2.0 boilerplate missing copyright appendix (HIGH)

Apache-2.0 explicitly expects `Copyright [yyyy] [name of copyright owner]` after "END OF TERMS AND CONDITIONS". `cli/diffgazer/LICENSE` stops at line ~187 with no attribution. This is a defective Apache notice.

### NEW-011 — `Stepper.Content` and `pulse` animations break reduced-motion (MEDIUM, extends UI-002)

Spec 028 UI-002 listed Select/Popover/Accordion/Dialog. Verification adds:

- `libs/ui/registry/ui/stepper/stepper-content.tsx:19` — `transition-[grid-template-rows] duration-200` (same bug class as Accordion).
- `libs/ui/registry/ui/select/select-item.tsx:147` — `animate-pulse` (active glyph) without `motion-safe:` prefix.
- `libs/ui/registry/ui/stepper/stepper-substep.tsx:21` — `animate-pulse` (active substep) without `motion-safe:` prefix.

SOTA fix recommended:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --animate-slide-in: none;
    --animate-slide-out: none;
    /* ...every --animate-* token */
  }
}
```

Apply at `libs/ui/styles/theme-base.css`. Because Tailwind v4 compiles `animate-slide-in` to `animation: var(--animate-slide-in)`, this would neutralize every consumer without retrofitting `motion-safe:` everywhere. Plus per-component fixes for the two grid containers and two `animate-pulse` sites. This has not been implemented yet; refresh public registry/artifacts after changing the CSS.

Also: `libs/ui/registry/ui/shared/dialog.css:62` currently sets `animation-duration: 0.01s !important` under `prefers-reduced-motion`. Change to `animation: none !important`.

### NEW-012 — Major dep drift: 12 majors, 20 minors behind (MEDIUM)

`pnpm outdated -r` exit 1, 41 packages drifted. 12 majors include `typescript 5.9 → 6.0`, `vite 7 → 8`, `@types/node 22 → 25`, `jsdom 28 → 29`, `@vitejs/plugin-react 5 → 6`, `diff 8 → 9`, `commander 13 → 14`, `shiki 3 → 4`, `ink 6 → 7`, `fumadocs-mdx 14 → 15`, `@clack/prompts 0.11 → 1.4`, `@hono/node-server 1 → 2`. `@types/diff@8.0.0` is deprecated.

### NEW-013 — `pnpm dedupe --check` fails and would rewrite importer/transitive lock state (MEDIUM)

Exit code 1. Wants to dedupe: `enhanced-resolve`, `fdir(picomatch@4.0.3)`, `picomatch@4.0.3`, `postcss@8.5.6`, `srvx@0.11.13`, `tapable@2.3.2`, `tinyexec@1.0.2`. It also updates importer state (`tailwindcss 4.2.2 → 4.3.0` in both `apps/docs` and `apps/web`) and several transitive package versions (`postcss`, `picomatch`, `tinyexec`, etc.). Deprecated subdeps: `@ungap/structured-clone@1.3.0`, `node-domexception@1.0.0`, `whatwg-encoding@3.1.1`.

### NEW-014 — `commander` has 4 majors in lockfile (LOW)

`commander 4.1.1, 11.1.0, 13.1.0, 14.0.3`. Worst single dup spread among declared dependencies. Symptom of zero `pnpm.overrides` policy.

### NEW-015 — `@types/node` split across majors 22/25 (MEDIUM)

`libs/registry` and `apps/docs` declare `^22`, others declare `^25`. Resolves to three versions in lockfile (`12.20.55, 22.19.11, 25.2.3`). Type drift between packages.

### NEW-016 — `useFocusTrap` comment lie in example (LOW)

`libs/ui/registry/examples/keyscope-copy-mode/keyscope-copy-mode.tsx:74` says "Confirm dialog (uses useFocusTrap + useScrollLock internally)" — it doesn't. Fix comment.

### NEW-017 — Direct shadcn UI commands do not install the theme/style contract (HIGH)

Docs and READMEs tell users to run commands like `npx shadcn add https://diffgazer.com/r/ui/button.json` and then import Diffgazer UI CSS. But public UI component items such as `button.json` do not depend on `theme.json`; the style files live in the `theme` registry item. The existing shadcn smoke installs `theme` first, so it does not catch a consumer following the documented single-component command.

Fix options:

1. Make public UI items depend on `theme` or a minimal style item.
2. Change docs to always install `theme` first and add a smoke test that follows that exact path.
3. Document package-mode CSS as the only supported styling path for direct shadcn installs.

### NEW-018 — `dgadd` CSS chunks are not owned, diffed, or removed (MEDIUM)

`dgadd add ui/dialog` writes CSS chunks into the configured styles file, but those chunks are not modeled as owned manifest entries. `dgadd diff` cannot report drift in the installed chunks, and `dgadd remove` does not remove them when dialog and its dependencies are removed. This is the same ownership-class problem as CLI-001/002/003, but for style side effects instead of copied TS/TSX files.

### NEW-019 — Low-priority package hygiene from second pass (LOW)

- `libs/registry` is private today, but if it becomes publishable its current package surface would include compiled `dist/testing/*`; narrow its `tsconfig`/`files` before publication.
- `libs/server/package.json` declares `@napi-rs/keyring` in both runtime and dev dependencies with different ranges. Normalize to one declaration.

### NEW-020 — `apps/web` API key dialog forces remount on close and can bypass focus restore (LOW-MEDIUM)

`apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx` passes `key={String(open)}` to `DialogContent`. The UI dialog primitive sets `restoreOnUnmount: false` and restores focus through its normal close lifecycle; forcing the content subtree to remount on open/close can bypass that path and leave focus unrecovered after closing the API key dialog.

Also fold into WEB-002 cleanup: app code passes explicit close handlers into some `DialogClose` usages even though `DialogClose` already dismisses via context after `onClick` when not prevented.

## 4. Reset Severities (vs Spec 028)

| ID | Spec 028 | Verified | Notes |
|----|----------|----------|-------|
| REL-001 | Critical | **Critical** | Unchanged |
| CLI-001 | Critical | **Critical** | Confirmed via live repro |
| CLI-002 | High | **High** | Confirmed via live repro |
| CLI-003 | High | **High** | Confirmed via live repro |
| DIST-001 | High | **Critical** | Upgraded — without DNS, every README install snippet is dead |
| DOCS-001 | High | **High** | Counts updated: 33/44 (was 33/43) |
| DOCS-002 | High | **Critical** | Upgraded — compounded by NEW-001 (prerender build broken) |
| PKG-001 | High | **High** | Confirmed |
| SEC-001 | High | **High for `diffgazer` CLI, MEDIUM elsewhere** | 18 of 43 advisories reach end users; rest are maintainer/private-server/tooling |
| SEC-002 | High | **Medium** | Pinning actions by SHA is best-practice, not blocker |
| KEYS-001 | High | **Medium** | No internal consumer in `libs/ui`; rename/document or fix before "full trap" claim |
| UI-001 | High | **Medium** | Real but no in-repo iframe consumer; includes Portal fallback and `useActiveHeading` owner-document gaps |
| UI-002 | High | **High** | Confirmed; extended by NEW-011 |
| GOV-001 | Medium/High | **High** | Add NEW-010 (defective Apache notice) and NEW-009 |
| DOCS-003 | Medium | **Medium** | Unchanged |
| DOCS-004 | Medium | **Medium** | Unchanged |
| ART-001 | Medium | **Low** | Cosmetic rename only |
| PKG-002 | Medium | **Medium** | Unchanged |
| PKG-003 | Low/Medium | **Medium** | Confirmed (`@diffgazer/{keys,ui}` lack engines) |
| TS-001 | Medium | **Medium** | Unchanged |
| DEP-001 | Medium | **Medium** | Confirmed and extended by NEW-012/013/014/015 |
| WEB-001 | Medium | **Low** | Overstated; real but contained ~30-50 LOC per hook |
| WEB-002 | Medium | **Low** | Overstated; idempotent double-call is hygiene only |
| WEB-003 | Medium | **DROP** | False positive — guarded render-time setState is correct React pattern |
| I18N-001 | Medium | **Medium** | Same as NEW-006 |
| KEYS-002 | Medium | **Medium** | Confirmed; no in-repo consumer reduces practical impact |
| UI-003 | Low/Medium | **Low/Medium** | Unchanged (Typography no h1-h6) |
| UI-004 | Low/Medium | **Low/Medium** | Same as NEW-007 |
| FP-001 to FP-007 | Spec marks false | **All confirmed false** | Audit B was right to reclassify; one nuance on FP-006 (APG quote, ref impls) |

## 5. Final Fix Order (Merged)

### Sprint 0 — Stop-the-bleeding (1-2 days)

1. **CLI-001/002/003 + NEW-018**: Add reverse-dependency walk to `dgadd remove`, scope `dgadd diff` to manifest items, add cascade/orphan cleanup, and model installed CSS chunks as owned/diffable/removable side effects. Add behavior tests. This is the only data-corrupting class of bug; ship first.
2. **NEW-001**: Fix the docs Vite alias contract for all registry `@/lib/*` imports, at minimum `aria-utils` and `typeahead`, so both default `build` and `build:prerender` exit zero.
3. **SEC-001 (consumer-facing only)**: Bump `hono >=4.12.18` and `@hono/node-server >=1.19.13` in `cli/diffgazer`; mirror in private `libs/server` to close the duplicate private-server findings. This removes the 18 consumer-facing advisories from the published `diffgazer` CLI path.

### Sprint 1 — Handoff blockers (3-5 days)

4. **REL-001**: Add `.github/workflows/release.yml` with `changesets/action@v1`, `npm publish --provenance` from OIDC. Move `id-token: write` off readiness workflow onto publish job.
5. **DIST-001**: Deploy `diffgazer.com/r/...` OR remove all hosted-shadcn snippets until ready. Add CI smoke for `curl /r/ui/registry.json`.
6. **NEW-017**: Make the direct shadcn styling contract real: either public UI items depend on `theme`, docs always install `theme` first with matching smoke coverage, or package CSS becomes the only documented styling path.
7. **DOCS-002 + NEW-001/002/003/004**: Fix `/ui/docs` and `/keys/docs` to render real SSR content (not client-only `<Navigate>`). Remove `/docs` from prerender list. Route top-level library intro pages coherently instead of `/ui/docs/index`/`/keys/docs/index`. Flip default build to `DOCS_PRERENDER=1`. Emit per-page description/canonical/og/twitter. Generate sitemap.xml. Update robots.txt.
8. **GOV-001 + NEW-010 + NEW-009**: Add root `LICENSE`. Fix `libs/keys/LICENSE` copyright holder (or document split). Add Apache-2.0 appendix copyright to `cli/diffgazer/LICENSE`. Add `LICENSE` to `libs/registry` or drop the package.json license field. Add `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, issue/PR templates. Document MIT-vs-Apache-2.0 split in `PACKAGE_GOVERNANCE.md`.

### Sprint 2 — Docs content + package surface (3-5 days)

9. **DOCS-001**: Populate props data for 33/44 components (fix the extractor or hand-author). Add `<APIReference />` to 33 MDX pages. Add validation that empty public prop tables fail unless explicitly exempted.
10. **PKG-001**: Add `"./package.json": "./package.json"` to `libs/ui/package.json` exports. Add package-mode docs artifact smoke test.
11. **PKG-002**: Decide: docs artifacts in `@diffgazer/ui` (28.93 MB packed, 1160 entries) or in a separate `@diffgazer/ui-handoff` package. If keeping, document the cost; if moving, redirect docs-app to hosted artifacts.
12. **PKG-003**: Add `engines.node` to `@diffgazer/keys` and `@diffgazer/ui`.

### Sprint 3 — Library correctness (3-5 days)

13. **KEYS-001**: Either fix `useFocusTrap` (document-level capture + focusin recapture + MutationObserver, plus no-focusable-child fallback) OR rename to `useFocusBoundary` and document boundary-cycling contract. Fix the lying comment at `keyscope-copy-mode.tsx:74`.
14. **UI-001**: Switch `use-floating-position`, `use-outside-click`, `use-popover-behavior`, Portal fallback, and `useActiveHeading` to owner-document/owner-window/root-aware behavior where their contracts imply DOM ownership.
15. **UI-002 + NEW-011**: Add `@media (prefers-reduced-motion: reduce)` block in `theme-base.css` neutralizing every `--animate-*` token to `none`. Per-component fixes for `accordion-content`, `stepper-content`, `select-item`, `stepper-substep`. Fix `dialog.css:62` to `animation: none !important`. Refresh public registry/artifacts after changing CSS.
16. **KEYS-002**: Document gaps prominently. Optionally add owner-document-aware default (`(target?.current?.ownerDocument ?? document).body`) and `preventLayoutShift` / `preventIosRubberBand` opt-in flags.
17. **NEW-008**: Verify the existing `body:has(dialog[open])` CSS body-lock coverage across browser targets and iOS/custom scroll roots. If moving to JS lock, add `useScrollLock` plus the correct registry dependency.
18. **NEW-005**: Replace scroll-parent walker in `use-floating-position` with Floating UI's `getScrollParents` shape (handles transform/shadow/iframe).
19. **NEW-006**: Normalize lowercasing across `use-typeahead-buffer`, `typeahead.ts`, and `search.ts`. Add Turkish-I/locale tests and document the locale contract.
20. **NEW-007**: Fix `useFormReset` subscription strategy and canceled-reset behavior; it already uses `useEffectEvent`, so the remaining issue is the dependency-less layout effect and event semantics.

### Sprint 4 — Tooling + dependency governance (2-3 days)

21. **TS-001**: Align `libs/ui/tsconfig.json` with `libs/core/tsconfig/base.json`. Migrate `libs/registry` from `Node16` to `NodeNext`. Fix `@diffgazer/core` React peer floor.
22. **DEP-001 + NEW-012/013/014/015/019**: Add root `pnpm.overrides` for `@types/node`, `tailwindcss`, `picomatch`, `postcss`, `commander`. Establish upgrade cadence. Normalize `libs/server` duplicate `@napi-rs/keyring`. Add `pnpm audit --prod --audit-level=moderate` and `pnpm dedupe --check` as CI advisory gates.
23. **SEC-002**: Pin GitHub Actions by SHA. Add `.github/dependabot.yml`. Add `concurrency:` block to workflows. Restrict OIDC to publish job.
24. **DOCS-004**: Add docs metadata completeness check that fails on empty public component prop tables.

### Sprint 5 — Polish (1-2 days)

25. **DOCS-003**: Split `.changeset/public-handoff-docs.md` into per-package per-concern changesets.
26. **WEB-001**: Refactor `use-providers-keyboard` / `use-model-dialog-keyboard` / `use-api-key-dialog-keyboard` footer/buttons zones to use `useActionRowNavigation`. Keep app-specific flow logic.
27. **WEB-002 + NEW-020**: Remove redundant `useKey("Escape", onClose)` from api-key + model dialog hooks and redundant explicit close handlers on `DialogClose`. Remove or justify `DialogContent key={String(open)}` in the API key dialog so focus restore follows the primitive lifecycle.
28. **UI-003**: Either add `h1`-`h6` to `Typography` `as` union or document the SectionHeader/Typography split.
29. **FP-006 polish**: Document accordion `region` prop in `accordion.mdx`, or consider renaming to `role: 'group' | 'region'` (React Aria pattern).
30. **NEW-016**: Fix `keyscope-copy-mode.tsx:74` comment.

## 6. Verification Plan

After Sprint 0 + Sprint 1 land:

```bash
# Local
git status --short
pnpm audit --prod --audit-level=moderate  # expect zero advisories on published package paths; remaining private/tooling advisories triaged
pnpm dedupe --check                        # expect exit 0 after overrides
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/keys validate:registry
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/docs test
pnpm --filter @diffgazer/docs build:prerender  # must exit zero
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
pnpm run smoke:packages
pnpm run verify:monorepo
git diff --check

# Live repro for CLI-001
mkdir /tmp/dgadd-verify && cd /tmp/dgadd-verify
# (vite/react init)
pnpm add /Users/voitz/Projects/diffgazer-workspace/cli/add
dgadd init --yes
dgadd add ui/dialog --yes
dgadd remove ui/button --yes
# expect: "Keeping ui/button; still required by: ui/dialog"
# verify: src/components/ui/button/button.tsx still exists
dgadd remove ui/dialog --yes
# expect: cascade-remove orphans OR prompt
dgadd diff
# expect: detects drift in src/components/ui/shared/portal.tsx after edit
```

After Sprint 1 deploys:

```bash
curl -I https://diffgazer.com/r/ui/registry.json     # 200
curl -I https://diffgazer.com/r/ui/button.json       # 200
curl -I https://diffgazer.com/r/keys/navigation.json # 200
curl -I https://diffgazer.com/schema/diffgazer.json  # 200
npm view @diffgazer/add version --json
npm view @diffgazer/ui version --json
npm view @diffgazer/keys version --json
npm view diffgazer version --json
# After first publish via OIDC workflow:
npm view diffgazer --json | jq '.dist.attestations'  # expect non-null
```

## 7. Confirmed Strengths (Preserve)

Unchanged from spec 028 §"Confirmed Strengths to Preserve". Add:

- The `dgadd` rollback machinery (snapshot-based, covers package-manager side effects) is genuinely SOTA. The defect is in remove's reverse-dependency logic, not in the underlying write/rollback architecture.
- The `libs/keys` test suite is unusually rigorous (5505 LOC, ~250 tests, zero `vi.mock`, owner-document discipline throughout). Audit A scored this 95% SOTA; verification confirms.
- The native `<dialog>.showModal()` approach in `DialogShell` is the right 2026 pattern. Compensates for `useFocusTrap`'s limitations and explains why the trap defect has zero in-repo blast radius today.
- The `useOutsideClick` priority+nesting stack with capture-phase + composedPath + touch/mouse dedupe is best-in-class.
- The shadcn registry transform (`@diffgazer/keys` → `@/hooks/utils/*` rewrite, `.js` extension stripping) works correctly — zero `.js` specifiers, zero unrewritten keys imports across 75 public JSON files.

## 8. Open Questions

Carry forward from spec 028 §"Open Questions", plus:

- Should `useFocusTrap` be fixed (full trap) or renamed to `useFocusBoundary` (boundary cycling)? Either is defensible; pick before next published changeset bumps keys.
- Is the current CSS-only `DialogShell` body lock (NEW-008) the intended contract, or should the primitive own JS-level scroll locking for custom scroll roots/iOS? Confirm with manual browser tests before changing registry dependencies.
- Should the SOTA fix for reduced-motion (token override in `:root` under `@media`) ship as the canonical pattern, or should each component get `motion-safe:` prefixes? Token override is cheaper and more complete; per-component is more explicit.
- Should `commander` version split (4/11/13/14) be resolved via pnpm.overrides or by refactoring CLI deps to use a single major?
- Should direct shadcn install make `theme` a dependency of every public UI item, or should docs/smoke enforce "install theme first" as the explicit contract?

## 9. Author Notes

- This spec is read-only. No production code was modified in producing it.
- Spec 028 is the better baseline than Audit A. Most of Audit A's "critical" items remain, but several were misclassified (FP-001 to FP-007) and Audit A missed real bugs that Audit B caught (CLI-001/002/003, DIST-001, PKG-001, SEC-001, UI-001 in overlay hooks).
- The new findings in §3 came from verification agents probing claims and adjacent code. The follow-up pass corrected this spec in several places: docs build needs both `aria-utils` and `typeahead` alias coverage, NEW-008 is a CSS-lock coverage question rather than a proven unconditional body-scroll leak, and the reduced-motion token fix is proposed rather than already applied.
- Fix order in §5 deliberately puts Sprint 0 ahead of REL-001. Reasoning: the publish workflow is useless if `diffgazer.com` is dead and the published CLI silently breaks consumer apps. Fix the data-corrupting bug, fix the broken docs build, fix the consumer-facing CVE, THEN wire publish.

## 10. Third-Pass Raw Findings (10 Requested Lanes, Uncovered Angles)

After the spec was first written, a third verification pass requested 10 additional workstreams on dimensions neither Audit A nor Audit B examined: mobile/touch, React 19 feature usage, bundle size empirical measurement, SSR/hydration safety on TanStack Start, browser compatibility floor, visual regression / E2E coverage, z-index/CSS layer architecture, generic typing quality, and adversarial edge cases.

The claims below are preserved as raw intake (`NEW-021` through `NEW-044`) so the original evidence trail stays auditable. **They are not the final severity table.** The final validation pass corrected multiple severities, merged duplicates, and dropped one false finding. Use §§11-13 as the source of truth for final status, fix order, and verdict.

### NEW-021 — Three missing Vite aliases, not two (CRITICAL, extends NEW-001)

`apps/docs/vite.config.ts:120-135` is missing **three** alias entries that exist in `apps/docs/tsconfig.json:26-46`:

- `@/lib/aria-utils` — hard build break (per NEW-001)
- `@/lib/typeahead` — hard build break (per NEW-001, second failure once aria-utils fixed)
- `@/lib/utils` — **silent registry contract bleed** (139 files affected). Resolves via `@` → `./src` fallback to `apps/docs/src/lib/utils.ts`, which RE-EXPORTS `cn` from the `@diffgazer/ui` package. Registry source is implicitly pulled through the npm package instead of being self-contained — a copy/shadcn consumer would not have `@diffgazer/ui` available. The build succeeds, but the contract is broken.

Both default `build` and `build:prerender` fail today at `aria-utils`. tsc passes because TypeScript uses `tsconfig.json` paths; Vite's `resolve.alias` overrides `vite-tsconfig-paths`.

### NEW-022 — Popover/Tooltip hover-mode unreachable on touch devices (CRITICAL)

`libs/ui/registry/ui/popover/popover-trigger.tsx:144-152, 222-223` — in hover mode with a non-interactive child, renders `<span>` with `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur` **only**. No `onClick`/`onTouchStart`/`onPointerDown` fallback. On touch devices (no hover event), the popover/tooltip is unreachable.

`libs/ui/registry/ui/tooltip/tooltip.tsx:30-38` forces `triggerMode="hover"`. Every tooltip in the library is invisible to touch users. WCAG 1.3.1 / 4.1.3 "additional info" affordance broken on every touch device. No `aria-describedby` equivalent surfaced.

### NEW-023 — iOS Safari persistent focus-zoom on text-xs/text-sm inputs (CRITICAL)

`libs/ui/registry/lib/input-variants.ts:4-6` — `sm` is `text-xs` (12px), `md` is `text-sm` (14px). iOS Safari triggers zoom-on-focus for any `<input>`/`<textarea>` with computed `font-size < 16px`. **The page does not zoom back when the input is blurred.** Every focus permanently breaks the viewport scale for the rest of the session. Only `lg` (`text-base`, 16px) avoids it.

Fix: bump base font-size or add `font-size: 16px` for `@media (max-width: 768px) { input, textarea }`.

### NEW-024 — `<dialog>.showModal()` no feature detect, hard error on iOS < 15.4 (CRITICAL)

`libs/ui/registry/ui/shared/dialog-shell.tsx:65` calls `dialog.showModal()` directly with no feature detection and no `<div>`-based fallback. iOS Safari < 15.4 throws. Real consumer impact for iPad/iPhone fleets on older iOS.

Fix: feature-detect `'showModal' in HTMLDialogElement.prototype`; fall back to portalled `<div>` with manual focus trap + scroll lock + escape handling.

### NEW-025 — Bundle install footprint is 31.7 MB unpacked, 94% is shippable artifacts (HIGH)

Measured via `pnpm pack`:

- `@diffgazer/ui`: 1.59 MB packed, **31.7 MB unpacked**, 1160 files. **29 MB is `dist/artifacts/`** (registry JSON handoff) that consumers never read at runtime.
- `@diffgazer/keys`: 174 KB packed, **2.9 MB unpacked**, 183 files. 2.3 MB is `dist/artifacts/`.
- Runtime JS only: UI 347 KB unminified, keys 65.4 KB unminified.

Runtime tree-shaking IS working correctly:
- `import { Button }` from UI → 33.1 KB min / 10.8 KB gzip (27 KB is `tailwind-merge` fixed tax)
- `import { useKey }` from keys → 1.3 KB min / 0.7 KB gzip
- 30 components combined → 182.5 KB min / 55.8 KB gzip

Fix: exclude `dist/artifacts/` from the npm tarball via `files` field negation. Drops `@diffgazer/ui` to ~3 MB unpacked.

### NEW-026 — `figlet` is a hard runtime dependency on `@diffgazer/ui` (CRITICAL DX)

`libs/ui/package.json:268-273` lists `figlet` in `dependencies` (~21 MB install). It is only used by the `./components/logo/figlet` subpath (`libs/ui/dist/components/logo/figlet.js`). The bare `Logo` import correctly does NOT pull figlet (subpath isolation works), but every consumer's `node_modules` carries the 21 MB regardless.

Fix: move `figlet` to `peerDependenciesMeta: { figlet: { optional: true } }`. Document that ASCII Logo requires `npm install figlet`.

### NEW-027 — Button unconditionally bundles Spinner (HIGH)

`libs/ui/registry/ui/button/button.tsx` imports `Spinner` at module top-level for the `loading` branch. Even consumers who never use `loading={true}` ship Spinner code (~2.5 KB per Button consumer). Same in Toast.

Fix: `React.lazy(Spinner)` for the loading branch, OR split into `<Button>` (bare) and `<LoadingButton>` (with spinner).

### NEW-028 — `@diffgazer/keys` ships source maps (LOW, inconsistency)

`libs/keys/tsconfig.json:19-20` emits `sourceMap: true` + `declarationMap: true`. 48 `.map` files (~80 KB) ship in the tarball. `@diffgazer/ui` (tsup-built) ships zero `.map` files. Pick one policy.

### NEW-029 — Dialog `hasTitle`/`hasDescription` post-mount state causes hydration mismatch on `defaultOpen={true}` (HIGH)

`libs/ui/registry/ui/dialog/dialog.tsx:23-24` initializes `hasTitle=false`. SSR renders `<dialog>` with `aria-label="Dialog"` (fallback) and `aria-labelledby=undefined`. After client mount, `DialogTitle` fires `onTitleMount` in `useLayoutEffect` (`dialog-title.tsx:17`), `hasTitle` flips to `true`, next commit emits `aria-label=undefined` + `aria-labelledby={titleId}`. React reconciles silently but SSR HTML differs from post-hydration DOM — assistive tech briefly reads the fallback label.

Same defect for `DialogDescription` (`dialog-description.tsx:12` uses `useEffect`, same drift).

Fix: derive `hasTitle`/`hasDescription` from `containsDialogTitleElement(children)` at render-time. The detection function already exists (`dialog-content.tsx:78`). Drop the mount-callback state machine entirely. This is tracked as P1-006 in `libs/ui/specs/025-sota-readiness-fixes/issues/`.

### NEW-030 — 16+ `useLayoutEffect` SSR dev warnings under TanStack Start (MEDIUM)

TanStack Start renders all hooks on the server; `"use client"` directives are no-ops. Every `useLayoutEffect` on the SSR path emits React's "useLayoutEffect does nothing on the server" warning. Affected sites:

- `libs/keys/src/hooks/{use-key.ts:71, use-scope.ts:15}`
- `libs/ui/registry/hooks/{use-form-reset.ts:15, use-floating-position.ts:193, use-overflow.ts:32, use-overflow.ts:56, use-overflow-items.ts:104, use-overflow-items.ts:138, use-overflow-items.ts:142, use-listbox.ts:278, use-listbox.ts:282}`
- `libs/ui/registry/ui/{shared/dialog-shell.tsx:61, select/select-search.tsx:44, select/select-content.tsx:182, radio/radio-group-item.tsx:47, checkbox/checkbox-item.tsx:36, dialog/dialog-title.tsx:17, command-palette/command-palette-item.tsx:66, toggle-group/toggle-group-item.tsx:84}`
- `libs/ui/registry/lib/selectable-collection.ts:97`

Fix: add `useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect` to `libs/ui/registry/lib/` and `libs/keys/src/dom/`. Replace 16+ imports. Non-fatal warning today but pollutes SSR logs.

### NEW-031 — Browser support floor is undocumented, real floor is Tailwind v4 (Chrome 111 / Safari 16.4 / Firefox 128) (MEDIUM)

Zero `browserslist`, zero `engines` for browser packages, zero README/docs statement. The de facto floor is **inherited from Tailwind CSS v4**, which the libs hard-require. Within that floor:

- **`scrollbar-gutter: stable`** on global `html` (`theme-base.css:62`) — Safari 18.2+. Safari 16.4-18.1 ignores it → layout shift on every consumer's page when scrollbars toggle. Cosmetic only.
- **`backdrop-filter` unprefixed** (`dialog.css:14`) — Safari 18+. Safari 16.4-17.x falls back to solid `rgba(0,0,0,0.6)` backdrop without blur. One-line fix: add `-webkit-backdrop-filter: blur(4px);`.
- **CSS Grid `1fr ↔ 0fr` animation** (Accordion, Stepper) — Chrome 117+, Safari 17.4+. Below floor: snap instead of smooth animate. Functionally fine.
- **`color-mix(in srgb, …)`** (`select.tsx:147`) — Safari 16.2+. Pass.

Fix: add `browserslist` field to `libs/ui/package.json`; add "Supported browsers" section to README and docs.

### NEW-032 — Zero visual regression, zero E2E, zero cross-browser tests (HIGH)

CI workflow `.github/workflows/release-readiness.yml` has install + build + verify + smoke + pack — **no browser job, no Playwright, no Cypress, no Chromatic, no Storybook, no `.snap` files**. 272 Vitest files (1564 tests) all run in jsdom. 46 `axe()` assertions also jsdom-only.

Concrete risk scenarios that current CI cannot catch:
- CSS regressions (smoke only asserts "CSS bytes emitted")
- Focus ring / outline regressions (jsdom doesn't compute focus visuals)
- Popover/dialog positioning (jsdom has no layout engine; `getBoundingClientRect` returns zeros)
- Cross-browser WebKit-specific `dialog::backdrop`, `:focus-visible`, `inert`, container queries
- Real Tab/Shift+Tab ordering (depends on real browser layout/visibility)

Reference comparison: Radix, Ark UI, shadcn/ui all ship Playwright + visual regression in CI. Diffgazer ships none.

Fix (minimum viable): add Playwright to `apps/docs` with smoke specs for 8-10 critical primitives (Button, Dialog, Select, Popover, Menu, Tooltip, ToggleGroup, CommandPalette, Tabs, Accordion). Add `@axe-core/playwright` for real-browser a11y. Add `toHaveScreenshot` baseline snapshots. ~300 LOC, one CI matrix.

### NEW-033 — Toast over open Dialog is visually invisible (HIGH, real reachable scenario)

`<Toaster position="bottom-right" />` mounts at app root (`apps/web/src/app/routes/__root.tsx:78`), portaled to `document.body` with `z-50` (`toast-container.tsx:32`). When a dialog is open via `dialog.showModal()`, the top-layer backdrop (rgba(0,0,0,0.6) + 4px blur from `shared/dialog.css:13`) paints over it. **`z-index` cannot beat the browser top-layer.**

Concrete reachable scenario: `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx` → `onSubmit` → `use-provider-management.ts:33,43,61,71` → `toast.error("Failed to Save", …)` fires while the dialog is open. Toast is occluded; user sees no feedback on save failure. Screen readers still announce via `role="alert"` but sighted users miss critical error.

Fix options:
1. Route `<Toaster>` to the topmost open dialog's portal container via `PortalContainerProvider`.
2. Use HTML Popover API (`popover="manual"` + `showPopover()`) for toasts so they join the top-layer. Chrome 114+, Safari 17+, Firefox 125+.

### NEW-034 — Declare cascade layer order; expose z-index tokens (MEDIUM, extends NEW-033)

`@layer theme, base, components, utilities;` is **not declared anywhere** in `libs/ui/styles/*.css`. Consumer override behavior depends on source order, fragile against bundler reorderings. No public z-index token scale — `z-50` (toast), `z-9999` (popover/select/tooltip), `z-10` (CardLabel) — ad-hoc.

Fix: declare layer order at top of `theme-base.css`. Add `--z-toast`, `--z-popover`, `--z-overlay` tokens to `@theme`. Document that native dialog is above all z-index.

### NEW-035 — `useActionRowNavigation` has no type relation between actions, disabled flags, and onAction index (CRITICAL DX)

`libs/keys/src/hooks/use-action-row-navigation.ts:12-26` — `actionCount: number`, `disabledActions: readonly boolean[]`, `onAction: (index: number) => void` are three loose primitives. Consumers can pass mismatched lengths or supply `disabledActions[0]` for the wrong action with zero type pushback.

Fix: `<Actions extends readonly unknown[]>` generic with `disabledActions?: { readonly [K in keyof Actions]: boolean }` and `onAction: (index: keyof Actions & number) => void`.

### NEW-036 — Tabs/Select/RadioGroup/ToggleGroup/Menu not generic over value union (HIGH DX)

All five components accept `value: string` and provide no parent↔child cross-narrowing. Consumer `<Tabs<"overview"|"details">>` would force `TabsTrigger value` to be one of those two literals — today it accepts any string.

Affected: `libs/ui/registry/ui/{tabs/tabs.tsx:19, select/select.tsx:35-47, radio/radio-group.tsx:48, toggle-group/toggle-group.tsx:17-29, menu/menu.tsx:15-29}`. Same gap in hooks: `libs/keys/src/hooks/{use-navigation.ts:20-54, use-scoped-navigation.ts:14-24}` and `libs/ui/registry/hooks/use-listbox.ts:34-70`.

Fix: add `<T extends string = string>` to each component/hook; thread through children. Backwards-compatible because of the `string` default.

### NEW-037 — Zero `@example` JSDoc across both public packages (HIGH DX)

`rg "@example"` against `libs/keys/src` and `libs/ui/registry/ui` returns **zero**. Sparse `@param`/`@returns` either. IDE hover tooltips on `useKey`, `useFocusZone`, `Select`, `Button`, `Tabs` show only the type signature with no copy-pastable usage. For libraries at v0.1.x with `prepublishOnly` configured for public npm publish, this is a release-blocking DX gap.

Fix: add `@example` block to at least the top-15 public APIs before first scoped-package publish.

### NEW-038 — `<Field.Error>` and `<Field.Description>` with empty string render empty `<p>` + wire `aria-describedby` (HIGH)

`libs/ui/registry/ui/field/field.tsx:178, 208` — `hasChildren = children !== undefined && children !== null`. Empty string passes the check; renders empty `<p>` and wires `aria-describedby` to it. **Screen readers announce an empty description/error on every focus** when consumer passes `error=""` or `description=""` (common pattern for "show error only when form submitted").

Fix: check truthiness or non-empty: `const hasChildren = typeof children === "string" ? children.length > 0 : children !== undefined && children !== null;`.

### NEW-039 — Tabs with zero triggers silently broken (HIGH)

`libs/ui/registry/ui/tabs/tabs.tsx:91-92` — `firstEnabledTab=""` when no triggers exist; `resolvedValue=""` always; no panel matches "". No throw, no warn, no test. Empty Tabs renders an empty tablist with no error feedback.

Fix: throw or warn when `triggers.length === 0`; or render `<EmptyState>` slot.

### NEW-040 — `useFloatingPosition` unthrottled scroll/resize listener causes layout thrash (HIGH performance)

`libs/ui/registry/hooks/use-floating-position.ts:222-223` — `window.addEventListener("scroll", update); …("resize", update)`. `update()` runs synchronously on every event with no `requestAnimationFrame` batch, no throttle. Combined with the scroll-parent walker (`:211-217`) that attaches listeners to every overflow ancestor, scroll on nested-scroll pages compounds.

Real risk: open a Popover/Select/Tooltip on a long page or inside a scroll container; user scrolls fast → 60+ synchronous reposition computations per second.

Fix: wrap `update` in `requestAnimationFrame` with a pending-flag guard, OR adopt Floating UI's `autoUpdate` which already handles this.

### NEW-041 — `useDeferredValue` not used in command-palette filtering (MEDIUM, opportunity)

`libs/ui/registry/ui/command-palette/use-command-palette-state.ts:53-62` and `command-palette-item.tsx:64` — filter runs synchronously per item on every keystroke. For palettes with 100+ items, typing latency degrades visibly. Wrapping consumed `search` value in `useDeferredValue` would keep typing responsive.

### NEW-042 — Field.Control loosely typed (LOW)

`libs/ui/registry/ui/field/field.tsx:149-152` — `children: ReactElement<FieldControlChildProps>` doesn't narrow per concrete control type. Wiring works, but autocomplete on wrapped child is generic. Acceptable for a wiring layer; flag only.

### NEW-043 — `Popover` with `role="dialog"` THROWS for missing accessible name; `Dialog` WARNS-AND-FALLBACKS (MEDIUM, contract asymmetry)

`libs/ui/registry/ui/popover/popover-content.tsx:101` — hard `throw new Error(...)`. `libs/ui/registry/ui/dialog/dialog-content.tsx:92` — `console.warn(...)` and applies `FALLBACK_DIALOG_LABEL`. Either both throw or both warn; mixed contract surprises consumers.

### NEW-044 — `libs/keys` ships handoff artifacts in npm tarball (HIGH, extends NEW-025)

`libs/keys` tarball includes `dist/artifacts/`, `registry/`, `public/r/` — ~2.5 MB of JSON handoff payload that consumers using `import { useKey } from "@diffgazer/keys"` never read. Shipping handoff artifacts in the runtime npm tarball is the wrong axis.

Fix: split handoff artifacts into separate `@diffgazer/keys-handoff` package or distribute via hosted registry URLs only.

---

## 11. Final Third-Pass Reconciliation (Validated)

The raw third-pass section above over-counted criticals, duplicated package-footprint findings, and included one React 19 SSR warning claim that did not reproduce. This table supersedes §10 severities.

| ID | Final Status | Final Severity | Corrected Finding |
|----|--------------|----------------|-------------------|
| NEW-021 | Confirmed, extends NEW-001 | **Critical** | Vite aliases still miss `@/lib/aria-utils` and `@/lib/typeahead`; `@/lib/utils` falls through to `apps/docs/src/lib/utils.ts`, which re-exports from `@diffgazer/ui` instead of the registry copy. `tsc` passes because TS paths mask Vite resolution. |
| NEW-022 | Partially confirmed | High | Hover-mode Popover/Tooltip is touch-unreliable for passive/non-button triggers. Interactive hover triggers already get click/key fallback, so "every tooltip is unreachable" was overstated. |
| NEW-023 | Confirmed source, impact softened | High | Default `md` text controls are below 16px and can trigger iOS Safari/WKWebView focus zoom. Affected surface includes Input, Textarea, InputGroup inheritance, and SelectSearch. Do not claim permanent zoom without manual device proof. |
| NEW-024 | Confirmed source, mostly support-contract | Medium | `dialog.showModal()` is called without feature detection. This is only critical if browsers below Safari/iOS 15.4 are supported; otherwise document the Tailwind v4 browser floor and treat fallback as legacy support work. |
| NEW-025 | Confirmed, merge with PKG-002/NEW-044 | High | Exact pack numbers: UI is 1,500,528 bytes packed / 28,927,312 bytes unpacked; keys is 167,482 bytes packed / 2,440,250 bytes unpacked. Combined unpacked payload is 31.37 MB; 30.65 MB is docs/handoff artifact payload. |
| NEW-026 | Confirmed, severity softened | High | `figlet` is a production dependency for optional `./components/logo/figlet`; local package content is ~18.78 MB / 21000 KiB disk. Do not claim "0% of users." Moving it to optional peer changes that subpath contract and must be documented. |
| NEW-027 | Confirmed, impact softened | Low/Medium | Button and Toast import Spinner at module top level. Built Spinner chunk is ~5.3 KB unminified before min/gzip. This is bundle hygiene, not a high release blocker; `React.lazy` may add more complexity than value. |
| NEW-028 | Confirmed | Low | `@diffgazer/keys` ships 48 source-map/declaration-map files, ~82.1 KB in the tarball. `@diffgazer/ui` ships none. Pick a policy. |
| NEW-029 | Partially false, residual issue confirmed | Medium | Title/accessible-name SSR drift is false: `DialogContent` already uses `containsDialogTitleElement(children)` during render. Residual issue is description-only drift: `aria-describedby` depends on post-mount `hasDescription`. |
| NEW-030 | False as written | Drop | React 19.2 server rendering did not emit `useLayoutEffect` SSR warnings locally; server maps it to a noop. Keep only as Low SSR behavior review if a user-visible hydration behavior is proven. |
| NEW-031 | Confirmed with corrections | Medium | Browser support floor is undocumented. Tailwind v4 implies a modern floor; docs should state it. Add `-webkit-backdrop-filter` for Safari 16.4-17.x. Drop the CSS grid-track warning; current browser data puts it inside the implied floor. |
| NEW-032 | Confirmed, wording corrected | High | No real-browser E2E, cross-browser, or visual-regression CI exists. The repo does have some node/SSR Vitest coverage, so "all jsdom-only" was inaccurate. |
| NEW-033 | Confirmed, wording corrected | High | Toaster is root-mounted fixed UI, not a portal. Native `dialog.showModal()` top-layer/backdrop sits above it; z-index cannot fix this. Strongest app repro is model selection failure while the model dialog remains open. |
| NEW-034 | Confirmed, decoupled from NEW-033 | Medium | There is no global cascade layer order declaration and z-index values are ad hoc. This improves non-modal overlay consistency, but it does not solve native dialog top-layer stacking. |
| NEW-035 | Confirmed, severity softened | Medium DX | `useActionRowNavigation` has loose `actionCount` / `disabledActions` / `onAction(index)` typing. The proposed tuple generic is incomplete unless the API accepts an inference source such as an action tuple. |
| NEW-036 | Confirmed, severity softened | Medium DX | Value/id APIs are not generic over literal unions. Do not claim parent generic JSX children would be reliably constrained; frame as root value/onChange and exported child-prop DX. |
| NEW-037 | Confirmed, wording corrected | Medium DX | Public source/declarations have zero `@example` JSDoc tags. Public docs do have examples, so this is IDE-hover DX, not "zero public examples." |
| NEW-038 | Confirmed, severity softened | Medium | `Field.Description` and `Field.Error` treat empty string as children and wire empty referenced nodes. The screen-reader announcement claim needs manual AT validation. Trim strings rather than checking only `.length > 0`. |
| NEW-039 | Confirmed, severity softened | Medium | Tabs with zero enabled triggers resolve to `""` and hide real panels silently. This is contract validation / developer-feedback work, not a high user-facing defect by itself. |
| NEW-040 | Confirmed, severity softened | Medium | `useFloatingPosition` runs layout reads and state updates directly from scroll/resize/ResizeObserver callbacks. Reword from "causes layout thrash" to "can cause unbatched layout work and unnecessary commits." |
| NEW-041 | Overstated | Low opportunity | Synchronous command-palette filtering can be profiled for large lists, but `useDeferredValue` is not automatically correct because stale results can misalign visible items and Enter activation. |
| NEW-042 | Confirmed | Low DX | `Field.Control` accepts a generic injected-props element rather than preserving concrete child prop/ref typing. Acceptable unless stronger compound typing is desired. |
| NEW-043 | Confirmed | Medium | `Popover.Content role="dialog"` throws without an accessible name while `Dialog.Content` warns and applies fallback label. Pick one policy and document/test it. |
| NEW-044 | Duplicate, merged into NEW-025 | Merged | Keys handoff payload is 2,261,090 bytes of the 2,440,250-byte unpacked package. Keep as evidence under NEW-025/PKG-002, not a separate High. |

## 12. Corrected Fix Order Addenda

These are the third-pass additions to §5 after validation, not the raw §10 ordering.

**Sprint 0 — Stop-the-bleeding**

- Fold **NEW-021** into **NEW-001**: align Vite aliases with registry TS paths for `aria-utils`, `typeahead`, and `utils`; add a docs build check that catches Vite alias drift.
- Fix **NEW-038** if touching form primitives: trim empty string children in `Field.Description` and `Field.Error`.
- Add a **NEW-039** invariant/warn path for zero enabled Tabs triggers.

**Sprint 1 — Handoff blockers**

- Add **NEW-033** to the app/library handoff blocker set: toasts must remain visible/reachable when a native modal dialog is open. Do not solve this with z-index; either render modal-scoped toasts or move to a top-layer-capable primitive with browser support documented.
- Add **NEW-022** and **NEW-023** to mobile readiness: touch fallback semantics for hover-only affordances and mobile-safe 16px text-control focus sizing.
- Treat **NEW-024** through **NEW-031**: document the browser floor first; only build a `showModal()` fallback if the documented support matrix goes below the Tailwind v4 floor.

**Sprint 2 — Docs content + package surface**

- Merge **NEW-025** and **NEW-044** with **PKG-002**: decide whether docs/handoff artifacts belong in runtime npm packages. If not, exclude `dist/artifacts/` and move hosted/registry artifacts to a separate distribution path.
- Fix **NEW-026**: remove `figlet` from unconditional runtime install cost or document it as an optional subpath dependency contract.
- Keep **NEW-027/028** as package hygiene, not blockers: spinner chunk import and keys source-map policy.

**Sprint 3 — Library correctness**

- Fix **NEW-029** as description-only SSR ARIA drift; do not refactor away the title render-time detection that already works.
- Batch **NEW-040** updates with `requestAnimationFrame` or a proven auto-update utility.
- Align **NEW-043** missing accessible-name policy between Dialog and Popover.

**Sprint 4 — Tooling + governance**

- Add **NEW-032** real-browser coverage: a minimum Playwright matrix for Dialog, Select, Popover/Tooltip, Menu, Tabs, Accordion, CommandPalette, and Toast-over-Dialog; include real-browser a11y and a small visual baseline set.
- Add **NEW-034** CSS architecture work: global layer order declaration plus public z-index tokens for non-modal overlays; document that native modal dialogs sit above document z-index.

**Sprint 5 — DX polish**

- Keep **NEW-035/036/037/042** as TypeScript/IDE polish before public handoff if time allows, but do not classify them beside release/provenance/docs-build blockers.
- Treat **NEW-041** as a measured optimization only after profiling large command palettes.

## 13. Final Verdict After Validation

Audit B's "not handoff-ready" verdict still stands. The third-pass raw section did surface real issues, but its severity was inflated: `NEW-030` is false as written, `NEW-044` duplicates `NEW-025`, and several "Critical" items are High/Medium once the browser floor, current source, and measured package sizes are checked.

The hard handoff blockers are these clusters:

- **Release/publication:** no provenance-capable publish workflow (**REL-001**).
- **Consumer safety:** `dgadd remove/diff` can corrupt installed copy-mode projects (**CLI-001/002/003 + NEW-018**).
- **Public install path:** `diffgazer.com` registry URLs do not resolve (**DIST-001**) and direct shadcn styling contract is not enforced (**NEW-017**).
- **Docs/site:** docs build/prerender/route/metadata contract is broken (**DOCS-002 + NEW-001/021**) and 33/44 public component docs have empty prop tables (**DOCS-001**).
- **Security:** published `diffgazer` CLI still carries consumer-facing Hono advisories (**SEC-001**).
- **Governance/package:** root/license/governance gaps, UI package `./package.json` export, and runtime tarball bloat remain unresolved (**GOV-001, PKG-001/002, NEW-025/026**).
- **User-visible UI readiness:** touch/hover fallbacks, iOS text-control sizing, and toast-over-native-dialog top-layer behavior need fixes or documented constraints (**NEW-022/023/033**).

The final read is more nuanced than both earlier extremes:

- Audit A's "around 80% SOTA and nearly ready" was too optimistic because release, docs, governance, install URLs, and CLI removal safety are not ready.
- The raw third-pass "60-65% SOTA" claim is too punitive because it double-counted package findings and treated multiple DX/legacy-browser items as critical.
- Core library engineering remains strong: keys tests, owner-document discipline in `libs/keys`, native dialog strategy, registry transforms, and CLI atomic write/rollback foundations are legitimately senior-grade.
- Public handoff is still blocked. Treat this as a strong codebase with an unfinished release/docs/package perimeter, not as bad code.

Realistic focused time to handoff-ready: **2-4 weeks**, depending on whether the package-artifact split and real-browser/visual CI are done minimally or as a full public-library hardening pass.
