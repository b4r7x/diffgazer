# @diffgazer/ui

Reusable React UI components for Diffgazer and compatible product surfaces.

## Consumption Contract

There are two intended ways to consume the UI library. The npm package names are external publish-gated as of May 6, 2026; public npm commands below are valid only after `npm view @diffgazer/add`, `npm view @diffgazer/ui`, and `npm view @diffgazer/keys` return versions.

### Copy-first registry mode

Use this when your app should own and customize component source:

```bash
npx @diffgazer/add init
npx @diffgazer/add add ui/button
```

Before publication, validate copy mode from this workspace with `pnpm run smoke:packages` or install a locally packed `@diffgazer/add` tarball into a fixture app and run `pnpm exec dgadd`.

`dgadd init` creates `diffgazer.json`, records installer aliases, creates install directories, writes `src/lib/utils.ts`, copies `src/styles/theme.css` and `src/styles/styles.css`, and installs shared dependencies. It does not edit `tsconfig.json`, Vite/Next aliases, or your app CSS entrypoint.

Copied components expect:

- `@/*` mapped to your source directory in TypeScript and your bundler/framework.
- `src/styles/styles.css` imported from your app CSS, or equivalent manual Tailwind/theme imports.
- Tailwind CSS v4 in the consuming app.

For keyboard behavior, `npx @diffgazer/add add ui/menu --integration copy` copies standalone hooks. `npx @diffgazer/add add ui/menu --integration keys` rewrites imports to `@diffgazer/keys` and installs that runtime package.

### Runtime package mode

Use this when you want versioned package imports and do not need to customize source:

```bash
npm install @diffgazer/ui @diffgazer/keys
```

Before publication, validate runtime package mode with locally packed tarballs from `@diffgazer/ui` and `@diffgazer/keys`; do not document public npm install as available.

Configure Tailwind CSS v4 from the CSS file that imports Tailwind:

```css
@import "tailwindcss";
@source "../node_modules/@diffgazer/ui/dist";
@import "@diffgazer/ui/styles.css";
```

Adjust the `@source` path so it is relative to that CSS file.

```tsx
import { Button } from "@diffgazer/ui/components/button";
```

Runtime package mode exports compiled components, hooks, utilities, and CSS. It is not the customization path.

## Keyboard Dependencies

`@diffgazer/keys` is a required peer for runtime package mode because package entries can import keyboard hooks:

```tsx
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { useScope } from "@diffgazer/keys";
```

Icon primitives ship from `@diffgazer/ui`; there is no `lucide-react` peer or runtime dependency.

## Entries

- `@diffgazer/ui/components/*`
- `@diffgazer/ui/hooks/*`
- `@diffgazer/ui/lib/*`
- `@diffgazer/ui/theme-base.css`
- `@diffgazer/ui/styles.css`

## Peer dependencies

- `react >= 19`
- `react-dom >= 19`
- `@diffgazer/keys >= 0.1`

## Versioning and Migration

Packages use changesets and semantic versioning. During `0.x`, public contracts can still move; breaking changes must be documented in changesets and migration docs. Runtime package consumers update with their package manager. Copy-first consumers update manually with:

```bash
npx @diffgazer/add diff ui/button
npx @diffgazer/add add ui/button --overwrite
```

Review copied source in your own git diff before keeping updates.

## Repository metadata

- **Source:** https://github.com/b4r7x/diffgazer/tree/main/libs/ui
- **Homepage:** https://github.com/b4r7x/diffgazer/tree/main/libs/ui
