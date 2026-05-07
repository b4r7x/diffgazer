# Issues

Priority definitions:

- `P0`: public install, local tarball, package import, copy-first, or shadcn-style install can break.
- `P1`: user-facing API, docs, accessibility, or release contract is inconsistent.
- `P2`: quality hardening, confidence gap, maintainability, or polish.

Readiness issues:

- `RDY-001` P0 - Copy-first registry dependency closure is incomplete.
- `RDY-002` P0 - CLI remove can delete copied keys hooks still required by retained UI.
- `RDY-003` P1 - Install docs still expose unavailable public commands without local-tarball context.
- `RDY-004` P1 - Canonical CSS story is inconsistent across docs, artifacts, and runtime package.
- `RDY-005` P2 - Consumer compatibility matrix and strict smoke gates need broader proof.
- `RDY-006` P2 - Package surface and optional dependency policy need polish.

Quality issues:

- `QLT-001` P1 - Default Select dropdown can close before portalled option selection.
- `QLT-002` P1 - Empty string values are treated as no value in navigation and Select.
- `QLT-003` P1 - Custom form controls have split accessibility and native validity ownership.
- `QLT-004` P1 - Value-derived IDs can break ARIA relationships.
- `QLT-005` P2 - Component API and composition contracts are inconsistent.
- `QLT-006` P2 - Overlay dismissal and browser API resilience need hardening.
- `QLT-007` P2 - Display and navigation primitives have edge-case behavior gaps.
- `QLT-008` P2 - Test and maintainability confidence gaps remain.

