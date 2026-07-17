# diffgazer

CLI tool that starts the Diffgazer web environment.

Source: https://github.com/b4r7x/diffgazer/tree/main/cli/diffgazer

Requires Node.js >= 22.

## What it does

- Dev: shows the Diffgazer ASCII banner, spawns API server and web frontend (HMR), and opens the browser
- Prod package: shows the Diffgazer ASCII banner, runs the embedded server, serves static files, and opens the browser
- TUI beta: available with `--tui`; incomplete and not recommended for normal use

## Development

```bash
pnpm --filter diffgazer dev
```

Set `PORT` to move the development API server. The launcher passes the matching API URL to the Vite child automatically. An explicit `VITE_API_URL` overrides that derived target.

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

`diffgazer` is live on npm:

```bash
npm install -g diffgazer
diffgazer        # Run from anywhere
```

You can also run it without a global install:

```bash
npx diffgazer
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
    root.tsx                # TUI provider shell
    providers/              # TUI runtime providers
    router.tsx              # TUI screen routing
  components/               # Ink layout and UI components
  features/                 # TUI feature modules and screens
  hooks/                    # TUI hooks
  lib/
    api.ts                  # API client binding
    query-client.ts         # Query client setup
    servers/                # API, web, embedded, and factory launch helpers
  theme/                    # TUI color palettes and theme context
```
