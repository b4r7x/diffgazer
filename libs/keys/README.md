# @diffgazer/keys

Composable, scoped keyboard navigation hooks for React `>=19.2.0`.

## Consumption Paths Summary

All npm package names are external publish-gated as of May 2026. Public npm commands are valid only after `npm view @diffgazer/keys version` succeeds. Local tarballs are the package-mode validation path before publication. `@diffgazer/keys` requires no CSS or Tailwind setup.

| Path | Standalone hooks | Provider-backed APIs |
|------|-----------------|---------------------|
| Manual copy / shadcn (future) | `npx shadcn add https://docs.diffgazer.b4r7.dev/r/keys/navigation.json` (hosted registry not yet live — see [Hosted Registry Status](../../PACKAGE_GOVERNANCE.md#hosted-registry-status)) | Not available |
| `dgadd` CLI | `pnpm exec dgadd add keys/navigation` | Not available |
| npm package | `npm install @diffgazer/keys` | `npm install @diffgazer/keys` |

Provider-backed APIs (`KeyboardProvider`, `useKey`, `useScope`, `useScopedNavigation`, `useActionRowNavigation`, `useFocusZone`) require `KeyboardProvider` and are only available through the npm package.

## Install

`@diffgazer/keys` is external publish-gated as of May 6, 2026. Use the public npm command only after `npm view @diffgazer/keys version` succeeds. Before publication, validate with a locally packed workspace tarball.

```bash
npm install @diffgazer/keys
```

## Dependency Policy

`@diffgazer/keys` has no runtime dependencies. React `>=19.2.0` is a peer dependency.

## Usage

```tsx
import { KeyboardProvider, useKey } from "@diffgazer/keys";

function Demo() {
  useKey("k", () => {
    console.log("shortcut triggered");
  });

  return (
    <button>Shortcut demo</button>
  );
}

export function App() {
  return (
    <KeyboardProvider>
      <Demo />
    </KeyboardProvider>
  );
}
```

## Consumption Paths

`@diffgazer/keys` hooks are available through three paths:

### All three paths (package, dgadd copy, direct shadcn/manual copy)

| Hook | Description |
|------|-------------|
| `useNavigation` | Standalone keyboard navigation for role-based lists and tabs |
| `useFocusRestore` | Capture and restore focus around overlays with nested stack safety |
| `useFocusTrap` | Trap Tab focus within a container element |
| `useScrollLock` | Prevent body/element scrolling with reference counting |

### Package-only (`import from "@diffgazer/keys"`)

| API | Description |
|-----|-------------|
| `KeyboardProvider` | Provider for scoped keyboard context |
| `useKey` | Register a keyboard shortcut within the active scope |
| `useScope` | Activate a keyboard scope |
| `useScopedNavigation` | Navigation scoped to the keyboard provider |
| `useActionRowNavigation` | Roving row navigation for action toolbars within the keyboard provider |
| `useFocusZone` | Multi-zone focus management |
| `keys` | Key constant utilities |
| `useKeyboardContext` | Access the keyboard context |
| `useOptionalKeyboardContext` | Optionally access the keyboard context |

Package-only hooks require `KeyboardProvider` and are not available through copy or registry paths.

## Exports

- `@diffgazer/keys` → default entry point (`dist/index.*`). Root-only, no subpath exports.

## Repository metadata

- **Source:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
- **Homepage:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
