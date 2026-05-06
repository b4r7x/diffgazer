# QLT-024 - Event handlers can replace internal component behavior

**Area**: component API and DX  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Some components spread consumer props after internal event handlers, or implement ad hoc disabled-event behavior. This lets a consumer handler accidentally replace internal behavior instead of composing with it.

## Evidence

- `libs/ui/registry/ui/tabs/tabs-trigger.tsx:61` assigns the internal `onClick` that selects the tab.
- `libs/ui/registry/ui/tabs/tabs-trigger.tsx:66` spreads `...rest` after that handler, so a consumer `onClick` replaces tab selection.
- `libs/ui/registry/ui/button/button.tsx:171` spreads anchor props, then line 172 replaces `onClick` when disabled.
- `libs/ui/registry/ui/sidebar/sidebar-item.tsx:107` spreads anchor props, then line 110 replaces `onClick` when disabled.
- `libs/ui/registry/ui/sidebar/sidebar-trigger.tsx:22` manually composes toggle and external click behavior, showing the repo already needs a shared composition policy.

## User Impact

Consumers can break stateful primitives by adding ordinary DOM handlers. Disabled links may suppress analytics or router handlers inconsistently. The result is hard to debug because JSX still type-checks.

## Fix

Add and use a small event-composition helper that:

- calls consumer handlers in a consistent order;
- respects `event.defaultPrevented`;
- preserves internal behavior unless the API explicitly allows cancellation;
- handles disabled anchor behavior consistently.

Apply it to stateful interactive parts that extend native DOM props.

## Acceptance Criteria

- Adding `onClick` to `TabsTrigger` does not prevent tab selection unless the handler intentionally prevents default and the API documents that behavior.
- Stateful parts have tests for consumer handlers plus internal behavior.
- Disabled anchor-button behavior is consistent across Button and Sidebar.
- New components follow the same event-composition helper.

## Verification

- Add behavior tests for `TabsTrigger`, `Button as="a"`, `SidebarItem as="a"`, and `SidebarTrigger`.
- Add a lint or code-review checklist for handler spread order in stateful primitives.
