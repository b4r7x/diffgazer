---
"@diffgazer/add": patch
"@diffgazer/ui": patch
"@diffgazer/keys": patch
---

Stop tracking deterministic generated docs data and CLI source bundles. Root
verification and docs preparation now regenerate library artifacts before
validation/build so local development and deploys do not depend on committed
generated JSON snapshots.
