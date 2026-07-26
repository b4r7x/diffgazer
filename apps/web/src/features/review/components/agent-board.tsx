import { getAgentDetail } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { Badge } from "@diffgazer/ui/components/badge";
import { Progress } from "@diffgazer/ui/components/progress";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { cn } from "@diffgazer/ui/lib/utils";

interface AgentBoardProps {
  agents: AgentState[];
  className?: string;
}

// One grid for the whole board with each agent a subgrid row, so the four cells
// of an agent stay one list item for assistive tech while the columns still line
// up across rows.
const BOARD_GRID =
  "grid grid-cols-[auto_minmax(0,auto)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5";
const AGENT_ROW = "col-span-4 grid grid-cols-subgrid items-center";

export function AgentBoard({ agents, className }: AgentBoardProps) {
  if (agents.length === 0) return null;

  return (
    <div className={cn("mb-8", className)}>
      <SectionHeader variant="muted" bordered className="mb-2">
        Agent Board
      </SectionHeader>
      {/* biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
      <ul
        // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ul>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
        role="list"
        aria-label="Agent board"
        className={BOARD_GRID}
      >
        {agents.map((agent) => {
          const detail = getAgentDetail(agent);
          return (
            <li key={agent.id} className={AGENT_ROW}>
              <Badge
                variant={agent.meta.badgeVariant ?? "info"}
                size="sm"
                className="min-w-12 justify-center"
              >
                {agent.meta.badgeLabel}
              </Badge>
              <span className="text-sm font-bold text-foreground">{agent.meta.name}</span>
              <Progress
                value={agent.progress}
                size="sm"
                aria-label={`${agent.meta.name} progress`}
              />
              <span className="text-xs text-muted-foreground truncate" title={detail}>
                {detail}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
