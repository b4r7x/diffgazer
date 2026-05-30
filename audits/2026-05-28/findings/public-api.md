# Findings: public-api

`@diffgazer/ui`

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 0 | 0 | 0 | 0 |
| Medium | 0 | 0 | 0 | 0 |
| Low | 3 | 0 | 3 | 0 |
| **Total** | **3** | **0** | **3** | **0** |

---

## Critical

_No Critical findings._

---

## High

_No High findings._

---

## Medium

_No Medium findings._

---

## Low

### F64 — [NEW] [anti-slop] Section divider comments in menu-sub.tsx

- **file:line** — `libs/ui/registry/ui/menu/menu-sub.tsx:26-28, 47-49, 88-90, 189-191`
- **What** — Decorative separator comments like `// ---------------------...` followed by component names only restate symbol names and add visual noise to public copy-mode source.
- **Why** — Comments that restate the symbol name carry no information and add noise to source that consumers copy verbatim.
- **How** — Delete all section divider lines (e.g., lines 26, 28, 47, 49, 88, 90, 189, 191) and the blank lines around them. The component structure is already clear from function declarations and context exports.
- **Effort** — low

### F65 — [NEW] [kiss] Nested ternary in navigation-list-item indicator styling

- **file:line** — `libs/ui/registry/ui/navigation-list/navigation-list-item.tsx:177-181`
- **What** — Two-level nested ternary at lines 179-180 checks `isActive ? indicator === "bar" ? ... : ... : ...` within a conditional array in the `cn()` call, making the color logic harder to scan than necessary.
- **Why** — A nested ternary buried inside a `cn()` call obscures the indicator color states and makes the logic hard to scan or test.
- **How** — Extract the nested ternary to a variable above the return: `const indicatorColorClass = isActive ? (indicator === "bar" ? "bg-primary-foreground/40" : "bg-primary-foreground") : "bg-transparent group-hover:bg-muted";` Then use `indicatorColorClass` in the `cn()` call. This also makes the three indicator color states testable.
- **Effort** — low

### F311 — [NEW] [public-api] Non-semantic callback naming in SidebarProvider

- **file:line** — `libs/ui/registry/ui/sidebar/sidebar-provider.tsx:8-14`
- **What** — SidebarProvider uses `state`/`defaultState`/`onStateChange` for its state machine callback, which is a generic, non-semantic name that doesn't describe what state is being managed.
- **Why** — A generic `onStateChange` name fails the public API rule that non-value callbacks describe the semantic state, leaving consumers to guess what is being managed.
- **How** — Rename `onStateChange` to a more semantic name that describes the sidebar state. Options include: (1) Rename props to separate concerns (e.g., `collapsed`/`defaultCollapsed`/`onCollapsedChange` if collapsing is the primary concern) or (2) if the three-state nature is truly a single semantic concept, rename to `onStateChange` only if documented as an exception, or (3) use a more specific name like …
- **Effort** — medium
