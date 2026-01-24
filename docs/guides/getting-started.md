# Getting Started

This guide walks you through setting up and using Stargazer for AI-powered code review.

## Prerequisites

- Node.js 18+
- Git repository
- API key for at least one AI provider

## Installation

### Clone and Install

```bash
git clone https://github.com/your-org/stargazer.git
cd stargazer
npm install
npm run build
```

### Link CLI Globally

```bash
npm link
```

Now `stargazer` is available as a command.

## Initial Setup

### Start Stargazer

```bash
stargazer run
```

On first run, you'll see the onboarding screen.

### Select AI Provider

Choose from:
1. **Google Gemini** (recommended - has free tier)
2. **OpenAI**
3. **Anthropic**

### Enter API Key

Get your API key:
- Gemini: https://aistudio.google.com/app/apikey
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys

Enter the key when prompted. It's stored securely in your OS keyring.

### Select Model

Choose a model. Recommendations:
- **Gemini**: gemini-2.5-flash (free, fast)
- **OpenAI**: gpt-4o (best quality)
- **Anthropic**: claude-sonnet-4 (balanced)

## Your First Review

### Make Some Changes

```bash
# Edit a file
echo "console.log('test');" >> src/index.ts

# Stage the changes
git add src/index.ts
```

### Run Review

In the Stargazer TUI, press `r` to start a review.

You'll see:
1. Loading spinner while AI analyzes
2. Summary of findings
3. List of issues with severity colors

### Navigate Issues

| Key | Action |
|-----|--------|
| `j/k` | Move up/down |
| `Enter` | View details |
| `i` | Ignore issue |
| `b` | Go back |

### Toggle Staged/Unstaged

Press `s` to switch between reviewing staged and unstaged changes.

## Common Workflows

### Pre-Commit Review

```bash
# Stage your changes
git add -p

# Start Stargazer
stargazer run

# Press 'r' to review staged changes
# Fix critical/warning issues
# Commit
```

### Quick Check

For a fast review focusing on critical issues:

```bash
stargazer run

# Press 'r' for review
# Address only red (critical) items
```

### Full Review Before PR

```bash
stargazer run

# Review all changes
# Press 's' to toggle staged/unstaged
# Address warnings and suggestions
```

## Configuration

### View Current Config

```bash
curl http://localhost:3000/config
```

### Change Provider

In the TUI, access settings to change provider or model.

### Configuration File

Config is stored at `~/.config/stargazer/config.json`:

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

## Session Management

### Continue Previous Session

```bash
stargazer run --continue
```

### Resume Specific Session

```bash
stargazer run --resume
# Shows session picker

stargazer run --resume abc123
# Resume specific session
```

## Troubleshooting

### API Key Invalid

1. Check your API key is correct
2. Verify it has the required permissions
3. Re-enter via settings

### No Changes to Review

Make sure you have either:
- Staged changes (for staged review)
- Unstaged changes (for unstaged review)

### Server Won't Start

Check if port 3000 is in use:

```bash
lsof -i :3000

# Use different port
stargazer run --port 3001
```

### Rate Limited

- Wait and retry
- Consider upgrading to paid tier
- Use a different model

## Next Steps

- [Adding Features](./adding-features.md) - Extend Stargazer
- [Adding Lenses](./adding-lenses.md) - Customize reviews
- [CLI Commands Reference](../reference/cli-commands.md) - All commands

## Cross-References

- [Apps: CLI](../apps/cli.md) - CLI details
- [Features: Review Flow](../features/review-flow.md) - How reviews work
- [Features: AI Integration](../features/ai-integration.md) - Provider setup
