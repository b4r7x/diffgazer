# Task T-TOAST-OVER-DIALOG — Make Toast visible above open native <dialog>

**Source findings:** NEW-033
**Severity:** High (real reachable defect in apps/web)
**Phase:** 1
**Blocks:** none
**Blocked by:** none

## Goal
`<Toaster position="bottom-right" />` mounts at app root (`apps/web/src/app/routes/__root.tsx:78`), portaled to `document.body` with `z-50`. When a dialog is open via `dialog.showModal()`, the browser top-layer backdrop occludes the toast. **`z-index` cannot beat the browser top-layer.** Real consumer scenario: `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx` → `onSubmit` → `use-provider-management.ts:33` → `toast.error("Failed to Save", ...)` — toast is invisible to sighted users.

Fix: choose one approach.

**Option A (preferred):** Use the HTML Popover API (`popover="manual"` + `showPopover()`) for the Toaster container. The Popover API renders to the browser top-layer, same as `<dialog>`. Supported: Chrome 114+, Safari 17+, Firefox 125+. Below those versions, fall back to current `z-index` approach.

**Option B:** Route `<Toaster>` to the topmost open dialog's portal container via `PortalContainerProvider`. Toast visibly attached to dialog while modal is open. Returns to root when modal closes.

Pick A if browser support matrix from T-BROWSER-DOCS confirms it; pick B otherwise.

## Files to touch (allowlist)
- `libs/ui/registry/ui/toast/toast-container.tsx`
- `libs/ui/registry/ui/toast/toast.test.tsx` (add behavior test for toast-during-dialog)
- `libs/ui/registry/ui/shared/portal-context.tsx` (if Option B — extend to track topmost dialog)
- `libs/ui/registry/ui/shared/dialog-shell.tsx` (if Option B — register/unregister as topmost in PortalContainerProvider)
- `libs/ui/public/r/toast.json`, `toaster.json`, `portal.json`, `portal-context.json`, `dialog-shell.json` (regenerate via build:shadcn)

## Files NOT to touch
- Toast variant CSS (positioning unchanged)
- Toast store logic
- Dialog content/title/description components

## Acceptance criteria
- [ ] In a test that opens a `Dialog` then calls `toast.error("Test")`, the toast text is visible (not occluded by dialog backdrop)
- [ ] Pre-Popover-API browsers (Chrome <114, Safari <17, Firefox <125) fall back gracefully — toast at minimum readable by screen reader via `role="alert"` (already works today)
- [ ] No regression: toast outside any dialog still works normally
- [ ] Multiple toasts stack correctly
- [ ] Toast dismiss (click X, swipe — current behavior) still works
- [ ] All existing toast tests pass
- [ ] `pnpm --filter @diffgazer/ui type-check` passes
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- toast dialog
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/toast.json libs/ui/public/r/dialog-shell.json
# Manual probe (out of automation):
# 1. cd apps/web && pnpm dev
# 2. Trigger API key dialog
# 3. Submit with bad key → confirm toast error is visible
```

## Notes & references
- Spec 029 §NEW-033 documents the reachable scenario.
- HTML Popover API spec: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
- Top-layer stacking: native `<dialog>` and `popover` both live in browser top-layer; `position: fixed` + `z-index` cannot beat them.
- Pre-Popover-API fallback: detect via `'popover' in HTMLElement.prototype` and either use Option B (portal into dialog) OR leave current behavior (toast hidden but announced).

## Non-goals
- Do not redesign Toast appearance.
- Do not introduce a new toast library.
- Do not change toast API surface.
- Do not fix `useScrollLock` related issues (separate task T-SCROLL-LOCK).
- Do not add toast swipe-to-dismiss (separate concern).

## Implementation hints

### Option A: Popover API
```tsx
// toast-container.tsx
const toasterRef = useRef<HTMLOListElement>(null);
useEffect(() => {
  const el = toasterRef.current;
  if (!el) return;
  if ("popover" in HTMLElement.prototype) {
    el.popover = "manual";
    el.showPopover();
    return () => { if (el.matches(":popover-open")) el.hidePopover(); };
  }
}, []);

return (
  <ol
    ref={toasterRef}
    role="region"
    aria-label="Notifications"
    className="fixed inset-0 pointer-events-none ... z-50"
    // popover attribute set in effect when supported
  >
    {toasts.map(...)}
  </ol>
);
```

### Option B: Portal into topmost dialog
1. Extend `PortalContainerProvider` to track a stack of dialog containers.
2. `DialogShell` pushes its content node onto the stack on `showModal`, pops on close.
3. `Toaster` reads the topmost dialog container (or falls back to `document.body`).
4. CSS positioning relative to the new container vs root needs to account for stacking context — test carefully.

Option A is less code and more correct. Default to A unless browser support concerns dictate B.
