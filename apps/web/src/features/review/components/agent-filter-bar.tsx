import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";
import { Badge } from "@diffgazer/ui/components/badge";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import type { KeyboardEvent } from "react";
import { ALL_AGENTS_VALUE } from "../hooks/use-progress-keyboard";

export interface AgentOption {
  id: string;
  name: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
}

export function AgentFilterBar({
  agents,
  active,
  isFocused,
  onChange,
  onKeyDown,
}: {
  agents: AgentOption[];
  active: string | null;
  /** True while the keyboard zone sits on the chip row. */
  isFocused: boolean;
  onChange: (v: string | null) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  return (
    <ToggleGroup
      value={active ?? ALL_AGENTS_VALUE}
      onChange={(value) => onChange(value === ALL_AGENTS_VALUE ? null : value)}
      // The zone owns the mark, so no chip can keep it after the row loses
      // focus and paint a second one beside the control the user is on.
      highlighted={isFocused ? (active ?? ALL_AGENTS_VALUE) : null}
      onKeyDown={onKeyDown}
      label="Agent filter"
      className="items-center pb-2"
    >
      <ToggleGroupItem
        value={ALL_AGENTS_VALUE}
        className="h-auto min-h-6 px-2 py-1 text-2xs pointer-coarse:min-h-11 pointer-coarse:px-3"
      >
        All
      </ToggleGroupItem>
      {agents.map((agent) => (
        <ToggleGroupItem
          key={agent.id}
          value={agent.name}
          className="h-auto min-h-6 px-2 py-1 text-2xs pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          <Badge
            variant={agent.badgeVariant}
            size="sm"
            className="mr-1 group-data-[state=on]/segmented-item:border-primary-foreground/40 group-data-[state=on]/segmented-item:bg-primary-foreground/15 group-data-[state=on]/segmented-item:text-primary-foreground"
          >
            {agent.badgeLabel}
          </Badge>
          <span>{agent.name}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
