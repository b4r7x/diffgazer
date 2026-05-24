# Global Context (Mandatory Pre-Read for Every Subagent)

This file is the curated extract of AGENTS.md, TESTING.md, PACKAGE_GOVERNANCE.md, and the React/TypeScript conventions used across the Diffgazer monorepo. Read it before reading your brief.

If you find a contradiction between this file and the canonical files (AGENTS.md etc.) at repo root, the canonical files win — but report the contradiction.

## Repo Layout

```
diffgazer-workspace/
├── apps/
│   ├── docs/    — TanStack Start + Fumadocs MDX docs site (`@diffgazer/docs`)
│   └── web/     — Diffgazer product web app (`@diffgazer/web`)
├── cli/
│   ├── add/     — `@diffgazer/add` CLI, binary `dgadd`
│   └── diffgazer/ — `diffgazer` CLI (Hono + Ink)
├── libs/
│   ├── core/    — shared utilities, schemas, hooks (private)
│   ├── keys/    — `@diffgazer/keys` keyboard hooks (PUBLIC)
│   ├── registry/ — `@diffgazer/registry` build engine (private)
│   ├── server/  — Hono server (private)
│   └── ui/      — `@diffgazer/ui` React UI components (PUBLIC)
└── scripts/monorepo/ — invariant + smoke scripts
```

## Architecture Boundaries (enforced)

- `libs/keys` owns keyboard-first behavior. Independent of UI.
- `libs/ui` may import `@diffgazer/keys` (peer). MUST NOT import app code.
- `apps/web` composes. Owns product-specific copy/flows.
- `libs/registry` owns registry contracts.
- `cli/add` owns user-facing CLI.

**Forbidden imports:**
- libs ↛ apps (no `libs/*` import from `apps/*`)
- libs/ui ↛ libs/core (UI must not import app utilities)
- Any file outside the brief's allowlist

## React Rules (apply to ALL TSX/TS in libs/ui and libs/keys)

1. **Derive values during render. Do not sync derived state with `useEffect`.**
2. **Events for user actions; effects for external system sync only.**
3. **`useRef` for non-render mutable values, DOM handles, stale-closure escape hatches.**
4. **Do NOT add `useMemo`/`useCallback`/`memo` defensively.** Only for measured performance, stable context values, or real referential contracts.
5. **Hooks must be called unconditionally and before early returns.**
6. **Store stable IDs, not object copies.**
7. **Prefer union state over multiple booleans for status.**
8. **No nested ternaries or long nullish chains in JSX.** Name the decision with a helper if needed.
9. **React 19 native:** no `forwardRef` — `ref` is a regular prop. Use `useEffectEvent` for stale-closure-in-async/event-handler scenarios.

## Keys Library Specific Rules

- Public keyboard callbacks describe the semantic event, not the implementation: `onNavigate`, `onHighlightChange`, `onNavigationBoundaryReached`, `onZoneChange`.
- Focusable and tabbable are different concepts. Tab cycling uses tabbable only; programmatic focus may include `tabIndex={-1}`.
- Focus utilities respect element `ownerDocument`, NOT global `document`.
- Scopes must be registered before hooks that rely on the active scope.
- Keyboard handlers ignore editable targets unless the component explicitly owns the input interaction.
- Navigation utilities accept disabled/skipped items and preserve DOM/user-visible order.

## UI Library Specific Rules

- Build PRIMITIVES that compose. Keep repeated app layouts in `apps/web`.
- Components preserve accessible roles, labels, descriptions, invalid/disabled state, keyboard behavior, form submission semantics.
- `Field` owns label/control/description/error ARIA wiring. Controls MERGE external ARIA props, not replace them.
- Compound components keep public state names semantic.
- Direct shadcn/copy consumers must receive source that builds without unpublished package-only assumptions.
- Package consumers must receive complete exports, declarations, CSS/source contracts, peer dependency behavior.

## Public UI API Conventions

- Value controls: `value`, `defaultValue`, `onChange(value)` — pass the VALUE, not the event.
- Native wrappers (Input, Textarea): keep native handlers — `onChange(event)`.
- Non-value state: `open`/`onOpenChange`, `highlighted`/`onHighlightChange`, `selectedId`/`onSelect`, `onNavigate`.
- Boolean form controls (Checkbox, Radio): `checked`/`defaultChecked`/`onChange(checked)`; `value: string` is form-submission value.
- Group primitives (CheckboxGroup, RadioGroup): standard `value`/`defaultValue`/`onChange(value)`.

**No deprecated aliases before first public customer-facing release.** Rename in place, update all docs, examples, registry, generated bundles, app consumers.

## Testing Rules (Vitest 4)

1. **Test behavior, not implementation.** Assert on what consumers see — rendered output, accessible roles/labels/text, returned values from public APIs, fired events. Never assert on internal state, private function calls, ref internals, or call counts (unless count IS the contract — annotate with `// call-count IS the contract:`).

2. **Accessible queries in priority order:**
   ```
   getByRole > getByLabelText > getByPlaceholderText > getByText > getByDisplayValue > getByAltText > getByTitle > getByTestId
   ```
   `getByTestId` is last resort; `querySelector` is anti-pattern (with documented exceptions for focus-movement tests in `libs/keys` and structural assertions on no-accessible-role elements).

3. **Fewer, longer tests.** One test covering a complete user flow > five micro-step tests. Use `it.each` with parameterized titles for parameterizable cases (include EVERY parameter in the title so failing iterations are bisectable).

4. **Boundary mocks ONLY.** `vi.mock(...)` is allowed at system boundaries (network/fs/subprocess/keychain/timers/browser-only APIs/external libs). Every retained mock MUST carry `// Boundary mock: <why>` comment.

5. **`userEvent` over `fireEvent`.** `fireEvent` retained only for animation/transition events, synthetic dialog events, coordinate-based hit-detection, pointer/touch event-type tests, hover under fake timers. Each retained `fireEvent` MUST carry `// fireEvent retained: <why>` comment.

6. For keys library: test ACTUAL focus movement (`expect(document.activeElement).toBe(...)`), active descendant, boundary callbacks, editable-target behavior, disabled/skipped items.

7. For registry/CLI: test copy/package/direct public registry paths and removal ownership.

## TypeScript Conventions

- `strict: true` everywhere.
- ZERO `as any`, ZERO `@ts-ignore`, ZERO `@ts-nocheck`.
- `@ts-expect-error` ONLY with a comment explaining why.
- No non-null assertion `!` unless absolutely necessary AND commented.
- Prefer overloads over union casts for function signatures.
- `export type { X }` for type-only exports (`verbatimModuleSyntax`).
- Generic constraints: tight where possible (`<T extends string>`, not `<T>`).

## Anti-Slop Rules

1. **No unnecessary comments.** Comments explain WHY (non-obvious constraint, subtle invariant, workaround for specific bug). Never restate WHAT the code does.
2. **No over-engineering.** Three similar lines is better than a premature abstraction. No factories for one object. No configuration for hardcoded values.
3. **No defensive over-coding.** Don't null-check non-nullable types. Don't try/catch infallible ops. Don't add fallbacks that hide bugs.
4. **No AI voice.** No "enhances", "ensures", "robust", "graceful", "comprehensive" in comments or identifiers. No "Here we...", "Let's...", "First we...".
5. **No dead code.** Remove unused imports, unused exports, unreachable branches.
6. **No verbose patterns.** Use `??` not `condition ? value : default-value`. Use `>0 &&` not `length && value` (handles 0).

## Generated Artifacts Policy

- DO NOT commit deterministic generated data under:
  - `libs/ui/docs/generated`
  - `libs/keys/docs/generated`
  - `cli/add/src/generated`
- DO commit public registries (reviewable handoff contract):
  - `libs/ui/public/r/*.json`
  - `libs/keys/public/r/*.json`
- Run `pnpm run prepare:artifacts` before artifact validation or root tests when generated files are missing or stale.
- After modifying a registry source file, regenerate the public registry:
  - `pnpm --filter @diffgazer/ui build:shadcn`
  - `pnpm --filter @diffgazer/keys build:shadcn`

## Verification Gates (run after your changes)

- After keys changes: `pnpm --filter @diffgazer/keys test && pnpm --filter @diffgazer/keys type-check`
- After UI changes: `pnpm --filter @diffgazer/ui test && pnpm --filter @diffgazer/ui type-check && pnpm --filter @diffgazer/ui validate:registry`
- After web changes: `pnpm --filter @diffgazer/web test && pnpm --filter @diffgazer/web type-check`
- After registry/CLI changes: `pnpm run prepare:artifacts && pnpm run validate:artifacts:check && pnpm --filter @diffgazer/add test`
- Before final response: `git diff --check`

## Git Discipline

- Do NOT git commit, git stage, git stash, git push, or open PRs unless the brief EXPLICITLY says so. The leader handles git.
- If the brief instructs you to commit, use HEREDOC for commit messages and include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- NEVER use `--no-verify`, `--no-gpg-sign`, `git rebase -i`, or `git reset --hard`.
- NEVER push to main without explicit instruction.

## Common Tasks Cheatsheet

### Adding a file to a UI component
1. Edit `libs/ui/registry/ui/<component>/<file>.tsx`.
2. Edit `libs/ui/registry/ui/<component>/<file>.test.tsx` (behavior test).
3. Regenerate: `pnpm --filter @diffgazer/ui build:shadcn` (or `build:declarations` if types only).
4. Verify: `pnpm --filter @diffgazer/ui test -- <component>` and `validate:registry`.

### Adding a hook to libs/keys
1. Edit `libs/keys/src/hooks/<file>.ts`.
2. Edit `libs/keys/src/hooks/<file>.test.ts`.
3. Export from `libs/keys/src/index.ts` if public.
4. Verify: `pnpm --filter @diffgazer/keys test && type-check`.
5. If public and intended for copy/shadcn: regenerate via `pnpm --filter @diffgazer/keys build:shadcn`.

### Adding a CLI command/flag
1. Edit `cli/add/src/commands/<command>.ts`.
2. Edit `cli/add/src/commands/cli-behavior.test.ts` (spawn-based integration).
3. Verify: `pnpm --filter @diffgazer/registry build && pnpm --filter @diffgazer/add test`.
4. Live repro in `/tmp/<unique-name>` per the brief's verification.

## When the Verification Commands in Your Brief Fail

1. Read the error carefully. Don't bypass.
2. Check if the brief documents the failure mode.
3. If your change introduced the failure, fix YOUR change.
4. If the failure is pre-existing, note it in your Report under `Follow-up tasks needed`.
5. Never `--no-verify` to ship.

## React 19 Features You Can Use

- `useEffectEvent` (stable in 19.2) — for stale-closure-in-effect/handler.
- `useFormStatus` — for form-action pending state.
- `useActionState` — for form action results.
- `useOptimistic` — for optimistic UI.
- `use()` — for resource reading inside Suspense.
- `useDeferredValue` / `useTransition` — for non-urgent updates.
- `<title>`, `<meta>`, `<link>` as JSX — hoisted to head.
- `ref` as a regular prop — no `forwardRef`.

If your brief asks for these and you don't know them, read https://react.dev/blog/2024/04/25/react-19 first.
