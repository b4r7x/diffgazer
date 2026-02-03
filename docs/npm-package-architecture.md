# Stargazer NPM Package Architecture

## Problem

Mamy monorepo z trzema aplikacjami:
- `apps/cli` - Ink CLI (UI)
- `apps/server` - Hono API server
- `apps/web` - Vite React app

W dev `apps/cli` spawnuje server i web jako osobne procesy (HMR). Po instalacji z npm użytkownik nie ma folderów `apps/server` ani `apps/web`, tylko `node_modules/stargazer/dist`.

## Rozwiązanie (1 paczka npm, 1 UI)

Publikujemy **jedną paczkę npm**: `apps/cli` z nazwą `stargazer`.

- UI jest tylko w `apps/cli` (zero duplikacji).
- `@stargazer/server` jest bundlowany do CLI przez `tsup`.
- Statyczne pliki web są budowane bezpośrednio do `apps/cli/dist/web`.

## Struktura

```
apps/cli/
├── src/
│   ├── index.tsx          # Entry point (dev/prod mode)
│   ├── config.ts          # Ports + paths
│   ├── app/
│   │   ├── index.tsx      # App layout + router shell
│   │   ├── app-router.tsx # Dev/prod switch (future router)
│   │   ├── dev-app.tsx    # Dev UI
│   │   ├── api-server.ts  # Dev API (child process)
│   │   ├── web-server.ts  # Dev Web (child process)
│   │   ├── prod-app.tsx   # Prod UI
│   │   └── embedded-server.ts # Prod server + static files
│   ├── hooks/
│   ├── lib/
│   └── ui/
├── dist/
│   ├── index.js       # Zbundlowany CLI + server code
│   └── web/           # Statyczne pliki z apps/web
├── bin/
│   └── stargazer.js   # Shebang + import dist
├── package.json
└── tsup.config.ts
```

## Kluczowe pliki

### apps/server/src/index.ts
Eksportuje `createApp()` bez side effects:
```ts
export function createApp() {
  const app = new Hono();
  app.get('/api/health', ...);
  return app;
}
```

### apps/cli/src/app/embedded-server.ts
Serwuje API + static files w tym samym procesie:
```ts
import { createApp } from '@stargazer/server';
import { serveStatic } from '@hono/node-server/serve-static';

export function createEmbeddedServer({ port, onReady }) {
  const app = createApp();
  app.use('/*', serveStatic({ root: join(__dirname, 'web') }));
  return serve({ fetch: app.fetch, port }, onReady);
}
```

### apps/cli/tsup.config.ts
```ts
export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  noExternal: ['@stargazer/hooks', '@stargazer/server'],
});
```

## Build process

```bash
pnpm --filter @stargazer/hooks build
pnpm --filter @stargazer/server build
pnpm --filter @stargazer/web exec tsc -b
pnpm --filter @stargazer/web exec vite build --outDir ../cli/dist/web
pnpm --filter stargazer build
```

## Dwa tryby pracy

| | Development | Production (npm) |
|---|---|---|
| Komenda | `pnpm cli` | `stargazer` |
| Używa | `apps/cli` | `apps/cli` |
| Server | Child process | W tym samym procesie |
| Web | Vite dev server (HMR) | Static files |
| Hot reload | ✅ | ❌ |
