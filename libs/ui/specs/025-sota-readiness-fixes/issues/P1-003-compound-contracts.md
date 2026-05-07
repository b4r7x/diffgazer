# P1-003: Compound component composition contract is unclear after child scanning changes

Area: Compound components / React 19 / DX / docs / tests
Severity: P1
Effort: Medium

## Problem

Several compound components now collect metadata by scanning `React.Children`. That can be valid for a direct-children contract, but it does not support opaque wrapper components that render items internally. Some docs previously implied broader wrapper support.

## Evidence

- Child metadata scans exist in Tabs, Select, CommandPalette, Menu, NavigationList, RadioGroup, and ToggleGroup.
- Prior docs/examples implied users could wrap subcomponents more broadly than the current metadata scan can observe.
- Re-audit agents found wrapper regressions in Tabs, Select, CommandPalette, NavigationList, RadioGroup, ToggleGroup, and Menu when opaque custom wrappers render item components internally.

## User Impact

Users can build reasonable wrapper components that render visible items but are missing from metadata, breaking keyboard navigation, selection, highlighting, filtering, or active state. This is especially confusing if docs imply wrapper support.

## Fix

Choose and enforce one release contract:

- Current release contract: direct compound children and static namespaced parts are supported. Custom item UI belongs inside the item component. Opaque wrappers that create item components internally are not guaranteed unless the component exposes an explicit metadata API.
- Future contract: explicit `items` or shared collection store can be added later if wrapper-generated items become a primary API.

For this pass, prefer the current release contract unless a component has no workable direct-child path. Do not reintroduce effect-based item registration only to support wrapper discovery. If any runtime path currently breaks direct namespaced compound usage, fix it.

## Acceptance Criteria

- Docs and generated component metadata state the supported composition model plainly.
- Tests cover direct compound children and namespaced/static part usage for audited components.
- Tests include at least one negative or documented-limitation case showing opaque wrapper-generated items are not part of the public contract, or docs explicitly avoid testing that unsupported shape.
- No docs claim "no matter how deep" or equivalent wrapper support.
- No new render-phase state sync or ref-as-render-state workaround is introduced.

## Verification

- Audit docs for wrapper/composition claims.
- Run compound component tests for Tabs, Select, CommandPalette, Menu, NavigationList, RadioGroup, and ToggleGroup.
- Regenerate docs/public registry artifacts after docs metadata changes.

