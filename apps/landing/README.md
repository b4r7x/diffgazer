# @diffgazer/landing

Private static Vite landing page for the public Diffgazer marketing surface. It is vanilla HTML/TS and imports only `@diffgazer/ui/styles.css` for theme tokens and the Panel/DiffView data-attribute contracts; it carries no product runtime logic, docs utilities, React runtime, Tailwind setup, or direct `@diffgazer/keys` dependency.

## Environment

`VITE_DOCS_ORIGIN` sets the documentation link target. It defaults to `https://docs.b4r7.dev`.
`VITE_GITHUB_URL` sets the GitHub and license link target. It defaults to `https://github.com/b4r7x/diffgazer`.

## Commands

```bash
pnpm --filter @diffgazer/landing dev
pnpm --filter @diffgazer/landing build
pnpm --filter @diffgazer/landing preview
pnpm --filter @diffgazer/landing type-check
pnpm --filter @diffgazer/landing test
```

`apps/landing/src/boundary.test.ts` enforces the private landing boundary: `@diffgazer/ui` is the only workspace dependency declared or imported from source.
