# Publishing Stargazer CLI to npm

This guide covers publishing `stargazer` so users can install and run it globally:

```bash
npm install -g stargazer
stargazer
```

## Prerequisites

1. npm account at [npmjs.com](https://www.npmjs.com/)
2. Logged in: `npm login`

## Package.json Configuration

Update `apps/cli/package.json`:

```json
{
  "name": "stargazer",
  "version": "0.1.0",
  "description": "Stargazer - Development toolkit",
  "type": "module",
  "bin": {
    "stargazer": "bin/stargazer.js"
  },
  "files": ["dist", "bin"],
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/stargazer.git",
    "directory": "apps/cli"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

## Entry Point Requirements

The `bin/stargazer.js` must start with a shebang:

```javascript
#!/usr/bin/env node
```

Verify after build:

```bash
head -1 apps/cli/bin/stargazer.js
# Should output: #!/usr/bin/env node
```

## Build Before Publishing

```bash
pnpm --filter stargazer build
ls apps/cli/dist/
```

This builds:
- `@stargazer/hooks`
- `@stargazer/server`
- `@stargazer/web` → `apps/cli/dist/web`
- CLI bundle via `tsup`

## Publishing

### First Time (or version bump)

```bash
cd apps/cli

npm version patch  # 0.1.0 -> 0.1.1
# or
npm version minor  # 0.1.0 -> 0.2.0
# or
npm version major  # 0.1.0 -> 1.0.0

npm publish
```

### Dry Run (Test Without Publishing)

```bash
cd apps/cli
npm publish --dry-run
```

### View Package Contents

```bash
cd apps/cli
npm pack --dry-run
```

## Monorepo Considerations

### Workspace Dependencies

`@stargazer/hooks` and `@stargazer/server` are bundled into `dist/index.js` via `tsup` (they are **devDependencies**, not runtime dependencies). This avoids npm install failures for unpublished workspace packages.

### TypeScript Build Order

Build dependencies first:

```bash
pnpm --filter stargazer build
```

Or explicitly:

```bash
pnpm --filter @stargazer/hooks build
pnpm --filter @stargazer/server build
pnpm --filter @stargazer/web exec tsc -b
pnpm --filter @stargazer/web exec vite build --outDir ../cli/dist/web
pnpm --filter stargazer build
```

### Missing bin File During Install

In TypeScript monorepos, the `dist/index.js` might not exist before build. Solutions:

1. **Always build before publishing** (recommended)
2. Create a stub `bin/stargazer.js` that imports from `dist/`:

```javascript
#!/usr/bin/env node
import '../dist/index.js';
```

## Automated Publishing with GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter stargazer build

      - name: Publish CLI
        run: |
          cd apps/cli
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
