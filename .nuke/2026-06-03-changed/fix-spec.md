# Fix Spec — diffgazer-workspace — 2026-06-04
source: .nuke/2026-06-03-changed/findings.md (18 findings: 0 critical / 0 high / 5 medium / 10 low / 3 info)
scorecard: .nuke/2026-06-03-changed/report.md — target after execution: 5/5 in every category

## Executor context (self-contained — assume zero prior knowledge)

- **Project:** Diffgazer — a pnpm + turbo monorepo (`@diffgazer/repo`, `type: module`) for an AI code-review tool. Workspaces: apps (`web`, `docs`, `landing`), libs (`core`, `keys`, `ui`, `registry`), CLIs (`cli/add`, `cli/server`, `cli/diffgazer`). This fix set touches `apps/docs`, `libs/keys`, `libs/ui`, and `libs/registry` only.
- **Stack (exact, from quality-bar.md):** React `^19.2.4` (apps/docs + libs pin `^19.2.0`; peer `react >=19.2.0`) · TypeScript `^5.9.3` (registry `^5.9.0`), `strict: true`, `verbatimModuleSyntax` (explicit `import type`), `noUncheckedIndexedAccess` (NOTE: apps/docs does NOT enable `noUncheckedIndexedAccess`) · Vitest `^4.1.0` (docs `^4.0.0`) + `@testing-library/react ^16.3.2` + `@testing-library/jest-dom ^6.9.1` + `@testing-library/user-event ^14.6.1` + jsdom `^28` (docs `^27`) + `@chialab/vitest-axe`/`axe-core ^4.11.4` · TanStack `@tanstack/react-router ^1.138.0` + `react-start ^1.138.0` on Vite `^7.1.7` + Nitro `^3.0.260429-beta` · fumadocs-core `^16.6.0` + fumadocs-mdx `^14.2.7` · Tailwind v4 `^4.3.0` (CSS-first, CVA `^0.7.1`, clsx, tailwind-merge) · Zod `^4.3.6` · Biome `2.3.14` · pnpm `10.28.2`, turbo `^2.9.14`, Node `>=18`.

### Conventions executors MUST obey (distilled from context.md / AGENTS.md)

- **Architecture boundaries:** `libs/keys` = keyboard/focus behavior; `libs/ui` = shadcn-like UI primitives (must NOT import app code); `libs/registry` = registry contracts + docs-sync engine; `apps/docs` = docs site that CONSUMES core/keys/registry/ui (must consume `@diffgazer/ui`, never mirror it; extract only generic utilities, never docs-specific layout). Do not move app-specific widgets into libs.
- **React rules:** Derive during render; do NOT sync derived state with `useEffect`. Effects only for external-system sync/visibility/lifecycle (each observer must `disconnect()` in cleanup and re-subscribe when deps change). No defensive `useMemo`/`useCallback`/`memo`. Hooks unconditional, before early returns. Prefer stable IDs over object copies. Avoid nested ternaries / long nullish chains in JSX — name the decision with a helper.
- **Keys library rules:** Public keyboard callbacks describe semantic events. Focusable != tabbable. Focus utils respect element `ownerDocument`. Keyboard handlers ignore editable targets unless the component owns the input (the `allowInInput` opt-in).
- **Registry / handoff:** Update source registry files, public registry JSON, docs, examples, generated bundles, AND app consumers TOGETHER on any public API change. Committed `libs/ui/public/r/*.json` and `libs/keys/public/r` are the reviewable handoff contract (committing them is INTENTIONAL).
- **Generated-artifacts policy:** `libs/ui/docs/generated`, `libs/keys/docs/generated`, `cli/add/src/generated` MUST NOT be committed (deterministic generated data). When generated files are missing/stale, run `pnpm run prepare:artifacts` to (re)materialize. Registry example sources in `libs/keys/registry/examples/**` are verbatim-synced into `apps/docs/registry/examples/keys/**` by `prepare:artifacts`; never hand-edit the synced copies.
- **Testing philosophy:** Test user-visible behavior + a11y contracts; query by role/label/text. Do NOT assert Tailwind class names unless the class IS the public API. Hooks/observers: test transitions, cleanup on unmount, re-subscription on id changes.

### Gates (verbatim from context.md — all must pass at every phase exit)

- Keys changes: focused keys tests + `pnpm --filter @diffgazer/keys type-check`
- UI primitive changes: focused UI tests + `pnpm --filter @diffgazer/ui type-check`
- Web adoption changes: focused web tests + `pnpm --filter @diffgazer/web type-check`
- Registry / CLI / docs / public-handoff changes: `pnpm run prepare:artifacts` and `pnpm run validate:artifacts:check`
- apps/docs `type-check` runs `tsc --noEmit && tsc --noEmit -p tsconfig.test.json` (its own package.json). There is NO apps/docs-specific gate line in AGENTS.md; docs changes fall under the docs/public-handoff gate plus the SOTA turbo gates below.
- Before declaring SOTA/ready:
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
  - `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
  - `pnpm run verify:monorepo`
  - (catalog smoke validates the bundled offline snapshot every run; add `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` to also validate the live models.dev fetch, as CI does)
- Always before final response: `git diff --check`

### Rules

- Never run `git add` / `git commit` / `git stash`. Never overwrite unrelated worktree changes — the tree is already dirty; work WITH the existing changes.
- No `.bak` files, no commented-out dead code, no compatibility shims/aliases (pre-first-release repo).
- Fix EVERY task, including low and info severity. Behavior-preserving unless a task explicitly says otherwise.
- Use the strongest model at max effort; cost is not a concern — use as many subagents as needed for the highest quality.
- Edit `libs/keys/registry/examples/**` SOURCE files; never the synced `apps/docs/registry/examples/keys/**` copies (those are regenerated by `prepare:artifacts`).
- Do NOT commit generated artifacts (`libs/{ui,keys}/docs/generated`). After docs/registry edits run `prepare:artifacts` only to validate; leave generated dirs uncommitted.

## Execution protocol (the nuke-fix skill automates this)

For each phase, in order:

1. **Implement.** Run every batch in the phase as parallel implementation subagents — one subagent per batch. Batches within a phase touch DISJOINT files, so they cannot collide. Each subagent receives the full task text (file paths, Change, Accept) for its batch and the Executor context above.
2. **Validate (FRESH subagents — never the implementers).** Dispatch a validation wave: per task, a fresh subagent checks the Accept criteria with `file:line` evidence, re-audits the changed files for any NEW issues introduced by the fix, and runs all gates relevant to the touched packages.
3. **Repair loop.** Any failure -> dispatch fix subagents with the exact findings -> revalidate -> repeat until clean. Cap at 5 cycles; if still failing, STOP and report honestly with the remaining failures.
4. **Advance.** Only after a phase is fully clean do you start the next phase (later phases assume earlier file layout/edits are in place).

After the last phase: run ALL gates (the full SOTA gate list), then one final full-sweep validation wave over every changed file, then a completeness check — every T-### done and every finding ID F-001..F-018 resolved.

## Phases

Ordering rule: structural moves/renames -> DRY extractions & architecture -> local fixes (slop, types, errors, simplicity, dead code) -> tests -> docs/content cleanup. This finding set has no critical/high and no structural moves, so the phases are:

- **Phase 1 — cross-cutting correctness + DRY.** The TOC heading-id collision (F-001) and its dead-key cleanup (F-005), the route-splat DRY helper (F-012), and the docs-sync cache-fingerprint correctness fix (F-018). These touch shared infrastructure that later phases assume.
- **Phase 2 — local fixes (types / errors / slop / simplicity / conventions).** Registry-example correctness/teaching fixes, the lying type guard, the bare-typed doc member, redundant-doc trim, missing frontmatter, and the sidebar component-docs lockstep update.
- **Phase 3 — tests.** Coverage-gap test additions for the TOC observer path, h3/dedupe branches, keys hook-doc example collectors, `findPageNeighbors` separator/folder skip, and the docs-sync re-sync regression test.
- **Phase 4 — docs/content cleanup.** Re-run artifact materialization and confirm committed handoff JSON / generated artifacts are consistent; final validation.

---

### Phase 1 — cross-cutting correctness + DRY

**Batch 1A — TOC + Steps (apps/docs)** — files: `apps/docs/content/docs/app/getting-started/first-review.mdx`, `apps/docs/src/components/toc.tsx`

- [ ] **T-001 (fixes F-001)** — `apps/docs/content/docs/app/getting-started/first-review.mdx`
      Change: The `<Step title="Read the findings">` at line 64 slugifies to id `read-the-findings`, which collides with the markdown `## Read the findings` section at line 102 (fumadocs github-slugger emits the identical id). This produces two elements with `id="read-the-findings"` (invalid duplicate HTML id); the DOM-derived TOC drops the second, and `#read-the-findings` anchors/scroll-spy resolve to the Step instead of the real section. Resolve the collision by renaming the Step title only (do NOT touch the markdown `## Read the findings` heading at line 102, which is the canonical anchor target referenced elsewhere). Change line 64 from `<Step title="Read the findings">` to `<Step title="Open your findings">`. Verify no other `<Step title=...>` on this page slugifies to `open-your-findings` and that the new title still reads naturally with its body copy at line 66.
      Accept: `rg '"Read the findings"' apps/docs/content/docs/app/getting-started/first-review.mdx` returns only the `## Read the findings` markdown heading (line 102), not the Step; the Step title is `Open your findings`. After build/render, `#read-the-findings` resolves uniquely to the markdown section; no two headings on the page share a slug (the Step now slugifies to `open-your-findings`).

- [ ] **T-005 (fixes F-005)** — `apps/docs/src/components/toc.tsx`
      Change: `TocEntry` (lines 16-21) carries a dead `key: string` field used only as the React list key (line 212 `key={entry.key}`). `entriesFromToc` sets `key: item.url` (line 42) and `entriesFromDom` sets `key: id` (line 67), so logically-identical entries flip key across the SSR->DOM swap, forcing needless remounts. `id` is already unique in both builders. Remove the `key` field entirely: (1) delete the `key: string;` member from the `TocEntry` interface (line 20); (2) in `entriesFromToc` drop `key: item.url` so the pushed object is `{ depth: item.depth, title: item.title, id }` (line 42); (3) in `entriesFromDom` drop `key: id` so the pushed object is `{ depth: ..., title: ..., id }` (lines 63-68); (4) at line 212 change `key={entry.key}` to `key={entry.id}`.
      Accept: `rg '\bkey\b' apps/docs/src/components/toc.tsx` shows no `key:` field on `TocEntry` and no `entry.key`; the only `key=` is `key={entry.id}` at the `TocItem`. `pnpm --filter @diffgazer/docs type-check` passes. Existing `toc.test.tsx` cases still pass.

**Batch 1B — route-splat DRY helper (apps/docs)** — files: `apps/docs/src/lib/docs-library.ts`, `apps/docs/src/routes/$lib/$.tsx`, `apps/docs/src/routes/$lib/index.tsx`, `apps/docs/src/layouts/sidebar.tsx`

- [ ] **T-012 (fixes F-012)** — `apps/docs/src/lib/docs-library.ts`, `apps/docs/src/routes/$lib/$.tsx`, `apps/docs/src/routes/$lib/index.tsx`, `apps/docs/src/layouts/sidebar.tsx`
      Change: The route-splat derivation `url.split("/").slice(2).join("/")` (inverse of `docsPath`) is hand-duplicated across new/changed sites: `splatFromUrl` defined at `$.tsx:174-176` and `sidebar.tsx:131-133`, and inline at `index.tsx:20` (`firstPage.url.split("/").slice(2).join("/")`). Add one exported helper in `apps/docs/src/lib/docs-library.ts` directly after `docsPath` (which ends at line 157):
      ```ts
      /** Inverse of docsPath: a docs page url ("/{library}/{...slugs}") to the TanStack route _splat ("{...slugs}"). */
      export function routeSplatFromDocsPath(url: string): string {
        return url.split("/").slice(2).join("/");
      }
      ```
      Then: (a) in `$.tsx` delete the local `function splatFromUrl` (lines 174-176), import `routeSplatFromDocsPath` from `@/lib/docs-library`, and replace the two `splatFromUrl(previous.url)` / `splatFromUrl(next.url)` call sites (lines 196, 214) with `routeSplatFromDocsPath(...)`; (b) in `sidebar.tsx` delete the local `function splatFromUrl` (lines 131-133), import the helper, and replace its call site(s) with `routeSplatFromDocsPath(...)`; (c) in `index.tsx` replace the inline `firstPage.url.split("/").slice(2).join("/")` (line 20) with `routeSplatFromDocsPath(firstPage.url)` and add the import. Do NOT touch `apps/docs/src/features/home/home-data.ts` (out of audit scope, divergent spelling, pre-existing). Confirm imports use `import { routeSplatFromDocsPath } from "@/lib/docs-library"` and that `$.tsx`/`sidebar.tsx` no longer declare `splatFromUrl`.
      Accept: `rg 'splatFromUrl' apps/docs/src` returns ZERO matches; `rg 'routeSplatFromDocsPath' apps/docs/src` shows one export in `docs-library.ts` plus three consumer imports/uses ($.tsx, index.tsx, sidebar.tsx); `rg '\.split\("/"\)\.slice\(2\)' apps/docs/src` matches only the helper body in `docs-library.ts`. `pnpm --filter @diffgazer/docs type-check` and the docs sidebar/route tests pass; previous/next links still resolve to the same splats.

**Batch 1C — docs-sync cache fingerprint (libs/registry)** — files: `libs/registry/src/docs/cache.ts`, `libs/registry/src/docs/index.ts`

- [ ] **T-018 (fixes F-018)** — `libs/registry/src/docs/cache.ts`, `libs/registry/src/docs/index.ts`
      Change: `extraRootPages` (and `rootTitle`) are appended to root `content/docs/meta.json` `pages` by `writeRootMeta` (sync-operations.ts:201-216) but are NOT part of `computeSyncFingerprint` (cache.ts:13-32) — which hashes only `origin`, `syncSchemaVersion`, and per-ARTIFACT manifest/fingerprint. Authored non-artifact root pages (e.g. `...app`) never reach the fingerprint, so a config-only change with byte-identical artifact manifests leaves the fingerprint unchanged on a warm cache; `shouldSkipSync` returns true, `writeRootMeta` never runs, and the root `pages` array goes stale (wrong sidebar nav / `firstNavigablePage` redirect target). Fix the cache key:
      (1) In `cache.ts`, extend `computeSyncFingerprint`'s signature to accept the two scalar inputs and hash them deterministically. Change the signature to:
      ```ts
      export function computeSyncFingerprint(
        origin: string,
        syncSchemaVersion: number,
        artifacts: LoadedLibraryArtifacts[],
        extraRootPages: string[] = [],
        rootTitle?: string,
      ): string {
      ```
      and after the existing `hash.update(`sync-schema:${syncSchemaVersion}\n`);` (line 20), add (before the `for (const artifact of artifacts)` loop):
      ```ts
        hash.update(`root-title:${rootTitle ?? ""}\n`);
        hash.update(`extra-root-pages:${extraRootPages.join(",")}\n`);
      ```
      (Use `.join(",")` to preserve order/count sensitivity — reorder, add, remove, and rename all change the hash.)
      (2) In `index.ts`, pass the values at the call site (lines 51-55):
      ```ts
        const syncFingerprint = computeSyncFingerprint(
          origin,
          syncSchemaVersion,
          artifacts,
          extraRootPages ?? [],
          rootTitle,
        );
      ```
      (`extraRootPages` and `rootTitle` are already destructured from `options` at index.ts:26-27.)
      Accept: editing `extraRootPages` (add/remove/reorder/rename an entry) or `rootTitle` between two `syncDocsFromArtifacts` runs with unchanged artifact manifests yields a DIFFERENT `syncFingerprint`, so `shouldSkipSync` returns false and `writeRootMeta` re-runs (asserted by the new T-018b test). `pnpm --filter @diffgazer/registry type-check` passes; all existing `docs-sync.test.ts` cases still pass; `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` pass with the committed root `content/docs/meta.json` unchanged.

---

### Phase 2 — local fixes (types / errors / slop / simplicity / conventions)

**Batch 2A — Steps type guard (apps/docs)** — files: `apps/docs/src/components/docs-mdx/blocks/steps.tsx`

- [ ] **T-006 (fixes F-006)** — `apps/docs/src/components/docs-mdx/blocks/steps.tsx`
      Change: The `Steps` filter predicate (lines 25-27) over-claims `ReactElement<StepProps>` with only an `isValidElement(child)` check and no `child.type === Step` identity check — a lying guard (a non-Step valid element would be typed as carrying `title`). Mirror the repo's own sound pattern (breadcrumbs.tsx / stepper.tsx). Change the filter at lines 25-27 to:
      ```ts
      const steps = Children.toArray(children).filter(
        (child): child is ReactElement<StepProps> =>
          isValidElement(child) && child.type === Step,
      );
      ```
      `Step` is declared in the same file (exported `function Step` at line 38), so it is in scope inside `Steps`. Leave `index = 0` default and the `cloneElement(step, { index, key: step.props.title })` call unchanged.
      Accept: the predicate includes `&& child.type === Step`. `pnpm --filter @diffgazer/docs type-check` passes; all existing MDX pages using `<Steps><Step .../></Steps>` still render their step list (no Step is dropped). `rg 'child.type === Step' apps/docs/src/components/docs-mdx/blocks/steps.tsx` matches.

**Batch 2B — keys registry examples (libs/keys)** — files: `libs/keys/registry/examples/use-key/use-key-scoped.tsx`, `libs/keys/registry/examples/use-focus-restore/use-focus-restore-fallback.tsx`, `libs/keys/registry/examples/use-scope/use-scope-nested.tsx`, `libs/keys/registry/examples/use-focus-trap/use-focus-trap-initial-focus.tsx`

- [ ] **T-007 (fixes F-007)** — `libs/keys/registry/examples/use-key/use-key-scoped.tsx`
      Change: The example binds `useKey("ctrl+s", ..., { containerRef: cardRef, focusWithinOnly: true, preventDefault: true })` (lines 12-16) and instructs the user to focus the textarea then press Ctrl+S — but the only focusable element inside the card is the editable `<textarea>`, so the editable-target guard (`isEditable && !allowInInput` -> `continue`) skips the handler and `saved` never increments. Add `allowInInput: true` to the options object so the container-scoped Ctrl+S fires while the textarea is focused. The options object (lines 12-16) becomes:
      ```ts
      useKey("ctrl+s", () => setSaved((n) => n + 1), {
        containerRef: cardRef,
        focusWithinOnly: true,
        preventDefault: true,
        allowInInput: true,
      })
      ```
      Accept: the options include `allowInInput: true`. Following the printed instruction ("Click into the textarea, then press Ctrl+S") increments `saved` and prevents the native save. `pnpm --filter @diffgazer/keys type-check` passes. (Do NOT edit the synced `apps/docs/registry/examples/keys/...` copy — `prepare:artifacts` regenerates it.)

- [ ] **T-011 + T-013 (fixes F-011, F-013)** — `libs/keys/registry/examples/use-focus-restore/use-focus-restore-fallback.tsx`
      Change: Two defects in this one file, fixed together. (F-011) The comment at lines 11-12 claims "No opener button: the palette is summoned from a global shortcut in real apps" but the file renders a literal `<button onClick={openPalette}>Summon palette</button>` (lines 32-34), and that button is `document.activeElement` at capture time, so the `fallback` branch is never exercised. (F-013) `useFocusRestore({ fallback: anchorRef.current })` (line 13) reads `anchorRef.current` during render — an AGENTS.md react-useref violation — and refs are still `null` on the first render, so the canonical `fallback` example actually configures `fallback: null` until some later re-render refreshes the hook's options. The hook API is `useFocusRestore({ fallback?: HTMLElement | null })`; `capture(ownerDocument?)` takes NO per-call fallback (verified: `libs/keys/src/hooks/use-focus-restore.ts:17,74`), and options are re-read at event time via an options ref updated each render (`use-focus-restore.ts:72`). Therefore hold the anchor element in STATE via a callback ref so the configured `fallback` is a live element without any render-time `ref.current` read:
      (1) Line 8: replace `const anchorRef = useRef<HTMLDivElement>(null)` with `const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)`. Keep the `useRef` import — `paletteRef` (line 9) still uses it.
      (2) Line 13: replace `const focusRestore = useFocusRestore({ fallback: anchorRef.current })` with `const focusRestore = useFocusRestore({ fallback: anchor })`.
      (3) Line 28: replace `ref={anchorRef}` with `ref={setAnchor}` on the editor-surface div. Leave `openPalette`/`closePalette` (lines 15-24) unchanged — `capture()` stays argument-less.
      (4) Replace the false comment at lines 11-12 with narration describing what the button-driven demo actually shows:
      ```ts
      // Summon opens the palette and captures the current focus. On close, focus
      // returns there; `fallback` (the editor surface) catches the case where
      // nothing was focused at open time so focus never lands on <body>.
      ```
      Accept: the `fallback` option receives a state-held element (callback ref `ref={setAnchor}`); no `ref.current` is read during render anywhere in the file; the comment no longer claims "No opener button" and accurately describes the button-driven demo and the fallback's role. `pnpm --filter @diffgazer/keys type-check` passes. (Do NOT edit the synced apps/docs copy.)

- [ ] **T-014 (fixes F-014)** — `libs/keys/registry/examples/use-scope/use-scope-nested.tsx`
      Change: `Page` renders `<Drawer>` unconditionally (line 15) and `Drawer` calls `useScope("drawer")` unconditionally (line 22), so the "drawer" scope is always active and the page-scope `useKey("Escape", () => setLog("page Escape"))` (line 10) can never fire — contradicting the prose "Escape here logs from the page" (line 14). Make the drawer conditionally mounted so the page-scope Escape is genuinely reachable when the drawer is closed. In `Page`: add `const [drawerOpen, setDrawerOpen] = useState(false)`, render an Open/Close toggle button, and render `{drawerOpen && <Drawer ... />}` instead of the unconditional `<Drawer>`. Concretely, rewrite `Page` (lines 6-18) to:
      ```tsx
      function Page() {
        const [log, setLog] = useState("page")
        const [drawerOpen, setDrawerOpen] = useState(false)

        // Lives in the global scope; fires only while no deeper scope is active.
        useKey("Escape", () => setLog("page Escape"))

        return (
          <div>
            <p>Escape here logs from the page. Open the drawer to see a deeper scope win.</p>
            <button type="button" onClick={() => setDrawerOpen((open) => !open)}>
              {drawerOpen ? "Close drawer" : "Open drawer"}
            </button>
            {drawerOpen && <Drawer log={log} setLog={setLog} />}
          </div>
        )
      }
      ```
      Leave `Drawer`/`Dialog` otherwise intact (they still demonstrate dialog > drawer precedence when the drawer is open).
      Accept: with the drawer closed, pressing Escape logs "page Escape"; opening the drawer and pressing Escape logs "drawer Escape" (then dialog when opened). The page-scope handler is reachable. `pnpm --filter @diffgazer/keys type-check` passes. (Do NOT edit the synced apps/docs copy.)

- [ ] **T-015 (fixes F-015)** — `libs/keys/registry/examples/use-focus-trap/use-focus-trap-initial-focus.tsx`
      Change: The example demonstrates `initialFocus` by pointing it at the destructive Confirm button of a delete dialog (line 12 `initialFocus: confirmRef`, `confirmRef` on `<button>Confirm</button>` line 33; body text "opens with focus on Confirm" line 29), contradicting the same hook page's new a11y guidance (use-focus-trap.mdx:52: "for a destructive prompt, point it at Cancel rather than Confirm"). Convert the example to a NON-destructive action so it still demonstrates `initialFocus` overriding the default first-focusable element without teaching the destructive anti-pattern. Make these edits: (a) the trigger button text (line 17) from `Delete item` to `Edit item`; (b) `aria-label` (line 25) from `Confirm delete` to `Save changes`; (c) the body `<p>` text (line 29) from "This dialog opens with focus on Confirm." to "This dialog opens with focus on Save. Tab stays inside; Esc is up to you."; (d) the second button (lines 33-35) label from `Confirm` to `Save` (keep `ref={confirmRef}`); optionally rename `confirmRef`->`saveRef` consistently across declaration (line 9), the hook option (line 12), and the button ref (line 33) for clarity. The structural demonstration (initialFocus targeting the non-default, second button) is preserved.
      Accept: the dialog is a non-destructive Save/Cancel dialog; `initialFocus` still targets the second (Save) button so it demonstrates overriding the default; no destructive verb (Delete/Confirm-delete) remains; the example no longer contradicts use-focus-trap.mdx:52. `pnpm --filter @diffgazer/keys type-check` passes. (Do NOT edit the synced apps/docs copy.)

**Batch 2C — keys hook-doc type + scroll-lock dedupe (libs/keys docs)** — files: `libs/keys/docs/hook-docs/use-action-row-navigation.ts`, `libs/keys/docs/content/hooks/use-scroll-lock.mdx`

- [ ] **T-008 (fixes F-008)** — `libs/keys/docs/hook-docs/use-action-row-navigation.ts`
      Change: The `getActionProps` return-type string (line 149) is `'(index: number) => { ref; "data-action-index": number; onFocus: () => void }'` — the `ref` member is bare/untyped, the sole un-annotated inline-object member in the whole hook-docs corpus. The actual source declares `ref: RefCallback<HTMLElement>` (libs/keys/src/hooks/use-action-row-navigation.ts:93). Annotate it to match: change line 149 to
      ```ts
      type: '(index: number) => { ref: RefCallback<HTMLElement>; "data-action-index": number; onFocus: () => void }',
      ```
      (This is a documentation string only — `RefCallback` need not be imported in this file; it appears inside a quoted string rendered verbatim in the API reference.)
      Accept: `rg '\{ ref;' libs/keys/docs/hook-docs/use-action-row-navigation.ts` returns nothing; the `getActionProps` type string contains `ref: RefCallback<HTMLElement>`. `pnpm --filter @diffgazer/keys type-check` passes; the rendered ReturnsTable shows the typed `ref`.

- [ ] **T-009 (fixes F-009)** — `libs/keys/docs/content/hooks/use-scroll-lock.mdx`
      Change: The page states the reference-counting mechanic three times (intro line 7, auto-rendered `<Notes />` from use-scroll-lock.ts:34, and the new "Refcounted release" Edge-cases bullet line 50). Drop ONLY the redundant Edge-cases bullet (line 50, "**Refcounted release.** Each enabled `useScrollLock` ... when the last lock releases ...") so the page matches its siblings (whose Edge cases add distinct facts). Keep the "**Toggling `enabled`.**" bullet (line 51). After deletion the `## Edge cases` section (lines 48-51) retains only the Toggling-enabled bullet. Do not touch the intro paragraph (line 7) or the Notes source.
      Accept: `## Edge cases` in use-scroll-lock.mdx contains only the "Toggling `enabled`" bullet; the "Refcounted release" bullet is gone. The page still renders the refcounting fact via the intro and the Notes block. `pnpm run prepare:artifacts` + `pnpm run validate:artifacts:check` pass.

**Batch 2D — libs/ui sidebar docs lockstep + frontmatter (libs/ui)** — files: `libs/ui/registry/component-docs/sidebar.ts`, `libs/ui/docs/content/changelog.mdx`, `libs/ui/docs/content/contributing.mdx`

- [ ] **T-017 (fixes F-017)** — `libs/ui/registry/component-docs/sidebar.ts`
      Change: This change set added the public `terminal` Sidebar variant (in the `SidebarVariant` union, CVA, VariantGlyph, registry JSON, registry.json, and the components/sidebar.mdx intro) and bumped this file's top `description` from "five" to "six active-marker variants" (line 5) — but three sub-fields still advertise only five variants, so the rendered API reference is self-contradictory and understates the public union. Update all three in lockstep with the new variant:
      (1) **Visual variants note** (line 49): change the opening from "Five active-marker variants share row metrics ..." to "Six active-marker variants share row metrics ...", and append a `terminal` clause to the enumeration after `block (...)`, e.g. `, terminal (\`>\` prompt prefix on active; 1px hairline left rail, no bg fill)`. Keep the rest of the sentence (`Selected via <Sidebar variant=...>...exposed as data-variant...`) intact.
      (2) **props.Sidebar.variant.type** (line 90): change the literal from `'"caret" | "inverted" | "bar" | "bracket" | "block"'` to `'"caret" | "inverted" | "bar" | "bracket" | "block" | "terminal"'` so the published API type matches the `SidebarVariant` union.
      (3) **props.Sidebar.variant.description** (lines 93-94): append a `terminal` clause matching the union, e.g. add `; "terminal" prefixes active items with a \`>\` prompt and draws a 1px hairline left rail with no background fill` before the trailing "Propagated to items via context ..." sentence.
      Cross-check the exact `terminal` glyph/visual wording against `libs/ui/registry/lib/sidebar-variants.ts` (the CVA `terminal` branch) and `libs/ui/registry/ui/sidebar/sidebar-item.tsx` (the `terminal` VariantGlyph, `>` when active) so the prose is accurate.
      Accept: `rg -c terminal libs/ui/registry/component-docs/sidebar.ts` >= 3 (note + type + description); the variant `type` string is a 6-member union including `"terminal"`; the Visual-variants note says "Six". `pnpm --filter @diffgazer/ui type-check` passes; the UI sidebar test suite passes; `pnpm run prepare:artifacts` regenerates `libs/ui/docs/generated/components/sidebar.json` with the six-variant type/note/description consistently (generated file stays uncommitted), and `pnpm run validate:artifacts:check` passes.

- [ ] **T-016 (fixes F-016)** — `libs/ui/docs/content/changelog.mdx`, `libs/ui/docs/content/contributing.mdx`
      Change: This change set removed the `description:` frontmatter line from both files, making them the only two of 93 libs/ui docs pages without one (breaking the uniform per-page description / SEO convention; both now emit the generic site description and render no header subtitle). Restore a page-specific `description:` to each frontmatter block (the deleted values were "Release notes for @diffgazer/ui." and "How to contribute to @diffgazer/ui."). In `changelog.mdx`, the frontmatter (lines 1-3) becomes:
      ```
      ---
      title: Changelog
      description: Release notes for @diffgazer/ui.
      ---
      ```
      In `contributing.mdx`, the frontmatter (lines 1-3) becomes:
      ```
      ---
      title: Contributing
      description: How to contribute to @diffgazer/ui.
      ---
      ```
      Accept: `rg -L '^description:' libs/ui/docs/content/changelog.mdx libs/ui/docs/content/contributing.mdx` shows both files have a `description:` line; scanning all `libs/ui/docs/content/*.mdx` finds zero pages lacking `description:`. `pnpm run prepare:artifacts` + `pnpm run validate:artifacts:check` pass.

---

### Phase 3 — tests

**Batch 3A — TOC tests (apps/docs)** — files: `apps/docs/src/components/toc.test.tsx`

- [ ] **T-002 + T-003 (fixes F-002, F-003)** — `apps/docs/src/components/toc.test.tsx`
      Change: The existing four cases render every heading synchronously before `TableOfContentsPanel` mounts, so they only exercise the one-shot `sync()` and never (F-002) the `MutationObserver` refresh path that production relies on (Suspense-loaded MDX injects headings AFTER mount), and never (F-003) the `entriesFromDom` h3-depth branch (toc.tsx:64 `depth = H3 ? 3 : 2`) or the duplicate-id `seen`-Set dedupe (toc.tsx:60-62). FIRST read the existing `toc.test.tsx` (especially `renderWithHeadings` lines 17-31 and how `#main-content` is set up) to match its setup/query conventions. Then add behavior cases (using `@testing-library/react` + `waitFor`, querying by role/link text, not implementation):
      (1) **Observer refresh (F-002):** render the panel with an empty (or markdown-only) `#main-content`, then after mount append an `h2[id]` element into `#main-content` and `waitFor` the corresponding TOC link to appear — asserting the MutationObserver-driven refresh. Add a companion case that REMOVES a heading after mount and asserts its link disappears.
      (2) **h3 depth (F-003):** render an `h3[id]` heading and assert it appears in the TOC at the nested depth (use whatever public signal the existing tests use for depth — e.g. the rendered `TocItem` depth/indentation attribute or class the suite already asserts; if depth is not observable via a public query, assert the h3's link is present and its `depth` prop path is exercised through a rendered nested item the way sibling tests do). 
      (3) **Dedupe (F-003):** render two headings sharing one `id` and assert exactly ONE TOC link is produced for that id.
      Reuse the existing helpers/`#main-content` container; do not assert Tailwind classes unless the suite already treats them as public API.
      Accept: `apps/docs/src/components/toc.test.tsx` contains a case that appends an `h2[id]` post-mount and waits for the new link; a case that removes a heading post-mount; a case rendering an `h3[id]` asserting nested inclusion; and a case with two same-id headings asserting one link. All cases pass under `pnpm --filter @diffgazer/docs test` (focused on toc.test). A regression that broke the observer wiring (wrong target, dropped `subtree:true`, broken signature dedupe, missing re-subscription) now fails at least one test.

**Batch 3B — docs-tree + docs-library tests (apps/docs)** — files: `apps/docs/src/lib/docs-tree.test.ts`, `apps/docs/src/lib/docs-library.test.ts`

- [ ] **T-010 (fixes F-010)** — `apps/docs/src/lib/docs-tree.test.ts`
      Change: All three `findPageNeighbors` fixtures (lines 116-131) are flat `type:"page"` lists with no separator between pages and no folder, so the separator/folder-skip behavior `findPageNeighbors` relies on in production (the mapped tree always interleaves separators) is only covered transitively via `firstNavigablePage`. Add a `findPageNeighbors` case inside the existing `describe("findPageNeighbors", ...)` block (after line 163) whose fixture interleaves `separator` nodes (and at least one `folder` with a page child) between pages, and assert that `previous`/`next` for a middle page still resolve to the adjacent navigable PAGES (skipping the separator/folder), matching the separator-bearing tree the pager receives in production. Model the fixture on the production shape (separators labeling following sections, a folder containing a page) — reuse the `PageTree` type already imported at the top of the file.
      Accept: a new `findPageNeighbors` test with a separator+folder-bearing fixture asserts prev/next resolve to adjacent pages across the boundary. `pnpm --filter @diffgazer/docs test` (focused on docs-tree.test) passes including the new case; flipping `flattenPageTree`'s separator/folder skip would now fail it.

- [ ] **T-004 (fixes F-004)** — `apps/docs/src/lib/docs-library.test.ts`
      Change: The example-reference guard collectors are UI-only, so the keys hook-doc `examples[]` arrays (added/edited in this change set across 8 keys hooks + the new `use-action-row-navigation`) have zero drift coverage — a future typo/rename in a keys example name would throw at page render with no failing test. Generalize the collectors so the existing missing-example assertions (lines 303-313, 315-322) also cover keys. Specifically:
      (1) `collectExampleNamesFromHookDocs` (lines 60-71): also scan `libs/keys/docs/hook-docs` (in addition to `libs/ui/registry/hook-docs`) — iterate both directories.
      (2) `collectHookDocExampleCounts` (lines 73-89): also include `libs/keys/docs/hook-docs` files so per-hook counts cover keys hooks.
      (3) `collectHookPagesWithExamplesSection` (lines 91-101): also scan `libs/keys/docs/content/hooks` for pages containing `<Examples />`.
      (4) `collectExampleFileNames` (lines 151-161): also include `libs/keys/registry/examples` `.tsx` files so referenced keys example names resolve to on-disk files.
      Prefer parametrizing each collector by library root (e.g. accept the registry/content base dirs) or simply unioning both libraries' directories. Keep the assertions at lines 303-322 unchanged — they will now transitively cover keys.
      Accept: with a deliberate temporary typo in any keys hook-doc `examples[].name`, the "fails static validation when component, hook docs, or pages reference missing examples" test (line 303) FAILS (revert the typo after confirming). With the real tree, all `docs-library.test.ts` cases pass. `rg 'libs/keys/docs/hook-docs|libs/keys/docs/content/hooks|libs/keys/registry/examples' apps/docs/src/lib/docs-library.test.ts` shows the keys directories are now scanned by the relevant collectors. `pnpm --filter @diffgazer/docs test` passes.

**Batch 3C — docs-sync re-sync regression test (libs/registry)** — files: `libs/registry/src/testing/docs-sync.test.ts`

- [ ] **T-018b (fixes F-018)** — `libs/registry/src/testing/docs-sync.test.ts`
      Change: The two existing `extraRootPages` tests (lines 305-345) run on a fresh `mkdtemp` root with no prior state file, exercising only the cold/fresh sync path — they never exercise the warm-cache skip path that T-018 fixes. Add a regression test that proves changing `extraRootPages` between runs (with unchanged artifacts) forces a re-sync and rewrites the root `meta.json` `pages`. FIRST read the test file's helpers (`createLibraryFixture`, `syncDocsFromArtifacts` usage, `runSync`, the `docsRoot`/`workspaceRoot` setup) to match conventions. Then add a case in the same `describe` block: (1) run `syncDocsFromArtifacts` once with `extraRootPages: ["...app"]` and assert `result.synced === true` and root `meta.json` `pages` ends with `"...app"`; (2) run it AGAIN with identical artifacts but `extraRootPages: ["...app", "...guides"]` (or a reordered/renamed list) and assert the SECOND result `synced === true` (the fingerprint changed, so it did NOT skip) and that root `meta.json` `pages` now reflects the new extra pages. Because the state file persists across the two calls in the same temp root, this directly exercises the warm-cache path through `computeSyncFingerprint`/`shouldSkipSync`. (This test FAILS against the pre-T-018 code — the second run would skip with stale `pages` — and PASSES after T-018.)
      Accept: the new test runs two `syncDocsFromArtifacts` calls against the same root with changed `extraRootPages` and asserts the second run re-syncs and rewrites `pages`. It fails if T-018's fingerprint change is reverted. `pnpm --filter @diffgazer/registry test` (focused on docs-sync) passes; all existing cases still pass.

---

### Phase 4 — docs/content cleanup & final materialization

**Batch 4A — artifact materialization + verification (whole repo)** — files: none edited directly (validation/regeneration only)

- [ ] **T-FINAL (verifies F-001, F-004, F-008, F-009, F-016, F-017, F-018 handoff outputs)** — repo-wide
      Change: No source edits in this batch. Run `pnpm run prepare:artifacts` to (re)materialize the deterministic generated data affected by the docs edits (e.g. `libs/ui/docs/generated/components/sidebar.json` for T-017, keys hook-doc/example JSON for T-004/T-008/T-009, and the apps/docs synced keys example copies for T-007/T-011/T-013/T-014/T-015) and confirm the regenerated outputs are internally consistent. Then run `pnpm run validate:artifacts:check`. Confirm the committed handoff JSON (`libs/ui/public/r/*.json`, `libs/keys/public/r`) and the tracked root `content/docs/meta.json` are unchanged by the source fixes (none of these tasks change a public registry value, so they must stay byte-stable). Do NOT commit anything under the generated dirs (policy: generated artifacts are not committed).
      Accept: `pnpm run prepare:artifacts` succeeds; `pnpm run validate:artifacts:check` passes; `git status --short` shows no NEW staged/committed generated-artifact files beyond the existing committed handoff contract; the committed handoff JSON and root `meta.json` are unchanged vs their pre-fix content.

---

## Final gate sequence (run after Phase 4, all must pass)

- `pnpm --filter @diffgazer/keys type-check` and focused keys tests (Phase 2 batch 2B/2C touched keys)
- `pnpm --filter @diffgazer/ui type-check` and focused UI tests (Phase 2 batch 2D)
- `pnpm --filter @diffgazer/registry type-check` and focused registry tests (Phase 1 batch 1C, Phase 3 batch 3C)
- `pnpm --filter @diffgazer/docs type-check` and focused docs tests (Phases 1-3 docs work)
- `pnpm run prepare:artifacts` and `pnpm run validate:artifacts:check`
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
- `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
- `pnpm run verify:monorepo`
- `git diff --check`

## Coverage map

- F-001 -> T-001
- F-002 -> T-002 (batch 3A)
- F-003 -> T-003 (batch 3A)
- F-004 -> T-004
- F-005 -> T-005
- F-006 -> T-006
- F-007 -> T-007
- F-008 -> T-008
- F-009 -> T-009
- F-010 -> T-010
- F-011 -> T-011 (batch 2B, combined with T-013)
- F-012 -> T-012
- F-013 -> T-013 (batch 2B, combined with T-011)
- F-014 -> T-014
- F-015 -> T-015
- F-016 -> T-016
- F-017 -> T-017
- F-018 -> T-018 (fingerprint fix) + T-018b (regression test) ; handoff output re-checked in T-FINAL

All 18 findings (F-001..F-018), including the 3 info-severity findings (F-006, F-009, F-011), map to at least one task.
