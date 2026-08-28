---
"diffgazer": minor
---

A run that ends early no longer ends empty. When a session is terminated mid-review the
server saves what the run already found, and the live screen offers "View Saved Run" to
open that record instead of dropping you back at the start. Model answers that arrive
truncated or malformed are salvaged issue by issue, so the findings that stand on their
own survive an answer that did not.

A run that finishes clean now gets a receipt rather than a blank screen: both the web app
and the TUI show what was reviewed, by which model, and how long it took, and the history
row reads "Passed with no issues." only when every lens actually reported.

Reviews that wait a long time on a slow model no longer die to the HTTP client's own fixed
300-second ceiling before their own deadline is reached: each dispatch runs on a pooled
connection whose response timeouts are sized to that dispatch's wall, so the timeout that
fires is the one the diagnostic names.
