# @diffgazer/keys

Composable, scoped keyboard navigation hooks for React `>=19.2.0`.

## Consumption Paths Summary

> **Note:** Diffgazer packages are not yet published to npm. Until the first release, install from a local checkout of the repository.

`@diffgazer/keys` requires no CSS or Tailwind setup.

| Path | Standalone hooks | Provider-backed APIs |
|------|-----------------|---------------------|
| Manual copy / shadcn | Not available; use source checkout or a local registry preview | Not available |
| `dgadd` CLI | `pnpm exec dgadd add keys/navigation` | Not available |
| npm package | `npm install @diffgazer/keys` | `npm install @diffgazer/keys` |

The hosted registry is not public yet because r.b4r7.dev does not resolve. Use this source checkout or a local registry preview until the endpoint returns 200.

Provider-backed APIs (`KeyboardProvider`, `useKey`, `useScope`, `useScopedNavigation`, `useActionRowNavigation`, `useFocusZone`) require `KeyboardProvider` and are only available through the npm package.

## Install

Install the package from npm after the first release:

```bash
npm install @diffgazer/keys
```

## Dependency Policy

`@diffgazer/keys` has no runtime dependencies. React `>=19.2.0` is a peer dependency.

### Vitest navigation helper

`@diffgazer/keys/testing/navigation-behavior` is a Vitest-specific test helper. Keep runtime-only installs lean; the helper's test peers are optional and must be installed as development dependencies in projects that import it:

```bash
npm install --save-dev @testing-library/react@^16.3.2 @testing-library/user-event@^14.6.1 vitest@^4.1.0
```

Import the helper from its testing subpath inside a Vitest suite:

```ts
import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
```

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
| `keys` | Map multiple hotkeys to one handler for the `useKey` key-map overload |
| `useKeyboardContext` | Access the keyboard context |
| `useOptionalKeyboardContext` | Optionally access the keyboard context |

Package-only hooks require `KeyboardProvider` and are not available through copy or registry paths.

## Exports

- `@diffgazer/keys` -> default entry point (`dist/index.*`).
- `@diffgazer/keys/testing/navigation-behavior` -> optional Vitest keyboard-navigation test helper; install the test peers listed above before importing it.

## Repository metadata

- **Source:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
- **Homepage:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
