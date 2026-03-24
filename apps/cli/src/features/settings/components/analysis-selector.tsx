import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { CheckboxGroup } from "../../../components/ui/checkbox.js";
import { Badge } from "../../../components/ui/badge.js";
import type { BadgeProps } from "../../../components/ui/badge.js";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/schemas/events";
import type { LensId } from "@diffgazer/schemas/review";

interface LensOption {
  id: LensId;
  label: string;
  badgeLabel: string;
  badgeVariant: BadgeProps["variant"];
}

function buildLensOptions(): LensOption[] {
  return (Object.entries(LENS_TO_AGENT) as Array<[LensId, keyof typeof AGENT_METADATA]>).map(
    ([lensId, agentId]) => {
      const meta = AGENT_METADATA[agentId];
      return {
        id: lensId,
        label: meta.name,
        badgeLabel: meta.badgeLabel,
        badgeVariant: (meta.badgeVariant ?? "info") as BadgeProps["variant"],
      };
    },
  );
}

export const lensOptions = buildLensOptions();

interface AnalysisSelectorProps {
  selectedLenses: LensId[];
  onChange: (lenses: LensId[]) => void;
  isActive?: boolean;
  disabled?: boolean;
}

export function AnalysisSelector({
  selectedLenses,
  onChange,
  isActive = true,
  disabled = false,
}: AnalysisSelectorProps): ReactElement {
  return (
    <CheckboxGroup
      value={selectedLenses}
      onChange={(values) => onChange(values as LensId[])}
      isActive={isActive}
      disabled={disabled}
    >
      {lensOptions.map((lens) => (
        <CheckboxGroup.Item
          key={lens.id}
          value={lens.id}
          label={
            <Box gap={1}>
              <Text>{lens.label}</Text>
              <Badge variant={lens.badgeVariant}>{lens.badgeLabel}</Badge>
            </Box>
          }
        />
      ))}
    </CheckboxGroup>
  );
}
