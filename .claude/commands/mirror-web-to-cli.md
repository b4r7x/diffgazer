# Mirror Web to CLI

Replicate web pages to CLI views with **exact 1:1 UI structure** using Ink components.

---

## Usage

```
/mirror-web-to-cli <page_name>
```

### Available pages:

| Page | Web File | CLI Target |
|------|----------|------------|
| `home` | home.tsx | main-menu-view.tsx |
| `review` | review.tsx | review-view.tsx |
| `history` | history.tsx | history-screen.tsx |
| `settings-hub` | settings-hub.tsx | settings-view.tsx |
| `settings-theme` | settings-theme.tsx | theme section |
| `trust` | trust-permissions.tsx | trust section |
| `provider` | provider-selector.tsx | provider section |
| `diagnostics` | settings-about.tsx | diagnostics section |
| `all` | ALL pages | Full sync |

---

## Execution Flow

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  STEP 1: EXTRACT WEB STRUCTURE (3 parallel agents)                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║  │ code-explorer #1    │  │ code-explorer #2    │  │ code-explorer #3    │   ║
║  │ LAYOUT TREE         │  │ COMPONENTS          │  │ BEHAVIOR            │   ║
║  │                     │  │                     │  │                     │   ║
║  │ - Box hierarchy     │  │ - All imports       │  │ - All hooks         │   ║
║  │ - Flex directions   │  │ - Props interfaces  │  │ - State shape       │   ║
║  │ - Dimensions        │  │ - Feature components│  │ - Keyboard shortcuts│   ║
║  │ - Gaps/margins      │  │ - UI components     │  │ - Focus zones       │   ║
║  └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘   ║
║             │                        │                        │               ║
║             └────────────────────────┴────────────────────────┘               ║
║                                      ▼                                        ║
║                            MERGED: web_structure.json                         ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  ⏸️  CHECKPOINT: Review web structure                                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  STEP 2: COMPARE CLI (2 parallel agents)                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐    ║
║  │ code-explorer #1                │  │ code-explorer #2                │    ║
║  │ LAYOUT DIFF                     │  │ COMPONENT/HOOK DIFF             │    ║
║  │                                 │  │                                 │    ║
║  │ - Compare Box structures        │  │ - Missing components list       │    ║
║  │ - Dimension mismatches          │  │ - Missing hooks list            │    ║
║  │ - Missing layout elements       │  │ - Prop interface gaps           │    ║
║  │ - Wrong flex directions         │  │ - State shape differences       │    ║
║  └────────────────┬────────────────┘  └────────────────┬────────────────┘    ║
║                   │                                    │                      ║
║                   └────────────────┬───────────────────┘                      ║
║                                    ▼                                          ║
║                              gap_analysis.json                                ║
║                              {                                                ║
║                                missing_components: [...],                     ║
║                                layout_changes: [...],                         ║
║                                hook_gaps: [...],                              ║
║                                keyboard_gaps: [...]                           ║
║                              }                                                ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  ⏸️  CHECKPOINT: Review gap analysis, type "ok" to proceed                    ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  STEP 3: DESIGN (2 parallel agents)                                           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐    ║
║  │ code-architect                  │  │ react-component-architect       │    ║
║  │ ARCHITECTURE SPECS              │  │ INK API DESIGN                  │    ║
║  │                                 │  │                                 │    ║
║  │ For each missing component:     │  │ For each missing component:     │    ║
║  │ - File path                     │  │ - Props interface (TypeScript)  │    ║
║  │ - Dependencies                  │  │ - Ink Box structure             │    ║
║  │ - Integration points            │  │ - Text styling                  │    ║
║  │ - Feature module location       │  │ - Color mapping (web→CLI)       │    ║
║  └────────────────┬────────────────┘  └────────────────┬────────────────┘    ║
║                   │                                    │                      ║
║                   └────────────────┬───────────────────┘                      ║
║                                    ▼                                          ║
║                           component_specs.md                                  ║
║                           (ready for implementation)                          ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  ⏸️  CHECKPOINT: Review component specs, type "ok" to implement               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  STEP 4: IMPLEMENT COMPONENTS (N parallel agents)                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  For each component in missing_components:                                    ║
║                                                                               ║
║  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         ║
║  │ react-comp-  │ │ react-comp-  │ │ react-comp-  │ │ react-comp-  │         ║
║  │ architect #1 │ │ architect #2 │ │ architect #3 │ │ architect #N │         ║
║  │              │ │              │ │              │ │              │         ║
║  │ Component A  │ │ Component B  │ │ Component C  │ │ Component N  │         ║
║  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         ║
║                                                                               ║
║  Each agent:                                                                  ║
║  1. Read web component source                                                 ║
║  2. Create Ink equivalent with SAME:                                          ║
║     - Props interface                                                         ║
║     - Visual hierarchy                                                        ║
║     - Keyboard handling                                                       ║
║  3. Write to CLI features/*/components/                                       ║
║  4. Update barrel export (index.ts)                                           ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  STEP 5: ASSEMBLE VIEW (1 agent)                                              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────────────────────────────────────────────────────┐     ║
║  │ react-component-architect                                            │     ║
║  │ VIEW ASSEMBLY                                                        │     ║
║  │                                                                      │     ║
║  │ 1. Read web page layout structure                                    │     ║
║  │ 2. Rewrite CLI view with:                                            │     ║
║  │    - SAME component composition                                      │     ║
║  │    - SAME Box hierarchy (translated to Ink)                          │     ║
║  │    - SAME hooks (or CLI equivalents)                                 │     ║
║  │    - SAME keyboard shortcuts                                         │     ║
║  │    - SAME state management pattern                                   │     ║
║  │ 3. Update navigation in app.tsx if needed                            │     ║
║  └─────────────────────────────────────────────────────────────────────┘     ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  STEP 6: VALIDATE (3 parallel agents)                                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   ║
║  │ code-reviewer       │  │ type-design-        │  │ code-simplifier     │   ║
║  │                     │  │ analyzer            │  │                     │   ║
║  │ CODE QUALITY        │  │ TYPE SAFETY         │  │ SIMPLIFICATION      │   ║
║  │                     │  │                     │  │                     │   ║
║  │ - Bugs              │  │ - Props types       │  │ - Remove over-      │   ║
║  │ - Logic errors      │  │ - State types       │  │   engineering       │   ║
║  │ - Missing edge cases│  │ - Hook return types │  │ - Simplify complex  │   ║
║  │ - Security issues   │  │ - Generic usage     │  │   logic             │   ║
║  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  STEP 7: VERIFY                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Bash: npm run type-check && npm run build                                    ║
║                                                                               ║
║  If fails → fix errors → re-run                                               ║
║  If passes → DONE                                                             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Agent Specifications

### STEP 1: Extract Web Structure

```yaml
Agent 1 - Layout:
  type: feature-dev:code-explorer
  model: opus
  prompt: |
    Analyze {web_page_path} and extract COMPLETE layout structure.

    Output JSON:
    {
      "root": {
        "element": "div|Box",
        "className": "...",
        "inkEquivalent": { "flexDirection": "...", "padding": N, ... },
        "children": [...]
      }
    }

    Map EVERY Tailwind class to Ink Box prop:
    - flex → flexDirection: "row"
    - flex-col → flexDirection: "column"
    - flex-1 → flexGrow: 1
    - gap-N → gap: N
    - p-N → padding: N
    - px-N → paddingX: N
    - w-1/3 → width: "33%"
    - etc.

Agent 2 - Components:
  type: feature-dev:code-explorer
  model: opus
  prompt: |
    Analyze {web_page_path} and extract ALL components.

    Output JSON:
    {
      "imports": [
        { "name": "ComponentName", "from": "@/path", "type": "ui|feature|layout" }
      ],
      "components": [
        {
          "name": "ComponentName",
          "props": { "propName": "propType" },
          "location_in_layout": "root.children[0].children[1]",
          "web_source_file": "/path/to/component.tsx"
        }
      ]
    }

Agent 3 - Behavior:
  type: feature-dev:code-explorer
  model: opus
  prompt: |
    Analyze {web_page_path} and extract ALL behavior.

    Output JSON:
    {
      "hooks": [
        { "name": "useHookName", "from": "@/path", "returns": "{ field: type }" }
      ],
      "state": [
        { "name": "stateName", "type": "Type", "initial": "value" }
      ],
      "keyboard": [
        { "key": "j", "action": "moveDown", "scope": "list", "handler": "code" }
      ],
      "focus_zones": ["zone1", "zone2"],
      "navigation": { "escape": "home", "enter": "action" }
    }
```

### STEP 2: Compare CLI

```yaml
Agent 1 - Layout Diff:
  type: feature-dev:code-explorer
  model: opus
  prompt: |
    Compare web layout (from step 1) with CLI view {cli_view_path}.

    Output JSON:
    {
      "layout_matches": false,
      "differences": [
        {
          "path": "root.children[0]",
          "web": { "element": "div", "class": "flex gap-4" },
          "cli": { "element": "Box", "props": {} },
          "fix": "Add gap: 1 to Box"
        }
      ],
      "missing_elements": [
        { "path": "root.children[2]", "web_element": "FocusablePane" }
      ]
    }

Agent 2 - Component/Hook Diff:
  type: feature-dev:code-explorer
  model: opus
  prompt: |
    Compare web components/hooks (from step 1) with CLI view {cli_view_path}.

    Output JSON:
    {
      "missing_components": [
        {
          "name": "ContextSidebar",
          "web_source": "/path/to/web/component.tsx",
          "cli_target": "/path/to/cli/features/home/components/context-sidebar.tsx",
          "priority": "high"
        }
      ],
      "missing_hooks": [
        { "name": "useRouteState", "web_source": "...", "cli_equivalent": "useState" }
      ],
      "keyboard_gaps": [
        { "key": "Tab", "web_action": "cycleFocus", "cli_action": null }
      ]
    }
```

### STEP 3: Design

```yaml
Agent 1 - Architecture:
  type: feature-dev:code-architect
  model: opus
  prompt: |
    Design architecture for missing components: {missing_components}

    For each component specify:
    1. File path (follow bulletproof-react structure)
    2. Feature module (features/*/components/)
    3. Dependencies (other components, hooks)
    4. Integration points (where used in view)

    Output: component_architecture.md

Agent 2 - Ink API:
  type: react-component-architect
  model: opus
  prompt: |
    Design Ink component APIs for: {missing_components}

    For each component specify:
    1. Props interface (TypeScript)
    2. Ink Box structure (complete JSX skeleton)
    3. Text styling (color, bold, dim mappings)
    4. Keyboard handling (useInput patterns)

    Web-to-Ink color mapping:
    - text-tui-cyan → color="cyan"
    - text-tui-violet → color="magenta"
    - text-tui-blue → color="blue"
    - text-muted → dimColor
    - bg-* → (use inverse or backgroundColor if supported)

    Output: ink_component_specs.md
```

### STEP 4: Implement Components

```yaml
Per Component:
  type: react-component-architect
  model: opus
  prompt: |
    Create Ink component: {component_name}

    Web source: {web_source_path}
    CLI target: {cli_target_path}

    Requirements:
    1. Read web component completely
    2. Create EXACT Ink equivalent:
       - Same props interface
       - Same visual structure (Box hierarchy)
       - Same keyboard handling
    3. Use existing CLI UI components where available
    4. Follow kebab-case file naming
    5. Export from feature barrel (index.ts)

    IMPORTANT:
    - Copy the EXACT visual hierarchy
    - Translate Tailwind → Ink props
    - Keep same component composition pattern
```

### STEP 5: Assemble View

```yaml
View Assembly:
  type: react-component-architect
  model: opus
  prompt: |
    Rewrite CLI view: {cli_view_path}
    To match web page: {web_page_path}

    Using components created in Step 4.

    Requirements:
    1. SAME layout structure (Box hierarchy)
    2. SAME component composition
    3. SAME hooks (or CLI equivalents)
    4. SAME keyboard shortcuts
    5. SAME state shape
    6. SAME focus zone management

    Also update:
    - views/index.ts exports
    - app.tsx navigation if needed
```

### STEP 6: Validate

```yaml
Agent 1 - Code Review:
  type: code-reviewer
  model: opus
  prompt: |
    Review all files created/modified for {page_name} mirror.

    Check:
    - Logic correctness
    - Edge cases
    - Error handling
    - Keyboard accessibility
    - Focus management

Agent 2 - Type Safety:
  type: pr-review-toolkit:type-design-analyzer
  model: opus
  prompt: |
    Analyze types in files created for {page_name} mirror.

    Check:
    - Props interfaces complete
    - State types correct
    - Hook return types
    - No any/unknown unless justified

Agent 3 - Simplification:
  type: code-simplifier:code-simplifier
  model: opus
  prompt: |
    Review and simplify files created for {page_name} mirror.

    Remove:
    - Overengineering
    - Unused code
    - Overly complex patterns
    Keep:
    - All functionality
    - Visual structure match
```

---

## Page-Specific Mappings

### home → main-menu-view

```
Web Structure:
├── ContextSidebar (left panel)
│   ├── StatusCard (provider, model, trust)
│   └── LastRunStats
└── HomeMenu (right panel)
    └── MenuItem[] (review, history, settings, quit)

CLI Target:
├── ContextSidebar (NEW - create)
│   ├── StatusCard (exists, enhance)
│   └── LastRunStats (NEW)
└── Menu (exists, align styling)
```

### review → review-view

```
Web Structure (3 phases):
Phase 1: ReviewContainer (progress)
Phase 2: AnalysisSummary (summary)
Phase 3: SplitPane
         ├── IssueListPane (filters + list)
         └── IssueDetailsPane (tabs)

CLI Target:
- Ensure 3-phase flow exists
- Match IssueListPane exactly
- Match IssueDetailsPane tabs exactly
```

### history → history-screen

```
Web Structure:
├── Tabs (runs | sessions)
└── 3-Pane Layout
    ├── FocusablePane (timeline)
    ├── FocusablePane (runs list)
    └── FocusablePane (insights)

CLI Target: (already similar, verify exact match)
```

### settings-hub → settings-view

```
Web Structure:
└── Panel
    ├── PanelHeader ("SETTINGS HUB")
    └── Menu (variant="hub")
        └── MenuItem[] (trust, theme, provider, diagnostics)

CLI Target:
- Change from section list to hub menu pattern
- Match web MenuItem styling
```

### provider → provider section

```
Web Structure:
├── ProviderList (left, w-2/5)
│   ├── Search input
│   ├── Filter buttons
│   └── Provider items
├── ProviderDetails (right, w-3/5)
│   ├── Header
│   ├── Info fields
│   └── Action buttons
└── Dialogs
    ├── ApiKeyDialog
    └── ModelSelectDialog

CLI Target:
- Create 2-pane layout
- Create ProviderList component
- Create ProviderDetails component
- Create dialogs (Modal components)
```

---

## Execution Rules

1. **ALL agents use model=opus** - no haiku for quality work
2. **Parallel where possible** - Steps 1, 2, 4, 6 spawn parallel agents
3. **Checkpoint after each step** - user must type "ok" to proceed
4. **Subagents return structured data** - JSON for diffs, specs for design
5. **One view at a time** - complete one page fully before next
6. **Type-check gate** - Step 7 must pass before marking done
7. **No shortcuts** - every component must be created, no "similar enough"

---

## Quick Reference

```bash
# Single page
/mirror-web-to-cli home

# All pages (runs sequentially)
/mirror-web-to-cli all

# Specific settings section
/mirror-web-to-cli provider
```
