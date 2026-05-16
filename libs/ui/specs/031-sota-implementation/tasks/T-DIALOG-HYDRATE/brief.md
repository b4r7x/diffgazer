# Task T-DIALOG-HYDRATE — Derive Dialog title/description presence at render-time

**Source findings:** NEW-029
**Severity:** Medium (real hydration mismatch when `defaultOpen={true}`)
**Phase:** 2
**Blocks:** none
**Blocked by:** none

## Goal
`libs/ui/registry/ui/dialog/dialog.tsx:23-24` initializes `hasTitle=false`. SSR renders `<dialog>` with `aria-label="Dialog"` fallback + `aria-labelledby=undefined`. After client mount, `DialogTitle` fires `onTitleMount` in `useLayoutEffect` → `hasTitle=true` → next commit emits `aria-label=undefined` + `aria-labelledby={titleId}`. React reconciles silently but SSR HTML differs from post-hydration DOM. Assistive tech briefly reads fallback label. Same for `DialogDescription`.

The detection function `containsDialogTitleElement(children)` already exists at `dialog-content.tsx:78` for the static path. Derive `hasTitle`/`hasDescription` from children at render-time using the same scan. Drop the mount-callback state machine entirely.

This is tracked in `libs/ui/specs/025-sota-readiness-fixes/issues/` as P1-006 — coordinate.

## Files to touch (allowlist)
- `libs/ui/registry/ui/dialog/dialog.tsx` (drop `hasTitle`/`hasDescription` state)
- `libs/ui/registry/ui/dialog/dialog-content.tsx` (derive from children scan)
- `libs/ui/registry/ui/dialog/dialog-title.tsx` (drop `onTitleMount` callback)
- `libs/ui/registry/ui/dialog/dialog-description.tsx` (drop `onDescriptionMount`)
- `libs/ui/registry/ui/dialog/dialog-context.ts` (drop the mount-callback context fields)
- `libs/ui/registry/ui/dialog/dialog.test.tsx` (add SSR + `defaultOpen={true}` test scenario)
- `libs/ui/public/r/dialog.json` (regenerated)

## Files NOT to touch
- `dialog-shell.tsx` (native dialog mechanics)
- `dialog-close.tsx`, `dialog-action.tsx`, `dialog-body.tsx`, `dialog-header.tsx`, `dialog-footer.tsx`
- Other components

## Acceptance criteria
- [ ] `Dialog` no longer holds `hasTitle`/`hasDescription` in state
- [ ] `DialogContent` computes `hasTitle = containsDialogTitleElement(children)` and `hasDescription = containsDialogDescriptionElement(children)` at render time
- [ ] `DialogTitle`/`DialogDescription` no longer call `onTitleMount`/`onDescriptionMount` via `useLayoutEffect`/`useEffect`
- [ ] SSR of `<Dialog defaultOpen={true}><Dialog.Content><Dialog.Title>X</Dialog.Title></Dialog.Content></Dialog>` emits `aria-labelledby={titleId}` (NOT `aria-label="Dialog"` fallback)
- [ ] Post-hydration DOM matches SSR HTML (no React reconcile log of aria-label change)
- [ ] All existing dialog tests pass (62+ scenarios)
- [ ] New test renders with `defaultOpen={true}` and asserts no a11y attribute mismatch between initial render and re-render
- [ ] `containsDialogDescriptionElement` helper exists (if it doesn't yet, add it modeled on `containsDialogTitleElement`)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- dialog
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/dialog.json
# Quick SSR check (renders to string and compares)
node --experimental-vm-modules <<'EOF'
import("react-dom/server").then(async ({ renderToString }) => {
  const React = await import("react");
  const { Dialog } = await import("./libs/ui/dist/components/dialog.js");
  const html = renderToString(React.createElement(Dialog, { defaultOpen: true },
    React.createElement(Dialog.Content, null,
      React.createElement(Dialog.Title, null, "X"))));
  console.log(html);
});
EOF
```

## Notes & references
- Spec 029 §NEW-029
- `libs/ui/specs/025-sota-readiness-fixes/issues/` P1-006 tracks this; reference but don't block on it
- AGENTS.md React rules: "Derive values during render when possible. Do not sync derived state with `useEffect`."

## Non-goals
- Do not change the dialog's visual presentation
- Do not change how `aria-label` fallback works (keep the `console.warn` + fallback for true no-title case)
- Do not refactor `DialogShell` or native dialog mechanics
- Do not remove the `console.warn` for missing accessible name (Audit A spec 028 confirmed this is correct)
- Do not change the public Dialog API
