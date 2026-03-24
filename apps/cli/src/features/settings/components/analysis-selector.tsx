import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { CheckboxGroup } from "../../../components/ui/checkbox.js";
import { Badge } from "../../../components/ui/badge.js";

interface AnalysisSelectorProps {
  selectedAgents: string[];
  onChange: (agents: string[]) => void;
  isActive?: boolean;
}

const agents = [
  { id: "security", label: "Security", variant: "error" as const },
  { id: "performance", label: "Performance", variant: "warning" as const },
  { id: "correctness", label: "Correctness", variant: "info" as const },
  { id: "style", label: "Style", variant: "neutral" as const },
  { id: "tests", label: "Tests", variant: "success" as const },
];

export function AnalysisSelector({
  selectedAgents,
  onChange,
  isActive = true,
}: AnalysisSelectorProps): ReactElement {
  return (
    <CheckboxGroup value={selectedAgents} onChange={onChange} isActive={isActive}>
      {agents.map((agent) => (
        <CheckboxGroup.Item
          key={agent.id}
          value={agent.id}
          label={
            <Box gap={1}>
              <Text>{agent.label}</Text>
              <Badge variant={agent.variant}>{agent.id}</Badge>
            </Box>
          }
        />
      ))}
    </CheckboxGroup>
  );
}
