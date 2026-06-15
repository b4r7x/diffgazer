# dgadd

Installer CLI for adding Diffgazer UI components and keys hooks to your React project. Files are copied into your codebase so you own the implementation.

## Supported Libraries

| Library | Namespace | What `dgadd` installs |
|---------|-----------|----------------------|
| `@diffgazer/ui` | `ui/*` | Components, hooks, libs, theme CSS |
| `@diffgazer/keys` | `keys/*` | Standalone keyboard hooks (no CSS needed) |

`dgadd` is one of three planned consumption paths. The other two are direct shadcn/manual copy from the hosted registry, and npm package install. The hosted registry and all npm package names (`@diffgazer/add`, `@diffgazer/ui`, `@diffgazer/keys`) are publish-gated until the live registry returns 200 responses and `npm view` returns versions. Local tarballs are the validation path before publication.

## Before Publication

`@diffgazer/add` is publish-gated until `npm view @diffgazer/add version` succeeds. Public `npx` and global install commands are valid only after that check passes.

Before publication, pack the CLI from this workspace and install the tarball into the target app:

From this repository:

```bash
pnpm --filter @diffgazer/add build
pnpm --filter @diffgazer/add pack --pack-destination /tmp/diffgazer-packs
```

From the target app:

```bash
pnpm add -D /tmp/diffgazer-packs/diffgazer-add-*.tgz
pnpm exec dgadd init
pnpm exec dgadd add ui/button
```

This detects your project setup and creates a `diffgazer.json` config file. Configure a TypeScript or Vite source alias, for example `@/*` or `~/*`, before running `init`.

## Quick Start

Use these commands after installing the local tarball into the target app:

```bash
pnpm exec dgadd init
pnpm exec dgadd add ui/button
pnpm exec dgadd add ui/input keys/navigation
pnpm exec dgadd list
```

## After Publication

Public hosted registry and npm deployment remain future work. Once `npm view @diffgazer/add version` succeeds, these public commands are valid:

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

The command examples below assume the local tarball is already installed in the target app. They are not public package-manager entry points yet.

## Commands

### `init`

Initialize dgadd in your project. Detects your setup and creates the config file, utility files, and theme styles.

```bash
pnpm exec dgadd init [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--components-dir <path>` | Component install directory | `src/components/ui` |
| `--allow-missing-alias` | Continue when the app has no source alias configured | `false` |
| `-y, --yes` | Skip confirmation prompts | `false` |
| `--force` | Overwrite existing configuration | `false` |
| `--dry-run` | Preview initialization without writing files | `false` |
| `--skip-install` | Write files without installing npm dependencies | `false` |

`dgadd init` does not mutate `tsconfig`, Vite, Next, or your CSS entrypoint. Configure a TypeScript or Vite alias to your source directory first, or use `--allow-missing-alias` only when your tooling already resolves source aliases.

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

`copy` mode installs bundled offline hook source. `keys` mode rewrites local hook imports to `@diffgazer/keys` and installs the package dependency, so use it only after `@diffgazer/keys` is published or available through a local tarball. `--yes` uses `copy` mode for components that require keyboard hooks; `none` is rejected for those components because it would leave unresolved local hook imports.

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
    "css": "src/styles/styles.css"
  }
}
```

## Requirements

- Node.js >= 22
- React `>=19.2.0`
- Tailwind CSS v4

## License

MIT
