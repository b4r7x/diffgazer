# Task T-OWNER-DOC — Overlay hooks: use ownerDocument/ownerWindow, not globals

**Source findings:** UI-001
**Severity:** Medium
**Phase:** 2
**Blocks:** none
**Blocked by:** none

## Goal
Three overlay hooks in `libs/ui/registry/hooks/` use global `window`/`document` where they should use the trigger/content element's `ownerDocument`/`ownerDocument.defaultView`. Iframe-rendered popovers/selects misposition, outside-clicks don't fire across documents, escape doesn't reach parent document.

Specific lines:
- `libs/ui/registry/hooks/use-floating-position.ts:180` — `window.innerWidth, window.innerHeight`
- `libs/ui/registry/hooks/use-floating-position.ts:222-231` — `window.addEventListener("scroll" | "resize")`
- `libs/ui/registry/hooks/use-outside-click.ts:160-205` — `document.addEventListener("pointerdown" | "touchstart" | "mousedown" | "keydown")`
- `libs/ui/registry/ui/popover/use-popover-behavior.ts:93-99` — `window.addEventListener("scroll" | "resize")` for hover-mode auto-close
- `libs/ui/registry/ui/shared/portal.tsx:14` — fallback container is ambient `document.body`
- `libs/ui/registry/hooks/use-active-heading.ts` — uses ambient `document`/`window` for heading scrolling

`libs/keys` overlay hooks are already disciplined — match that pattern.

## Files to touch (allowlist)
- `libs/ui/registry/hooks/use-floating-position.ts`
- `libs/ui/registry/hooks/use-floating-position.test.ts` (add cross-document test)
- `libs/ui/registry/hooks/use-outside-click.ts`
- `libs/ui/registry/hooks/use-outside-click.test.ts` (add cross-document test)
- `libs/ui/registry/ui/popover/use-popover-behavior.ts`
- `libs/ui/registry/ui/popover/popover.test.tsx`
- `libs/ui/registry/ui/shared/portal.tsx` (fallback should accept owner doc from a context or prop)
- `libs/ui/registry/hooks/use-active-heading.ts` (accept root/owner doc OR document the single-document limitation)
- Regenerated `libs/ui/public/r/*.json` for changed items

## Files NOT to touch
- `libs/keys/src/**` (already disciplined)
- Component files that consume these hooks (changes should be backwards-compatible)
- Other unrelated hooks

## Acceptance criteria
- [ ] `use-floating-position` derives viewport + listener target from `triggerRef.current?.ownerDocument?.defaultView ?? window`
- [ ] `use-outside-click` derives doc from `entry.ref.current?.ownerDocument`. Single global listener is replaced with per-document listeners stored in `Map<Document, ...>`
- [ ] `use-popover-behavior` scroll/resize listener attaches to trigger's `ownerDocument.defaultView`
- [ ] `Portal` fallback derives container from a context-provided owner doc, falling back to ambient `document.body`
- [ ] `use-active-heading` either accepts an explicit root element/doc option, OR has a documented JSDoc limitation that it's host-document only
- [ ] New tests render component in a JSDOM iframe (or simulate via `Document` instance) and assert positioning/outside-click works in that document, not the host
- [ ] Existing tests all pass
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes
- [ ] No public API change at the component level (Popover/Select consumers don't need code changes)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- use-floating-position use-outside-click use-popover-behavior popover use-active-heading portal
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/ui build:shadcn
```

## Notes & references
- Spec 029 §UI-001
- Pattern reference from libs/keys: `libs/keys/src/dom/dom.ts` `getOwnerView()` returns the element's `ownerDocument.defaultView`
- AGENTS.md keys library rule applies in spirit to overlay hooks too: "Focus utilities must respect the element `ownerDocument`"

## Non-goals
- Do not fix `useFloatingPosition` scroll-parent walker (separate task T-FLOAT-PARENTS)
- Do not throttle `useFloatingPosition` updates (separate task T-FLOAT-THROTTLE)
- Do not change overlay positioning algorithm or shift/flip behavior
- Do not introduce a new "OwnerDocumentContext" — `Portal` already has `PortalContainerProvider` that can carry this if needed
