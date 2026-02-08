# Getting Started

## Prerequisites

- **Node.js 20+** (`node --version`)
- **pnpm** (comes with corepack: `corepack enable`)
- A **git repository** with staged or unstaged changes to review

## Install

```bash
npm install -g stargazer
```

## Install from Source

```bash
git clone https://github.com/user/stargazer.git
cd stargazer
pnpm install
pnpm build
cd apps/cli && npm link
```

After linking, `stargazer` is available globally.

## First Run

```bash
cd your-project
stargazer
```

The CLI prints an ASCII logo, starts a local server on port 3000, and opens your browser. All interaction happens in the browser -- the terminal just shows "Esc or ctrl+c to exit."

## Onboarding

On first launch, a 5-step wizard walks you through setup:

1. **Secrets storage** -- choose OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service) or file-based storage (`~/.stargazer/secrets.json`, mode 0600).
2. **Provider** -- pick an AI provider: Google Gemini (free tier available), Z.AI (free tier), or OpenRouter (access to Claude, GPT, and others).
3. **API key** -- paste your key. It gets stored using the method you chose in step 1.
4. **Model** -- select from available models for your provider.
5. **Analysis preferences** -- choose which lenses (Correctness, Security, Performance, Simplicity, Tests) to enable and whether agents run in parallel or sequentially.

## Your First Review

1. From the home screen, select **Review Unstaged** or **Review Staged**.
2. Watch the streaming progress view -- you will see steps (diff, context, review, enrich, report), agent status per lens, and an activity log.
3. When complete, a **summary** shows severity breakdown and top issues.
4. Browse results in the split-pane viewer: issue list on the left, detail tabs (Details, Explain, Trace, Patch) on the right.

## Configuration

Settings are stored in `~/.stargazer/config.json`.

| Setting | Default | Description |
|---------|---------|-------------|
| `theme` | `auto` | UI theme (auto, dark, light, terminal) |
| `defaultLenses` | all 5 | Which lenses run by default |
| `defaultProfile` | `null` | Review profile preset (quick, strict, perf, security) |
| `severityThreshold` | `low` | Minimum severity to display |
| `secretsStorage` | `null` | API key storage (file or keyring) |
| `agentExecution` | `sequential` | Run lenses in parallel or sequentially |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `STARGAZER_HOME` | Override global config directory |
| `PORT` | Override server port (default: 3000) |
| `GOOGLE_API_KEY` | Gemini API key (alternative to stored) |
| `ZAI_API_KEY` | Z.AI API key (alternative to stored) |
| `OPENROUTER_API_KEY` | OpenRouter API key (alternative to stored) |

## File Locations

### Global (`~/.stargazer/`)

| File | Contents |
|------|----------|
| `config.json` | Settings and provider configuration |
| `secrets.json` | API keys (file storage mode only) |
| `trust.json` | Per-project trust grants |
| `triage-reviews/*.json` | Saved review results |

### Per-Project (`{project}/.stargazer/`)

| File | Contents |
|------|----------|
| `project.json` | Project identity (UUID, repo root) |
| `context.md` | Cached project context |
| `context.json` | Project context graph |
| `context.meta.json` | Context metadata and status hash |

## Uninstall

```bash
npm uninstall -g stargazer
rm -rf ~/.stargazer  # remove config and saved reviews
```

---

[Back to README](../README.md)
