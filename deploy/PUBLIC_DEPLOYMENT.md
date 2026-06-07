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

The workflow refuses non-`main` refs before checkout, GHCR push, production
environment approval, or Coolify secret access.

## Images

The build job pushes SHA tags first and scans those pushed images. After the
`production` environment approval, the deploy job promotes the scanned SHA tags
to `:prod` without rebuilding.

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
| Public origins such as `REGISTRY_ORIGIN`, `VITE_PUBLIC_ORIGIN`, `VITE_REGISTRY_ORIGIN`, `VITE_DOCS_ORIGIN` | Docker build args or public workflow configuration |
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
- Protect `main` and require CODEOWNER review for workflow, Dockerfile, and
  deploy-runbook changes.
- Enable GitHub secret scanning and push protection if available.

GHCR:

- Create or let the workflow create the three image packages.
- Choose public image visibility, or configure Coolify with read-only GHCR
  credentials for private images.
- Keep SHA tags as the audit trail; treat `prod` as the mutable deployment
  pointer.

Coolify:

- Create three Docker Image resources: `diffgazer-docs`,
  `diffgazer-registry`, and `diffgazer-landing`.
- Set each resource image to the matching GHCR `:prod` tag from the table
  above.
- Set Auto Deploy off.
- Set domains and health paths as documented in
  [`deploy/REVERSE_PROXY.md`](./REVERSE_PROXY.md).
- Store each resource webhook in the matching GitHub environment secret.

DNS and firewall:

- Point `docs.b4r7.dev`, `r.b4r7.dev`, and `diffgazer.b4r7.dev` at the Coolify
  proxy/VPS.
- Allow public `80/tcp` and `443/tcp`; keep app container ports private.
- Keep SSH restricted to management access.

## Verification

After `docs-registry` or `all`, run:

```sh
curl -fI https://docs.b4r7.dev
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

Rollback docs and registry together:

```sh
docker login ghcr.io
docker buildx imagetools create --tag ghcr.io/b4r7x/diffgazer-docs:prod ghcr.io/b4r7x/diffgazer-docs:<sha>
docker buildx imagetools create --tag ghcr.io/b4r7x/diffgazer-registry:prod ghcr.io/b4r7x/diffgazer-registry:<sha>
```

Then trigger the docs and registry Coolify webhooks and rerun the docs plus
registry health checks.

Rollback landing separately:

```sh
docker login ghcr.io
docker buildx imagetools create --tag ghcr.io/b4r7x/diffgazer-landing:prod ghcr.io/b4r7x/diffgazer-landing:<sha>
```

Then trigger the landing Coolify webhook and rerun the landing health check.
