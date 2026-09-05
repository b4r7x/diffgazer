# dgadd

Installer CLI for adding Diffgazer UI components and keys hooks to your React project. Files are copied into your codebase so you own the implementation.

## Supported Libraries

| Library | Namespace | What `dgadd` installs |
|---------|-----------|----------------------|
| `@diffgazer/ui` | `ui/*` | Components, hooks, libs, theme CSS |
| `@diffgazer/keys` | `keys/*` | Standalone keyboard hooks (no CSS needed) |

`dgadd` is one of three consumption paths. The other two are direct shadcn/manual copy from the hosted registry, and npm package install.

> **Availability:** the hosted registry at `https://r.b4r7.dev` is live, so `npx shadcn add https://r.b4r7.dev/r/ui/<item>.json` installs components without a checkout. The npm package names (`@diffgazer/add`, `@diffgazer/ui`, `@diffgazer/keys`) are publish-gated until `npm view` returns versions, so a locally packed tarball is the only working `dgadd` install path, and every command below is run from a target app that already has that tarball installed.

## Install from a packed tarball

Pack the CLI from this workspace and install the tarball into the target app:

From this repository:

```bash
pnpm --filter @diffgazer/add build
pnpm --filter @diffgazer/add pack --pack-destination /tmp/diffgazer-packs
```

From the target app, install the tarball with the package manager your project already uses:

```bash
# npm
npm install --save-dev /tmp/diffgazer-packs/diffgazer-add-*.tgz

# pnpm
pnpm add -D /tmp/diffgazer-packs/diffgazer-add-*.tgz

# yarn
yarn add -D /tmp/diffgazer-packs/diffgazer-add-*.tgz

# bun
bun add -D /tmp/diffgazer-packs/diffgazer-add-*.tgz
```

Then initialize and add your first item with that same package manager:

```bash
# npm
npx dgadd init
npx dgadd add ui/button

# pnpm
pnpm exec dgadd init
pnpm exec dgadd add ui/button

# yarn
yarn dgadd init
yarn dgadd add ui/button

# bun
bunx dgadd init
bunx dgadd add ui/button
```

This detects your project setup and creates a `diffgazer.json` config file. Configure a TypeScript or Vite source alias, for example `@/*` or `~/*`, before running `init`.

## Quick Start

```bash
pnpm exec dgadd init
```

`init` writes the theme entry but never edits your CSS entrypoint, so import it yourself. In the app's main CSS file (adjust the relative path to wherever `init` reported the styles directory):

```css
@import "tailwindcss";
@import "./styles/styles.css";
```

Then add items:

```bash
pnpm exec dgadd add ui/button
pnpm exec dgadd add ui/input keys/navigation
pnpm exec dgadd list
```

## npm commands (publish-gated)

These commands work only if `@diffgazer/add` is published, which `npm view @diffgazer/add version` confirms:

```bash
npx @diffgazer/add init
npx @diffgazer/add add ui/button
npx @diffgazer/add add ui/input keys/navigation
npx @diffgazer/add list
```

## Namespaces

- `ui/*` installs components from `@diffgazer/ui`.
- `keys/*` installs standalone hooks from `@diffgazer/keys`.
- All install names must use a namespace prefix. Bare names like `button` are rejected; use `ui/button` instead.

## Commands

### `init`

Initialize dgadd in your project. Detects your setup and creates the config file, utility files, and theme styles.

```bash
pnpm exec dgadd init [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--components-dir <path>` | Component install directory. Passed verbatim; must sit inside the detected source directory | `<source dir>/components/ui` |
| `--allow-missing-alias` | Continue when the app has no source alias configured | `false` |
| `--import-alias-prefix <prefix>` | Alias prefix when detection fails (`@`, `~`, etc.) | — |
| `--source-dir <path>` | Source directory when detection fails (`src`, `client`, etc.) | — |
| `-y, --yes` | Skip confirmation prompts | `false` |
| `--force` | Overwrite existing configuration | `false` |
| `--dry-run` | Preview initialization without writing files | `false` |
| `--skip-install` | Write files without installing npm dependencies | `false` |
| `--reset-manifest` | Recovery only: discard the installed-item ownership ledger. Previously installed files stay on disk but are no longer tracked by `diff` or `remove` | `false` |

`dgadd init` requires Tailwind CSS v4 to be declared in `dependencies` or `devDependencies`. If it is missing or still on v3, install it first (for example, `pnpm add -D tailwindcss@^4`) and rerun init. The check runs before any files or configuration are written; `--skip-install` skips Diffgazer's companion dependencies, not this prerequisite. The command never installs or upgrades Tailwind silently.

`dgadd init` does not mutate `tsconfig`, Vite, Next, or your CSS entrypoint. Configure a TypeScript or Vite alias to your source directory first. When detection cannot find one, pass `--allow-missing-alias` together with `--import-alias-prefix` and `--source-dir` so generated imports and install paths match your project layout.

### `add`

Add `ui/*` and `keys/*` items to your project. UI dependencies are resolved automatically.

```bash
pnpm exec dgadd add ui/button keys/navigation [options]
pnpm exec dgadd ui/button
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--all` | Add all public items | `false` |
| `--overwrite` | Overwrite existing files | `false` |
| `--dry-run` | Preview changes without writing files | `false` |
| `--skip-install` | Write files without installing npm dependencies | `false` |
| `--integration <mode>` | Keyboard integration mode: `ask \| none \| copy \| keys` | `ask` |
| `--keys-version <version>` | Version/range used by `@diffgazer/keys` package mode | caret range of the bundled `@diffgazer/keys` release |
| `-y, --yes` | Skip confirmation prompts | `false` |

`copy` mode installs bundled offline hook source. `keys` mode rewrites local hook imports to `@diffgazer/keys` and installs the package dependency, so use it only when `@diffgazer/keys` resolves: from a local tarball, or from npm if the package is published. `--yes` uses `copy` mode for components that require keyboard hooks; `none` is rejected for those components because it would leave unresolved local hook imports.

When re-adding an installed keyboard component with a different integration mode, `dgadd` stops before writing and asks for `--overwrite`. With `--overwrite`, it rewrites the component files and migrates copied hook files and their ownership records to the requested mode.

### `list`

List available or installed `ui/*` and `keys/*` items.

```bash
pnpm exec dgadd list [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--json` | Output as JSON | `false` |
| `--installed` | Show only installed items | `false` |
| `--all` | Include hidden/internal items | `false` |

### `diff`

Compare local files with the registry data bundled in the installed `dgadd` package.

```bash
pnpm exec dgadd diff ui/button keys/navigation [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |

If no item names are given, all installed items are compared.

### `remove`

Remove installed items from your project.

```bash
pnpm exec dgadd remove ui/button keys/navigation [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `-y, --yes` | Skip confirmation prompts | `false` |
| `--dry-run` | Preview changes without removing files | `false` |
| `--force` | Remove files even when ownership metadata is missing or content changed | `false` |

## Global options

Every command also accepts:

| Option | Description |
|---|---|
| `-s, --silent` | Suppress all output except errors |

## Environment variables

| Variable | Description |
|---|---|
| `CLI_SKIP_INSTALL` | Set to `1`, `true`, `yes`, or `on` to skip npm dependency installation, exactly like `--skip-install`. The packages you still need are listed instead |
| `DEBUG` | Set to any value to print the package manager's full install output and the raw error on failure, instead of the first three lines |

## Concurrent runs

`init`, `add`, and `remove` hold a project lock at `.diffgazer/mutation.lock` for the whole run, so a second `dgadd` in the same project waits instead of interleaving writes. A run that has been waiting for 120 seconds gives up and names the pid holding the lock; re-run it once the first command finishes. A lock left behind by a process that is no longer running is reclaimed automatically.

## Configuration

Running `dgadd init` creates a `diffgazer.json` file in your project root. For a Vite + TypeScript app with an `@/*` alias pointing at `src/`, init writes:

```json
{
  "$schema": "https://r.b4r7.dev/schema/diffgazer.json",
  "version": "0.1.1",
  "aliases": {
    "components": "@/components/ui",
    "utils": "@/lib/utils",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "componentsFsPath": "src/components/ui",
  "libFsPath": "src/lib",
  "hooksFsPath": "src/hooks",
  "rsc": false,
  "tailwind": {
    "css": "src/styles/styles.css"
  }
}
```

`version` is the `dgadd` version that wrote the file. The alias prefix and every `*FsPath` follow your detected source directory and `--components-dir`. `rsc` is detected, not configured: it is `true` only for a Next.js App Router project and `false` everywhere else. `dgadd add` later appends an `installedItems` ledger recording which items it owns; edit it only through the CLI.

## Requirements

- Node.js >= 22
- React `>=19.2.0`
- Tailwind CSS v4

## Platform support

`dgadd init` installs companion npm dependencies through your detected package manager (`npm`, `pnpm`, `yarn`, or `bun`). On Windows, those shims are launched through `cmd.exe` so Node 22+ can spawn them safely (CVE-2024-27980). Release CI currently runs on Linux only; Windows install behavior is covered by unit tests in `@diffgazer/registry`, not a Windows CI job.

## License

MIT
