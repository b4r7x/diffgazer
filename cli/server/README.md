# @diffgazer/server

Private Hono backend embedded by the `diffgazer` CLI. It is not a reusable public server package; `cli/diffgazer` builds it as a workspace dependency and bundles it into the CLI with tsup `noExternal`.

## Layout

`src/app.ts` creates the Hono app and mounts feature routers:

- `/api/config`
- `/api/settings`
- `/api/git`
- `/api/review`
- `/api/shutdown`
- `/api/health`

`src/serve.ts` is the standalone dev entry, and `src/http-server.ts` owns the Node adapter and port errors. Feature code lives under `src/features/<domain>`. Shared HTTP, config, git, AI, and middleware helpers live under `src/shared`.

## Security

The app is local-only by design. `createApp()` enforces:

- Host allowlist for `localhost`, `127.0.0.1`, and `::1`.
- Hardening headers: `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, and `Referrer-Policy`.
- Origin checks for unsafe `/api/*` methods. Non-localhost origins are rejected before route handlers.
- Shutdown token auth on `/api/*` outside health. Packaged mode fails closed; split dev may run without a token and logs that state.
- CORS limited to same-origin in packaged mode and localhost origins in dev.

Routes add their own body limits, rate limits, setup guards, trust guards, and zod validation where needed.

## Environment

| Variable | Effect |
| --- | --- |
| `PORT` | Standalone dev server port. Defaults to `3000`; invalid values fail startup. |
| `DIFFGAZER_HOME` | Overrides the global Diffgazer directory. Defaults to `~/.diffgazer`. |
| `DIFFGAZER_PROJECT_ROOT` | Project root used by server-side config, trust, git, and review paths. |
| `DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT=1` | In non-packaged dev only, allows the project-root request header. |
| `DIFFGAZER_PACKAGED=1` | Marks packaged CLI mode. Changes token, CORS, logging, and project-root behavior. |
| `DIFFGAZER_SHUTDOWN_TOKEN` | Required in packaged mode and whenever configured in dev. Sent through `x-diffgazer-shutdown-token`. |
| `DIFFGAZER_CLI_PID` | Parent CLI process id used by the shutdown route. |
| `DIFFGAZER_LOG_LEVEL` | Minimum log level: `debug`, `info`, `warn`, or `error`. |
| `DIFFGAZER_OFFLINE` | Skips live models.dev fetches and uses cached or bundled model catalog data. |

## Commands

```bash
pnpm --filter @diffgazer/server dev
pnpm --filter @diffgazer/server build
pnpm --filter @diffgazer/server start
pnpm --filter @diffgazer/server type-check
pnpm --filter @diffgazer/server test
```
