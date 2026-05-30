# Findings: dry-reuse

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

### F312 — [NEW] [type-safety] Type mismatch: WebTheme excludes 'terminal' but core Theme includes it

- **file:line** — `apps/web/src/types/theme.ts:1-8`
- **What** — WebTheme is defined as 'auto' | 'dark' | 'light', but the component ThemeSelectorContent and ThemeProvider actually use the full Theme type ('auto' | 'dark' | 'light' | 'terminal') from @diffgazer/core/schemas/config. The theme provider converts 'terminal' to 'dark' as a workaround.
- **Why** — The local type narrows away a value the components actually handle, so the declared type contradicts runtime behavior and the 'terminal' case is unrepresented.
- **How** — Replace the WebTheme type definition with an import from core's Theme type, or explicitly import and use Theme from @diffgazer/core/schemas/config and update ThemeContextValue to reflect the full range of valid values with proper documentation about the terminal → dark mapping for web UI.
- **Effort** — low

---

## Medium

### F66 — [NEW] [dry] Duplicate cn() utility in apps/docs/registry/lib/utils.ts

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/apps/docs/registry/lib/utils.ts:1-6`
- **What** — The file defines a `cn()` function that is an exact duplicate of `libs/ui/registry/lib/utils.ts:1-6`, but this copy appears to be unused. The vite.config.ts at line 87 aliases `@/lib/utils` to `src/lib/utils` (which re-exports from @diffgazer/ui), not to registry/lib/utils.ts.
- **Why** — An unused exact-duplicate utility adds dead code that can drift from the canonical source and confuse future consumers about which copy is authoritative.
- **How** — Delete `/Users/voitz/Projects/diffgazer-workspace/apps/docs/registry/lib/utils.ts` entirely. All components in apps/docs/registry already import via the `@/lib/utils` alias which correctly resolves to the src-level re-export of @diffgazer/ui/lib/utils.
- **Effort** — low

### F192 — [NEW] [reusability] Registry hooks and utilities intentionally duplicated between libs/ui/registry and apps/docs/registry

- **file:line** — `libs/ui/registry/hooks/use-listbox.ts:1-436 (and 15 other identical hooks)`
- **What** — 16 identical utility files (use-listbox.ts, use-typeahead-buffer.ts, use-focus-trap.ts, use-focus-restore.ts, use-overflow.ts, use-overflow-items.ts, use-presence.ts, use-floating-position.ts, use-active-heading.ts, use-form-reset.ts, use-outside-click.ts, use-navigation.ts, use-floating-indicator.ts, use-is-mobile.ts, use-controllable-state.ts) and 15 identical lib files (utils.ts, aria-utils.ts,…
- **Why** — Many byte-identical files maintained in two locations will diverge silently unless an enforced sync or shared source keeps them aligned.
- **How** — Consider: (1) Extract these hooks/utilities to a separate shared registry package (libs/registry-hooks) that both libs/ui/registry and apps/docs/registry depend on and re-export; (2) Or enforce strict artifact sync in the build pipeline with a pre-commit hook that fails if apps/docs/registry files diverge from libs/ui/registry; (3) Or document in CONTRIBUTING.md that registry files must be synced …
- **Effort** — high

### F313 — [NEW] [dry] InputMethod type duplicated: defined in apps/web instead of using core export

- **file:line** — `apps/web/src/types/input-method.ts:1-2`
- **What** — InputMethod type and INPUT_METHODS constant are defined locally in apps/web/src/types/input-method.ts as: const INPUT_METHODS = ["paste", "env"] as const; export type InputMethod = (typeof INPUT_METHODS)[number]; However, the identical definition already exists and is exported from @diffgazer/core/onboarding/types.ts.
- **Why** — Re-declaring a type and constant that core already exports duplicates the source of truth and lets the two copies diverge.
- **How** — Remove apps/web/src/types/input-method.ts and replace all imports of InputMethod and INPUT_METHODS in apps/web with imports from @diffgazer/core/onboarding. Update imports in: apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts, use-api-key-form.ts, and apps/web/src/components/shared/api-key-method-selector.tsx.
- **Effort** — low

### F314 — [NEW] [dry] Multiple theme type definitions scattered across packages

- **file:line** — `libs/core/src/schemas/config/settings.ts:23-25, apps/web/src/types/theme.ts:1, cli/diffgazer/src/features/settings/components/theme-selector.tsx:4`
- **What** — Theme type is defined in three different locations with different scopes: (1) core has Theme = 'auto' | 'dark' | 'light' | 'terminal'; (2) web has WebTheme = 'auto' | 'dark' | 'light' (subset); (3) CLI has CliTheme = 'auto' | 'dark' | 'light' (subset). Each package defines its own narrowed version instead of using or extending the core definition.
- **Why** — Three independent theme type definitions can drift from the core definition, leaving consumers with inconsistent and unverified value sets.
- **How** — Keep the single Theme definition in core. For web and CLI packages that intentionally support a subset, create explicit type aliases or branded types that reference the core Theme type with documented constraints. For example: 'export type WebTheme = Theme & ('auto' | 'dark' | 'light');' or create a validation function that asserts theme validity. Document why 'terminal' is excluded from web.
- **Effort** — medium

---

## Low

### F193 — [NEW] [reusability] App-local theme types not exported from @diffgazer/core

- **file:line** — `apps/web/src/types/theme.ts:1-8`
- **What** — apps/web defines WebTheme ('auto'|'dark'|'light'), ResolvedTheme ('dark'|'light'), and ThemeContextValue types locally instead of sharing from @diffgazer/core. libs/core defines Theme schema via ThemeSchema and exports Theme = z.infer<typeof ThemeSchema>.
- **Why** — Defining theme context types per app foregoes a shared contract that core could own, encouraging duplicate and divergent definitions across packages.
- **How** — Export the theme context types from @diffgazer/core/theme or @diffgazer/core/schemas/config, and have apps/web import from there. Update ThemeContextValue to be either: (1) a shared schema type re-exported from core, or (2) moved to core/theme and re-exported. Ensure this type is used across apps/web, cli/diffgazer, and any other package that manages theme state.
- **Effort** — medium

### F194 — [NEW] [reusability] Query client factory duplicated between apps/web and cli/diffgazer without shared config

- **file:line** — `apps/web/src/lib/query-client.ts:1-22 and cli/diffgazer/src/lib/query-client.ts:1-18`
- **What** — Both apps/web and cli/diffgazer define createWebQueryClient() and createCliQueryClient() with different default options (staleTime, retry, refetchOnWindowFocus, networkMode) but identical structure. Each is tightly bound to its specific environment, but the QueryClient instantiation pattern is repeated.
- **Why** — The repeated instantiation structure has no shared base, so common wiring is maintained twice even though only a few options legitimately differ.
- **How** — Create @diffgazer/core/api or @diffgazer/core/hooks export a createQueryClientBase(overrides?) that accepts a partial options object, and have both apps override specific keys. Or document in API guide why these factories differ and should be kept separate.
- **Effort** — low

### F315 — [NEW] [dry] Test setup files have minor duplication of ResizeObserver polyfill

- **file:line** — `apps/web/src/test-setup.ts:6-12, apps/landing/src/test-setup.ts`
- **What** — ResizeObserver polyfill logic is defined in apps/web/src/test-setup.ts (lines 6-12) but not in apps/landing/src/test-setup.ts. Both define afterEach cleanup identically. The UI library's test-setup.ts (libs/ui/test-setup.ts) provides a more complete polyfill setup using vi.stubGlobal and additional window.matchMedia mocking.
- **Why** — Polyfill and cleanup setup copied across test-setup files drifts apart, leaving some app test suites with incomplete or inconsistent environment shims.
- **How** — Create a shared test-setup utility in @diffgazer/core or a dedicated test-utilities package that both apps import. Alternatively, document the required polyfills and ensure all app test-setup files include them consistently. Consider if the UI's more complete setup (vi.stubGlobal, matchMedia, HTMLDialogElement polyfills) should be shared.
- **Effort** — low
