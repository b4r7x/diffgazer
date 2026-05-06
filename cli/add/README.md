# dgadd

Installer CLI for adding Diffgazer UI components and keys hooks to your React project. Files are copied into your codebase so you own the implementation.

## Installation

`@diffgazer/add` is external publish-gated as of May 6, 2026. Public `npx`/global install commands are valid only after `npm view @diffgazer/add version` succeeds.

Before publication, validate the CLI from this workspace:

```bash
pnpm --filter @diffgazer/add build
pnpm --filter @diffgazer/add pack --pack-destination /tmp/diffgazer-packs
pnpm add -D /tmp/diffgazer-packs/diffgazer-add-*.tgz
pnpm exec dgadd init
```

After publication, use:

```bash
npx @diffgazer/add init
```

This detects your project setup and creates a `diffgazer.json` config file. Configure your `@/*` alias before running `init`.

## Quick Start

```bash
npx @diffgazer/add init
npx @diffgazer/add add ui/button
npx @diffgazer/add add ui/input keys/navigation
npx @diffgazer/add list
```

## Namespaces

- `ui/*` installs components from `@diffgazer/ui`.
- `keys/*` installs standalone hooks from `@diffgazer/keys`.
- Bare item names are treated as `ui/*` for compatibility.

## Commands

### `init`

Initialize dgadd in your project. Detects your setup and creates the config file, utility files, and theme styles.

```bash
npx @diffgazer/add init [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--components-dir <path>` | Component install directory | `src/components/ui` |
| `--allow-missing-alias` | Continue when the app has no `@/*` alias configured | `false` |
| `-y, --yes` | Skip confirmation prompts | `false` |

`dgadd init` does not mutate `tsconfig`, Vite, Next, or your CSS entrypoint. Configure an `@/*` alias in the app first, or use `--allow-missing-alias` only when your tooling already resolves `@/*`.

### `add`

Add `ui/*` and `keys/*` items to your project. UI dependencies are resolved automatically.

```bash
npx @diffgazer/add add ui/button keys/navigation [options]
npx @diffgazer/add ui/button
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--all` | Add all public items | `false` |
| `--overwrite` | Overwrite existing files | `false` |
| `--dry-run` | Preview changes without writing files | `false` |
| `--integration <mode>` | Keyboard integration mode: `ask \| none \| copy \| keys` | `ask` |
| `--keys-version <version>` | Version/range used by `@diffgazer/keys` package mode | `^0.1.1` |
| `-y, --yes` | Skip confirmation prompts | `false` |

`copy` mode installs bundled offline hook source. `keys` mode rewrites local hook imports to `@diffgazer/keys` and installs the package dependency. `--yes` uses `copy` mode for components that require keyboard hooks; `none` is rejected for those components because it would leave unresolved local hook imports.

### `list`

List available or installed `ui/*` and `keys/*` items.

```bash
npx @diffgazer/add list [options]
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
npx @diffgazer/add diff ui/button keys/navigation [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |

If no item names are given, all installed items are compared.

### `remove`

Remove installed items from your project.

```bash
npx @diffgazer/add remove ui/button keys/navigation [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `-y, --yes` | Skip confirmation prompts | `false` |
| `--dry-run` | Preview changes without removing files | `false` |

## Configuration

Running `dgadd init` creates a `diffgazer.json` file in your project root:

```json
{
  "aliases": {
    "components": "@/components/ui",
    "utils": "@/lib/utils",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "rsc": true,
  "tailwind": {
    "css": "src/styles/theme.css"
  }
}
```

## Requirements

- Node.js >= 18
- React 19
- Tailwind CSS v4

## License

[MIT](./LICENSE)
