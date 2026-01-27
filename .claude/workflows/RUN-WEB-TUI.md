# RUN: Web UI TUI Implementation

> **Copy this entire file content and paste into empty Claude context**

---

## Task

Implement Stargazer web UI using TUI (Terminal UI) style from mockups.

## Instructions

1. Read the workflow: `/Users/voitz/Projects/stargazer/.claude/workflows/web-ui-tui-implementation.md`

2. Execute phases using Task tool with specialized agents:
   - Phase 1: Analysis (parallel agents)
   - Phase 2: Components (theme → primitives → layout)
   - Phase 3: Screens (parallel where possible)
   - Phase 4: Integration & validation

3. Key constraints:
   - **ONLY TUI style** (skip mockup #1 Observatory, skip #25 Portfolio)
   - Use mockups 2-24, 26 as reference
   - All components use `tui-` prefix
   - Theme via CSS variables `--tui-*`
   - JetBrains Mono font only
   - Keyboard navigation required

4. Parallelize agents where indicated in workflow

5. Run build verification at end

## Quick Reference

**Mockups location:** `/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/`

**Web app:** `/Users/voitz/Projects/stargazer/apps/web/src/`

**TUI Colors:**
```
--tui-bg: #0D1117      --tui-blue: #58A6FF
--tui-fg: #C9D1D9      --tui-violet: #BC8CFF
--tui-border: #30363D  --tui-green: #3FB950
--tui-selection: #1F2428  --tui-red: #FF7B72
```

**Agent types to use:**
- `Explore` - codebase analysis
- `tailwind-frontend-expert` - theme CSS
- `react-component-architect` - components
- `frontend-developer` - screens
- `code-reviewer` - validation
- `Bash` - build check

## Start

Begin by reading the full workflow file, then execute Phase 1.
