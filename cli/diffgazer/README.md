# diffgazer

CLI tool that starts the Diffgazer web environment.

Source: https://github.com/b4r7x/diffgazer/tree/main/cli/diffgazer

Requires Node.js >= 20.

## What it does

- Dev: shows the Diffgazer ASCII banner, spawns API server and web frontend (HMR), and opens the browser
- Prod package: shows the Diffgazer ASCII banner, runs the embedded server, serves static files, and opens the browser
- TUI beta: available with `--tui`; incomplete and not recommended for normal use

## Development

```bash
pnpm --filter diffgazer dev
```

The terminal UI is opt-in while it is in beta:

```bash
pnpm --filter diffgazer dev -- --tui
```

## Production Build

```bash
pnpm --filter diffgazer build
pnpm --filter diffgazer start
```

## Global Install (npm)

The public `diffgazer` npm package is published. Run `npm view diffgazer version` to verify the current published version. For local development, use the workspace development and production commands above.

```bash
npm install -g diffgazer
diffgazer        # Run from anywhere
```

## Exit

Default web mode exits with `Ctrl+C`.

The beta TUI exits with `q` or `Ctrl+C`.

## Architecture

```
src/
  index.tsx                 # CLI entry point
  cli-options.ts            # Argument parsing and help text
  web-launcher.ts           # Default web mode process lifecycle
  tui-entry.tsx             # Opt-in beta TUI renderer
  banner.ts                 # ASCII banner output
  config.ts                 # Ports and workspace paths
  app/
    index.tsx               # TUI provider shell and router
    providers/              # TUI runtime providers
    screens/                # TUI screens
    router.tsx              # TUI screen routing
  components/               # Ink layout and UI components
  features/                 # TUI feature modules
  hooks/                    # TUI hooks
  lib/
    api.ts                  # API client binding
    query-client.ts         # Query client setup
    servers/                # API, web, embedded, and factory launch helpers
  theme/                    # TUI color palettes and theme context
  types/                    # Shared CLI types
```
