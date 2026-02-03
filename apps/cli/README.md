# @stargazer/cli

CLI tool that starts the Stargazer development environment.

## What it does

Spawns both the API server and web frontend, then opens the browser.

## Development

```bash
# From monorepo root
pnpm cli

# Or from this directory
pnpm dev
```

## Production Build

```bash
pnpm build       # Compile TypeScript → dist/
pnpm start       # Run compiled version
```

## Global Install (future)

```bash
npm install -g @stargazer/cli
stargazer        # Run from anywhere
```

## Exit

Press `Ctrl+C` to stop both servers. Exit code 143 is normal (SIGTERM).

## Architecture

```
src/
  index.tsx                    # Entry point
  app.tsx                      # UI components (Banner, StatusDisplay)
  config.ts                    # Ports and paths
  hooks/
    use-server-processes.ts    # Process management with execa
```

## Cross-Platform

Uses `execa` for Windows/Linux/Mac compatibility.
