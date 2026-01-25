# Phase 1: Agent Event Schema

## Overview

Create the foundational types for agent visibility. These types define how agents identify themselves and what events they emit.

## Goal

Enable the UI to show:
- Which agent is running (Detective, Guardian, etc.)
- What the agent is doing (reading file, analyzing, etc.)
- Issues as they're found (live updates)

---

## Agent 1.1: Create AgentEvent Types

```
subagent_type: "backend-development:backend-architect"

Task: Add agent event types to schemas package.

Location: packages/schemas/src/agent-event.ts

## Types to Create

### Agent Identity

Each lens becomes a named "agent" with personality:

const AgentIdSchema = z.enum([
  "detective",   // correctness lens
  "guardian",    // security lens
  "optimizer",   // performance lens
  "simplifier",  // simplicity lens
  "tester",      // tests lens
]);
type AgentId = z.infer<typeof AgentIdSchema>;

### Lens to Agent Mapping

const LENS_TO_AGENT: Record<LensId, AgentId> = {
  correctness: "detective",
  security: "guardian",
  performance: "optimizer",
  simplicity: "simplifier",
  tests: "tester",
};

### Agent Metadata

const AgentMetaSchema = z.object({
  id: AgentIdSchema,
  lens: LensIdSchema,
  name: z.string(),        // "Detective", "Guardian"
  emoji: z.string(),       // "🔍", "🔒"
  description: z.string(), // "Finds bugs and logic errors"
});

const AGENT_METADATA: Record<AgentId, AgentMeta> = {
  detective: {
    id: "detective",
    lens: "correctness",
    name: "Detective",
    emoji: "🔍",
    description: "Finds bugs and logic errors",
  },
  guardian: {
    id: "guardian",
    lens: "security",
    name: "Guardian",
    emoji: "🔒",
    description: "Protects against vulnerabilities",
  },
  optimizer: {
    id: "optimizer",
    lens: "performance",
    name: "Optimizer",
    emoji: "⚡",
    description: "Improves speed and efficiency",
  },
  simplifier: {
    id: "simplifier",
    lens: "simplicity",
    name: "Simplifier",
    emoji: "🧹",
    description: "Reduces complexity",
  },
  tester: {
    id: "tester",
    lens: "tests",
    name: "Tester",
    emoji: "🧪",
    description: "Ensures test coverage",
  },
};

### Stream Events

const AgentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent_start"),
    agent: AgentMetaSchema,
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("agent_thinking"),
    agent: AgentIdSchema,
    thought: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("tool_call"),
    agent: AgentIdSchema,
    tool: z.string(),
    input: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("tool_result"),
    agent: AgentIdSchema,
    tool: z.string(),
    summary: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("issue_found"),
    agent: AgentIdSchema,
    issue: TriageIssueSchema,
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("agent_complete"),
    agent: AgentIdSchema,
    issueCount: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("orchestrator_complete"),
    summary: z.string(),
    totalIssues: z.number(),
    timestamp: z.string(),
  }),
]);
type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

### UI State (for hook)

const AgentStatusSchema = z.enum(["queued", "running", "complete"]);

const AgentStateSchema = z.object({
  id: AgentIdSchema,
  meta: AgentMetaSchema,
  status: AgentStatusSchema,
  progress: z.number().min(0).max(100),
  issueCount: z.number(),
  currentAction: z.string().optional(),
  lastToolCall: z.string().optional(),
});
type AgentState = z.infer<typeof AgentStateSchema>;

## Exports

Export from packages/schemas/src/index.ts:
- All schemas (AgentIdSchema, AgentMetaSchema, AgentStreamEventSchema, AgentStateSchema)
- All types (AgentId, AgentMeta, AgentStreamEvent, AgentState)
- Constants (LENS_TO_AGENT, AGENT_METADATA)

## Steps

1. Create packages/schemas/src/agent-event.ts
2. Import LensIdSchema from lens.ts
3. Import TriageIssueSchema from triage.ts
4. Define all schemas and types
5. Create constants with agent metadata
6. Export from index.ts
7. Run: npm run type-check

## Validation

After completion:
- All types compile without errors
- LENS_TO_AGENT maps all 5 lenses
- AGENT_METADATA has all 5 agents
- AgentStreamEvent covers all event types

Output: Agent event schema created
```

---

## Why This Design

### Named Agents vs Anonymous Lenses

Before:
```
Running lens: correctness...
Running lens: security...
```

After:
```
🔍 Detective is analyzing your code...
🔒 Guardian is checking for vulnerabilities...
```

The personification makes the tool feel more "agentic" and engaging.

### Discriminated Union for Events

Using `z.discriminatedUnion("type", [...])` gives us:
- Type-safe event handling with switch/case
- Automatic narrowing of event payloads
- Easy extension for new event types

### Separate State from Events

Events are immutable, append-only.
State is derived from events, mutable, for UI.

This separation makes testing easier and state updates predictable.
