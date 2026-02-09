import type { AgentStreamEvent, AgentId, StepEvent, EnrichEvent } from "@diffgazer/schemas/events";
import { AGENT_METADATA, STEP_METADATA } from "@diffgazer/schemas/events";
import type { LogEntryData } from "@diffgazer/schemas/ui";
import { truncate } from "../strings.js";

function getAgent(agentId: AgentId): { label: string; name: string } {
  const meta = AGENT_METADATA[agentId];
  return { label: meta?.badgeLabel ?? "AGT", name: meta?.name ?? agentId };
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function convertEventToLogEntry(
  event: AgentStreamEvent | StepEvent | EnrichEvent,
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
      message: `Review started: ${event.filesTotal} file${event.filesTotal === 1 ? "" : "s"} to analyze`,
    };
  }

  if (event.type === "enrich_progress") {
    return {
      id,
      timestamp,
      tag: "ENRICH",
      tagType: "system",
      message: `${event.enrichmentType} ${event.status}: ${event.issueId}`,
    };
  }

  switch (event.type) {
    case "orchestrator_start":
      return {
        id,
        timestamp,
        tag: "ORCH",
        tagType: "system",
        message: `Orchestrator started (${event.agents.length} agents, concurrency ${event.concurrency})`,
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
      return { id, timestamp, tag: label, tagType: "thinking", message: truncate(event.thought, 100), source: name };
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

    case "tool_call":
    case "tool_start": {
      const { name } = getAgent(event.agent);
      return {
        id,
        timestamp,
        tag: "TOOL",
        tagType: "tool",
        message: `${event.tool}: ${truncate(event.input, 60)}`,
        source: name,
      };
    }

    case "tool_result":
    case "tool_end": {
      const { name } = getAgent(event.agent);
      return {
        id,
        timestamp,
        tag: "TOOL",
        tagType: "tool",
        message: truncate(event.summary, 100),
        source: name,
      };
    }

    case "issue_found": {
      const { label, name } = getAgent(event.agent);
      return { id, timestamp, tag: label, tagType: "warning", message: `Found: ${event.issue.title}`, isWarning: true, source: name };
    }

    case "agent_complete": {
      const { label, name } = getAgent(event.agent);
      return { id, timestamp, tag: label, tagType: "agent", message: `Complete (${pluralize(event.issueCount, "issue")})`, source: name };
    }

    case "orchestrator_complete":
      return { id, timestamp, tag: "DONE", tagType: "system", message: `Review complete: ${pluralize(event.totalIssues, "issue")} found` };

    default: {
      const _exhaustive: never = event;
      return null;
    }
  }
}

export function convertAgentEventsToLogEntries(
  events: (AgentStreamEvent | StepEvent | EnrichEvent)[]
): LogEntryData[] {
  return events
    .map(convertEventToLogEntry)
    .filter((entry): entry is LogEntryData => entry !== null);
}
