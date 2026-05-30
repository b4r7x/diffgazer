# Findings: apps-hub

`@diffgazer/hub`

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 8 | 0 | 8 | 0 |
| Medium | 8 | 0 | 8 | 0 |
| Low | 1 | 0 | 1 | 0 |
| **Total** | **17** | **0** | **17** | **0** |

---

## Critical

_No critical findings._

---

## High

### F180 — [NEW] [reusability] apps/hub hardcodes design tokens instead of importing from @diffgazer/ui

- **file:line** — `apps/hub/public/index.html:19-35`
- **What** — The inline `<style>` block in index.html contains hardcoded hex color values (`#0a0a0a`, `#e0e0e0`, `#7aa2f7`, `#888`, `#555`) instead of importing design tokens from @diffgazer/ui.
- **Why** — Hardcoded colors that bypass the shared design system drift out of sync with @diffgazer/ui and duplicate values that should have a single source.
- **How** — Convert apps/hub from raw HTML to a thin Vite app (same pattern as apps/landing): create src/App.tsx, import @diffgazer/ui theme CSS files, move hardcoded styles to Tailwind/CSS variables, or compose components from @diffgazer/ui.
- **Effort** — high

### F182 — [NEW] [dead-code] apps/hub references favicon.ico and og-image.png assets that do not exist

- **file:line** — `apps/hub/public/index.html:9,13`
- **What** — index.html declares `<link rel="icon" href="/favicon.ico" />` and `<meta property="og:image" content="https://b4r7.dev/og-image.png" />` but neither file exists in apps/hub/public/.
- **Why** — Referencing assets that are never produced results in broken favicon and Open Graph image links when the page is served.
- **How** — Either (a) create the assets (favicon.ico, og-image.png) in apps/hub/public/, or (b) remove the meta tags and favicon link. Given that the HTML includes comprehensive OG metadata, assets should be created (or use a placeholder/inherited asset from a shared location).
- **Effort** — low

### F183 — [NEW] [architecture] apps/hub has no build script or turbo task

- **file:line** — `apps/hub/package.json:1-6`
- **What** — package.json lacks any `scripts` field (no dev, build, test, type-check). There is no corresponding turbo task in turbo.json for `@diffgazer/hub#build`.
- **Why** — With no build script or turbo task, the package is excluded from the monorepo build/test pipeline and cannot be developed or validated like its sibling apps.
- **How** — Convert apps/hub from raw HTML stub to a proper Vite app: (1) create tsconfig.json, vite.config.ts, vitest.config.ts (copy patterns from apps/landing); (2) add `"scripts": { "dev": "vite", "build": "tsc -b && vite build", "type-check": "tsc --noEmit", "test": "vitest run" }` and `"dependencies": { "@diffgazer/ui": "workspace:*", "react": "^19.2.4", "react-dom": "^19.2.4", ... }` to package.json; (…
- **Effort** — high

### F293 — [NEW] [file-organization] Package.json is incomplete stub — no scripts, no dependencies, no type field

- **file:line** — `apps/hub/package.json:1-6`
- **What** — package.json only contains name, private flag, version (0.0.0), and description. Missing: all build/dev scripts, type: "module", TypeScript/Vite dependencies, and dev dependencies required for a modern app.
- **Why** — An incomplete package manifest leaves the app without the scripts, type declaration, and dependencies needed to build, run, or align with the rest of the workspace.
- **How** — Scaffold package.json with scripts: build, dev, type-check, test (mirroring apps/landing); add deps: @diffgazer/ui@workspace:*, @diffgazer/shell@workspace:*, react, react-dom, tailwindcss, @tailwindcss/vite; add devDeps: @types/react, @types/react-dom, @vitejs/plugin-react, vite, typescript, vitest, jsdom, @testing-library/react.
- **Effort** — medium

### F294 — [NEW] [architecture] Missing turbo task — apps/hub#build not declared in turbo.json

- **file:line** — `turbo.json:1-44`
- **What** — turbo.json has build tasks for @diffgazer/landing (line 14-16), @diffgazer/docs (line 9-12), and diffgazer (line 18-20), but no @diffgazer/hub#build task. This breaks the monorepo build pipeline; `turbo run build --filter=@diffgazer/hub` will fail silently.
- **Why** — Without a declared build task, hub is left out of the orchestrated build pipeline and filtered builds for it do not run as expected.
- **How** — Add to turbo.json tasks: "@diffgazer/hub#build": { "dependsOn": ["^build"], "outputs": ["dist/**"] } — identical pattern to landing. Update deploy/hub.Dockerfile to copy `apps/hub/dist` instead of `apps/hub/public` once the app is built.
- **Effort** — low

### F295 — [NEW] [dead-code] Referenced favicon.ico does not exist, will 404 on serve

- **file:line** — `apps/hub/public/index.html:9`
- **What** — index.html declares `<link rel="icon" href="/favicon.ico" />` but `/Users/voitz/Projects/diffgazer-workspace/apps/hub/public/favicon.ico` does not exist. Verified: `ls apps/hub/public/favicon.ico` returns ENOENT.
- **Why** — A favicon link pointing at a missing file produces a 404 every time the page is served.
- **How** — Either (a) drop the favicon link if hub will use a shared favicon from @diffgazer/shell, or (b) create apps/hub/public/favicon.ico (copy from apps/docs/public/favicon.ico or create a new one). If (a), refactor index.html to be a proper Vite template (part of the full Vite scaffold, not raw HTML).
- **Effort** — low

### F296 — [NEW] [dead-code] Referenced og-image.png does not exist, OG meta tag points to 404

- **file:line** — `apps/hub/public/index.html:13`
- **What** — index.html declares `<meta property="og:image" content="https://b4r7.dev/og-image.png" />` but the asset is missing (verified: no og-image.png, og-image.jpg, or similar in the workspace outside node_modules).
- **Why** — An Open Graph image tag pointing at a nonexistent asset yields broken social-share previews and a 404 for crawlers.
- **How** — Create apps/hub/public/og-image.png (1200x630px recommended for OG compliance). If deploying a Vite app, move assets into `public/` and ensure they are copied during build. Consider sharing the og-image between landing and hub if they have the same branding.
- **Effort** — low

### F300 — [NEW] [architecture] No src/ directory or TypeScript source — raw HTML only, not maintainable as code

- **file:line** — `apps/hub`
- **What** — apps/hub contains only package.json + public/. No src/ directory, no .tsx/.ts files, no tsconfig.json, no vite.config.ts. It is pure static HTML with no TypeScript tooling.
- **Why** — A raw-HTML-only app has no TypeScript tooling or component structure, so it cannot share types, components, or build conventions with the rest of the monorepo.
- **How** — Scaffold the directory structure: src/main.tsx, src/App.tsx, src/styles/index.css, index.html (Vite template), vite.config.ts, vitest.config.ts, tsconfig.json. Follow the landing app structure exactly (they should be nearly identical after the shell is created).
- **Effort** — high

---

## Medium

### F55 — [NEW] [file-organization] Inconsistent package.json metadata: missing 'type' field

- **file:line** — `apps/hub/package.json`
- **What** — apps/hub/package.json lacks the "type": "module" field present in all sibling app packages (apps/landing, apps/web, apps/docs). Workspace consistency dictates all ESM packages declare this explicitly.
- **Why** — Omitting `"type": "module"` diverges from every sibling app package and leaves the module format implicit rather than declared.
- **How** — Add "type": "module" to apps/hub/package.json after "private": true, even though hub has no actual JS/TS code. This signals intent to the toolchain and maintains workspace uniformity.
- **Effort** — low

### F179 — [NEW] [file-organization] apps/hub is missing the `type: module` field in package.json

- **file:line** — `apps/hub/package.json:1-6`
- **What** — package.json is missing the `"type": "module"` declaration required for ESM packages in this monorepo; all other app packages declare it.
- **Why** — Without an explicit `"type": "module"`, hub is inconsistent with the monorepo's ESM convention shared by every other app package.
- **How** — Add `"type": "module"` field to apps/hub/package.json, matching the pattern in sibling apps (apps/landing line 4, apps/web line 5, apps/docs line 5).
- **Effort** — low

### F181 — [NEW] [dead-code] apps/hub robots.txt advertises a sitemap that does not exist

- **file:line** — `apps/hub/public/robots.txt:4`
- **What** — robots.txt declares `Sitemap: https://b4r7.dev/sitemap.xml` but the build process never generates a sitemap.xml file for hub.
- **Why** — Advertising a sitemap that is never generated points crawlers at a nonexistent file.
- **How** — Either (a) remove the `Sitemap:` line from robots.txt, or (b) add a build step to generate a sitemap (currently only apps/docs generates one via scripts/generate-sitemap.mjs). Given hub is a stub with minimal content, option (a) is simpler; option (b) becomes viable once hub is a proper Vite app.
- **Effort** — low

### F184 — [NEW] [reusability] apps/hub hardcodes all cross-property links instead of using a shared siteLinks config

- **file:line** — `apps/hub/public/index.html:8,12,45-47`
- **What** — The canonical href, OG URL, and navigation links are hardcoded as literal strings: `https://b4r7.dev`, `https://diffgazer.b4r7.dev`, `https://docs.b4r7.dev`, `https://github.com/b4r7x`.
- **Why** — Hardcoding cross-property URLs in each file leaves them without a single source of truth, so they drift as properties move or rename.
- **How** — Once @diffgazer/shell is created (a new package recommended by DEPLOYMENT-ROUTING.md Section 2), define a `siteLinks` config object exporting the property URLs and GitHub. When hub is converted to a Vite app, import and consume this config. For the interim (if hub stays raw HTML), extract the hardcoded URLs to a separate config file or document them in a way that signals they are shared.
- **Effort** — high

### F297 — [NEW] [dead-code] Sitemap reference in robots.txt not emitted — crawlers hit 404

- **file:line** — `apps/hub/public/robots.txt:4`
- **What** — robots.txt declares `Sitemap: https://b4r7.dev/sitemap.xml` but the app has no build step and does not emit a sitemap. Crawlers will 404 when attempting to fetch it.
- **Why** — A sitemap directive with no emitted sitemap sends crawlers to a 404.
- **How** — Either (a) remove line 4 from robots.txt (simplest for a stub with few pages), or (b) add a `generate-sitemap.mjs` script to hub that emits a single-page XML (e.g., listing only `/`). Option (a) is recommended for a stub portfolio.
- **Effort** — low

### F298 — [NEW] [dry] Hardcoded hex color values in inline <style> bypass design system, guaranteed to drift

- **file:line** — `apps/hub/public/index.html:19-34`
- **What** — index.html contains inline CSS with hardcoded hex values (#0a0a0a, #e0e0e0, #7aa2f7, #888, #555) instead of importing @diffgazer/ui theme tokens. These colors do not live anywhere else in the codebase; they are duplicated magic values.
- **Why** — Inline hex values that duplicate no shared token bypass the design system and drift independently of @diffgazer/ui.
- **How** — Convert apps/hub from raw HTML to a thin Vite+React app (mirroring landing). Scaffold vite.config.ts, index.html template (div#root + script src=/src/main.tsx), src/main.tsx, and src/App.tsx. In src/styles/index.css, import @diffgazer/ui/theme-*.css and tailwindcss. Use tailwind utility classes or imported tokens instead of inline hex. This is the 'docs/template as entry point' pattern from DEPLOY…
- **Effort** — high

### F299 — [NEW] [dry] All cross-property URLs hardcoded instead of routed through shared siteLinks config

- **file:line** — `apps/hub/public/index.html:45-47`
- **What** — HTML hardcodes three URLs: `https://diffgazer.b4r7.dev` (line 45), `https://docs.b4r7.dev` (line 46), and `https://github.com/b4r7x` (line 47). These are magic strings; no single source of truth.
- **Why** — Cross-property URLs hardcoded as magic strings have no single source of truth and must be updated in every location when a property changes.
- **How** — Create @diffgazer/shell package (per DEPLOYMENT-ROUTING.md Section 2) exporting a `siteLinks` config: { diffgazer, docs, hub, github }. Once hub becomes a Vite app, import siteLinks and use it in the nav links. This makes the config a single source of truth.
- **Effort** — medium

### F301 — [NEW] [tests] No test files — cannot verify UI or cross-links work correctly

- **file:line** — `apps/hub`
- **What** — No .test.tsx or .test.ts files in apps/hub. Once it becomes a Vite app, it needs test coverage comparable to landing (App.test.tsx).
- **Why** — With no tests, there is no automated verification that the UI renders or that cross-links resolve correctly.
- **How** — Add src/App.test.tsx (copy pattern from landing/src/App.test.tsx). Test that the app renders, that cross-links resolve to the correct siteLinks config entries, and that canonical/OG meta tags are correct. Use vitest + @testing-library/react.
- **Effort** — low

---

## Low

### F185 — [NEW] [yagni] apps/hub description field describes a portfolio but no portfolio content exists

- **file:line** — `apps/hub/package.json:5`
- **What** — package.json description is "b4r7.dev hub — project portfolio" but the HTML contains only three static links, no portfolio content (projects, case studies, experience, etc.).
- **Why** — The description claims portfolio functionality the stub does not yet provide, misrepresenting the current state of the app.
- **How** — Update the description to match the current stub status: `"description": "b4r7.dev hub — landing page"` or plan and implement actual portfolio content in a follow-up task.
- **Effort** — low
