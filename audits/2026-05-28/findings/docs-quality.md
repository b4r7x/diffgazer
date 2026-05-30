# Findings: docs-quality

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 1 | 0 | 1 | 0 |
| Medium | 6 | 0 | 6 | 0 |
| Low | 2 | 0 | 2 | 0 |
| **Total** | **9** | **0** | **9** | **0** |

---

## Critical

_No critical findings._

---

## High

### F330 — [NEW] [docs] Registry items without corresponding documentation

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/registry.json`
- **What** — 37 public registry items in libs/ui/registry/registry.json have no dedicated MDX documentation: active-heading, aria-utils, compose-refs, controllable-state, diff, floating-indicator, floating-position, focus, form-reset, input-variants, listbox, outside-click, overflow-detection, overflow-items, presence, resolve-tab-target, search, segmented-variants, selectable-collection, selectable-variants, …
- **Why** — Public registry items shipped without documentation leave consumers unable to discover how to use a large share of the library.
- **How** — Prioritize by user impact: (1) Create docs for all public hooks (use-navigation, use-focus-trap, use-focus-restore, use-scroll-lock, use-is-mobile) in ui/hooks/; (2) Create docs for critical utilities (compose-refs, selectable-collection, aria-utils, focus, overflow-detection) in ui/utils/; (3) Document theme, variants, and semantic token helpers in ui/theme/; (4) Mark internal-only items with met…
- **Effort** — high

---

## Medium

### F87 — [NEW] [dead-code] Registry.json component descriptions are stale and mismatched

- **file:line** — `apps/docs/registry/registry.json:1-2777`
- **What** — 44+ component descriptions in registry.json don't match the authoritative component documentation in libs/ui/registry/component-docs/. Examples: button has 'Terminal-inspired button with variants' but should be 'Terminal-inspired button with bracket notation and 8 variants'; accordion missing 'Supports controlled and uncontrolled modes'; checkbox missing 'Standalone or CheckboxGroup with built-in …
- **Why** — Stale registry descriptions misrepresent components to anyone reading the public registry until it is regenerated from the authoritative docs.
- **How** — Regenerate apps/docs/registry/registry.json by running the artifact sync and registry generation scripts (prepare:generated). Verify that the descriptions in registry.json match both the MDX frontmatter descriptions and the descriptions in libs/ui/registry/component-docs/*.ts files. This is likely an artifact freshness issue where the registry was not regenerated after component doc metadata was u…
- **Effort** — low

### F88 — [NEW] [docs] Installation instructions are publish-gated but docs don't clearly highlight the temporary nature

- **file:line** — `apps/docs/content/docs/ui/getting-started/installation.mdx:7-34`
- **What** — Installation instructions mention publish-gating for packages but the docs use passive language ('external publish-gated as of May 6, 2026') without strong upfront messaging about the temporary nature of the workaround. The note on line 8 is easy to miss when scanning.
- **Why** — Passive, easy-to-miss wording about the temporary publish-gating lets readers mistake a stopgap workaround for the permanent install path.
- **How** — Add a prominent callout/alert block before the main installation instructions clearly stating 'Temporary: Packages are currently publish-gated. See Current Local Validation below.' Consider moving 'Current Local Validation' before the standard commands and reordering to show 'what will work' vs 'what's temporary'.
- **Effort** — low

### F89 — [NEW] [docs] Documentation lacks runnable installation examples for end-users

- **file:line** — `apps/docs/content/docs/ui/getting-started/installation.mdx:1-152`
- **What** — The installation docs show local workspace testing with pnpm pack commands and fixture apps, but do not include a post-publication version of the commands that users will actually run. Future readers will see instructions designed for development/testing rather than copy-paste installation.
- **Why** — Showing only local development/testing commands leaves end users without the copy-paste installation steps they will actually run after publication.
- **How** — Reorganize to: (1) document what users will do post-publication (npm install / pnpm dlx @diffgazer/add init / etc) as the primary path; (2) move 'Current Local Validation' to a subsection; (3) add a prominently dated note ('As of May 28, 2026, packages are publish-gated; check npm for status'). Consider using a frontmatter flag or comment to auto-generate dated warnings.
- **Effort** — medium

### F207 — [NEW] [docs] Misleading documentation link for useScope in hooks table

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/apps/docs/content/docs/ui/integrations/keys.mdx:119`
- **What** — The table row for `useScope` has a docs link labeled '[useKey]' pointing to '/ui/integrations/keys-usekey', which creates confusion. While both hooks are documented on that page, the link text is incorrect—it should be '[useScope]' or point to the dedicated hook page.
- **Why** — A mislabeled link in the hooks table sends readers to the wrong hook's documentation, creating confusion about which hook they are reading about.
- **How** — Change line 119 from '| `useScope` | Push a named scope onto the stack | Yes | [useKey](/ui/integrations/keys-usekey) |' to '| `useScope` | Push a named scope onto the stack | Yes | [useScope](/keys/hooks/use-scope) |' to link to the dedicated hook documentation page, or change link text to '[Keys Shortcuts](/ui/integrations/keys-usekey)' if keeping the current target.
- **Effort** — low

### F328 — [NEW] [docs] Missing section landing pages for keys documentation

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/apps/docs/content/docs/keys/index.mdx:14-18`
- **What** — The keys/index.mdx links to /keys/hooks and /keys/guides sections, but keys/hooks/index.mdx and keys/guides/index.mdx do not exist. Routing may fall back to first child or 404.
- **Why** — Linking to section landing pages that do not exist leaves navigation falling back to a child page or a 404 instead of an overview.
- **How** — Create keys/hooks/index.mdx and keys/guides/index.mdx with frontmatter (title, description) and a brief overview listing the hooks/guides below. Match the pattern used in keys/api/index.mdx (table format) or use a simple list like keys/getting-started/index.mdx.
- **Effort** — low

### F329 — [NEW] [docs] Incomplete UI documentation section coverage

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/apps/docs/content/docs/ui`
- **What** — Six UI documentation sections lack index.mdx files: getting-started/, hooks/, integrations/, patterns/, theme/, utils/. These sections have subsections (8-6 files each) but no section landing page, making it unclear what each section covers.
- **Why** — Sections with subsections but no landing page give readers no overview of what each section covers when they arrive at it.
- **How** — Create missing index.mdx files in each section with title, description, and a brief intro explaining the section's purpose. (Example: ui/getting-started/index.mdx could overview installation methods; ui/patterns/index.mdx could list the 4 patterns.)
- **Effort** — low

---

## Low

### F331 — [NEW] [docs] Very sparse theme/colors documentation

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/apps/docs/content/docs/ui/theme/colors.mdx:1-9`
- **What** — The colors.mdx page has only 9 lines: frontmatter + 1 intro line + 1 component reference. No documentation of color token names, variable naming conventions, or how to override them.
- **Why** — A near-empty colors page gives readers no token names, naming conventions, or override guidance, so theming the colors is undocumented.
- **How** — Expand colors.mdx with: (1) explanation of color token naming (e.g., --color-foreground, --color-border); (2) notes on semantic vs. primitive tokens; (3) examples of common overrides (accent color, border color). Or provide a table like in overview.mdx (tokens, defaults, usage).
- **Effort** — medium

### F332 — [NEW] [docs] Inconsistent documentation structure for utility libraries

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/apps/docs/content/docs/ui/utils`
- **What** — Utility doc files vary widely in structure and completeness. Some (compose-refs, selectable-collection) include full inline API docs, usage examples, and notes. Others (shadcn-namespace) are narrative-only. Some are sparse (only ConsumptionBlock). Pattern inconsistency makes it unclear what level of detail is standard.
- **Why** — Inconsistent depth across utility docs leaves readers and contributors unsure what level of detail is expected for any given item.
- **How** — Standardize on one of two patterns: (1) Lightweight: frontmatter + ConsumptionBlock + example link (for simple items); or (2) Complete: frontmatter + ConsumptionBlock + inline API signature + example + notes (for complex items like compose-refs). Document the choice in CONTRIBUTING or a docs README.
- **Effort** — medium
