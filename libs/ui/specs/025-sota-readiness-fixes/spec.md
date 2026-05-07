# @diffgazer/ui SOTA Readiness Fix Plan

Date: 2026-05-07

Scope:

- UI package: `libs/ui`
- Keys package: `libs/keys`
- Installer CLI: `cli/add`
- Product CLI package: `cli/diffgazer`
- Docs, generated registry artifacts, package governance, and smoke scripts where needed

This spec turns the final 30-agent re-audit into implementation work. Public npm publication and hosted registry deployment remain future product work and are not blockers in this pass. The goal is SOTA handoff quality for the current local/tarball/copy-first reusable UI library contract, with no false claims in docs.

## Non-Goals

- Do not deploy the hosted registry.
- Do not publish public npm packages.
- Do not rewrite all compound components around a new collection framework unless a focused fix proves the current public contract cannot be made correct.
- Do not revert unrelated dirty-tree changes. Work with the current tree.
- Do not use refs to prevent rerenders. Refs are allowed for DOM nodes, observers, timers, focus restore handles, and other non-render state.

## Required Outcome

The implementation is done only when:

- No P0/P1 audit findings remain for local tarball, copy-first install, package imports, docs handoff, accessibility, or release governance.
- Component docs do not promise unsupported wrapper composition.
- React 19 hook/ref/effect usage is defensible: no ref-as-render-state hacks, no render-phase state sync, no effect registration used only to repair render ordering.
- Overlay, form-control, IDREF, and compound-contract tests cover the audited failures.
- `@diffgazer/ui` generated registry/docs artifacts are synchronized after source changes.
- Release/governance files and changesets describe the public package changes that remain.

## Issues

P1:

- [P1-001: Overlay portal scope and modal focus lifecycle are not correct](issues/P1-001-overlay-portal-focus.md)
- [P1-002: Form-control accessibility, validity ownership, and IDREF safety are inconsistent](issues/P1-002-a11y-form-idrefs.md)
- [P1-003: Compound component composition contract is unclear after child scanning changes](issues/P1-003-compound-contracts.md)
- [P1-004: Docs and handoff snippets are stale or under-gated](issues/P1-004-docs-handoff.md)
- [P1-005: Release governance and package lifecycle are not clean enough for handoff](issues/P1-005-release-governance.md)
- [P1-006: Final contract closure blockers remain after 10x3 re-audit](issues/P1-006-final-contract-closure.md)

P2:

- [P2-001: Test, validation, and generated-artifact coverage needs final hardening](issues/P2-001-test-validation-matrix.md)
- [P2-002: Final 5/5 polish and verification gates](issues/P2-002-final-verification-polish.md)

## Agent Briefs

Implementation should be split by ownership to avoid merge conflicts:

- [Agent 01: Overlay Runtime](agents/01-overlay-runtime.md)
- [Agent 02: Accessibility, Forms, and IDREFs](agents/02-a11y-form-idrefs.md)
- [Agent 03: Compound Contracts](agents/03-compound-contracts.md)
- [Agent 04: Docs and Release Governance](agents/04-docs-release-governance.md)
- [Agent 05: Artifacts, Validation, and Final Local Gates](agents/05-artifacts-validation.md)
- [Agent D1: React Forms and IDREF Closure](agents/D1-react-forms-idrefs.md)
- [Agent D2: Docs API CSS Truth](agents/D2-docs-api-css-truth.md)
- [Agent D3: Component Contract Closure](agents/D3-component-contract-closure.md)
- [Agent D4: Release Governance and Final Gates](agents/D4-release-governance-final-gates.md)

Agents are not alone in the codebase. They must not revert edits made by other agents or by the user. They must keep changes inside their write ownership unless they need to propose a handoff change in their final note.

## Implementation Order

1. Run Agents 01-04 in parallel.
2. Review and integrate their changes.
3. Run Agent 05 after the first wave lands, because generated artifacts and validation files depend on source/doc changes.
4. Run local package tests and validation.
5. Run 10x3 read-only re-audit.
6. Report the re-audit result and remaining work before starting any next implementation batch.
7. Run Batch D final contract closure agents.
8. Regenerate artifacts and run local gates.
9. Run a focused re-audit on the Batch D blockers.
10. After approval, run the `$sota-verify` loop against this spec until clean.

## Batch D Result From 10x3 Re-Audit

The re-audit found no remaining P0 registry/installability blocker. Registry closure, CLI copy/package flows, generated bundles, package exports, and strict smoke are materially improved. It did find remaining P1 blockers for a credible SOTA 5/5 handoff:

- React purity: `usePresence` still uses render-phase state sync, and Dialog still reads a ref as render-affecting title state.
- Forms and IDREFs: required Select/Radio behavior is still partly tied to `name`; Radio puts required state on individual radio items; controlled active-descendant paths can point at missing options.
- Docs truth: compound pattern docs still overpromise deep wrappers; examples still promote deprecated props; several component pages reference missing examples; theme docs drift from `theme.css`; `diffgazer` install docs are inconsistent.
- Component contracts: Stepper can emit dangling `aria-controls`; Tabs can collect nested tabs; KeyValue layout does not match its horizontal/bordered contract.
- Release governance: package policy files are untracked while included in package manifests; `@diffgazer/ui` still runs network smoke from `prepublishOnly`.

The following are explicitly deferred unless a fix is tiny and low-risk:

- Hosted registry deployment and scoped public npm publication.
- Full universal collection store or opaque wrapper-generated item support.
- Full npm/yarn/bun post-publication matrix. Yarn PnP must be documented or explicitly excluded, but not fully supported in this pass.
- Full custom form-control architecture rewrite.

## Baseline Verification Commands

Use the narrowest relevant commands while developing, then run the broader gates:

- `pnpm --filter @diffgazer/ui test -- ...`
- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm run validate:artifacts`
- `pnpm changeset status --since=main`
- `pnpm run verify`

If a command fails due to sandbox/network restrictions, report it and retry with approval only when it is essential.
