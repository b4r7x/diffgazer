# @diffgazer/core

Private shared product logic for the CLI, embedded server, web app, docs app, and TUI. It owns Zod schemas and types, result/error helpers, format/string utilities, API client factories and React hooks, review state/presentation helpers, provider/catalog helpers, navigation helpers, env parsing, and the theme token-key parity contract consumed by the TUI and `@diffgazer/ui` tests.

## Package shape

`@diffgazer/core` is subpath-only. `package.json` deliberately has no root `.` export; consumers import the specific domain they need, such as `@diffgazer/core/api`, `@diffgazer/core/schemas/review`, `@diffgazer/core/review`, or `@diffgazer/core/theme`.

This package must not import from `apps/*` or `cli/*`. Single-surface helpers stay in the surface that owns them.

## Commands

```bash
pnpm --filter @diffgazer/core build
pnpm --filter @diffgazer/core type-check
pnpm --filter @diffgazer/core test
pnpm --filter @diffgazer/core check
```
