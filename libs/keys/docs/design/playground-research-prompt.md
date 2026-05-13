# Research Prompt: @diffgazer/keys Playground / Example App

You are researching how to build a playground / example app for **@diffgazer/keys** — a composable, scoped keyboard navigation hooks library for React 19.

Your deliverable is a concrete implementation plan, NOT code.

---

## What You Have

The @diffgazer/keys package lives in `libs/keys/` within the Diffgazer workspace. Read these files to understand the full API:

### Must-Read Files
- `src/index.ts` — complete public API surface (all exports)
- `src/providers/keyboard-provider.tsx` — the root provider (scope stack, handler registry)
- `src/hooks/use-key.ts` — single hotkey handler
- `src/hooks/use-focus-zone.ts` — arrow/tab-based zone navigation
- `src/hooks/use-navigation.ts` — standalone DOM-based list navigation
- `src/hooks/use-scoped-navigation.ts` — provider-backed DOM navigation
- `src/hooks/use-focus-trap.ts` — Tab focus containment
- `src/hooks/use-focus-restore.ts` — nested focus restoration
- `src/hooks/use-scroll-lock.ts` — body/element scroll locking
- `src/hooks/use-scope.ts` — manual scope push/pop
- `src/utils/keys.ts` — `keys()` helper for multi-key handler maps
- `src/utils/keyboard-utils.ts` — `matchesHotkey()` with `mod` alias support
- `src/utils/types.ts` — `NavigationRole` type
- `package.json` — dependencies, React 19 peer dep

### Key Facts
- **React 19 only** — uses `useEffectEvent` (not available in React 18)
- **8 hooks**: `useKey`, `useScope`, `useNavigation`, `useScopedNavigation`, `useFocusZone`, `useFocusTrap`, `useFocusRestore`, `useScrollLock`
- **1 provider**: `KeyboardProvider` wraps the app, manages scope stack + handler registry
- **Scope system**: Scopes stack. Only the topmost scope's handlers fire. `useScope` pushes on mount, pops on unmount.
- **Zone system**: `useFocusZone` manages which "zone" (logical UI region) is active. Use `getKeyOptions(zone)` with `useKey` to register handlers that only fire in a specific zone.
- **Navigation**: `useNavigation` is standalone and returns `onKeyDown`. `useScopedNavigation` registers equivalent navigation through `KeyboardProvider` for scope-aware surfaces.
- **`mod` alias**: `mod+k` resolves to `Cmd+K` on Mac, `Ctrl+K` on Windows/Linux.
- **`keys()` helper**: `keys(["1", "2", "3"], handler)` returns `{ "1": handler, "2": handler, "3": handler }` for use with the key-map overload of `useKey`.
- **No UI components included** — @diffgazer/keys is hooks-only. The playground must provide its own components.

### Hook Composition Patterns

These are the patterns @diffgazer/keys is designed for:

**1. Global shortcut**
```tsx
useKey("mod+k", openCommandPalette);
useKey("Escape", closeModal, { enabled: isModalOpen });
```

**2. Scoped modal**
```tsx
useScope("modal", { enabled: isOpen });
useKey("Escape", close);  // only fires when modal scope is active
```

**3. Zone navigation with zone-specific keys**
```tsx
const { zone, getKeyOptions } = useFocusZone({
  initial: "sidebar",
  zones: ["sidebar", "content", "preview"],
  transitions: ({ zone, key }) => {
    if (zone === "sidebar" && key === "ArrowRight") return "content";
    if (zone === "content" && key === "ArrowLeft") return "sidebar";
    if (zone === "content" && key === "ArrowRight") return "preview";
    if (zone === "preview" && key === "ArrowLeft") return "content";
    return null;
  },
});

useKey("Enter", openItem, getKeyOptions("sidebar"));
useKey("d", deleteItem, getKeyOptions("sidebar"));
useKey(["Enter", "Space"], toggleSection, getKeyOptions("content"));
useKey("e", edit, getKeyOptions("content"));
useKey("Escape", backToContent, getKeyOptions("preview"));
```

**4. List/menu navigation**
```tsx
const { highlighted } = useNavigation({
  containerRef: listRef,
  role: "option",
  onSelect: handleSelect,
  onEnter: handleOpen,
});
```

**5. Tab navigation**
```tsx
const { onKeyDown } = useNavigation({
  containerRef: tabsRef,
  role: "tab",
  orientation: "horizontal",
});
```

---

## Research Areas

### 1. Where Do Best OSS Libraries Put Their Examples?

Research how these keyboard/interaction libraries structure their examples and playgrounds:

| Library | What to look at |
|---------|----------------|
| **react-hotkeys-hook** | Does it have a playground? Where does it live in the repo? |
| **tinykeys** | Examples structure |
| **cmdk** (command menu) | How is the demo site built? Same repo or separate? |
| **downshift** (combobox) | Examples/storybook/docs setup |
| **@tanstack/react-table** | Example apps structure — they do this very well |
| **react-aria** (Adobe) | How do they showcase hook-based libraries? |
| **dnd-kit** | Playground / examples structure |
| **zustand** | Simple library, how do they demo? |
| **jotai** | Demo/docs structure |
| **radix-ui** | How do they demo primitives? |

Answer these questions:
- **Repo structure**: Do they put examples in `examples/`, `playground/`, `apps/demo/`, or a separate repo?
- **Framework**: Vite? Next.js? Astro? Plain HTML?
- **Monorepo or not**: If the lib is a single package, do they use a monorepo just for the example app? Or keep it flat?
- **How do examples reference the library**: `workspace:*` link? Relative path import? Published package?

### 2. App Framework

For a simple, interactive playground — what's the right tool?

| Option | Notes |
|--------|-------|
| **Vite + React** | Simplest. Fast. Full React 19 support. No SSR overhead. |
| **Next.js** | Overkill? Or useful for future docs integration? |
| **Astro + React islands** | Good for docs-style pages with embedded demos. React 19 island support? |

The playground should:
- Be fast to start (`pnpm dev` → see demos immediately)
- Support React 19 (`useEffectEvent`)
- Let the user interact with keyboard and SEE what's happening
- Be simple enough that the components aren't the focus — @diffgazer/keys is

### 3. What Demos to Build

The playground needs to showcase every hook in a compelling, interactive way. Each demo should:
- Be self-contained (one component/file per demo)
- Visualize keyboard state (show which keys are pressed, which scope is active, which zone is focused)
- Have a "what to try" section telling the user which keys to press

**Proposed demos (evaluate and refine):**

| Demo | Hooks used | What it shows |
|------|-----------|--------------|
| **Global Shortcuts** | `useKey` | Press `mod+K` to toggle command palette, `Escape` to close, `/` to focus search. Shows basic key binding. |
| **Scoped Dialog** | `useScope`, `useKey` | Open a modal → keyboard shortcuts change. Close → they revert. Shows scope stacking. |
| **Nested Scopes** | `useScope`, `useKey` | Dialog inside dialog. Inner dialog's shortcuts shadow outer's. Show scope stack visually. |
| **Three-Panel Layout** | `useFocusZone`, `useKey` | Sidebar / Content / Preview. Arrow keys move between zones. Each zone has its own shortcuts via `getKeyOptions`. Classic IDE layout. |
| **Tab Groups** | `useFocusZone` with `tabCycle` | Tab bar where Tab cycles between sections. Shows `tabCycle` option. |
| **Command Palette** | `useKey`, `useScope`, `useScopedNavigation` | `mod+K` opens palette, arrow keys navigate, Enter selects, Escape closes. Combines multiple hooks. |
| **Selectable List** | `useScopedNavigation` | Arrow keys navigate items through `KeyboardProvider`, Enter/Space selects. Shows `highlighted`, `onSelect`. |
| **Standalone Combobox** | `useNavigation` | Standalone `onKeyDown` navigation that only responds when the combobox/list owns focus. |
| **Tab Bar** | `useNavigation` with `role: "tab"` | Horizontal tabs with Left/Right navigation. Shows tab navigation via `useNavigation`. |
| **Multi-Key Handler** | `useKey` with arrays/maps, `keys()` helper | `["Enter", "Space"]` fires same action. `keys(["1","2","3"], handler)` creates a handler map for number shortcuts. |
| **Platform-Aware** | `useKey` with `mod` | `mod+S` shows as Cmd+S on Mac, Ctrl+S on Windows. Shows `mod` alias. |

### 4. State Visualization

This is critical for a keyboard library playground. The user needs to SEE what @diffgazer/keys is doing internally. Research how to visualize:

- **Active scope stack** — show a live stack display (e.g., `global > modal > dropdown`)
- **Current zone** — highlight which zone is active in multi-panel demos
- **Registered handlers** — show what keys are currently listening
- **Last key pressed** — show a key event log / indicator
- **Handler fired** — flash/highlight when a handler fires

How do other interactive demos do this? (React DevTools-style? Inline annotations? Floating panel?)

### 5. Styling Approach

The playground needs to look good enough to be impressive, but components are NOT the point — the keyboard interactions are.

Options:
- **Tailwind CSS** — quick, utility-based, familiar
- **Vanilla CSS** — minimal deps, full control
- **CSS Modules** — scoped, no build complexity
- **@diffgazer/ui components** — dogfooding (but adds complexity, future consideration)

Consider: What's the minimum viable styling that makes the demos clear and interactive without overshadowing the keyboard behavior?

### 6. Keyboard Hint / Shortcut Display

Most keyboard-focused apps show shortcut hints in the UI (like `⌘K` badges on buttons). Research:
- How to detect Mac vs Windows for display (`⌘` vs `Ctrl`)
- Common UI patterns for keyboard hint badges
- Whether this should be a reusable component in the playground

---

## Deliverable

Write TWO files:

### File 1: `docs/design/playground-spec.md`

A design spec with:
1. **Recommended location** — where the playground lives in the repo (with rationale from OSS research)
2. **Tech stack** — framework, styling, dev tooling (exact packages)
3. **App structure** — directory layout, routing (if any), how demos are organized
4. **Demo list** — final list of demos with descriptions, which hooks each showcases
5. **State visualization design** — how keyboard state is shown to the user
6. **Keyboard hint system** — how shortcut badges work
7. **How the playground imports @diffgazer/keys** — workspace link, relative path, or other

### File 2: `docs/design/playground-implementation-plan.md`

An implementation plan for building the playground. The plan should:

- Reference the spec (`docs/design/playground-spec.md`) as the source of truth
- Define workstreams (e.g., "scaffolding" for project setup, "basic demos" for simple demos, "advanced demos" for complex demos, "visualization" for state visualization components)
- Specify which workstreams can proceed independently and which depend on others
- For each workstream, describe:
  - Exact files to create
  - Which demos to implement
  - What "done" looks like (builds, demos work, keyboard interactions are correct)
- Include a verification step (build, type-check, manual test checklist)

Use `docs/design/playground-spec.md` as the only required planning input.

---

## Workflow

1. **Research** — read the @diffgazer/keys source, analyze OSS examples, evaluate options
2. **Write the spec** — `docs/design/playground-spec.md`
3. **Present the spec to the user** — wait for approval/feedback
4. **After approval, write the implementation plan** — `docs/design/playground-implementation-plan.md`

Do NOT write the implementation plan before the spec is approved. The spec drives the plan.

---

## What NOT to Do

- Do NOT write any code
- Do NOT create the playground app
- Do NOT modify any existing files in the repo
- Do NOT make vague recommendations — be specific and justify every choice
- Do NOT default to "it depends" — pick a direction and explain trade-offs
- Do NOT write the implementation plan before the spec is reviewed
- Do NOT include @diffgazer/ui components yet — the playground uses simple, purpose-built components. @diffgazer/ui integration is a future step.
