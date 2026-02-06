# Project Context Snapshot
Generated: 2026-02-06T12:58:37.440Z
Root: /Users/voitz/Projects/stargazer/apps/cli

## Project Info
- Name: stargazer
- Version: 0.1.0
- Description: Stargazer - Development toolkit

## README (excerpt)
```
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
```

## Workspace Summary
No workspace packages detected.

## File Tree
- bin/
  - stargazer.js
- package.json
- README.md
- src/
  - app/
    - index.tsx
    - modes/
      - dev.ts
      - prod.ts
    - providers/
      - server-provider.tsx
    - router.tsx
    - screens/
      - status-screen.tsx
  - components/
    - ui/
      - logo.tsx
      - status-display.tsx
  - config.ts
  - hooks/
    - use-exit-handler.ts
    - use-servers.ts
  - index.tsx
  - lib/
    - servers/
      - api-server.ts
      - create-process-server.ts
      - embedded-server.ts
      - web-server.ts
  - types/
    - cli.ts
- tsconfig.json
- tsup.config.ts