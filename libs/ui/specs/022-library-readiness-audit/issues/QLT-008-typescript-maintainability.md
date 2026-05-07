# QLT-008: TypeScript Maintainability Has Remaining Smells

Area: TypeScript and source maintainability

Severity: P2

Effort: M

## Problem

Type-checking passes, but some source patterns weaken maintainability and public type clarity.

## Evidence

- `libs/ui/registry/ui/card/card.tsx:28`, `libs/ui/registry/ui/typography/typography.tsx:50`, `libs/ui/registry/ui/diff-view/diff-view.tsx:164`, and `libs/ui/registry/ui/diff-view/diff-view-unified.tsx:26` use `Ref<never>` casts.
- `libs/ui/dist/_types/registry/ui/button/button.d.ts:38` and `libs/ui/dist/_types/registry/ui/sidebar/sidebar-item.d.ts:26` show broad inferred declaration surfaces.
- `libs/ui/registry/ui/select/use-select-state.ts:62`, `libs/ui/registry/hooks/use-listbox.ts:83`, and related files show state split across refs, state, and DOM queries instead of one typed state model.

## User Impact

Consumers get noisy types, maintainers inherit fragile casts, and future changes are more likely to break polymorphic/ref behavior.

## Fix

Make polymorphic and forwarded-ref typing explicit, and reduce ref/state duplication.

Concrete fix:

- Replace `Ref<never>` casts with typed polymorphic helpers or explicit component overloads.
- Add explicit exported component types where inference produces unreadable declarations.
- Consolidate duplicate state into typed React state or store abstractions.
- Add type tests for public components with refs/as-child/polymorphic usage.

## Acceptance Criteria

- No `Ref<never>` casts remain in public components.
- Public declaration files for key components are readable and stable.
- Ref forwarding type tests cover Button, Card, Typography, SidebarItem, and DiffView.
- Type-check remains green without broad `any` or forced casts.

## Verification

- Run `pnpm --filter @diffgazer/ui type-check`.
- Generate declarations and inspect key `.d.ts` files.
- Add `tsd` or equivalent type tests for polymorphic/ref behavior.

