# Contributing

Project rules and architectural boundaries live in [`AGENTS.md`](./AGENTS.md). Read it before opening a non-trivial change.

User-facing changes to published packages require a [changeset](https://github.com/changesets/changesets). Run `pnpm changeset` and commit the generated file with your PR.

## Checklist

- [ ] Tests cover the new behavior (unit, integration, or accessibility as appropriate).
  - Run the focused package suite, e.g. `pnpm --filter @diffgazer/ui test`.
- [ ] `pnpm exec turbo run type-check` passes for affected packages.
  - Full gate: `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`.
- [ ] `pnpm exec turbo run test` passes for affected packages.
  - Full gate: `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`.
- [ ] Changeset added when shipping a user-visible change to a published package.
  - `pnpm changeset` — required for `diffgazer`, `@diffgazer/add`, `@diffgazer/ui`, `@diffgazer/keys`. See [PACKAGE_GOVERNANCE.md](./PACKAGE_GOVERNANCE.md#versioning).
  - The PR-side "Changeset status" CI check is intended to be a required branch-protection check on `main` (a maintainer enables it in repository settings); the `changeset-release/main` Version PR is exempt.
- [ ] Public registry, docs, and example consumers updated together with any public API change.
  - Regenerate and validate: `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check`.
- [ ] No commented-out code, dead files, or unrelated drive-by edits.
  - Enforced by review; `git diff --check` catches whitespace errors.

CI runs these gates (build, verify, smoke, `changeset status`, pack dry-runs) in [`.github/workflows/release-readiness.yml`](./.github/workflows/release-readiness.yml). `pnpm run release-check` runs the same no-publish readiness sequence locally.
