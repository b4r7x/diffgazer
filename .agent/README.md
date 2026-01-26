# Antigravity Configuration

Configuration for Google Antigravity AI IDE.

## Structure

```
.agent/
├── rules/              # Always-on constraints (injected into system prompt)
├── workflows/          # User-triggered sequences (/workflow-name)
└── skills/             # On-demand capabilities (loaded when relevant)
```

## Workflows

| Workflow | Model | Purpose |
|----------|-------|---------|
| `/create-web-ui` | Gemini 3 Pro | Create web UI with Bulletproof React |
| `/wire-web-backend` | Opus 4.5 | Connect web to backend, extract shared code |

### Usage

In Antigravity chat:
```
/create-web-ui
```

Or start typing `/` to see available workflows.

## Skills

| Skill | Description |
|-------|-------------|
| `stargazer-context` | Project overview, architecture, patterns |
| `web-design-guidelines` | UI/UX design principles |
| `bulletproof-react` | React architecture patterns |
| `base-ui-patterns` | Base UI + shadcn component patterns |

Skills are loaded automatically when relevant to your task.

## Rules

| Rule | Applies To | Purpose |
|------|------------|---------|
| `stargazer-web` | `apps/web/*` | Web app coding standards |

Rules are always active for matching file patterns.

## Model Recommendations

| Task | Best Model |
|------|-----------|
| UI/Frontend | Gemini 3 Pro |
| Backend/Logic | Claude Opus 4.5 |
| Quick tasks | Gemini 3 Flash |

Antigravity supports both Claude and Gemini models. Choose based on task type.
