# 06 — Docs Handoff

> Implement only this brief. Do not run git add/commit/stage/stash.

## Goal

Make docs and READMEs explain the three user paths for both `libs/ui` and `libs/keys`, with current publish-gated status and per-item install metadata.

## Required Skills

- `/code-audit`
- `/clean-code`
- `/code-quality`
- `/anti-slop`
- `/sota`
- `/test-behavior-not-implementation`

## Required Reading

- `README.md`
- `libs/ui/README.md`
- `libs/keys/README.md`
- `cli/add/README.md`
- `apps/docs/config/docs-libraries.json`
- `apps/docs/src/lib/docs-library.ts`
- `apps/docs/src/components/docs-mdx/blocks/install-command.tsx`
- `libs/ui/docs/content/**`
- `libs/keys/docs/content/**`
- `libs/ui/registry/component-docs/**`
- `libs/ui/registry/hook-docs/**`

## Write Ownership

```text
README.md
libs/ui/README.md
libs/keys/README.md
cli/add/README.md
apps/docs/config/**
apps/docs/content/**
apps/docs/src/lib/**
apps/docs/src/components/docs-mdx/**
libs/ui/docs/content/**
libs/keys/docs/content/**
libs/ui/registry/component-docs/**
libs/ui/registry/hook-docs/**
libs/ui/scripts/build-docs-data.ts
libs/keys/scripts/**
```

## Required Behavior

### Part A: Canonical consumption block

Add a reusable docs model/block for consumption options:

- manual copy/direct shadcn,
- `dgadd`,
- npm package.

Each option must support:

- library (`ui` or `keys`),
- item id,
- item kind,
- package import,
- copy path,
- `dgadd` item name,
- publish-gated status,
- unsupported path with reason,
- CSS notes for UI,
- no-CSS note for keys.

### Part B: READMEs must show all three paths

Update root, UI, Keys, and CLI READMEs with a short matrix for both libraries.

Current npm status must say public npm commands are publish-gated until `npm view` returns versions. Local tarballs are the package-mode validation path before publish.

### Part C: Per-item docs

Component, hook, and utility pages must present the three-path status.

Special cases:

- provider-backed keys APIs are package-only unless a future copy contract exists,
- UI package mode always requires `@diffgazer/keys` peer for components that use keys,
- UI copy mode must explain keys integration mode when applicable.

### Part D: Registry lib docs

Public `registry:lib` items must either have docs or be hidden/internalized.

Known missing docs candidates:

- `diff`
- `focus`
- `input-variants`
- `resolve-tab-target`
- `search`
- `selectable-variants`
- `step-status`

### Part E: Docs app navigation

Remove or disable docs targets that route to missing content. Known issue: docs app advertises `diffgazer` library while synced docs contain `ui` and `keys`.

### Part F: Props/API docs

Do not render empty "API Reference" sections. Either generate props, author them, or hide the section when no data exists.

### Part G: Framework setup

Docs must explain:

- UI manual copy CSS,
- UI `dgadd` CSS,
- UI npm package CSS (`sources.css`, `styles.css`),
- Vite setup,
- Next/PostCSS setup,
- Keys requires no CSS/Tailwind setup.

## Tests

Add docs checks for:

- every public UI component/hook/lib has consumption metadata,
- every public keys hook/API has consumption metadata,
- pages do not show public npm commands without publish gate while npm returns E404,
- no docs library points to missing content,
- no empty API Reference heading is rendered.

## Verification

```bash
pnpm run prepare:artifacts
pnpm --filter @diffgazer/docs test
pnpm --filter @diffgazer/docs type-check
pnpm --filter @diffgazer/docs build
pnpm run validate:artifacts:check
git diff --check
```

