import type { AgentId, AgentStreamEvent, LensStat, StepEvent } from "../schemas/events/index.js";
import { AGENT_METADATA, STEP_METADATA } from "../schemas/events/index.js";
import type { LogEntryData } from "../schemas/presentation/index.js";
import { pluralize, truncate } from "../strings.js";
import { isFatalStepFailure } from "./lifecycle.js";

function getAgent(agentId: AgentId): { label: string; name: string } {
  const meta = AGENT_METADATA[agentId];
  return { label: meta.badgeLabel, name: meta.name };
}

/**
 * Orchestration ends before the pipeline decides whether the review failed, so a
 * run whose lenses failed must not sign the log off as a clean pass.
 */
function describeOrchestratorCompletion(
  totalIssues: number,
  lensStats: readonly LensStat[],
): string {
  const issues = pluralize(totalIssues, "issue");
  const failedCount = lensStats.filter((stat) => stat.status === "failed").length;
  if (failedCount === 0) return `Review complete: ${issues} found`;

  const completedCount = lensStats.length - failedCount;
  const lenses = pluralize(lensStats.length, "lens", "lenses");
  return `Orchestration finished: ${issues} from ${completedCount} of ${lenses} (${failedCount} failed)`;
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
): LogEntryData {
  const id = `${event.type}-${index}`;
  const { timestamp } = event;

  switch (event.type) {
    case "step_start": {
      const meta = STEP_METADATA[event.step];
      return {
        id,
        timestamp,
        tag: "STEP",
        tagType: "system",
        message: `${meta.label}: ${meta.description}`,
      };
    }

    case "step_complete": {
      const meta = STEP_METADATA[event.step];
      return {
        id,
        timestamp,
        tag: "DONE",
        tagType: "system",
        message: `${meta.label} complete`,
      };
    }

    case "step_error": {
      const meta = STEP_METADATA[event.step];
      const fatal = isFatalStepFailure(event.step);
      return {
        id,
        timestamp,
        tag: "FAIL",
        tagType: "error",
        message: `${meta.label} failed: ${event.error}`,
        ...(fatal ? { isError: true } : { isWarning: true }),
      };
    }

    case "review_started":
      return {
        id,
        timestamp,
        tag: "START",
        tagType: "system",
        message: `Review started: ${pluralize(event.filesTotal, "file")} to analyze`,
      };

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
        message: describeOrchestratorCompletion(event.totalIssues, event.lensStats),
      };

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function convertReviewEventsToLogEntries(
  events: readonly (AgentStreamEvent | StepEvent)[],
  range: { start: number; end: number } = { start: 0, end: events.length },
): LogEntryData[] {
  const start = Math.max(0, Math.min(range.start, events.length));
  const end = Math.max(start, Math.min(range.end, events.length));
  const entries: LogEntryData[] = [];

  for (let index = start; index < end; index += 1) {
    const event = events[index];
    if (!event) continue;
    entries.push(convertReviewEventToLogEntry(event, index));
  }

  return entries;
}
