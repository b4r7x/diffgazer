# Findings — `@diffgazer/landing`

Audit date: 2026-05-28

## Summary

| Severity | Count | Statuses |
| --- | --- | --- |
| Critical | 0 | — |
| High | 4 | NEW ×4 |
| Medium | 10 | NEW ×10 |
| Low | 7 | NEW ×7 |
| **Total** | **21** | **NEW ×21** |

---

## Critical

_No critical findings._

---

## High

### [NEW] [a11y] Missing keyboard focus indicator on documentation link

**File:** `apps/landing/src/App.tsx:15-20`

**What:** The anchor tag linking to documentation has hover styles (`hover:text-tui-fg`) but lacks keyboard focus indicator (`focus-visible:outline` or `focus-visible:ring`).

**Why:** Keyboard users cannot see which element is focused, breaking visible focus requirements and degrading keyboard navigation.

**How:** Add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground` to the anchor className to match project patterns.

**Effort:** low

---

### [NEW] [other] Missing favicon and OG image assets for public landing page

**File:** `apps/landing/index.html:9,13`

**What:** index.html references `/favicon.ico` and `https://diffgazer.b4r7.dev/og-image.png`, but these files do not exist in `apps/landing/public/`.

**Why:** Broken asset references degrade the public landing page presentation and social-share previews, and produce 404s in production.

**How:** Create `apps/landing/public/favicon.ico` and `apps/landing/public/og-image.png` (or .png format for OG). These should be copied from a shared asset or created for the brand. The vite build will copy robots.txt automatically; add favicon and og-image to the `public/` directory so they are bundled into `dist/`.

**Effort:** low

---

### [NEW] [public-api] Hardcoded cross-app URL should use environment variable with fallback

**File:** `apps/landing/src/App.tsx:16`

**What:** Documentation link is hardcoded to `https://docs.b4r7.dev` instead of using `import.meta.env.VITE_DOCS_ORIGIN` or similar environment variable.

**Why:** A hardcoded cross-app URL cannot be configured per environment and breaks if the docs origin changes.

**How:** Replace `href="https://docs.b4r7.dev"` with `href={import.meta.env.VITE_DOCS_ORIGIN ?? 'https://docs.b4r7.dev'}` or use a config module. Add `VITE_DOCS_ORIGIN` to `.env.example` and document it. Also update the test to mock `import.meta.env`.

**Effort:** low

---

### [NEW] [a11y] Landing page missing accessibility landmarks and skip link

**File:** `apps/landing/src/App.tsx:1-25`

**What:** The landing page renders a single `<div>` wrapping `<main>` with no `<header>`, `<footer>`, `<nav>`, landmark roles (`role=`), or skip-to-main-content link. This violates WCAG 2.1 2.4.1 (Bypass Blocks) and 1.3.1 (Info and Relationships).

**Why:** Without landmarks and a skip link, screen reader and keyboard users cannot efficiently navigate or bypass repeated content, failing WCAG conformance.

**How:** Add a skip-to-main-content link at the top (typically hidden visually but keyboard-accessible), add `id="main"` to the main element, optionally add `<header>` and `<footer>` landmarks, and ensure `<main>` is a semantic landmark role. Example: `<a href="#main" className="sr-only">Skip to main content</a>` at the top, then add `id="main"` to `<main>`.

**Effort:** low

---

## Medium

### [NEW] [a11y] Code element in landing lacks semantic description for screen readers

**File:** `apps/landing/src/App.tsx:10-12`

**What:** The `<code>` element containing `npm install -g diffgazer` is presented as a visual snippet without an aria-label, aria-describedby, or semantic prose explaining its purpose to screen reader users.

**Why:** Screen reader users hear the raw command string with no context about what it is or how to use it.

**How:** Add `aria-label="npm install command"` to the code element, or wrap it in a figure/figcaption with semantic markup. For example: `<code aria-label="Install Diffgazer using npm globally">npm install -g diffgazer</code>`.

**Effort:** low

---

### [NEW] [type-safety] Test files excluded from TypeScript gate coverage

**File:** `apps/landing/tsconfig.json:14,apps/landing/vitest.config.ts:6`

**What:** `App.test.tsx` is explicitly excluded from tsconfig.json (line 14) and no `test:types` script exists in package.json. Test files are not type-checked during the type-check task or the monorepo root type-check gate.

**Why:** Type errors in test code go undetected by the type-check gate, allowing broken or untyped tests to pass CI.

**How:** Add `"test:types": "vitest --typecheck --typecheck.only --run"` to package.json scripts, and remove the exclude from tsconfig.json so tests are included. Alternatively, create a separate tsconfig.test.json and include it in the type-check script.

**Effort:** low

---

### [NEW] [reusability] Landing page is thin stub with no reuse of @diffgazer/ui components

**File:** `apps/landing/package.json:13,apps/landing/src/App.tsx:1-26`

**What:** Landing depends on @diffgazer/ui but imports nothing from it. The page is hand-written with raw Tailwind classes and semantic HTML instead of reusable UI primitives like Button, Link, Card, or the Typography component used in other apps.

**Why:** Hand-rolled markup diverges from shared primitives, risking inconsistent styling and accessibility behavior versus the rest of the product.

**How:** Consider whether a Button component or Link component from @diffgazer/ui would improve consistency or code reuse. If the landing is deliberately minimal for performance, document why. If adopting UI components, import and use them (e.g., Button for CTA, Card for content sections).

**Effort:** medium

---

### [NEW] [type-safety] Missing test:types script for TypeScript checking of test files

**File:** `apps/landing/package.json:5-11`

**What:** Landing app lacks a `test:types` script that type-checks test files, while sibling apps (web, docs) have it configured with `vitest --typecheck --typecheck.only --run`.

**Why:** Inconsistency with sibling apps means landing's test files escape the type-checking convention enforced elsewhere.

**How:** Add `"test:types": "vitest --typecheck --typecheck.only --run"` to scripts in `apps/landing/package.json` to match `apps/web` and `apps/docs`.

**Effort:** low

---

### [NEW] [type-safety] Test files excluded from TypeScript compilation in tsconfig

**File:** `apps/landing/tsconfig.json:11`

**What:** tsconfig.json explicitly excludes test files (`exclude: ["**/*.test.ts", "**/*.test.tsx"]`), preventing type-checking of test source code during `tsc --noEmit`.

**Why:** Test source is omitted from the compiler pass, so type regressions in tests are never surfaced by `tsc`.

**How:** Either (a) remove the exclude array from tsconfig.json to include tests by default, or (b) keep tests out of main tsc but rely on the `test:types` script (Vitest's typecheck mode) to type-check tests separately.

**Effort:** low

---

### [NEW] [other] Missing favicon asset breaks link reference

**File:** `apps/landing/public`

**What:** index.html references `<link rel="icon" href="/favicon.ico" />` but the file does not exist in `apps/landing/public/` or `dist/`.

**Why:** The broken favicon reference produces a 404 and leaves the page without an icon in browser tabs and bookmarks.

**How:** Either (a) create favicon.ico file in `apps/landing/public/` (e.g., 16x16 or 32x32 ICO format), or (b) remove the favicon link from index.html if favicon is not needed for a placeholder, or (c) use a favicon from a CDN with proper Cache-Control.

**Effort:** low

---

### [NEW] [a11y] Incomplete a11y coverage in tests — no keyboard navigation verification

**File:** `apps/landing/src/App.test.tsx:12-18`

**What:** The test for the documentation link verifies href and text content but does not verify keyboard accessibility (focus indicator or tab order).

**Why:** Without keyboard-focus assertions, regressions in focus reachability or focus styling can ship undetected.

**How:** Add a test that verifies keyboard focus: e.g., use `userEvent.tab()` to verify focus reaches the link, or add a visual assertion that focus-visible styles are applied.

**Effort:** low

---

### [NEW] [type-safety] tsconfig.json missing strict TypeScript compiler flags present in libs

**File:** `apps/landing/tsconfig.json`

**What:** tsconfig.json has `strict: true` but omits `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`, and `verbatimModuleSyntax` that are present in lib tsconfigs (libs/ui, libs/keys) and apps/web.

**Why:** Weaker compiler settings than the rest of the workspace allow classes of type errors that are caught elsewhere to slip through here.

**How:** Add `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"isolatedModules": true`, and `"verbatimModuleSyntax": true` to `apps/landing/tsconfig.json` to match the workspace standard.

**Effort:** low

---

### [NEW] [file-organization] Build script uses tsc -b with outDir but no noEmit, causing wasted TypeScript output

**File:** `apps/landing/package.json:7`

**What:** Build script runs `tsc -b && vite build`. The tsconfig has `outDir: dist` and no `noEmit: true`, so tsc emits .js files into `dist/` before vite build overwrites them. The tsc output is wasted work.

**Why:** The emitted-then-overwritten artifacts are pure wasted build effort and can leave stale files in `dist/` if the vite step is interrupted.

**How:** Option 1 (preferred): Add `"noEmit": true` to tsconfig.json, remove `outDir: dist`, and change the build script to `vite build` (vite runs tsc via its React plugin for type-checking). Option 2: Add `"composite": true` and project references if this is intended to be a composite project. The `type-check` script already runs `tsc --noEmit`, so the build script can rely on that in turbo rather than duplicating emit.

**Effort:** low

---

### [NEW] [tests] Test suite does not verify accessibility compliance of landing page

**File:** `apps/landing/src/App.test.tsx`

**What:** The test suite has two tests (heading/install and documentation link) but does not verify landmark structure, skip links, or semantic HTML. No a11y checks for WCAG conformance.

**Why:** Without automated a11y assertions, the landmark and skip-link gaps flagged elsewhere can regress silently.

**How:** Add a test using jest-axe or @testing-library/react's a11y testing. Example: `await axe(container)` to catch accessibility violations, or manually assert presence of skip links and landmarks: `expect(screen.getByRole('link', { name: /skip/i })).toBeInTheDocument()` and verify landmark regions exist.

**Effort:** medium

---

## Low

### [NEW] [a11y] Missing skip-to-main-content link

**File:** `apps/landing/src/App.tsx:2-26`

**What:** No skip-to-main link is present in the page structure. Keyboard users and screen reader users must tab through any header/navigation before reaching the main content, even on a simple single-screen page.

**Why:** Lack of a bypass mechanism slows keyboard and screen reader navigation and fails WCAG 2.4.1.

**How:** Add a visually-hidden skip link at the start of the App component that jumps to the main element. For example: `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>` and add `id="main-content"` to the `<main>`.

**Effort:** low

---

### [NEW] [architecture] Hardcoded external documentation link URL

**File:** `apps/landing/src/App.tsx:15-20`

**What:** The documentation link hardcodes `href="https://docs.b4r7.dev"`. If the docs domain changes or becomes unavailable, the link breaks. The test hard-codes the same URL.

**Why:** Duplicating the URL across source and test means a domain change requires edits in multiple places and risks drift.

**How:** Either create an environment variable or constant for the docs URL and use it in both App.tsx and App.test.tsx, or accept the hardcoded value if the domain is guaranteed stable. If this is intentional, add a comment explaining the assumption.

**Effort:** low

---

### [NEW] [other] Landing page lacks structured data (JSON-LD) for SEO

**File:** `apps/landing/index.html:1-27`

**What:** The landing page HTML includes og/twitter metadata but no JSON-LD structured data (schema.org). Search engines and social platforms can infer more context from structured data (Product, SoftwareApplication, Organization schema).

**Why:** Missing structured data limits how richly search engines and social platforms can represent the product.

**How:** Add a `<script type="application/ld+json">` block in the `<head>` with a SoftwareApplication or Product schema. Example: `{"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Diffgazer", "description": "...", "url": "https://diffgazer.b4r7.dev"}`.

**Effort:** low

---

### [NEW] [kiss] Whitespace-only styled wrapper div around main content

**File:** `apps/landing/src/App.tsx:3`

**What:** The outermost `<div>` with classes `min-h-screen bg-background font-mono text-foreground` is purely structural/styling. It adds a layout wrapper but no semantic content or accessibility role.

**Why:** A purely cosmetic wrapper adds DOM depth without semantic value; the same styling could live at the document/body level.

**How:** Consider moving the min-h-screen/bg/font/text classes to a global CSS rule or Tailwind @apply, or apply them to index.html body element. The div could then be removed or kept with minimal styling.

**Effort:** low

---

### [NEW] [dry] Hardcoded strings not extracted to constants

**File:** `apps/landing/src/App.tsx:5-19`

**What:** Multiple hardcoded strings appear directly in JSX: product name (`diffgazer`), npm command (`npm install -g diffgazer`), documentation URL (`https://docs.b4r7.dev`), and button text (`Documentation →`).

**Why:** The same literals are repeated across source and tests, so changes must be made in several places and can drift.

**How:** Extract strings to a constants file (e.g., `apps/landing/src/constants.ts`) with named exports: `export const DOCS_URL = "https://docs.b4r7.dev"`, `export const INSTALL_COMMAND = "npm install -g diffgazer"`, etc. Import and use in both App.tsx and App.test.tsx.

**Effort:** low

---

### [NEW] [reusability] @diffgazer/ui is in dependencies but not used in component code

**File:** `apps/landing/package.json:13`

**What:** @diffgazer/ui is listed as a dependency but only imported in styles/index.css (for theme CSS), not in any .tsx or .ts files. The package is not used for components.

**Why:** An undocumented dependency used only for CSS theming is easy to misread as unused and risks accidental removal.

**How:** Verify that the CSS imports in styles/index.css are necessary (theme-base.css, theme.css, styles.css). If they are, document why @diffgazer/ui is a dependency (CSS theming). If styles can be inlined or sourced differently, consider removing it. The CSS imports are likely necessary for the tailwind theme, so this is likely acceptable, but the motivation should be clear in a comment or README.

**Effort:** low

---

### [NEW] [other] Install command in `<code>` element is not copyable or interactive

**File:** `apps/landing/src/App.tsx:10-12`

**What:** The npm install command is rendered in a `<code>` element as plain text. Users cannot easily copy it; there is no button or click handler to copy to clipboard.

**Why:** Forcing manual selection of the install command adds friction to the primary onboarding action.

**How:** Replace the `<code>` element with a Button or interactive component that copies the command to the clipboard on click. Alternatively, wrap the code block with a button overlay or use a library like copy-to-clipboard. A simple approach: add an onClick handler and `navigator.clipboard.writeText('npm install -g diffgazer')`.

**Effort:** medium

---
