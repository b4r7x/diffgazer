import { formatDuration } from "@diffgazer/core/format";
import type { LogStreamState } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { pluralize } from "@diffgazer/core/strings";
import { cn } from "@diffgazer/ui/lib/utils";
import { useReviewClock } from "../../hooks/use-clock";

export interface TailStatusInput {
  state: LogStreamState;
  agents: readonly AgentState[];
  sourceFilter: string | undefined;
}

export interface LiveTailRowProps extends TailStatusInput {
  startTime?: Date;
  /** Epoch ms of the last event; falls back to the run start when unknown. */
  lastEventAt?: number;
}

/**
 * What is happening now, derived from agent state rather than from event text.
 * The log body keeps only things that happened, so this one pinned row answers
 * "is it alive?" without the reader scrolling or counting heartbeats. The clock
 * is appended by the row itself: the words are the news, the seconds are not.
 */
export function buildTailStatus({ state, agents, sourceFilter }: TailStatusInput): string {
  if (state === "stalled") return "stream stalled";

  const running = agents.filter((agent) => agent.status === "running");
  const focused = sourceFilter
    ? running.find((agent) => agent.meta.name === sourceFilter)
    : undefined;

  if (sourceFilter) {
    return focused ? `${focused.meta.name} · waiting for model response` : `${sourceFilter} · idle`;
  }
  // Before the roster exists the run is still being set up, and "the next
  // agent" would claim a previous one.
  if (running.length === 0) {
    return agents.length === 0 ? "waiting for the first agent" : "waiting for the next agent";
  }
  if (running.length === 1 && running[0]) {
    return `${running[0].meta.name} · waiting for model response`;
  }
  return `${pluralize(running.length, "agent")} · waiting for model response`;
}

export function LiveTailRow({
  state,
  agents,
  sourceFilter,
  startTime,
  lastEventAt,
}: LiveTailRowProps) {
  const now = useReviewClock();
  const isStalled = state === "stalled";
  // A stall clock anchored on "now" would read 0.0s forever and describe a dead
  // stream as a live one, so an unknown last event falls back to the run start.
  const silentSince = lastEventAt ?? startTime?.getTime();
  const clock = isStalled
    ? `last event ${formatDuration(silentSince ? Math.max(0, now - silentSince) : 0)} ago`
    : formatDuration(startTime ? Math.max(0, now - startTime.getTime()) : 0);

  return (
    // aria-hidden: the same sentence reaches assistive tech through the log's
    // announcement channel, and it must not be re-read every second.
    <div
      aria-hidden="true"
      data-log-tail={state}
      className="shrink-0 border-t border-border px-2 pt-1.5 pb-2 font-mono text-sm"
    >
      <span
        className={cn(
          "mr-2 inline-block h-4 w-2 bg-foreground align-middle",
          !isStalled && "cursor-blink",
        )}
      />
      <span className={cn("truncate", isStalled ? "text-error-text" : "text-muted-foreground")}>
        {`${buildTailStatus({ state, agents, sourceFilter })} · ${clock}`}
      </span>
    </div>
  );
}
