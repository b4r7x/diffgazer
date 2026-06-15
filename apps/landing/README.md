# @diffgazer/landing

Private static Vite landing page for the public Diffgazer marketing surface. It imports only `@diffgazer/ui` theme CSS and display primitives (`Button`, `Card`, `CodeBlock`, `DiffView`, `Kbd`); it carries no product runtime logic, docs utilities, or direct `@diffgazer/keys` dependency.

## Environment

`VITE_DOCS_ORIGIN` sets the documentation link target. It defaults to `https://docs.b4r7.dev`.

## Commands

```bash
pnpm --filter @diffgazer/landing dev
pnpm --filter @diffgazer/landing build
pnpm --filter @diffgazer/landing preview
pnpm --filter @diffgazer/landing type-check
pnpm --filter @diffgazer/landing test
```

`apps/landing/src/boundary.test.ts` enforces the private landing boundary: `@diffgazer/ui` is the only workspace dependency declared or imported from source.
