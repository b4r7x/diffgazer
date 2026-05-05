# @diffgazer/keys Playground — Design Spec

## 1. Location in Repo

**Decision: `examples/playground/` in the @diffgazer/keys repo, with pnpm workspaces.**

### Rationale

Research of 10 popular React hook/interaction libraries shows two dominant patterns:

| Pattern | Libraries | Pros | Cons |
|---------|-----------|------|------|
| `examples/` in same repo | TanStack Table, zustand, tinykeys | Co-located, one clone, one PR | Needs workspace or path tricks |
| Separate repo / external | react-hotkeys-hook, jotai (docs site) | Clean separation | Harder to iterate, separate maintenance |
| Monorepo `apps/` or `playground/` | dnd-kit, cmdk, radix-ui | Tight coupling, HMR on source | Heavier setup |

**TanStack Table and zustand** are the closest analogues — small React hook libraries with interactive demos. Both use `examples/` in the same repo with Vite.

@diffgazer/keys is a single package (not a multi-package monorepo). Adding `pnpm-workspace.yaml` at the root keeps it lightweight:

```
@diffgazer/keys/
├── pnpm-workspace.yaml      ← NEW (just lists examples/*)
├── package.json              ← existing library
├── src/                      ← existing library source
├── examples/
│   └── playground/           ← NEW Vite app
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
└── ...
```

The playground imports @diffgazer/keys via `"@diffgazer/keys": "workspace:*"` in its `package.json`. A Vite alias resolves it to source TypeScript for instant HMR during development.

---

## 2. Tech Stack

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| **Build** | Vite | ^6 | Fastest DX. Used by TanStack Table, zustand. No SSR overhead. |
| **Framework** | React | ^19 | Required for `useEffectEvent`. |
| **Styling** | Tailwind CSS | v4 | CSS-first config. Fast iteration. Utility classes perfect for visual state indicators. |
| **Language** | TypeScript | ^5.9 | Matches @diffgazer/keys's strict config. |
| **Routing** | None | — | Single-page app with client-side demo switching. No router needed. |

### Packages

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@diffgazer/keys": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.9.3",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

### Why not...

- **Next.js**: Overkill. The playground is pure client-side keyboard interaction — no server rendering, no routing, no data fetching. Vite is simpler and faster.
- **Astro**: Good for docs-style sites, but React 19 island support adds friction and `useEffectEvent` needs full React 19 runtime.
- **Storybook**: Good for component libraries (radix-ui, react-aria), but @diffgazer/keys is hooks-only. Storybook's per-story isolation works against showing scope stacking and zone transitions that span the whole viewport.

---

## 3. App Structure

```
examples/playground/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx                        — React root, KeyboardProvider wrapper
    ├── app.tsx                         — Layout + demo routing
    │
    ├── components/
    │   ├── layout.tsx                  — Sidebar nav + main content area
    │   ├── demo-wrapper.tsx            — Wraps each demo: title, description, "what to try" hints
    │   ├── kbd.tsx                     — Platform-aware keyboard shortcut badge
    │   ├── scope-stack.tsx             — Live scope stack visualizer
    │   ├── key-log.tsx                 — Floating key event log panel
    │   └── handler-flash.tsx           — Flash animation when a handler fires
    │
    ├── demos/
    │   ├── global-shortcuts.tsx        — Demo 1
    │   ├── scoped-dialog.tsx           — Demo 2
    │   ├── nested-scopes.tsx           — Demo 3
    │   ├── three-panel-layout.tsx      — Demo 4 (hero)
    │   ├── command-palette.tsx         — Demo 5
    │   ├── selectable-list.tsx         — Demo 6
    │   ├── standalone-combobox.tsx     — Demo 7
    │   ├── tab-bar.tsx                 — Demo 8
    │   ├── multi-key-handlers.tsx      — Demo 9
    │   └── platform-aware.tsx          — Demo 10
    │
    ├── hooks/
    │   └── use-platform.ts             — Mac/Win/Linux detection for <Kbd>
    │
    └── styles/
        └── globals.css                 — Tailwind v4 import + custom animations
```

### How the playground imports @diffgazer/keys

1. **`pnpm-workspace.yaml`** at repo root:
   ```yaml
   packages:
     - "examples/*"
   ```

2. **Playground `package.json`** depends on:
   ```json
   "@diffgazer/keys": "workspace:*"
   ```

3. **Vite alias** resolves to source for HMR:
   ```ts
   // vite.config.ts
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import tailwindcss from "@tailwindcss/vite";
   import path from "node:path";

   export default defineConfig({
     plugins: [react(), tailwindcss()],
     resolve: {
       alias: {
         @diffgazer/keys: path.resolve(__dirname, "../../src/index.ts"),
       },
     },
   });
   ```

This means:
- `import { useKey } from "@diffgazer/keys"` works in demo code
- Changes to @diffgazer/keys source trigger instant HMR in the playground
- TypeScript resolves types correctly through the workspace link
- Demo code uses the same import paths end users would use

### Navigation

The app uses simple state-based "routing" — no router library:

```tsx
// app.tsx
const [activeDemo, setActiveDemo] = useState("global-shortcuts");
```

The sidebar lists all demos. Clicking one sets the active demo. The main content area renders the corresponding demo component.

---

## 4. Demo List

### Section A: Basics

#### Demo 1: Global Shortcuts
- **Hooks**: `useKey`
- **What it shows**: Basic key binding. Press `mod+K` to toggle a search bar, `/` to focus it, `Escape` to close. Shows that handlers fire globally.
- **Visual**: Search bar appears/disappears. Active shortcut badges light up when pressed.
- **What to try**: "Press `⌘K` to open search. Press `Escape` to close. Press `/` to focus search."

#### Demo 2: Platform-Aware Shortcuts
- **Hooks**: `useKey` with `mod` alias
- **What it shows**: `mod+S` displays as `⌘S` on Mac, `Ctrl+S` on Windows. `mod+Shift+P` shows correctly per platform.
- **Visual**: Grid of shortcut cards showing `mod+X` resolved to the current platform. Pressing the key highlights the card.
- **What to try**: "Press `⌘S` (Mac) or `Ctrl+S` (Win). Notice the shortcut badges match your platform."

### Section B: Scopes

#### Demo 3: Scoped Dialog
- **Hooks**: `useScope`, `useKey`
- **What it shows**: Open a modal dialog — keyboard shortcuts change. Close it — they revert. Demonstrates scope push/pop.
- **Visual**: Main page has shortcuts (1-5 select tabs). Opening modal replaces them with modal shortcuts (Escape to close, Enter to confirm). Scope stack shown live.
- **What to try**: "Press `1-5` to switch tabs. Press `O` to open the modal. Notice shortcuts change. Press `Escape` to close."

#### Demo 4: Nested Scopes
- **Hooks**: `useScope`, `useKey`
- **What it shows**: Dialog inside dialog. Inner dialog's shortcuts shadow outer's. Closing the inner dialog reveals the outer dialog's shortcuts.
- **Visual**: Layered dialogs with increasing z-index. Scope stack shows `global > dialog > confirm`. Each layer has its own shortcut list displayed.
- **What to try**: "Press `O` to open dialog. Press `D` to open confirmation. Press `Escape` to close each layer. Watch the scope stack."

### Section C: Zones & Navigation

#### Demo 5: Three-Panel Layout (Hero Demo)
- **Hooks**: `useFocusZone`, `useZoneKeys`
- **What it shows**: IDE-style layout — Sidebar, Content, Preview. Arrow keys move between zones. Each zone has its own shortcuts that only fire when that zone is active.
- **Visual**: Three panels with colored borders indicating active zone. Zone-specific shortcut hints shown in each panel. Active zone highlighted with accent color.
- **Zone shortcuts**:
  - Sidebar: `Enter` opens item, `d` deletes, `n` creates new
  - Content: `Enter | Space` toggles section, `e` edits
  - Preview: `Escape` returns to content, `p` prints
- **What to try**: "Use `←` `→` arrows to switch zones. Each zone has different shortcuts — check the hints in each panel."

#### Demo 6: Selectable List
- **Hooks**: `useNavigation` (scoped mode)
- **What it shows**: Arrow keys navigate a list. Enter/Space selects. Home/End jump to first/last. Shows `highlighted` tracking.
- **Visual**: Vertical list of items. Focused item has a distinct background. Selected items have a checkmark. Focused value displayed below the list.
- **What to try**: "Use `↑` `↓` to navigate. `Enter` to select. `Home`/`End` to jump."

#### Demo 7: Standalone Combobox
- **Hooks**: `useNavigation` (local mode)
- **What it shows**: Same navigation but using local `onKeyDown` mode instead of scoped mode. Shows the two modes side by side.
- **Visual**: Two identical lists — left uses scoped mode, right uses local mode. The local mode list only responds when focused. Label indicates mode.
- **What to try**: "Click inside the right list, then use arrow keys. Notice it only works when the list has focus. The left list works globally."

#### Demo 8: Tab Bar
- **Hooks**: `useTabNavigation`
- **What it shows**: Horizontal tab bar with Left/Right arrow navigation. Home/End jump to first/last tab. Wrapping behavior.
- **Visual**: Tab bar with 5 tabs. Active tab has underline. Content below changes with tab. Second tab bar is vertical (Up/Down).
- **What to try**: "Focus a tab, then use `←` `→` to switch. Try `Home` and `End`. The vertical example uses `↑` `↓`."

### Section D: Composition

#### Demo 9: Command Palette
- **Hooks**: `useKey`, `useScope`, `useNavigation`
- **What it shows**: `mod+K` opens palette (pushes scope). Arrow keys navigate commands. Enter selects. Escape closes (pops scope). Combines three hooks into a real-world pattern.
- **Visual**: Full command palette overlay with search input, filtered command list, and keyboard navigation. Shows which hooks are active.
- **What to try**: "Press `⌘K` to open. Type to filter. `↑` `↓` to navigate. `Enter` to select. `Escape` to close."

#### Demo 10: Multi-Key Handlers
- **Hooks**: `useZoneKeys` with pipe syntax, `keys()` helper
- **What it shows**: `"Enter | Space"` fires the same action. `keys(["1","2","3"], handler)` for number shortcuts. Shows advanced `useZoneKeys` features.
- **Visual**: Card grid. Cards respond to both Enter and Space. Number keys 1-9 jump to corresponding card. Shows the handler map in a code block.
- **What to try**: "Navigate to a card with arrows. Both `Enter` and `Space` select it. Press `1-9` to jump directly."

### Hook Coverage Matrix

| Hook | Demos |
|------|-------|
| `useKey` | 1, 2, 3, 4, 9 |
| `useScope` | 3, 4, 9 |
| `useFocusZone` | 5 |
| `useZoneKeys` | 5, 10 |
| `useNavigation` (scoped) | 6, 9 |
| `useNavigation` (local) | 7 |
| `useTabNavigation` | 8 |
| `keys()` helper | 10 |
| `mod` alias | 2, 9 |
| Pipe syntax | 5, 10 |

Every hook is showcased in at least one dedicated demo and appears in at least one composition demo.

---

## 5. State Visualization

### 5a. Scope Stack Display (`<ScopeStack>`)

A horizontal breadcrumb bar at the top of the demo area showing the live scope stack:

```
Scope: global › modal › confirm
                        ^^^^^^^^ active
```

- Always visible in the demo wrapper
- Updates in real-time as scopes push/pop
- The active (topmost) scope is highlighted with accent color
- Animates on push/pop (slide in/out)

**Implementation**: Reads from `KeyboardContext` — the provider exposes `activeScope`. For the full stack visualization, the playground wraps `KeyboardProvider` with a thin observer that tracks all `pushScope`/`popScope` calls. The simplest approach: a custom `PlaygroundProvider` that wraps `KeyboardProvider` and maintains a `scopeHistory` state that mirrors the internal stack.

Actually, since `KeyboardProvider` doesn't expose the full stack (only `activeScope`), the playground will use a custom hook that intercepts scope changes. The approach:

1. The playground's `main.tsx` wraps the app in `<KeyboardProvider>`
2. A `<ScopeObserver>` component sits inside the provider and listens to `activeScope` changes, building a visible stack
3. Since scopes are deterministic (push on mount, pop on unmount), the observer can track the full stack by observing `activeScope` transitions

Alternatively, the simpler approach: each demo knows its own scope structure and renders the stack statically based on its state (e.g., `isModalOpen` → show `global > modal`). This is more reliable and avoids reverse-engineering the provider's internal stack.

**Decision: Per-demo static scope display.** Each demo component passes its known scope stack to `<ScopeStack>` based on its own state. This is simpler, more reliable, and sufficient for the playground.

### 5b. Key Event Log (`<KeyLog>`)

A collapsible panel (bottom-right corner) showing the last 20 key events:

```
↓  mod+K        → openPalette()     0.2s ago
↓  ArrowDown    → (no handler)      0.5s ago
↓  Enter        → selectItem()      1.1s ago
```

Each entry shows:
- The key combination pressed
- Which handler fired (or "no handler" / "blocked by scope")
- Relative timestamp

**Implementation**: A global `keydown` listener at the playground level captures all events. When a handler fires, demos call a shared `logHandlerFired(name)` function (via context) that annotates the most recent log entry.

### 5c. Zone Indicator

In zone-based demos (Three-Panel Layout), each zone has:
- A colored left border (blue/green/purple for each zone)
- The active zone gets a brighter background tint
- A small badge showing the zone name: `sidebar` `content` `preview`
- Transition animation on zone change (border color fades)

**Implementation**: A `<ZonePanel>` wrapper component that takes `isActive` and `zoneName` props. Uses Tailwind classes conditionally.

### 5d. Handler Flash

When any handler fires, the corresponding UI element briefly flashes:
- 150ms background color pulse (accent color → transparent)
- CSS `@keyframes` animation, triggered by toggling a class

**Implementation**: A `useHandlerFlash()` hook that returns `{ flash, triggerFlash }`. The demo wraps the handler: `() => { triggerFlash(); actualHandler(); }`. `flash` is a boolean that toggles a CSS class.

### 5e. Active Shortcuts Display

Each demo shows a "Keyboard Shortcuts" card listing all active shortcuts for the current state:

```
Active Shortcuts
  ⌘K    Open command palette
  ↑↓    Navigate list
  Enter  Select item
  Esc    Close
```

Shortcuts that are currently disabled (wrong scope/zone) are grayed out. When a shortcut fires, its row briefly highlights.

**Implementation**: Each demo defines its shortcuts as data (array of `{ keys, label, active }`) and passes them to a `<ShortcutList>` component.

---

## 6. Keyboard Hint System

### `<Kbd>` Component

A reusable component that renders keyboard shortcut badges:

```tsx
<Kbd keys="mod+k" />       → ⌘K (Mac) or Ctrl+K (Win)
<Kbd keys="ArrowUp" />     → ↑
<Kbd keys="Enter | Space" /> → Enter / Space
<Kbd keys="Escape" />      → Esc
```

### Platform Detection

```ts
// hooks/use-platform.ts
const isMac = typeof navigator !== "undefined"
  && /Mac|iPhone|iPad/.test(navigator.userAgent);
```

### Key Display Mapping

| Key | Display (Mac) | Display (Win/Linux) |
|-----|---------------|---------------------|
| `mod` | `⌘` | `Ctrl` |
| `Alt` | `⌥` | `Alt` |
| `Shift` | `⇧` | `Shift` |
| `ArrowUp` | `↑` | `↑` |
| `ArrowDown` | `↓` | `↓` |
| `ArrowLeft` | `←` | `←` |
| `ArrowRight` | `→` | `→` |
| `Enter` | `↵` | `Enter` |
| `Escape` | `Esc` | `Esc` |
| `Space` | `Space` | `Space` |
| `Tab` | `⇥` | `Tab` |
| `Backspace` | `⌫` | `Backspace` |

### Styling

- Monospace font
- Rounded corners, subtle border, light gray background
- `min-width` to prevent tiny badges for single characters
- Each key segment (e.g., `⌘` and `K`) rendered as separate adjacent badges
- Pipe syntax (`Enter | Space`) renders as two badges separated by `/`

---

## 7. App Layout

### Sidebar (left, 240px)

- @diffgazer/keys logo/name at top
- Demo list grouped by section (Basics, Scopes, Zones & Navigation, Composition)
- Each demo is a clickable item. Active demo highlighted.
- Keyboard navigable: `↑` `↓` to move, `Enter` to select (uses `useNavigation` from @diffgazer/keys — dogfooding)

### Main Content (right, fills remaining)

- Top bar: Demo title + `<ScopeStack>` display
- Demo area: The active demo component
- Bottom: "What to try" hints card

### Key Log Panel (floating, bottom-right)

- Collapsible with a toggle button
- Semi-transparent background
- Shows above other content (fixed position)
- Can be dismissed

### Responsive

Not a priority. The playground is designed for desktop keyboard interaction. Mobile shows a "This playground requires a keyboard" message.

---

## 8. Development Workflow

```bash
# From repo root
pnpm install                    # Installs both @diffgazer/keys and playground deps
cd examples/playground
pnpm dev                        # Starts Vite dev server

# Or from repo root:
# Add a script to root package.json: "playground": "pnpm --filter playground dev"
```

Changes to `@diffgazer/keys/src/**` trigger HMR in the playground (via Vite alias).

---

## 9. Files Modified in @diffgazer/keys Repo

The playground adds these files/changes to the existing @diffgazer/keys repo:

### New files
- `pnpm-workspace.yaml`
- `examples/playground/` (entire directory)

### Modified files
- `package.json` — add `"playground"` script: `"pnpm --filter playground dev"`
- `.gitignore` — no changes needed (already ignores `node_modules/` and `dist/`)

No existing source files are modified.
