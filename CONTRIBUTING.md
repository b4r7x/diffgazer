# Contributing

Project rules and architectural boundaries live in [`AGENTS.md`](./AGENTS.md). Read it before opening a non-trivial change.

User-facing changes to published packages require a [changeset](https://github.com/changesets/changesets). Run `pnpm changeset` and commit the generated file with your PR.

## Checklist

- [ ] Tests cover the new behavior (unit, integration, or accessibility as appropriate).
- [ ] `pnpm exec turbo run type-check` passes for affected packages.
- [ ] `pnpm exec turbo run test` passes for affected packages.
- [ ] Changeset added when shipping a user-visible change to a published package.
- [ ] Public registry, docs, and example consumers updated together with any public API change.
- [ ] No commented-out code, dead files, or unrelated drive-by edits.
