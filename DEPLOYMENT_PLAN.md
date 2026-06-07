# Deployment Plan

This file is intentionally kept as a compatibility pointer for older notes.
The previous deployment plan used Coolify source/compose-style deployment and
auto-deploy assumptions. That model is obsolete.

The current production source of truth is:

- [`deploy/PUBLIC_DEPLOYMENT.md`](deploy/PUBLIC_DEPLOYMENT.md)
- [`deploy/REVERSE_PROXY.md`](deploy/REVERSE_PROXY.md)
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

Current production model:

- manual GitHub Actions deploy only
- three separate Coolify Docker Image resources
- GHCR images promoted from scanned SHA tags to `:prod`
- docs and registry deployed together from the same SHA
- landing deployable separately
- no Docker Compose production path
- no Coolify source-build production resources
- no Coolify Auto Deploy for production
