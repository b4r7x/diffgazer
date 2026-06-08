import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { Badge, type BadgeProps } from "../../../components/ui/badge";
import { useTheme } from "../../../theme/provider";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export interface AgentFilterOption {
  id: string;
  name: string;
  badgeLabel?: string;
  badgeVariant?: BadgeVariant;
}

export interface AgentFilterBarProps {
  agents: AgentFilterOption[];
  active: string | null;
  onChange: (value: string | null) => void;
  isActive?: boolean;
}

const ALL_VALUE = "all";

export function AgentFilterBar({
  agents,
  active,
  onChange,
  isActive = false,
}: AgentFilterBarProps) {
  const { tokens } = useTheme();
  const options = [ALL_VALUE, ...agents.map((a) => a.name)];
  const [focusedIndex, setFocusedIndex] = useState(0);

  useInput(
    (input, key) => {
      if (key.leftArrow) {
        setFocusedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.rightArrow) {
        setFocusedIndex((i) => Math.min(options.length - 1, i + 1));
        return;
      }
      if (key.return || input === " ") {
        const next = options[focusedIndex];
        if (next === undefined) return;
        onChange(next === ALL_VALUE ? null : next);
      }
    },
    { isActive },
  );

  if (agents.length === 0) return null;

  const activeValue = active ?? ALL_VALUE;

  return (
    <Box gap={1}>
      {options.map((option, index) => {
        const isSelected = option === activeValue;
        const isFocused = isActive && index === focusedIndex;
        if (option === ALL_VALUE) {
          return (
            <Text
              key={option}
              color={isSelected ? tokens.accent : tokens.muted}
              bold={isSelected}
              inverse={isFocused}
            >
              [All]
            </Text>
          );
        }
        const agent = agents.find((a) => a.name === option);
        if (!agent) return null;
        return (
          <Box key={option}>
            <Text
              color={isSelected ? tokens.accent : tokens.muted}
              bold={isSelected}
              inverse={isFocused}
            >
              [
            </Text>
            <Badge variant={agent.badgeVariant ?? "info"} size="sm">
              {agent.badgeLabel ?? agent.name.slice(0, 3).toUpperCase()}
            </Badge>
            <Text
              color={isSelected ? tokens.accent : tokens.muted}
              bold={isSelected}
              inverse={isFocused}
            >
              {" "}
              {agent.name}]
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
