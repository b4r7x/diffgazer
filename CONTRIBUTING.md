# Contributing

Project rules and architectural boundaries live in [`AGENTS.md`](./AGENTS.md). Read it before opening a non-trivial change.

Diffgazer is maintained but not in active development. If a fix or a small correction comes in, it gets merged; open an issue before starting a feature so the work is not wasted.

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
  - Branch protection for `main` must require the `CI / Build, Type-Check, and Test` status check for contributor PRs; a required check that no workflow reports blocks every merge. The Version PR is opened with `GITHUB_TOKEN`, so GitHub gives it zero CI checks; its merged-main push is verified post-merge, with exact-SHA manual recovery available if needed.
- [ ] Public registry, docs, and example consumers updated together with any public API change.
  - Regenerate and validate: `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check`.
- [ ] No commented-out code, dead files, or unrelated drive-by edits.
  - Enforced by review; `git diff --check` catches whitespace errors.

CI runs these gates (audit, secret scan, build, dirty-tree guard, package checks, `changeset status` and changeset coverage on pull requests, type-check, tests, `git diff --check`) in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml), plus a separate event-range Gitleaks job. `pnpm run release-check` is the longer chain the Release workflow runs after a green CI run on `main`, before publishing; any operator can run it locally. It adds `pnpm run check`, `validate:artifacts:check`, `test:scripts`, `test:types`, the package smoke (`smoke:packages`), the provider Playwright spec on chromium, `verify:monorepo`, and the four pack dry-runs, and it omits the event-range Gitleaks scan and the dirty-tree guard. The full smoke matrix and the benchmark SLOs (`pnpm run verify`), the remaining browser suites (per-package `test:e2e`), and the Lighthouse budgets (`pnpm --filter @diffgazer/docs lighthouse`) stay local.
