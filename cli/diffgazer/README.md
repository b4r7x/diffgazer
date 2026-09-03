# diffgazer

CLI tool that starts the Diffgazer web environment.

Source: https://github.com/b4r7x/diffgazer/tree/main/cli/diffgazer

Requires Node.js >= 22 and a `git` binary on your PATH.

## What it does

- Dev: shows the Diffgazer ASCII banner, spawns API server and web frontend (HMR), and opens the browser
- Prod package: shows the Diffgazer ASCII banner, runs the embedded server, serves static files, and opens the browser
- TUI beta: available with `--tui`; incomplete and not recommended for normal use

## Development

```bash
pnpm --filter diffgazer dev
```

Set `PORT` to move the API server. In development that is the API child, and the launcher passes the matching API URL to the Vite child automatically; an explicit `VITE_API_URL` overrides that derived target. The packaged binary honors `PORT` too, so a `PORT` exported in your shell for other tooling also moves — or, when that port is taken, fails — the embedded server.

The terminal UI is opt-in while it is in beta:

```bash
pnpm --filter diffgazer dev --tui
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
cd /path/to/your/repo
diffgazer
```

Run `diffgazer` from inside the git repository you want to review. The repository should contain changes to review. For the full installation and first-review guide, see https://github.com/b4r7x/diffgazer/blob/main/apps/docs/content/docs/app/getting-started/first-review.mdx.

You can also run it without a global install:

```bash
npx diffgazer
```

## Exit

Default web mode exits with `Ctrl+C`.

The beta TUI always exits with `Ctrl+C`. `q` exits only when no text input, overlay, or streaming review owns the key — during a running review `q` cancels the review instead, and a second `q` exits.

## Architecture

The CLI's place in the workspace is documented at https://github.com/b4r7x/diffgazer/blob/main/apps/docs/content/docs/app/architecture.mdx; its source layout lives in the repository linked above.
