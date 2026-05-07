# RDY-001: Public Distribution Endpoints Are Deferred Until Deployment

Area: Distribution and public handoff

Severity: Deferred, not a current implementation blocker

Effort: M

## Problem

The public npm and hosted registry paths advertised to users are not currently usable because publication and deployment are intentionally not done yet. This is expected current state and should not block the present implementation pass.

Keep this as a future deployment task: once npm packages and registry hosting are deployed, the public docs/snippets should be promoted and verified.

## Evidence

- `npm view @diffgazer/add version --json` returned npm `E404` on 2026-05-06.
- `npm view @diffgazer/ui version --json` returned npm `E404` on 2026-05-06.
- `npm view @diffgazer/keys version --json` returned npm `E404` on 2026-05-06.
- `curl -I --max-time 8 https://ui.diffgazer.com/r/accordion.json` failed DNS resolution on 2026-05-06.
- `curl -I --max-time 8 https://keys.diffgazer.com/r/navigation.json` failed DNS resolution on 2026-05-06.
- Public commands appear in docs and READMEs, for example `libs/ui/README.md:7`, `libs/ui/README.md:38`, `cli/add/README.md:26-32`, and `libs/ui/docs/content/utils/shadcn-namespace.mdx:13-14`.

## User Impact

Until deployment, external users cannot use public npm or hosted registry URLs. For the current implementation pass, this is handled by using local/package-fixture smoke tests and by avoiding claims that public endpoints are live.

## Fix

Defer publication and hosting to the deployment phase, and keep public snippets clearly marked or gated until then.

Recommended fix:

- Publish `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys` during the deployment phase.
- Configure DNS and hosting for `ui.diffgazer.com` and `keys.diffgazer.com` during the deployment phase.
- Add release checks that query npm and hosted registry URLs before docs are promoted as public.
- Keep local development snippets clearly separate from public snippets until deployment is complete.

## Acceptance Criteria

- `npm view @diffgazer/add version --json` returns the intended published version.
- `npm view @diffgazer/ui version --json` returns the intended published version.
- `npm view @diffgazer/keys version --json` returns the intended published version.
- `curl -I https://ui.diffgazer.com/r/accordion.json` returns 200.
- `curl -I https://keys.diffgazer.com/r/navigation.json` returns 200.
- Docs do not show a public command unless that command is verified in CI.

## Verification

Create a clean temporary project and run:

- `npm create vite@latest`
- `npx @diffgazer/add@latest init`
- `npx @diffgazer/add@latest add ui:button`
- `npx @diffgazer/add@latest add keys:navigation`
- Build and type-check the consumer project.
