# @diffgazer/add

## 0.1.1

### Patch Changes

- 6416350: Stop tracking deterministic generated docs data and CLI source bundles. Root
  verification and docs preparation now regenerate library artifacts before
  validation/build so local development and deploys do not depend on committed
  generated JSON snapshots.
- 6416350: Document publish-gated install flows, local package validation, shadcn namespace
  setup, keyboard integration contracts, release-readiness governance, and runtime
  package surface validation for public handoff.
