# CLI Commands Reference

Complete reference for all Stargazer CLI commands and options.

## Global Options

These options apply to all commands:

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help |
| `-V, --version` | Show version |

## Commands

### stargazer run

Start the interactive terminal UI.

```bash
stargazer run [options]
```

#### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `3000` | Server port |
| `-H, --hostname <host>` | `localhost` | Server hostname |
| `-c, --continue` | - | Continue most recent session |
| `-r, --resume [id]` | - | Resume session (picker if no ID) |

#### Examples

```bash
# Start with default settings
stargazer run

# Use different port
stargazer run --port 3001

# Continue last session
stargazer run --continue

# Resume specific session
stargazer run --resume abc123

# Show session picker
stargazer run --resume
```

### stargazer serve

Start headless server without TUI.

```bash
stargazer serve [options]
```

#### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `3000` | Server port |
| `-H, --hostname <host>` | `localhost` | Server hostname |

#### Examples

```bash
# Start server only
stargazer serve

# Use custom port
stargazer serve --port 8080
```

### stargazer review

AI-powered code review command.

```bash
stargazer review [options]
```

#### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `3000` | Server port |
| `-H, --hostname <host>` | `localhost` | Server hostname |
| `-s, --staged` | `true` | Review staged changes |
| `-u, --unstaged` | - | Review unstaged changes |
| `-f, --files <files...>` | - | Review specific files (comma-separated or multiple flags) |
| `--lens <lenses>` | `correctness` | Comma-separated lens IDs |
| `--profile <profile>` | - | Review profile (quick, strict, perf, security) |
| `-l, --list` | - | List review history |
| `-r, --resume <id>` | - | Resume a saved review by ID |
| `--pick` | - | Pick files to review interactively |

#### Lens IDs

| ID | Focus |
|----|-------|
| `correctness` | Bugs, logic errors, edge cases |
| `security` | Vulnerabilities, injection, auth |
| `performance` | Efficiency, memory, algorithms |
| `simplicity` | Complexity, maintainability |
| `tests` | Test coverage, quality |

#### Profile IDs

| ID | Lenses | Min Severity |
|----|--------|--------------|
| `quick` | correctness | high |
| `strict` | correctness, security, tests | all |
| `perf` | correctness, performance | medium |
| `security` | security, correctness | all |

#### Examples

```bash
# Review staged changes with default lens
stargazer review

# Review unstaged changes
stargazer review --unstaged

# Use specific lenses
stargazer review --lens security,performance

# Use a profile
stargazer review --profile strict

# Review specific files
stargazer review --files src/api/routes.ts --files src/services/auth.ts
# or
stargazer review --files src/api/routes.ts,src/services/auth.ts

# Interactive file picker
stargazer review --pick

# List review history
stargazer review --list

# Resume a saved review
stargazer review --resume <uuid>
```

## TUI Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| `q` | Quit application |
| `?` | Show help |
| `Ctrl+C` | Force quit |

### Main View

| Key | Action |
|-----|--------|
| `r` | Start AI review |
| `s` | Toggle staged/unstaged |
| `h` | View review history |
| `d` | View git diff |
| `g` | View git status |

### Review View

| Key | Action |
|-----|--------|
| `j` or `Down` | Next issue |
| `k` or `Up` | Previous issue |
| `Enter` | View issue details / drilldown |
| `a` | Apply suggested patch |
| `i` | Ignore issue |
| `r` | Refresh review |
| `s` | Toggle staged/unstaged |
| `b` or `Esc` | Back to main |

### Session View

| Key | Action |
|-----|--------|
| `j` or `Down` | Next session |
| `k` or `Up` | Previous session |
| `Enter` | Select session |
| `d` | Delete session |
| `n` | New session |
| `Esc` | Cancel |

### Diff View

| Key | Action |
|-----|--------|
| `j` or `Down` | Scroll down |
| `k` or `Up` | Scroll up |
| `s` | Toggle staged/unstaged |
| `b` or `Esc` | Back |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `STARGAZER_PORT` | Default server port |
| `STARGAZER_HOST` | Default server hostname |
| `NO_COLOR` | Disable colored output |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Configuration error |
| `3` | Server startup failed |
| `130` | Interrupted (Ctrl+C) |

## Configuration Files

### User Config

Location: `~/.config/stargazer/config.json`

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "createdAt": "2024-01-24T10:00:00.000Z",
  "updatedAt": "2024-01-24T10:00:00.000Z"
}
```

## API Endpoints

When the server is running, these endpoints are available:

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |

### Git

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/git/status` | GET | Git repository status |
| `/git/diff` | GET | Git diff content |

### Triage

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/triage/stream` | GET | SSE triage stream |
| `/triage/reviews` | GET | List triage reviews |
| `/triage/reviews/:id` | GET | Get triage review |
| `/triage/reviews/:id` | DELETE | Delete triage review |
| `/triage/reviews/:id/drilldown` | POST | Deep analysis of issue |

#### Triage Stream Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `staged` | boolean | Review staged changes (default: true) |
| `lenses` | string | Comma-separated lens IDs |
| `profile` | string | Profile ID |
| `files` | string | Comma-separated file paths |

### Review (Legacy)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/review/stream` | GET | SSE review stream |
| `/reviews` | GET | List review history |
| `/reviews/:id` | GET | Get review details |

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sessions` | GET | List sessions |
| `/sessions` | POST | Create session |
| `/sessions/:id` | GET | Get session |
| `/sessions/:id` | DELETE | Delete session |

### Config

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/config` | GET | Get current config |
| `/config` | POST | Save config |
| `/config/check` | GET | Check if configured |

## Cross-References

- [Apps: CLI](../apps/cli.md) - CLI implementation details
- [Apps: Server](../apps/server.md) - Server API details
- [Guides: Getting Started](../guides/getting-started.md) - Usage tutorial
