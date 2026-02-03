# stargazer

CLI tool that starts the Stargazer environment.

## What it does

- Dev: spawns API server and web frontend (HMR)
- Prod (npm): runs embedded server and serves static files

## Development

```bash
# From monorepo root
pnpm cli

# Or from this directory
pnpm dev
```

## Production Build

```bash
pnpm build       # Build deps + web + bundle
pnpm start       # Run compiled version
```

## Global Install (npm)

```bash
npm install -g stargazer
stargazer        # Run from anywhere
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
