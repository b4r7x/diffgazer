# Stargazer

Local AI code review. Run one command, get a review from AI agents, your code stays on your machine.

> **Early release** - core review pipeline works, UI is getting polished. [Full context](docs/story.md).

<!--
  TODO: Add a screenshot or GIF of Stargazer in action here.
  A ~15s recording of the review streaming interface would work great.
  Recommended size: 800-1200px wide.
-->

## Why

I wanted my own code reviewer. Tools like Claude Code and Codex are great for writing code, but burning tokens on review when you could spend them building felt wrong.

Code review matters, especially now that we're all shipping AI-generated code faster than we can read it. Solo devs rarely get their code reviewed. Privacy, fear of judgment, or just nobody around. Stargazer is my answer to that.

Run one command, get a review. Only the diff goes to the provider you choose.

> [Why I Built Stargazer](docs/story.md) - the full story.

## Features

- **Five review lenses** - Correctness, Security, Performance, Simplicity, Tests. Each is a separate AI agent with its own prompt.
- **Review profiles** - Quick, Strict, Perf, Security. Pick what fits.
- **Streaming** - watch the review happen in real time via SSE.
- **Issue drilldowns** - click any issue to get more detail: root cause, impact, fix, patch.
- **Git blame enrichment** - each issue shows who last touched the code and surrounding context.
- **Review history** - browse past reviews with search, filters, severity breakdowns.
- **Embedded web UI** - the CLI serves a React app. One command, browser opens.
- **Multiple providers** - Gemini, Z.AI, OpenRouter. Bring your own API key.
- **Security** - localhost only, CORS, prompt injection hardening, OS keyring for secrets. [Why this matters for a local tool.](docs/security.md#why-secure-a-local-tool)
- **Parallel or sequential** - run all lenses at once or one by one.

## Quick start

Node.js 20+ required.

```bash
npm install -g stargazer
cd your-project
stargazer
```

First run walks you through setup - secrets storage, provider, API key, model, preferences.

> [Setup guide](docs/getting-started.md)

### From source

```bash
git clone https://github.com/b4r7x/stargazer
cd stargazer && pnpm install && pnpm build
cd apps/cli && npm link
stargazer   # now works from any git repo
```

## How it works

```
git diff -> parse -> build context -> run lenses -> enrich -> report
```

1. **Diff** - parse staged or unstaged changes, validate size
2. **Context** - analyze project structure for context-aware reviews
3. **Review** - agents go through the diff, each through its own lens
4. **Enrich** - add git blame and surrounding code to each issue
5. **Report** - deduplicate, filter, sort, save

Issues ranked: **Blocker** · **High** · **Medium** · **Low** · **Nit**

> [Full breakdown](docs/how-it-works.md)

## Providers

| Provider | Default Model | Free Tier | Notes |
|----------|--------------|-----------|-------|
| Gemini | gemini-2.5-flash | Yes | Default. Parallel agents work. |
| Z.AI | glm-4.7 | Yes | |
| OpenRouter | varies | Varies | Access to Claude, GPT, and others. |

> [Provider comparison and config](docs/providers.md)

## Documentation

- [Why I Built This](docs/story.md) - the story behind the project
- [Getting Started](docs/getting-started.md) - installation, providers, first review
- [How It Works](docs/how-it-works.md) - lenses, pipeline, profiles, drilldowns
- [Architecture](docs/architecture.md) - monorepo, packages, build, decisions
- [Providers](docs/providers.md) - Gemini, Z.AI, OpenRouter, config
- [Security](docs/security.md) - threat model, CORS, prompt injection
- [Roadmap](docs/roadmap.md) - what's planned
- [Contributing](docs/contributing.md) - dev setup, code style
- [Technical Reference](docs/PROJECT_DOCUMENTATION.md) - API, schemas, internals

## Contributing

```bash
pnpm install && pnpm dev
```

Starts the API server and web UI. See [contributing](docs/contributing.md) for details.

## Built with

TypeScript · Hono · React 19 · Ink 6 · Vite · Zod 4 · Vercel AI SDK · pnpm monorepo

## License

MIT
