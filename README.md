# Stargazer

CLI tool for managing Stargazer development servers.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Installation

```bash
pnpm install
```

## Development

```bash
# Run CLI in development mode (starts API + Web servers)
pnpm cli
```

## Build

```bash
pnpm build
```

## Run Locally as Global Command

After building, link the CLI globally:

```bash
cd apps/cli
pnpm link --global
```

Now you can run from anywhere:

```bash
stargazer
```

To unlink:

```bash
pnpm unlink --global stargazer
```

## Project Structure

```
stargazer/
├── apps/
│   ├── cli/          # Ink-based CLI (React for terminal)
│   ├── server/       # Hono API server
│   └── web/          # Vite + React web app
├── packages/
│   └── hooks/        # Shared React hooks
└── docs/             # Documentation
```

## NPM Publishing

See [docs/npm-publishing.md](docs/npm-publishing.md) for instructions on publishing to npm.
