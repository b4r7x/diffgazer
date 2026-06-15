# @diffgazer/web

Private Vite React app bundled into the `diffgazer` CLI web mode. It owns product-specific routes, copy, data fetching, onboarding, settings, provider management, review views, and history. Shared schemas, API hooks, review state helpers, and formatting come from `@diffgazer/core`; keyboard behavior comes from `@diffgazer/keys`; UI primitives come from `@diffgazer/ui`.

## Development

Run the API server and web app from separate terminals:

```bash
pnpm --filter @diffgazer/server dev
pnpm --filter @diffgazer/web dev
```

The web dev server listens on port `3001` and proxies `/api` to `http://127.0.0.1:3000` by default. Set `VITE_API_URL` to point at a different API server. Packaged CLI mode injects the shutdown token through `window.__DIFFGAZER_SHUTDOWN_TOKEN__`; dev can use `VITE_DIFFGAZER_SHUTDOWN_TOKEN`.

## Commands

```bash
pnpm --filter @diffgazer/web build
pnpm --filter @diffgazer/web preview
pnpm --filter @diffgazer/web type-check
pnpm --filter @diffgazer/web test
```
