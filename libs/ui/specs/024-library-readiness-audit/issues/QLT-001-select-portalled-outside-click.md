# QLT-001: Default Select dropdown can close before portalled option selection

Area: Select / forms / overlays
Severity: P1
Effort: Medium

## Problem

Default Select content is portalled outside the wrapper ref used by `useOutsideClick`. Pointer down inside portalled content can be treated as an outside click, closing/unmounting before option activation.

## Evidence

- Select only registers outside click against `wrapperRef`: `libs/ui/registry/ui/select/use-select-state.ts:146`.
- Default dropdown content is rendered inside `Portal`: `libs/ui/registry/ui/select/select-content.tsx:198`.

## User Impact

Default Select users may be unable to select options reliably with mouse/pointer. The current suite under-covers the default portalled path compared to card variant behavior.

## Fix

Track dropdown content ref in Select state and pass it to `useOutsideClick` as an excluded/inside ref, or move outside-click ownership to a layer that knows both trigger wrapper and portalled content.

## Acceptance Criteria

- Clicking an option in default variant updates value.
- Single-select closes after activation.
- Multi-select stays open after activation.
- Searchable default Select does not close before option activation.
- Outside click still closes the dropdown.

## Verification

- Add default-variant mouse/pointer tests for single, multiple, and searchable Select.
- Run `pnpm --filter @diffgazer/ui test -- registry/ui/select/select.test.tsx`.

