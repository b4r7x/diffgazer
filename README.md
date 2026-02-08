# Stargazer

**Local AI code review for developers who'd rather spend their tokens on building.**

> **Early release** — core review pipeline works well, UI is getting polished. [Full context](docs/story.md).

<!--
  TODO: Add a screenshot or GIF of Stargazer in action here.
  A ~15s recording of the review streaming interface would work great.
  Recommended size: 800-1200px wide.
-->

## Why

I wanted my own code reviewer. Tools like Claude Code and Codex are great for writing code, but burning tokens on review when you could spend them building things felt wrong.

Code review matters — especially now that we're all shipping AI-generated code faster than ever. Solo devs rarely get their code reviewed. Privacy, fear of judgment, or just nobody around. Stargazer is my answer to that.

Run one command, get a full review from specialized AI agents. Your code stays local — only the diff goes to the provider you choose.

> [Why I Built Stargazer](docs/story.md) — the full story, the philosophy, the honest take.

## Features

- **Five review lenses** — Correctness, Security, Performance, Simplicity, Tests. Each is a specialized agent with its own expert prompt.
- **Review profiles** — Quick, Strict, Perf, Security. Pick the depth that fits the moment.
- **Real-time streaming** — Watch agents work through your code live via SSE.
- **Issue drilldowns** — Deep-dive any finding: root cause, impact, suggested fix, patch.
- **Git blame enrichment** — Each issue shows who last touched the code and the surrounding context.
- **Review history** — Browse past reviews with search, filters, and severity breakdowns.
- **Embedded web UI** — Full React app served by the CLI. One command, browser opens.
- **Multiple providers** — Gemini (recommended), Z.AI, OpenRouter. Bring your own API key.
- **Security-first** — Localhost only, strict CORS, prompt injection hardening, OS keyring for secrets.
- **Parallel or sequential** — Run all lenses at once or one by one.

## Quick Start

Node.js 20+ required.

```bash
npm install -g stargazer
cd your-project
stargazer
```

First run walks you through setup — secrets storage, provider, API key, model, preferences.

> [Detailed setup guide](docs/getting-started.md) — providers, config, first review walkthrough.

### From Source

```bash
git clone https://github.com/b4r7x/stargazer
cd stargazer && pnpm install && pnpm build
cd apps/cli && npm link
stargazer   # now works from any git repo
```

## How It Works

```
git diff → parse → build context → run lenses → enrich → report
```

1. **Diff** — Parse staged or unstaged changes, validate size
2. **Context** — Analyze project structure for smarter reviews
3. **Review** — Agents examine the diff through their specialty lens
4. **Enrich** — Add git blame and surrounding code to each finding
5. **Report** — Deduplicate, filter, sort, save

Issues ranked: **Blocker** · **High** · **Medium** · **Low** · **Nit**

> [Full pipeline breakdown](docs/how-it-works.md) — lenses, profiles, drilldowns, streaming.

## Providers

| Provider | Default Model | Free Tier | Notes |
|----------|--------------|-----------|-------|
| **Gemini** | gemini-2.5-flash | Yes | Recommended. Fast, cheap, parallel agents work well. |
| **Z.AI** | glm-4.7 | Yes | |
| **OpenRouter** | varies | Varies | Access to Claude, GPT, and more. |

> [Why Gemini? Full comparison and configuration.](docs/providers.md)

## Documentation

- **[Why I Built This](docs/story.md)** — the story and philosophy behind the project
- **[Getting Started](docs/getting-started.md)** — installation, providers, your first review
- **[How It Works](docs/how-it-works.md)** — lenses, agents, pipeline, profiles, drilldowns
- **[Architecture](docs/architecture.md)** — monorepo, packages, build pipeline, key decisions
- **[Providers](docs/providers.md)** — Gemini, Z.AI, OpenRouter — comparison and config
- **[Security](docs/security.md)** — threat model, CORS, prompt injection hardening
- **[Roadmap](docs/roadmap.md)** — what's planned next
- **[Contributing](docs/contributing.md)** — dev setup, code style, PR workflow
- **[Technical Reference](docs/PROJECT_DOCUMENTATION.md)** — full API, schemas, internals

## Contributing

```bash
pnpm install && pnpm dev
```

Starts the API server and web UI. See the [Contributing Guide](docs/contributing.md) for details.

## Built With

TypeScript · Hono · React 19 · Ink 6 · Vite · Zod 4 · Vercel AI SDK · pnpm monorepo

## License

MIT
