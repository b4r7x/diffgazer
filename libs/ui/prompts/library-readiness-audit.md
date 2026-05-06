# Prompt: Re-run @diffgazer/ui Quality and User Handoff Readiness Audit

Use this prompt when you want to re-check whether `@diffgazer/ui` is ready to hand off to users and whether component quality is good enough.

## Variables

- `QUALITY_AGENTS`: number of agents for component quality, default `10`.
- `HANDOFF_AGENTS`: number of agents for user handoff readiness, default `10`.
- `ROOT`: repository root, default `/Users/voitz/Projects/diffgazer-workspace`.
- `UI_PATH`: UI package path, default `/Users/voitz/Projects/diffgazer-workspace/libs/ui`.
- `KEYS_PATH`: keys package path, default `/Users/voitz/Projects/diffgazer-workspace/libs/keys`.
- `CLI_PATH`: installer CLI path, default `/Users/voitz/Projects/diffgazer-workspace/cli/add`.
- `OUTPUT_SPEC`: optional spec folder for results, default `libs/ui/specs/<next-number>-library-readiness-audit`.

## User Prompt

I want a read-only SOTA audit of `@diffgazer/ui`.

Use `QUALITY_AGENTS` agents for component quality and `HANDOFF_AGENTS` agents for whether this can be handed off to users as an installable reusable UI library. Do not edit implementation files unless I explicitly approve later.

Scope:

- UI package: `UI_PATH`
- Keys package: `KEYS_PATH`
- Installer CLI: `CLI_PATH`
- Docs/registry consumers in the current repo if needed.

First gather current local context:

- package names and package exports
- registry item counts and dependency conventions
- CLI command name and package name
- Tailwind/CSS package story
- docs install snippets
- test and build commands

Then run two separate batches.

## Batch A - Component Quality

Run `QUALITY_AGENTS` read-only agents. They should inspect `UI_PATH/registry/ui`, `UI_PATH/registry/hooks`, `UI_PATH/registry/lib`, and tests.

Divide them by focus:

1. React 19 hooks/effects/refs/controlled state
2. Accessibility semantics against WAI-ARIA/APG
3. Component API consistency and DX
4. Form controls: input, textarea, label, checkbox, radio, select, search-input, toggle-group, button
5. Overlays: dialog, popover, tooltip, menu, command palette, toast, portal, presence, floating-position
6. Navigation/data: accordion, tabs, stepper, sidebar, navigation-list, breadcrumbs, pager, toc, diff-view, code-block, overflow
7. Display primitives: badge, avatar, card, panel, callout, empty-state, section-header, block-bar, key-value, kbd, divider, spinner, icons, logo, typography, scroll-area
8. Tests and behavior coverage
9. TypeScript/source maintainability and public exports
10. Cross-cutting clean-code, DRY, and anti-slop

Each agent must return:

- score `1-5`
- precise findings with severity and effort
- exact file references
- user impact
- concrete fix
- acceptance criteria
- what should be tested

## Batch B - User Handoff Readiness

Run `HANDOFF_AGENTS` read-only agents. They should answer: can this be handed to users today?

Divide them by focus:

1. Registry/shadcn installability and namespace resolution
2. Installer CLI flows: init/add/list/diff/remove, manifest safety, path safety, integration modes
3. npm package exports, `sideEffects`, peer deps, client directives, type declarations
4. Tailwind v4, CSS, theme, `@source`, component CSS aggregation
5. Docs/getting-started/examples install correctness
6. Release/CI/versioning/package metadata/governance
7. Consumer compatibility: Vite, Next App Router/RSC, SSR, TypeScript aliases, package managers
8. Dependency policy and bundle/runtime surface
9. Artifact generation and validation pipeline
10. Overall product positioning: copy-first vs runtime package, migration/support story

Each agent must return:

- score `1-5`
- blockers before user handoff
- precise evidence with file references
- concrete fix
- acceptance criteria
- clean consumer verification steps

## Synthesis Requirements

After agents finish:

1. Deduplicate findings.
2. Separate `RDY` readiness issues from `QLT` quality issues.
3. Assign priority:
   - `P0`: public install or package import breaks
   - `P1`: user-facing API/docs/release contract is inconsistent
   - `P2`: quality hardening and confidence gaps
4. Write results to `OUTPUT_SPEC`:
   - `spec.md`
   - `issues/README.md`
   - one markdown file per issue
5. Each issue file must include:
   - title
   - area
   - severity
   - effort
   - problem
   - evidence
   - user impact
   - fix
   - acceptance criteria
   - verification
6. Do not make implementation changes in this audit pass.

