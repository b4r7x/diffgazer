# Task T-DOCS-SITE — Fix /ui/docs and /keys/docs SSR + prerender + per-page meta + sitemap

**Source findings:** DOCS-002, NEW-002, NEW-003, NEW-004
**Severity:** Critical
**Phase:** 1
**Blocks:** T-DIST-DEPLOY (no point deploying broken docs)
**Blocked by:** T-VITE-ALIAS (build must work first)

## Goal
The docs site currently:

1. `/ui/docs` and `/keys/docs` are client-only `<Navigate>` routes — SSR returns empty 36 KB shell with only "Skip to content" visible. Empty pages get cached by CDNs and crawlers (NEW-002).
2. `apps/docs/vite.config.ts:18-22` unconditionally pushes `/docs` (non-existent route) into prerender list (NEW-003).
3. Top-level `apps/docs/content/docs/{ui,keys}/index.mdx` becomes `/ui/docs/index` and `/keys/docs/index` (orphaned), while `/ui/docs` and `/keys/docs` are the client-only redirects (NEW-004).
4. `apps/docs/src/routes/$lib/docs/$.tsx:54-62` `head()` only emits `title` — per-page `description` is loaded but never written (DOCS-002).
5. No `og:*`, `twitter:card`, `<link rel="canonical">`, JSON-LD, `theme-color`, `manifest`.
6. `apps/docs/public/robots.txt` is allow-all with no `Sitemap:` directive.
7. No `sitemap.xml`.
8. Default `pnpm build` runs with `DOCS_PRERENDER=0` — flip to prerender by default.

## Files to touch (allowlist)
- `apps/docs/src/routes/$lib/docs/index.tsx` (replace client `<Navigate>` with a real component rendering the library intro from `content/docs/{lib}/index.mdx`)
- `apps/docs/src/routes/$lib/docs/$.tsx` (extend `head()` to emit description, canonical, og, twitter)
- `apps/docs/src/routes/__root.tsx` (default head: theme-color, manifest, og defaults, twitter defaults)
- `apps/docs/vite.config.ts` (remove `/docs` from prerender list; include `/ui/docs` and `/keys/docs` as real routes with content from `index.mdx`)
- `apps/docs/package.json` (flip `build` script default to `DOCS_PRERENDER=1 vite build`)
- `apps/docs/scripts/generate-sitemap.mjs` (NEW — generate `sitemap.xml` from prerender list at build time)
- `apps/docs/public/robots.txt` (add `Sitemap: https://diffgazer.com/sitemap.xml`)
- `apps/docs/src/lib/seo.ts` (NEW or extend — centralize head-tag generation)

## Files NOT to touch
- `apps/docs/content/docs/**/*.mdx` (content is separate task T-DOCS-PROPS)
- `apps/docs/registry/` (registry sources)
- Any `libs/*` source
- `source.config.ts` (Fumadocs config — already correct)

## Acceptance criteria
- [ ] `pnpm --filter @diffgazer/docs build` (default) prerenders by default and exits zero
- [ ] `pnpm --filter @diffgazer/docs build:prerender` still works
- [ ] `GET /ui/docs` (run `pnpm --filter @diffgazer/docs preview` then `curl`) returns SSR HTML with the library intro content from `ui/index.mdx`, NOT an empty shell
- [ ] Same for `/keys/docs`
- [ ] `/docs` (non-existent) is NOT in the prerender list — verify by reading `getPreRenderPages()` output
- [ ] Every prerendered route emits `<title>`, `<meta name="description">` matching the per-page MDX frontmatter, `<link rel="canonical">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:type">`, `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title">`, `<meta name="twitter:description">`
- [ ] Root head: `<meta name="theme-color">`, `<link rel="manifest">` if `manifest.webmanifest` exists (skip if not)
- [ ] `apps/docs/public/sitemap.xml` is generated at build time and lists all prerendered URLs with `<lastmod>` from the source `.mdx` file mtime
- [ ] `apps/docs/public/robots.txt` includes `Sitemap: https://diffgazer.com/sitemap.xml`
- [ ] All existing docs tests pass
- [ ] `pnpm --filter @diffgazer/docs type-check` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/docs build 2>&1 | tail -30
# Should exit zero AND show prerender pages
ls apps/docs/.output/public/ui/docs/ 2>/dev/null
ls apps/docs/.output/public/sitemap.xml 2>/dev/null
# Spin up preview server and probe
pnpm --filter @diffgazer/docs preview &
PREVIEW_PID=$!
sleep 3
curl -s http://localhost:4173/ui/docs | grep -E "<title>|description|og:title|canonical" | head -8
curl -s http://localhost:4173/keys/docs | head -50
curl -s http://localhost:4173/sitemap.xml | head -20
kill $PREVIEW_PID
pnpm --filter @diffgazer/docs type-check
pnpm --filter @diffgazer/docs test
```

## Notes & references
- Spec 029 §NEW-002/003/004 documents the routes-vs-prerender diff.
- Fumadocs `source.loader()` exposes `getPage` and `getPages` — use it to enumerate URLs for sitemap.
- TanStack Router `head()` function signature: returns `{ title, meta, links, scripts }` arrays. See https://tanstack.com/router/latest/docs/framework/react/api/router/HeadContentComponent.
- For `/ui/docs` and `/keys/docs` to render content, use the `content/docs/{lib}/index.mdx` loader from Fumadocs. The current `<Navigate>` was a punt; replace with actual MDX rendering.
- Canonical URL pattern: `https://diffgazer.com${pathname}`. If `diffgazer.com` is not yet live (T-DIST-DEPLOY), use a configurable origin via `VITE_PUBLIC_ORIGIN` env var defaulting to the production URL.

## Non-goals
- Do not change MDX content (T-DOCS-PROPS handles props extraction).
- Do not introduce a new docs framework or replace Fumadocs.
- Do not add a search/Algolia integration.
- Do not refactor the Vite config plugin chain.
- Do not generate per-page OG IMAGES (just OG meta tags pointing to a default static OG image at `apps/docs/public/og-default.png` if one exists, else skip og:image).
- Do not add JSON-LD (out of scope; potential follow-up).
