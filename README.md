<h1 align="center">Diffgazer</h1>

<p align="center">
  <img src="docs/assets/logo.png" alt="Diffgazer logo" width="112" />
</p>

Local AI code review. Run one command, get a review from AI agents, and keep the app on your machine.

![Diffgazer demo](https://raw.githubusercontent.com/b4r7x/diffgazer/8119889d53f4a1457f0156d658e0bf08429e7f00/docs/assets/diffgazer-demo.gif)

## Why

I wanted my own code reviewer. Tools like Claude Code and Codex are great for writing code, but burning tokens on review when you could spend them building felt wrong.

Code review matters, especially now that we're all shipping AI-generated code faster than we can read it. Solo devs rarely get their code reviewed. Privacy, fear of judgment, or just nobody around. Diffgazer is my answer to that.

Run one command, get a review. Only the diff and prompt content go to the provider you choose.

## Features

- **Local-first review** - the CLI starts an embedded server and web UI on localhost.
- **Review pipeline** - diff, context, review, enrich, and report steps run in order.
- **Web and terminal modes** - the browser UI by default; the Ink terminal UI (`--tui`) is in beta and still catching up (see [terminal UI](https://docs.b4r7.dev/app/tui)).
- **Issue details** - read findings inline against your diff with evidence and fix guidance.
- **Provider choice** - nine selectable hosted API products (see [providers reference](https://docs.b4r7.dev/app/reference/providers)).
- **Privacy controls** - localhost binding, host allowlist, CSRF protection, per-run token, explicit repo trust, and server-only secret/admission boundaries.
- **Registry and packages** - `@diffgazer/ui`, `@diffgazer/keys`, and `dgadd` support copy-first and package consumption paths.

## Quick Start

```bash
npm install -g diffgazer
cd your-project
diffgazer
```

First run walks you through product selection, endpoint binding, authentication, exact model selection, the provider consent, and repo trust.

### Free models

Free tiers throttle. Z.AI's free Flash models allow one concurrent request (Diffgazer knows this and caps them to one dispatch at a time), and free OpenRouter models rate-limit under parallel load. Review agents run sequentially by default (`agentExecution: "sequential"`), and with a free model that's the setting to keep. Switch to `parallel` only on a paid tier that actually allows concurrent requests. See the [configuration reference](https://docs.b4r7.dev/app/reference/configuration).

Diffgazer is also a pnpm monorepo for the CLI, docs app, shared registry tooling, keyboard hooks, and UI packages.

## Workspace

- `cli/diffgazer` - public `diffgazer` CLI
- `cli/add` - public `@diffgazer/add` installer, binary `dgadd`
- `cli/server` - private `@diffgazer/server` embedded Hono backend
- `libs/core` - private `@diffgazer/core` shared schemas and utilities
- `libs/ui` - public `@diffgazer/ui` package
- `libs/keys` - public `@diffgazer/keys` package
- `libs/registry` - private `@diffgazer/registry` workspace library
- `apps/docs` - documentation app
- `apps/web` - private `@diffgazer/web` product frontend
- `apps/landing` - private `@diffgazer/landing` landing page

## Source Setup

```bash
git clone https://github.com/b4r7x/diffgazer.git
cd diffgazer
pnpm install
pnpm run build
```

The root build prepares shared registry and documentation artifacts once before Turbo starts the
parallel package builds. Focused package builds are not self-contained: a direct
`pnpm --filter @diffgazer/add build` skips workspace dependencies, and the bundle scripts it runs
import the compiled `@diffgazer/registry`, which no clean checkout carries. Run the root build, or at
least `pnpm --filter @diffgazer/registry build`, before any focused `@diffgazer/add` build or pack.

## Development

```bash
pnpm run docs:dev
pnpm run web:dev
pnpm run diffgazer:dev
pnpm run type-check
pnpm run test
pnpm run verify
```

This repository is one workspace with a single root install and lockfile.

## Consumption Paths

`@diffgazer/ui`, `@diffgazer/keys`, and `@diffgazer/add` are publish-gated: public npm commands for these packages are valid only after `npm view` returns versions. Publish status is per package; see [PACKAGE_GOVERNANCE.md](./PACKAGE_GOVERNANCE.md) for the current matrix. Local tarballs are the package-mode validation path before publication.

| Path | @diffgazer/ui | @diffgazer/keys |
|------|---------------|-----------------|
| Manual copy / shadcn | All components, hooks, libs | Standalone hooks only |
| `dgadd` CLI | All components, hooks, libs | Standalone hooks only |
| npm package | All exports | All exports (including provider-backed APIs) |

### Copy-first mode (`dgadd`)

`dgadd` is publish-gated, so there is no `dgadd` bin at the workspace root. Before publication, pack the CLI and install the tarball into the target app, which is what puts `dgadd` on `pnpm exec`.

From this repository:

```bash
pnpm --filter @diffgazer/registry build
pnpm --filter @diffgazer/add build
pnpm --filter @diffgazer/add pack --pack-destination /tmp/diffgazer-packs
```

From the target app:

```bash
pnpm add -D /tmp/diffgazer-packs/diffgazer-add-*.tgz
pnpm exec dgadd init
pnpm exec dgadd add ui/button keys/navigation
```

Copy mode installs source files the consuming app owns. UI components require Tailwind CSS v4 and the copied `src/styles/styles.css`. Keys standalone hooks require no CSS setup. After `@diffgazer/add` is published, use `npx @diffgazer/add` instead of the local tarball. `dgadd init` also supports the recovery-only `--reset-manifest` option, and `-s, --silent` is available globally to suppress non-error output. See [cli/add/README.md](./cli/add/README.md#before-publication) for the full command reference.

### Runtime package mode

```bash
npm install @diffgazer/ui @diffgazer/keys
```

Package consumers import Tailwind CSS v4, `@diffgazer/ui/sources.css`, and `@diffgazer/ui/styles.css`. `@diffgazer/keys` is a required peer of `@diffgazer/ui` in package mode. Keys provider-backed APIs (`KeyboardProvider`, `useKey`, `useScope`, `useFocusZone`, `useScopedNavigation`) are package-only.

### Direct shadcn / manual copy (future, after publication)

The hosted registry at `https://r.b4r7.dev` is not yet live. After publication (see [PACKAGE_GOVERNANCE.md](./PACKAGE_GOVERNANCE.md#hosted-registry-status)), these commands will be:

```bash
npx shadcn add https://r.b4r7.dev/r/ui/button.json
npx shadcn add https://r.b4r7.dev/r/keys/navigation.json
```

Until then, install the locally packed `@diffgazer/add` tarball into the target app and run `pnpm exec dgadd add ui/button keys/navigation` (see [Copy-first mode](#copy-first-mode-dgadd)), or `npm install` against locally packed `@diffgazer/ui` and `@diffgazer/keys` tarballs.

Versioning, release gates, migration expectations, and artifact ownership are documented in [PACKAGE_GOVERNANCE.md](./PACKAGE_GOVERNANCE.md).

## Published-Mode Smoke Test

Packs local workspace packages into isolated temp projects and verifies public imports/bins. This does not install from the public npm registry.

```bash
pnpm run smoke:packages
```

## Live Review E2E (opt-in)

Boots the real embedded API server against a scratch git repo, runs one bounded
single-lens review through a real provider over HTTP + SSE, and verifies the run
persists. Off by default; skips honestly without the opt-in envs. Uses an isolated
temp config home — your `~/.diffgazer` is never touched. Spends tokens on the
selected model (the flash set below).
The release gate is the full {openrouter, opencode-zen} × {small, medium, large}
matrix; zai and ollama-cloud join automatically when credentialed.

```bash
DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_LIVE_E2E=1 OPENROUTER_API_KEY=sk-... pnpm run smoke:review
```

```bash
# Release gate: full matrix (zai and ollama-cloud join when credentialed)
DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_LIVE_E2E=1 \
DIFFGAZER_LIVE_E2E_PRODUCT=openrouter,opencode-zen \
DIFFGAZER_LIVE_E2E_SCENARIO=small,medium,large \
pnpm run smoke:review
```

Every scenario of a provider runs one primary from the flash set — openrouter
`qwen/qwen3.8-flash`, opencode-zen `qwen3.8-flash` on the OpenCode Go endpoint
(`https://opencode.ai/zen/go/v1`, a subscription pool; `/zen/v1` does not serve the
flash ids), zai `glm-5.3-flash`, ollama-cloud `glm-5.3-flash` — and walks an ordered
fallback chain only when a member is down: openrouter `z-ai/glm-5.3-flash` →
`deepseek/deepseek-v4-flash-0731`; opencode-zen `glm-5.3-flash` → `deepseek-v4-flash`;
ollama-cloud `deepseek-v4-flash:0731` → `gpt-oss:20b`; zai `glm-4.5-air` (the proven
priced incumbent, outside the flash set).
"Down" is one of HTTP 402 (entitlement), 401/404 (not supported), 429 (capacity),
400 (model unavailable), 5xx (outage), or a timed-out attempt (harness watchdog,
dispatch wall, headers/answer-idle budget, review wall-clock) — one hop per
timeout, so a logical cell never exceeds two watchdogs (worst case 2 × 600/900/1200 s).
Each hop prints `WARN: live review e2e — <model> is down (<class>: <excerpt>); retrying
the cell on fallback <next>` and boots a fresh cell whose header names the model and
its chain position; a run without a WARN line ran its primary. A
`DIFFGAZER_LIVE_E2E_MODEL` pin never falls back.

## Package Governance

See [PACKAGE_GOVERNANCE.md](./PACKAGE_GOVERNANCE.md) for:

- Versioning policy and semantic versioning guidelines
- Release process and gates
- Dependency management and lockfile strategy
- Supported consumption contracts for each package
- Breaking change policy
