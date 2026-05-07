# @diffgazer/keys

Composable, scoped keyboard navigation hooks for React `>=19.2.0`.

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

## Exports

- `@diffgazer/keys` → default entry point (`dist/index.*`).

## Repository metadata

- **Source:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
- **Homepage:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
