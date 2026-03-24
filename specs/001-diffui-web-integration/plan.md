# Implementation Plan: Diff-UI Web Integration

**Branch**: `001-diffui-web-integration` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-diffui-web-integration/spec.md`

## Summary

Migrate @diffgazer/ui from a self-contained component library to a thin re-export facade over diff-ui. Consumer files keep importing from `@diffgazer/ui` unchanged. The migration covers all overlapping components at once (16 direct re-exports, 9 adapted re-exports with wrappers, ~6 kept local). A CSS token override layer maps diff-ui's monochrome theme to diffgazer's GitHub-inspired palette.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: React 19, diff-ui (workspace:*), keyscope (workspace:*), Tailwind CSS v4, CVA 0.7, tailwind-merge 3.4, clsx 2.1
**Storage**: N/A (no data persistence changes)
**Testing**: Vitest, @testing-library/react
**Target Platform**: Web (browser), pnpm monorepo workspace
**Project Type**: Web application (monorepo) — internal package migration
**Performance Goals**: N/A (migration, no new runtime features)
**Constraints**: Zero consumer file changes (re-export facade), zero keyboard navigation regressions
**Scale/Scope**: ~95 exports to evaluate, ~25 components to re-export (16 direct + 9 adapted), ~6 kept local, ~8 domain-specific tokens to preserve

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file contains template placeholders only (no project-specific rules defined). No gates to enforce. **PASS**.

**Post-Phase 1 re-check**: Design adds no new projects, no new abstractions, no new external dependencies beyond the existing workspace. The re-export facade is the simplest possible migration pattern. **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-diffui-web-integration/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: component mapping, token comparison, decisions
├── data-model.md        # Phase 1: entity descriptions
├── quickstart.md        # Phase 1: implementation summary
├── contracts/
│   └── ui-public-api.md # Phase 1: @diffgazer/ui public API contract
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (files to modify)

```text
packages/ui/
├── package.json                          # Add diffui: "workspace:*"
├── src/
│   ├── index.ts                          # Change imports: local → diff-ui re-exports
│   ├── styles/
│   │   ├── theme.css                     # Refactor → theme-overrides.css (only diffgazer values)
│   │   └── sources.css                   # May need @source update for diff-ui paths
│   ├── components/
│   │   ├── [direct-match]/*.tsx          # DELETE (replaced by re-exports)
│   │   ├── [adaptable]/*.tsx             # REPLACE with thin adapter wrappers
│   │   └── [local-only]/*.tsx            # KEEP as-is
│   └── lib/
│       └── utils.ts                      # REPLACE with re-export from diffui/lib/utils

apps/web/
├── src/
│   └── styles/
│       └── index.css                     # Update CSS import order
```

**Structure Decision**: No new directories. All changes happen within the existing `packages/ui/` package. The web app (`apps/web/`) changes only its CSS import order — no component file changes.

## Implementation Phases

### Phase A: Workspace Linking (P3 from spec, but prerequisite)

1. Add `"diffui": "workspace:*"` to `packages/ui/package.json` dependencies
2. Run `pnpm install` to verify resolution
3. Verify `import { Button } from 'diffui/components/button'` compiles

### Phase B: Direct Re-Exports (16 components)

Replace local component implementations with re-exports in `packages/ui/src/index.ts`:

```
Button, Badge, Input, Textarea, inputVariants, ScrollArea, BlockBar,
SectionHeader, EmptyState, Tabs (+sub), Menu (+sub), SearchInput,
ToggleGroup, DiffView, KeyValue, HorizontalStepper
```

For each: change `export { X } from './components/x/x.js'` → `export { X } from 'diffui/components/x'`

Delete the local source files for these components after re-export is verified.

### Phase C: Adapted Re-Exports (10 components)

Create thin adapter wrappers for components with API differences:

| Component | Adaptation |
| --------- | ---------- |
| Callout | Map flat API to compound (Callout.Icon, .Title, .Content, .Dismiss) |
| Checkbox/CheckboxGroup/CheckboxItem | Map named exports to compound (Checkbox.Group, Checkbox.Item) |
| Radio/RadioGroup/RadioGroupItem | Map named exports to compound (RadioGroup.Item) |
| Panel/PanelHeader/PanelContent | Map named exports to compound (Panel.Header, Panel.Content) |
| Stepper/StepperStep/StepperSubstep | Map named exports to compound (Stepper.Step, Stepper.Substep) |
| Toast/ToastProvider/useToast | Adapter from diff-ui's store API to existing context+hooks API |
| Dialog (+10 sub-exports) | Map named exports, handle missing DialogOverlay |
| NavigationList/NavigationListItem | Direct re-export (diff-ui is superset, backwards compatible) |
| CodeBlock/CodeBlockLine | Map CodeBlockLine to CodeBlock.Line |

### Phase D: Token Override Layer

1. Create `packages/ui/src/styles/theme-overrides.css`:
   - Dark mode: override 7 primitive tokens + 3 semantic tokens
   - Light mode: override corresponding light values
   - Preserve 8 domain-specific tokens (severity + status)
2. Update `apps/web/src/styles/index.css` import order:
   - `@import "tailwindcss"`
   - `@import "diffui/theme.css"` (NEW — base)
   - `@import "@diffgazer/ui/theme-overrides.css"` (replaces `@import "@diffgazer/ui/theme.css"`)
   - `@import "@diffgazer/ui/sources.css"`

### Phase E: Cleanup

1. Remove local source files for all re-exported components
2. Replace `packages/ui/src/lib/utils.ts` with re-export from `diffui/lib/utils`
3. Remove old `theme.css` (replaced by `theme-overrides.css`)
4. Verify build: `pnpm build && pnpm --dir apps/web build`
5. Visual verification: dark mode, light mode, all pages

## Risk Mitigation

| Risk | Mitigation |
| ---- | ---------- |
| Type incompatibility at consumer sites | Adapter wrappers preserve exact type signatures; TypeScript compiler catches mismatches at build time |
| Visual regression | Theme override layer preserves exact same CSS variable values; visual diff is zero if tokens match |
| Keyboard navigation regression | Keyscope is already integrated; diff-ui components use the same keyscope hooks within the same KeyboardProvider |
| Toast API architecture difference | Most complex adapter; may need to preserve diffgazer's context-based toast internally while delegating rendering to diff-ui |
| Build failure from workspace linking | Follow established pattern (keyscope already uses workspace:*) |

## Complexity Tracking

No constitution violations. No complexity justifications needed.
