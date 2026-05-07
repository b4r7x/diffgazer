# diffgazer

CLI tool that starts the Diffgazer environment.

Source: https://github.com/b4r7x/diffgazer/tree/main/cli/diffgazer

Requires Node.js >= 20.

## What it does

- Dev: spawns API server and web frontend (HMR)
- Prod package: runs embedded server and serves static files after the npm package is published

## Development

```bash
pnpm --filter diffgazer dev
```

## Production Build

```bash
pnpm --filter diffgazer build
pnpm --filter diffgazer start
```

## Global Install (npm)

The public `diffgazer` npm package is external publish-gated as of May 6, 2026. Use this global install command only after `npm view diffgazer version` succeeds. Before publication, use the workspace development and production commands above.

```bash
npm install -g diffgazer
diffgazer        # Run from anywhere
```

## Exit

Press `Ctrl+C` or `Esc` to stop.

## Architecture

```
src/
  index.tsx                 # Entry point (dev/prod mode)
  config.ts                 # Ports + paths
  app/
    index.tsx               # App layout + router shell
    app-router.tsx          # Dev/prod switch (future router)
    dev-app.tsx             # Dev UI
    api-server.ts           # Dev API (child process)
    web-server.ts           # Dev web (child process)
    prod-app.tsx            # Prod UI
    embedded-server.ts      # Prod server (static files)
  hooks/                    # CLI hooks
  lib/                      # Process server controller
  ui/                       # UI pieces (logo, status)
```
