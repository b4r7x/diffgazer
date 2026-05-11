# KYS-002: Focus Zone Target Synchronization

Priority: P0

## Problem

`useFocusZone` can change logical zone state without moving real DOM focus. In `apps/web`, several workflows then believe a zone is active while focus remains in the prior pane.

Known examples:

- `libs/keys/src/hooks/use-focus-zone.ts`
- `apps/web/src/features/history/hooks/use-history-keyboard.ts`
- `apps/web/src/features/history/components/page.tsx`
- `apps/web/src/features/review/hooks/use-review-results-keyboard.ts`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `apps/web/src/features/providers/hooks/use-providers-keyboard.ts`
- `apps/web/src/hooks/use-footer-navigation.ts`

## Required Fix

Introduce a reusable, domain-neutral focus-zone target contract in `@diffgazer/keys`, unless implementation proves a smaller API is better.

Candidate API:

```ts
type FocusZoneTarget<T extends string> = {
  zone: T;
  ref: React.RefObject<HTMLElement | null>;
  focus?: (node: HTMLElement) => boolean | void;
};

function useFocusZoneTargets<T extends string>(options: {
  zone: T;
  onZoneChange?: (zone: T) => void;
  targets?: FocusZoneTarget<T>[];
  fallback?: "container" | "first-focusable" | "none";
  preventScroll?: boolean;
}): {
  focusZone: (zone: T, options?: { preventScroll?: boolean }) => boolean;
  getZoneTargetProps: (zone: T) => {
    ref: (node: HTMLElement | null) => void;
    tabIndex: -1;
    "data-focused": true | undefined;
    onFocus: () => void;
  };
};
```

The exact shape may change, but it must:

- register/focus zone containers without product names;
- support fallback to first focusable child;
- avoid stealing focus if focus is already inside the target zone;
- work with controlled `zone` state;
- let web remove repeated querySelector/`.focus()` effects where appropriate.

## Also Fix

- Validate `tabCycle` entries against `zones`.
- Define behavior when current zone is omitted from `tabCycle`.
- Guard imperative `setZone(next)` so invalid zones do not fire lifecycle callbacks.
- Decide whether wrapping/trapping should be explicit. If current behavior remains, document it truthfully.

## Tests

Add keys tests for:

- `tabCycle` target validation;
- current zone omitted from `tabCycle`;
- invalid imperative `setZone`;
- focus target registration and fallback behavior;
- no focus theft when active element is already inside target;
- native Tab not swallowed for empty/single cycles.

Add web regression tests where History/Review/Providers previously needed manual focus repair.
