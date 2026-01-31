import type { AgentStreamEvent, AgentId } from "@repo/schemas/agent-event";
import { AGENT_METADATA } from "@repo/schemas/agent-event";
import type { StepEvent } from "@repo/schemas/step-event";
import { STEP_METADATA } from "@repo/schemas/step-event";
import type { LogEntryData } from "@repo/schemas/ui";

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

function getAgent(agentId: AgentId): { emoji: string; name: string } {
  const meta = AGENT_METADATA[agentId];
  return { emoji: meta?.emoji ?? "🤖", name: meta?.name ?? agentId };
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function convertEventToLogEntry(
  event: AgentStreamEvent | StepEvent,
  index: number
): LogEntryData | null {
  const id = `${event.type}-${index}`;
  const { timestamp } = event;

  // Handle StepEvents
  if (event.type === "step_start") {
    const meta = STEP_METADATA[event.step];
    return {
      id,
      timestamp,
      tag: "STEP",
      tagType: "system",
      message: `${meta.label}: ${meta.description}`,
    };
  }

  if (event.type === "step_complete") {
    const meta = STEP_METADATA[event.step];
    return {
      id,
      timestamp,
      tag: "✓",
      tagType: "system",
      message: `${meta.label} complete`,
    };
  }

  if (event.type === "step_error") {
    const meta = STEP_METADATA[event.step];
    return {
      id,
      timestamp,
      tag: "ERROR",
      tagType: "error",
      message: `${meta.label} failed: ${event.error}`,
      isWarning: true,
    };
  }

  if (event.type === "review_started") {
    return {
      id,
      timestamp,
      tag: "START",
      tagType: "system",
      message: `Review started: ${event.filesTotal} file${event.filesTotal === 1 ? "" : "s"} to analyze`,
    };
  }

  switch (event.type) {
    case "file_start":
      return {
        id,
        timestamp,
        tag: "FILE",
        tagType: "system",
        message: `Analyzing ${event.file} (${event.index + 1}/${event.total})`,
      };

    case "file_complete":
      return {
        id,
        timestamp,
        tag: "✓",
        tagType: "system",
        message: `${event.file} complete`,
      };
    case "agent_start":
      return {
        id,
        timestamp,
        tag: `${event.agent.emoji} ${event.agent.name}`,
        tagType: "lens",
        message: "Starting analysis...",
      };

    case "agent_thinking": {
      const { emoji } = getAgent(event.agent);
      return { id, timestamp, tag: emoji, tagType: "system", message: truncate(event.thought, 100) };
    }

    case "tool_call":
      return { id, timestamp, tag: "TOOL", tagType: "tool", message: `${event.tool}: ${truncate(event.input, 60)}`, source: event.tool };

    case "tool_result":
      return { id, timestamp, tag: "TOOL", tagType: "tool", message: truncate(event.summary, 100), source: event.tool };

    case "issue_found": {
      const { emoji, name } = getAgent(event.agent);
      return { id, timestamp, tag: emoji, tagType: "warning", message: `Found: ${event.issue.title}`, isWarning: true, source: name };
    }

    case "agent_complete": {
      const { emoji, name } = getAgent(event.agent);
      return { id, timestamp, tag: `${emoji} ${name}`, tagType: "lens", message: `Complete (${pluralize(event.issueCount, "issue")})` };
    }

    case "orchestrator_complete":
      return { id, timestamp, tag: "✅", tagType: "system", message: `Review complete: ${pluralize(event.totalIssues, "issue")} found` };

    default: {
      const _exhaustive: never = event;
      return null;
    }
  }
}

export function convertAgentEventsToLogEntries(events: (AgentStreamEvent | StepEvent)[]): LogEntryData[] {
  return events
    .map(convertEventToLogEntry)
    .filter((entry): entry is LogEntryData => entry !== null);
}
