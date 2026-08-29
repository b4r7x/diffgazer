---
"@diffgazer/ui": patch
---

The marker rail reserves its lane with a side-scoped `border-l-transparent` (previously the all-sides `border-transparent`, which tailwind-merge let clobber any per-side border color merged before it). NavigationList item separators now actually render at their variant color (`border-b-border/50`) on default rows, and a consumer-passed bottom-border color no longer tints the rail into a second vertical line beside a panel border. The item variant's separator color is also side-scoped (`border-b-border/50`).
