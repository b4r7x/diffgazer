# UI-005: Registry, Package, Docs, CSS, And Examples Handoff

Priority: P0

## Problem

Handoff surfaces are not equivalent enough for copy, CLI, npm/package, docs, and shadcn-style usage.

Known gaps:

- Component API reference sections render empty because generated component docs hardcode `props: {}` and docs block returns null.
- `dialog.css` is not wired for direct shadcn install.
- `logo/figlet` is package-only but docs advertise it while copy/dgadd users do not receive it.
- Package-mode declaration rewriting can leave public declarations depending on hidden `_types` hook shims.
- `Select` card docs say always-visible inline list, but implementation/example are collapsed unless `defaultOpen/open` is provided.
- `SelectTags` docs claim removable chips, but implementation renders plain spans.
- `CommandPalette` docs claim uncontrolled usage without a clear public trigger/default-open example.
- `useListbox` docs omit current `items` and `getItemId` options.
- `input-form` example teaches manual label/id wiring instead of `Field`.
- Hidden `Portal` examples import non-public paths.
- Install docs use inconsistent `npm view` wording.

Evidence:

- `libs/ui/scripts/build-docs-data.ts`
- `apps/docs/src/components/docs-mdx/blocks/props-table-block.tsx`
- `libs/ui/docs/generated/components/*.json`
- `libs/ui/registry/registry.json`
- `libs/ui/public/r/*.json`
- `libs/ui/package.json`
- `libs/ui/tsup.config.ts`
- `libs/ui/scripts/build-declarations.ts`
- `libs/ui/registry/component-docs/**`
- `libs/ui/registry/examples/**`
- `libs/ui/docs/content/**`

## Required Fix

- Generate or author truthful props/API references.
- Ensure CSS and helper files are available in every advertised install mode or document mode-specific limits.
- Make docs/examples match runtime behavior.
- Ensure declaration rewriting matches JS package rewriting for keys integration.
- Remove stale hidden examples or make them public intentionally.

## Tests And Validation

Add or update validators where possible:

- props table data is non-empty for public components with props;
- public examples do not import hidden non-public paths;
- package declarations do not reference hidden shims unless intentionally exported;
- registry CSS/helper closure is checked.

Run:

```bash
pnpm run prepare:artifacts
pnpm --filter @diffgazer/ui validate:registry
pnpm run validate:artifacts:check
pnpm --filter @diffgazer/ui type-check
```
