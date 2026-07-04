# @diffgazer/ui

Reusable React UI components for Diffgazer and compatible product surfaces.

## Consumption Paths

> **Note:** Diffgazer packages are not yet published to npm. Until the first release, install from a local checkout of the repository.

Choose the path that matches whether your app should own copied source or consume versioned packages.

| Path | What it does | CSS setup |
|------|-------------|-----------|
| Manual copy / shadcn | `npx shadcn add https://r.b4r7.dev/r/ui/button.json` | Import copied project-root `styles/styles.css` |
| `dgadd` CLI | `pnpm exec dgadd add ui/button` | Import copied `src/styles/styles.css` |
| npm package | `npm install @diffgazer/ui @diffgazer/keys` | Import `@diffgazer/ui/sources.css` and `@diffgazer/ui/styles.css` |

### Copy-first registry mode

Use this when your app should own and customize component source:

```bash
pnpm exec dgadd init
pnpm exec dgadd add ui/button
```

`dgadd init` creates `diffgazer.json`, records installer aliases, creates install directories, writes `src/lib/utils.ts`, copies theme and aggregate CSS into the configured styles directory, and installs shared dependencies. It does not edit `tsconfig.json`, Vite/Next aliases, or your app CSS entrypoint.

Copied components expect:

- `@/*` mapped to your source directory in TypeScript and your bundler/framework.
- The copied aggregate CSS imported from your app CSS, or equivalent manual Tailwind/theme imports.
- Tailwind CSS v4 in the consuming app.

For keyboard behavior, `pnpm exec dgadd add ui/menu --integration copy` copies standalone hooks. `pnpm exec dgadd add ui/menu --integration keys` rewrites imports to `@diffgazer/keys` and installs that runtime package.

### Runtime package mode

Use this when you want versioned package imports and do not need to customize source:

```bash
npm install @diffgazer/ui @diffgazer/keys
```

Configure Tailwind CSS v4 from the CSS file that imports Tailwind:

```css
@import "tailwindcss";
@import "@diffgazer/ui/sources.css";
@import "@diffgazer/ui/styles.css";
```

`@diffgazer/ui/sources.css` registers the package source paths Tailwind needs to scan.

```tsx
import { Button } from "@diffgazer/ui/components/button";
```

Runtime package mode exports compiled components, hooks, utilities, and CSS. It is not the customization path.

`@diffgazer/ui/styles.css` imports the package theme and component CSS only. It intentionally does not import Tailwind, so every app has exactly one Tailwind import in its own global CSS entrypoint.

### Direct shadcn / manual copy

Install from the hosted registry:

```bash
npx shadcn add https://r.b4r7.dev/r/ui/button.json
```

To copy source without the shadcn CLI, use the source files at `https://github.com/b4r7x/diffgazer/tree/main/libs/ui/registry/ui/button`.

Files install into your configured `components/ui` directory. Configure the `@ui` registry namespace in `components.json`; see docs for setup.

## Keyboard Dependencies

`@diffgazer/keys` is a required peer for runtime package mode because package entries can import keyboard hooks:

```tsx
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { useScope } from "@diffgazer/keys";
```

Icon primitives ship from `@diffgazer/ui`; there is no `lucide-react` peer or runtime dependency.

`figlet` is an optional peer dependency. The `./components/logo` entry renders static text or caller-provided `asciiText` and does not import `figlet`. The `./components/logo/figlet` helper loads `figlet` lazily inside `getFigletText`; install it only if you call this helper:

```bash
npm install figlet
```

Without `figlet` installed, importing `@diffgazer/ui/components/logo/figlet` still succeeds. The failure surfaces at call time: `getFigletText()` rejects with an error whose message mentions the `optional peer dependency 'figlet'`. All other `@diffgazer/ui` entries work unchanged.

`lowlight` is an optional peer dependency used only for syntax highlighting in `./components/code-block`. The component loads `lowlight` lazily, so install it only if you render highlighted code:

```bash
npm install lowlight
```

### Optional peers by entry

Only install the optional peer an entry needs:

| Optional peer | Entries that need it |
| --- | --- |
| `figlet` | `./components/logo/figlet` (lazy; the default `./components/logo` does not need it) |
| `lowlight` | `./components/code-block` (lazy) |

## Entries

This package is ESM-subpath-only: it has no top-level `.` export and no `main`/`types`
field. Import the specific subpath you need (listed below); `exports`-aware tooling
(bundlers, TypeScript `bundler`/`node16` resolution) resolves each entry directly.

- `@diffgazer/ui/components/*` (see package.json exports for the full component list)
- `@diffgazer/ui/hooks/controllable-state`
- `@diffgazer/ui/hooks/form-reset`
- `@diffgazer/ui/hooks/floating-indicator`
- `@diffgazer/ui/hooks/active-heading`
- `@diffgazer/ui/hooks/overflow-detection`
- `@diffgazer/ui/hooks/overflow-items`
- `@diffgazer/ui/hooks/outside-click`
- `@diffgazer/ui/hooks/presence`
- `@diffgazer/ui/hooks/is-mobile`
- `@diffgazer/ui/hooks/floating-position`
- `@diffgazer/ui/hooks/listbox`
- `@diffgazer/ui/hooks/copy-to-clipboard`
- `@diffgazer/ui/hooks/composed-refs`
- `@diffgazer/ui/lib/compose-refs`
- `@diffgazer/ui/lib/selectable-collection`
- `@diffgazer/ui/lib/utils`
- `@diffgazer/ui/theme-base.css`
- `@diffgazer/ui/theme.css`
- `@diffgazer/ui/sources.css`
- `@diffgazer/ui/styles.css`

## Peer dependencies

- React `>=19.2.0`
- React DOM `>=19.2.0`
- `@diffgazer/keys >= 0.2.0` (required — keyboard-backed entries import it at module top; see Keyboard Dependencies)
- `figlet >= 1.10.0` (optional — only `./components/logo/figlet`)
- `lowlight >= 3.0.0` (optional — only `./components/code-block`)

## Versioning and Migration

Packages use changesets and semantic versioning. During `0.x`, public contracts can still move; breaking changes must be documented in changesets and migration docs. Runtime package consumers update with their package manager. Copy-first consumers update manually with:

```bash
pnpm exec dgadd diff ui/button
pnpm exec dgadd add ui/button --overwrite
```

Review copied source in your own git diff before keeping updates.

## Supported browsers

`@diffgazer/ui` ships modern CSS and inherits the Tailwind CSS v4 baseline. The supported floor is:

| Browser | Minimum version |
|---------|-----------------|
| Chrome  | 111             |
| Edge    | 111             |
| Safari  | 16.4            |
| Firefox | 128             |

The declared `browserslist` field in `package.json` matches this floor. Bundlers that read `browserslist` (esbuild, Lightning CSS, swc, browserslist-loaded postcss plugins) target the same versions automatically.

### Cosmetic degradations within the supported floor

These browsers run the library, but a few visual details fall back to a simpler render:

- **Safari 16.4 - 18.1** ignores `scrollbar-gutter: stable` on `<html>`. The library wraps this declaration in `@supports (scrollbar-gutter: stable)`, so older Safari simply does not reserve the gutter and may shift layout when scrollbars toggle.
- **Safari 16.4 - 17.x** falls back to a solid backdrop without blur for `dialog::backdrop`. The library emits `-webkit-backdrop-filter` alongside the unprefixed property, so blur works on Safari 18+ and the solid backdrop is the cosmetic fallback below that.
- **Chrome below 117 / Safari below 17.4** snap accordion and stepper height transitions instead of animating `1fr ↔ 0fr` grid tracks. Functionally equivalent.

### Out of scope

Internet Explorer, legacy (EdgeHTML) Edge, and Safari below 16.4 are not supported. The library does not ship polyfills for `:has()`, `inert`, container queries, or other modern primitives required by Tailwind CSS v4.

## Repository metadata

- **Source:** https://github.com/b4r7x/diffgazer/tree/main/libs/ui
- **Homepage:** https://github.com/b4r7x/diffgazer/tree/main/libs/ui
- **Security:** https://github.com/b4r7x/diffgazer/security/advisories/new
- **Support:** https://github.com/b4r7x/diffgazer/issues
