# Decisions

## D1: Use Superpowers Spec, Not Speckit

**Decision:** Track this work under `docs/superpowers/specs/2026-05-12-ui-keys-handoff-readiness`.

**Rationale:** This repository does not currently have `.specify` initialized. Speckit is useful for business/user feature specs, but this work is a multi-package engineering handoff with agent briefs, write ownership, and final `$sota-verify`. The local `sota-verify` skill expects a spec directory like `docs/superpowers/specs/<feature>`.

**Alternative considered:** Initialize `.specify` and use Speckit. Rejected because it would add process scaffolding before the actual handoff work and would not naturally fit the `$sota-verify` brief format.

## D2: Three Consumption Paths Are Required For Both Libraries

**Decision:** Every public item must have a documented and tested status for:

1. manual copy/direct shadcn registry copy,
2. `dgadd`,
3. npm package.

**Rationale:** Users should not need to guess whether an item is package-only, copy-safe, or `dgadd`-only. If an item cannot support a path, that exception must be explicit and justified.

**Current exception:** Provider-backed keys APIs (`KeyboardProvider`, `useKey`, `useScope`, `useScopedNavigation`, `useFocusZone`) are package-only unless a future copy contract copies the provider and context as a coherent unit.

## D3: Public APIs Are Still Pre-Release, So Fix Names Instead Of Adding Aliases

**Decision:** Do not preserve deprecated aliases before the first public release.

**Rationale:** `AGENTS.md` says to rename public APIs and update all consumers/docs/artifacts together instead of adding compatibility wrappers. This applies to bare `dgadd` aliases, `highlighted` callback shapes, and final naming decisions.

## D4: `apps/web` Is A Dogfood Consumer, Not The Source Of Generic Library Behavior

**Decision:** Product-specific composition stays in `apps/web`; generic keyboard/focus/navigation behavior moves to `libs/keys` or `libs/ui`.

**Rationale:** Web should prove the libraries can build real Diffgazer flows. When web repeatedly implements action-row navigation, list-key guards, or Enter activation, that is feedback that library contracts are missing.

## D5: Manual Copy Means Direct Shadcn Must Build

**Decision:** Treat direct shadcn/public registry install as the automated representative of manual copy.

**Rationale:** Human manual copy is hard to prove. A clean shadcn fixture that installs from `libs/ui/public/r` and `libs/keys/public/r`, then type-checks/builds, gives a repeatable proxy.

## D6: Public Npm Path Is Publish-Gated Until Registry Versions Exist

**Decision:** Docs must show npm package mode as a supported target, but public commands are publish-gated until `npm view @diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys` return versions.

**Rationale:** On 2026-05-12, all three packages returned npm E404. Until publish happens, package smoke should use local tarballs.

