import type { AgentId, AgentStreamEvent, StepEvent } from "../schemas/events/index.js";
import { AGENT_METADATA, STEP_METADATA } from "../schemas/events/index.js";
import type { LogEntryData } from "../schemas/presentation/index.js";
import { pluralize, truncate } from "../strings.js";

function getAgent(agentId: AgentId): { label: string; name: string } {
  const meta = AGENT_METADATA[agentId];
  return { label: meta?.badgeLabel ?? "AGT", name: meta?.name ?? agentId };
}

export function getReviewEventLogSource(event: AgentStreamEvent | StepEvent): string | undefined {
  switch (event.type) {
    case "agent_start":
      return event.agent.name;
    case "agent_thinking":
    case "agent_progress":
    case "agent_error":
    case "issue_found":
    case "agent_complete":
      return getAgent(event.agent).name;
    default:
      return undefined;
  }
}

export function convertReviewEventToLogEntry(
  event: AgentStreamEvent | StepEvent,
  index: number,
): LogEntryData | null {
  const id = `${event.type}-${index}`;
  const { timestamp } = event;

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
      tag: "DONE",
      tagType: "system",
      message: `${meta.label} complete`,
    };
  }

  if (event.type === "step_error") {
    const meta = STEP_METADATA[event.step];
    return {
      id,
      timestamp,
      tag: "FAIL",
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
      message: `Review started: ${pluralize(event.filesTotal, "file")} to analyze`,
    };
  }

  switch (event.type) {
    case "orchestrator_start":
      return {
        id,
        timestamp,
        tag: "ORCH",
        tagType: "system",
        message: `Orchestrator started (${pluralize(event.agents.length, "agent")}, concurrency ${event.concurrency})`,
      };

    case "agent_queued":
      return {
        id,
        timestamp,
        tag: "QUEUE",
        tagType: "agent",
        message: `${event.agent.name} queued (${event.position}/${event.total})`,
      };

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
        tag: "DONE",
        tagType: "system",
        message: `${event.file} complete`,
      };

    case "file_progress":
      return {
        id,
        timestamp,
        tag: "FILE",
        tagType: "system",
        message: `Included ${event.file} in prompt (${event.completed}/${event.total})`,
      };

    case "agent_start":
      return {
        id,
        timestamp,
        tag: event.agent.badgeLabel,
        tagType: "agent",
        message: "Starting analysis...",
        source: event.agent.name,
      };

    case "agent_thinking": {
      const { label, name } = getAgent(event.agent);
      return {
        id,
        timestamp,
        tag: label,
        tagType: "thinking",
        message: truncate(event.thought, 100),
        source: name,
      };
    }

    case "agent_progress": {
      const { label, name } = getAgent(event.agent);
      return {
        id,
        timestamp,
        tag: label,
        tagType: "agent",
        message: `${event.progress}%${event.message ? ` — ${truncate(event.message, 80)}` : ""}`,
        source: name,
      };
    }

    case "agent_error": {
      const { label, name } = getAgent(event.agent);
      return {
        id,
        timestamp,
        tag: label,
        tagType: "error",
        message: truncate(event.error, 120),
        isError: true,
        source: name,
      };
    }

    case "issue_found": {
      const { label, name } = getAgent(event.agent);
      return {
        id,
        timestamp,
        tag: label,
        tagType: "warning",
        message: `Found: ${event.issue.title}`,
        isWarning: true,
        source: name,
      };
    }

    case "agent_complete": {
      const { label, name } = getAgent(event.agent);
      return {
        id,
        timestamp,
        tag: label,
        tagType: "agent",
        message: `Complete (${pluralize(event.issueCount, "issue")})`,
        source: name,
      };
    }

    case "orchestrator_complete":
      return {
        id,
        timestamp,
        tag: "DONE",
        tagType: "system",
        message: `Review complete: ${pluralize(event.totalIssues, "issue")} found`,
      };

    default: {
      const _exhaustive: never = event;
      return null;
    }
  }
}

export function convertAgentEventsToLogEntries(
  events: readonly (AgentStreamEvent | StepEvent)[],
  range: { start: number; end: number } = { start: 0, end: events.length },
): LogEntryData[] {
  const start = Math.max(0, Math.min(range.start, events.length));
  const end = Math.max(start, Math.min(range.end, events.length));
  const entries: LogEntryData[] = [];

  for (let index = start; index < end; index += 1) {
    const event = events[index];
    if (!event) continue;
    const entry = convertReviewEventToLogEntry(event, index);
    if (entry) entries.push(entry);
  }

  return entries;
}
