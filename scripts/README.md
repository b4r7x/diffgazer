# Monorepo Scripts

`scripts/monorepo/` holds the invariant checks, artifact validators, smokes, and
benchmarks that verify the single-repository Diffgazer workspace.

Tests for the modules in this directory:

```bash
pnpm run test:scripts
```

## Source of Truth

The repo-wide gates these modules back (`verify:monorepo`, `validate:artifacts`,
`smoke:*`, `bench`, `release-check`, `test-ci`) are wired through the root
`package.json`; see it for the authoritative invocation list. Gates that read
generated artifacts run through `scripts/monorepo/run-with-artifacts.sh`, so
invoke the prepared wrapper (`validate:artifacts`) rather than its bare
`:check` variant on a fresh clone.
