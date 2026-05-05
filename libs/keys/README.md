# @diffgazer/keys

Composable, scoped keyboard navigation hooks for React.

## Install

```bash
npm install @diffgazer/keys
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

## Exports

- `@diffgazer/keys` → default entry point (`dist/index.*`).

## Repository metadata

- **Source:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
- **Homepage:** https://github.com/b4r7x/diffgazer/tree/main/libs/keys
