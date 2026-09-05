# Public Deployment

Production deploys are manual and limited to the public surfaces: docs,
registry, and landing. The product CLI, embedded server, and web app are not
deployed to the VPS.

## Deploy Model

Run production deploys from GitHub Actions:

```text
Deploy Public Surfaces -> Run workflow
```

Inputs:

- `target=docs-registry` builds and deploys docs plus registry from the same
  SHA.
- `target=landing` builds and deploys only the landing page.
- `target=all` builds and deploys all three public surfaces.
- `confirm_production` must equal `deploy`.

The workflow refuses non-`main` refs before checkout, GHCR push, `production`
environment access, or Coolify secret access.

## Images

The build job pushes SHA tags first, scans each pushed image by its manifest
digest, and records that digest for the deploy job. The deploy job runs under the
`production` environment and repoints `:prod` at the recorded digest without
rebuilding, so production runs exactly the bytes that were scanned. Whether that
environment requires a reviewer is a repository setting; the workflow does not
assert it. A rollback reuses the digest records of the run that built and scanned
the requested SHA rather than re-resolving that SHA's mutable tag.

The first deploy of a surface has no `:prod` manifest to snapshot for rollback.
The workflow reports it as a first deploy and promotes it normally; no manual
bootstrap step is needed. A rollback has nothing to restore for that surface, so
it logs an error and leaves `:prod` on the failed first deploy until the next
deploy replaces it.

| Surface | Dockerfile | SHA image | Coolify image | Internal port |
|---|---|---|---|---:|
| Docs | `Dockerfile` | `ghcr.io/b4r7x/diffgazer-docs:<sha>` | `ghcr.io/b4r7x/diffgazer-docs:prod` | 3000 |
| Registry | `deploy/registry.Dockerfile` | `ghcr.io/b4r7x/diffgazer-registry:<sha>` | `ghcr.io/b4r7x/diffgazer-registry:prod` | 8080 |
| Landing | `deploy/landing.Dockerfile` | `ghcr.io/b4r7x/diffgazer-landing:<sha>` | `ghcr.io/b4r7x/diffgazer-landing:prod` | 8080 |

Production must not use Docker Compose, Coolify source-build Dockerfile
resources, or mutable tags such as `latest` and `main`.

## Public Vs Secret

| Item | Where it belongs |
|---|---|
| Public origins such as `REGISTRY_ORIGIN`, `VITE_PUBLIC_ORIGIN`, `VITE_DOCS_ORIGIN`, `VITE_GITHUB_URL` | Docker build args or public workflow configuration |
| GHCR image names and public domains | Repository docs and workflow files |
| `COOLIFY_TOKEN` | GitHub `production` environment secret |
| `COOLIFY_WEBHOOK_DOCS`, `COOLIFY_WEBHOOK_REGISTRY`, `COOLIFY_WEBHOOK_LANDING` | GitHub `production` environment secrets |
| Provider API keys, npm tokens, personal tokens, passwords | Never in deploy workflows, Docker build args, Docker images, or VPS public-surface resources |

Coolify may need GHCR pull credentials if images are private. Use a read-only
packages token for that, not a broad repo token.

## External Setup

GitHub:

- Create a `production` environment with required reviewer approval.
- Store `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_DOCS`,
  `COOLIFY_WEBHOOK_REGISTRY`, and `COOLIFY_WEBHOOK_LANDING` as environment
  secrets.
- Keep the repository artifact-retention setting at 90 days; it caps the deploy
  workflow's digest records and with them the rollback window.
- Protect `main` and require CODEOWNER review for workflow, Dockerfile, and
  deploy-runbook changes.
- Enable GitHub secret scanning and push protection if available.

GHCR:

- Create or let the workflow create the three image packages.
- Images the deploy workflow pushes from this public repository are public on
  creation: anonymous pulls of `ghcr.io/b4r7x/diffgazer-{docs,registry,landing}`
  returned 200 on the first production deploy before any manual step, so no
  visibility change is needed. Configure Coolify with read-only GHCR credentials
  only if a package is made private.
- Keep SHA tags as the audit trail; treat `prod` as the mutable deployment
  pointer.

Coolify:

- Create three Docker Image resources: `diffgazer-docs`,
  `diffgazer-registry`, and `diffgazer-landing`.
- Set each resource image to the matching GHCR `:prod` tag from the table
  above.
- Set Auto Deploy off.
- Set domains, health paths, and the `127.0.0.1` health check host as
  documented in [`deploy/REVERSE_PROXY.md`](./REVERSE_PROXY.md).
- Add the repository variable `REGISTRY_TRAEFIK_PROXY_CIDR` with the exact
  Traefik container address and an unpadded `/32` (IPv4) or `/128` (IPv6)
  prefix. On a Coolify Docker network that is normally a private address such as
  172.18.0.5/32. The registry image validates canonical address spelling and
  bakes this single peer into nginx; supernets such as 10.0.0.0/8,
  172.16.0.0/12, or 192.168.0.0/16, host-bit aliases, and equivalent CIDR
  spellings are rejected by the build. The peer is baked in at build time, so
  after changing it deploy a fresh registry build — a rollback re-promotes an
  image that still trusts the peer of its own build.
- Store each resource webhook in the matching GitHub environment secret.

DNS and firewall:

- Point `docs.diffgazer.b4r7.dev`, `r.b4r7.dev`, and `diffgazer.b4r7.dev` at
  the Coolify proxy/VPS.
- Allow public `80/tcp` and `443/tcp`; keep app container ports private.
- Keep SSH restricted to management access.

## Verification

CI is deliberately short: on every pull request and every push to `main` it
proves the tree builds, generates nothing uncommitted, type-checks, and passes
the unit suites, plus the audit, secret-scan, published-package, and
event-range Gitleaks gates that must never be deferred. One tier up,
`pnpm run release-check` adds `pnpm run check` (Biome, deploy-runbook, Turbo,
dependency-cruiser, and Knip checks), `validate:artifacts:check`,
`test:scripts` and `test:types`, the package smoke (`smoke:packages`), the
provider browser spec on chromium, the four pack dry-runs, `verify:monorepo`,
and the provider transport legacy allowlist; the Release workflow runs it after
a green CI run for a push to `main`, before anything is published, and any
operator can run it locally. The longest proofs stay local and are not wired
into any workflow: the full smoke matrix and the benchmark SLOs
(`pnpm run verify`), the remaining browser suites (per-package `test:e2e`), and
the Lighthouse budgets (`pnpm --filter @diffgazer/docs lighthouse`). The live
registry check is neither: the deploy workflow runs it with
`DIFFGAZER_LIVE_REGISTRY_REQUIRED=1` against the promoted image after a
`docs-registry` or `all` promote and rolls back when it fails, and
`DIFFGAZER_LIVE_REGISTRY_REQUIRED=1 pnpm run registry:live-check` repeats that
proof locally. Deploying gates on a green CI run for the exact SHA, so the fast
gate is the one that must stay fast.

After `docs-registry` or `all`, run:

```sh
curl -fI https://docs.diffgazer.b4r7.dev
curl -fI https://r.b4r7.dev/r/ui/registry.json
curl -fI https://r.b4r7.dev/r/ui/button.json
```

After `landing` or `all`, run:

```sh
curl -fI https://diffgazer.b4r7.dev
```

Before ungating public install commands, also verify:

```sh
curl -fI https://r.b4r7.dev/r/keys/navigation.json
npx shadcn@latest add https://r.b4r7.dev/r/ui/button.json
```

## Rollback

Roll back by re-running the deploy workflow with the `image_sha` input set to the
full commit SHA of the last-good deploy:

```text
Deploy Public Surfaces -> Run workflow
  target              = docs-registry | landing | all
  confirm_production  = deploy
  image_sha           = <full 40-char SHA of the last-good deploy>
```

With `image_sha` set, the workflow skips the build matrix, re-promotes the digests
that SHA's deploy run scanned to `:prod`, triggers the selected Coolify webhooks,
and reruns the post-deploy verification — no local imagetools retagging and no
out-of-band webhook access. Those digest records are requested for 90 days and
capped by the repository's artifact-retention setting; once they expire the
rollback fails and asks for a fresh build instead of promoting an unscanned tag. The rollback SHA is subject to the same CI-green
guard as a fresh deploy: it passed CI when it first landed, and the
workflow re-checks it before promoting. Leaving `image_sha` empty deploys current
`main` HEAD as before.
