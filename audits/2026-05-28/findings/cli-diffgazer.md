# Findings: cli-diffgazer

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 1 | 0 | 1 | 0 |
| Medium | 0 | 0 | 0 | 0 |
| Low | 7 | 0 | 7 | 0 |
| **Total** | **8** | **0** | **8** | **0** |

---

## Critical

_No critical findings._

---

## High

### F159 — [NEW] [architecture] Render-time setState in SeverityFilterGroup

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/features/review/components/severity-filter-group.tsx:32-34`
- **What** — setState is called directly during render (lines 32-34) when focusedIndex > maxIndex. This violates React's rules and can cause infinite loops or unexpected behavior.
- **Why** — Calling setState during render breaks React's render-purity rule, so the component's render is no longer a pure function of its props and state.
- **How** — Wrap the state synchronization in useEffect with maxIndex as a dependency: useEffect(() => { if (focusedIndex > maxIndex) setFocusedIndex(maxIndex); }, [focusedIndex, maxIndex]); Remove the imperative if-block from the render path.
- **Effort** — low

---

## Medium

_No medium findings._

---

## Low

### F160 — [NEW] [dry] Duplicate SHUTDOWN_TIMEOUT_MS constant

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/web-launcher.ts:17 and /Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/hooks/use-exit.ts:5`
- **What** — SHUTDOWN_TIMEOUT_MS = 3000 is defined in two separate files with identical values, violating DRY principle.
- **Why** — Two independent definitions of the same timeout can drift apart, leaving the shutdown paths with inconsistent values.
- **How** — Extract SHUTDOWN_TIMEOUT_MS to a shared constants file (e.g., src/lib/constants.ts or src/lib/shutdown-token.ts since it's shutdown-related) and import in both web-launcher.ts and use-exit.ts.
- **Effort** — low

### F260 — [NEW] [dead-code] Unused default import React in navigation-context

- **file:line** — `cli/diffgazer/src/app/navigation-context.tsx:1`
- **What** — React is imported with a default import but is never used. The file uses JSX syntax and named exports from React (createContext, useContext, useState, type ReactNode).
- **Why** — An unused default import is dead code that adds noise and misleads readers about the module's actual dependencies.
- **How** — Remove the React default import: `import React, { createContext, useContext, useState, type ReactNode } from 'react';` should be `import { createContext, useContext, useState, type ReactNode } from 'react';`
- **Effort** — low

### F262 — [NEW] [dead-code] Unused parameter input in history-screen useInput handler

- **file:line** — `cli/diffgazer/src/app/screens/history-screen.tsx:58`
- **What** — The useInput hook at line 57-82 destructures input parameter at line 58 but never uses it. The handler only checks key properties.
- **Why** — An unused, unmarked parameter reads as a bug and hides that the value is intentionally ignored.
- **How** — Replace `(input, key)` with `(_input, key)` to explicitly mark it as intentionally unused, matching the pattern used in the handler above at line 51.
- **Effort** — low

### F263 — [NEW] [dead-code] Unused type import ReactNode in badge component

- **file:line** — `cli/diffgazer/src/components/ui/badge.tsx:1`
- **What** — ReactNode is imported from react but the BadgeProps interface uses string children, not ReactNode.
- **Why** — An unused type import is dead code that adds noise and misleads readers about the component's actual dependencies.
- **How** — Remove ReactNode from the import: `import type { ReactNode } from 'react';` can be deleted entirely since React isn't used.
- **Effort** — low

### F264 — [NEW] [dead-code] Unused type import ReactNode in button component

- **file:line** — `cli/diffgazer/src/components/ui/button.tsx:1`
- **What** — ReactNode is imported from react but ButtonProps interface uses string children, not ReactNode.
- **Why** — An unused type import is dead code that adds noise and misleads readers about the component's actual dependencies.
- **How** — Remove ReactNode from the import: `import type { ReactNode } from 'react';` can be deleted entirely since React isn't used.
- **Effort** — low

### F265 — [NEW] [dead-code] Unused type import ReactNode in section-header component

- **file:line** — `cli/diffgazer/src/components/ui/section-header.tsx:1`
- **What** — ReactNode is imported from react but is never used in the component.
- **Why** — An unused type import is dead code that adds noise and misleads readers about the component's actual dependencies.
- **How** — Remove the unused import line.
- **Effort** — low

### F266 — [NEW] [dead-code] Unused type import ReactNode in spinner component

- **file:line** — `cli/diffgazer/src/components/ui/spinner.tsx:1`
- **What** — ReactNode is imported from react but is never used in the component.
- **Why** — An unused type import is dead code that adds noise and misleads readers about the component's actual dependencies.
- **How** — Remove the unused import line.
- **Effort** — low
