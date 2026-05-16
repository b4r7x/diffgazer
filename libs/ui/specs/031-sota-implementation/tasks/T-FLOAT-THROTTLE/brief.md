# Task T-FLOAT-THROTTLE — rAF-batch useFloatingPosition scroll/resize

**Source findings:** NEW-040
**Severity:** High (perf — affects every Popover/Select/Tooltip on long-scroll pages)
**Phase:** 2
**Blocks:** none
**Blocked by:** T-OWNER-DOC (combine scroll-parent + owner doc changes if possible, but standalone is fine)

## Goal
`libs/ui/registry/hooks/use-floating-position.ts:222-223` calls `update()` synchronously on every `scroll` and `resize` event. Combined with the scroll-parent walker that attaches listeners to every overflow ancestor (NEW-005, separate task), nested-scroll pages get 60+ synchronous reposition computations per second.

Wrap `update` in `requestAnimationFrame` with a pending-flag guard so only one update fires per frame.

## Files to touch (allowlist)
- `libs/ui/registry/hooks/use-floating-position.ts`
- `libs/ui/registry/hooks/use-floating-position.test.ts` (add rAF-batching test)
- `libs/ui/public/r/floating-position.json` (regenerated)

## Files NOT to touch
- Other overlay hooks
- Popover/Select/Tooltip components
- Other unrelated hooks

## Acceptance criteria
- [ ] Listener callbacks (scroll, resize) schedule update via `requestAnimationFrame`, not call directly
- [ ] Multiple events within a single frame coalesce to ONE `update` call (use a pending-flag pattern)
- [ ] Cleanup cancels any pending `requestAnimationFrame`
- [ ] `update` itself still runs synchronously when called manually (from layout effect on mount/dep change)
- [ ] New test: fire 10 scroll events synchronously, assert `update` runs at most once per frame (use `vi.useFakeTimers()` or count `getBoundingClientRect` invocations)
- [ ] No regression: positioning still updates correctly on scroll/resize
- [ ] All existing tests pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- use-floating-position popover select tooltip
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/floating-position.json
```

## Notes & references
- Spec 029 §NEW-040
- Floating UI npm has the SOTA `autoUpdate` shape that already does rAF-batching + cleanup correctly. Reference but don't adopt the lib (avoid new dep).

## Non-goals
- Do not address scroll-parent walker (T-FLOAT-PARENTS handles that)
- Do not change collision/flip algorithm
- Do not introduce dependencies
- Do not switch to `IntersectionObserver` (different semantics)

## Implementation hint

```ts
// use-floating-position.ts
const rafIdRef = useRef<number | null>(null);

const scheduleUpdate = useEffectEvent(() => {
  if (rafIdRef.current != null) return;
  rafIdRef.current = requestAnimationFrame(() => {
    rafIdRef.current = null;
    update();
  });
});

useEffect(() => {
  const win = triggerRef.current?.ownerDocument?.defaultView ?? window;
  win.addEventListener("scroll", scheduleUpdate, { passive: true });
  win.addEventListener("resize", scheduleUpdate);
  return () => {
    win.removeEventListener("scroll", scheduleUpdate);
    win.removeEventListener("resize", scheduleUpdate);
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };
}, []);
```
