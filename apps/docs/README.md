# @diffgazer/docs

Private documentation app for the Diffgazer product docs and the synced `@diffgazer/ui` and `@diffgazer/keys` library docs. Authored app docs live under `content/docs/app`; library docs are pulled from `libs/ui` and `libs/keys` artifacts by `prepare:generated`, so `content/docs/ui` and `content/docs/keys` are generated sync outputs.

## Generated data

`pnpm --filter @diffgazer/docs prepare:generated` runs `scripts/prepare-generated.mjs`. It rebuilds library artifacts unless `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1` is set and the needed workspace artifacts already exist, then runs `scripts/sync-artifacts.mjs`, the logo ASCII generator, and the section-index generator.

Artifact sync mode is automatic by package resolvability. Set `DIFFGAZER_ARTIFACT_SYNC_MODE=workspace` or `DIFFGAZER_ARTIFACT_SYNC_MODE=package` to force a mode.

## Environment

| Variable | Effect |
| --- | --- |
| `DOCS_PRERENDER=0` | Disables TanStack Start prerender in `vite.config.ts`. |
| `REGISTRY_ORIGIN` | Overrides the hosted registry origin written into synced library install metadata. Defaults to `https://r.b4r7.dev`. |
| `VITE_PUBLIC_ORIGIN` | Sets SEO canonical URLs and sitemap/robots output. Defaults to `https://docs.b4r7.dev`. |
| `DIFFGAZER_DEV=1` | In dev server mode, watches library `dist/artifacts` directories and reruns `prepare:generated` after artifact changes. |
| `PLAYWRIGHT_PORT` | Port used by the built-site Playwright server. Defaults to `4173`. |

## Commands

```bash
pnpm --filter @diffgazer/docs dev
pnpm --filter @diffgazer/docs build
pnpm --filter @diffgazer/docs preview
pnpm --filter @diffgazer/docs test
pnpm --filter @diffgazer/docs type-check
pnpm --filter @diffgazer/docs test:e2e
```

`build` runs `prepare:generated`, `vite build`, sitemap/robots generation, and CSP verification. `test:e2e` expects a built `.output/public` tree and serves `.output/server/index.mjs` so the Nitro headers are tested.
