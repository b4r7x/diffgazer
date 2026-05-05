# dgadd

Installer CLI for adding Diffgazer UI components and keys hooks to your React project. Files are copied into your codebase so you own the implementation.

## Installation

```bash
npx @diffgazer/add init
```

This detects your project setup and creates a `diffgazer.json` config file.

## Quick Start

```bash
dgadd init
dgadd ui/button
dgadd add ui/input keys/navigation
dgadd list
```

## Namespaces

- `ui/*` installs components from `@diffgazer/ui`.
- `keys/*` installs standalone hooks from `@diffgazer/keys`.
- Bare item names are treated as `ui/*` for compatibility.

## Commands

### `init`

Initialize dgadd in your project. Detects your setup and creates the config file, utility files, and theme styles.

```bash
dgadd init [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--components-dir <path>` | Component install directory | `src/components/ui` |
| `-y, --yes` | Skip confirmation prompts | `false` |

### `add`

Add `ui/*` and `keys/*` items to your project. UI dependencies are resolved automatically.

```bash
dgadd add ui/button keys/navigation [options]
dgadd ui/button
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--all` | Add all public items | `false` |
| `--overwrite` | Overwrite existing files | `false` |
| `--dry-run` | Preview changes without writing files | `false` |
| `--integration <mode>` | Keyboard integration mode: `ask \| none \| copy \| keys` | `ask` |
| `--keys-version <version>` | Version/tag used by `@diffgazer/keys` package mode | `latest` |
| `-y, --yes` | Skip confirmation prompts | `false` |

`copy` mode installs bundled offline hook source. `keys` mode rewrites local hook imports to `@diffgazer/keys` and installs the package dependency.

### `list`

List available or installed `ui/*` and `keys/*` items.

```bash
dgadd list [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |
| `--json` | Output as JSON | `false` |
| `--installed` | Show only installed items | `false` |
| `--all` | Include hidden/internal items | `false` |

### `diff`

Compare local files with the latest registry versions.

```bash
dgadd diff ui/button keys/navigation [options]
```

| Option | Description | Default |
|---|---|---|
| `--cwd <path>` | Working directory | `.` |

If no item names are given, all installed items are compared.

### `remove`

Remove installed items from your project.

```bash
dgadd remove ui/button keys/navigation [options]
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
