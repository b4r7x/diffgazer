# Component Mirror: Web → CLI (Ink)

## Type: AUDIT + IMPLEMENT

## Purpose
Web components are source of truth. Create matching CLI components using React Ink that display the same data in terminal UI.

## Agents Used
| Agent | Purpose |
|-------|---------|
| `feature-dev:code-explorer` | Analyze web component structure |
| `react-component-architect` | Design CLI component architecture |
| `javascript-typescript:typescript-pro` | TypeScript types and patterns |
| `react-principles` | React best practices |
| `feature-dev:code-reviewer` | Review created components |
| `code-simplifier:code-simplifier` | Simplify over-engineered code |

---

## AUDIT PHASE

### Phase 1: Web Component Inventory
```
Agent: feature-dev:code-explorer (opus)
Task: List all components in apps/web/src/components/ and apps/web/src/features/
Output: Component name, props interface, what it renders, data it needs
```

### Phase 2: CLI Component Inventory
```
Agent: feature-dev:code-explorer (opus)
Task: List all components in apps/cli/src/components/
Output: Component name, props interface, Ink elements used
```

### Phase 3: Component Mapping
```
Agent: react-component-architect (opus)
Task: Map web components to CLI equivalents
Output:
- Existing matches
- Missing components to create
- Components needing updates
```

---

## IMPLEMENT PHASE

> **Note:** IMPLEMENT PHASE runs only after user approval of all audits

### Phase 4: Create/Update Components
```
Agent: react-component-architect (opus) + javascript-typescript:typescript-pro (opus)
Task: For each missing/outdated component:
1. Design Ink equivalent of web component
2. Use same props interface (from @repo/core if shared)
3. Render same data in terminal-friendly format
```

### Phase 5: Review & Simplify
```
Agent: feature-dev:code-reviewer (opus)
Task: Review created components for quality

Agent: code-simplifier:code-simplifier (opus)
Task: Remove over-engineering, keep it simple
```

---

## Component Translation Rules

| Web Element | Ink Equivalent |
|-------------|----------------|
| `<div>` | `<Box>` |
| `<span>`, `<p>` | `<Text>` |
| `<button>` | `<Text>` with useInput handler |
| `<input>` | `<TextInput>` from ink |
| `<select>` | `<SelectInput>` from ink |
| Tailwind classes | Ink props (flexDirection, padding, etc.) |

## Expected Output

### Component Mapping Table
| Web Component | CLI Component | Status | Action |
|---------------|---------------|--------|--------|
| Panel | Card | ✓ Exists | Update props |
| Menu | SelectList | ✓ Exists | - |
| IssueCard | - | ✗ Missing | Create |
| ... | ... | ... | ... |

### Files Created/Modified
- apps/cli/src/components/ui/issue-card.tsx (NEW)
- apps/cli/src/components/ui/card.tsx (UPDATED)
- ...
