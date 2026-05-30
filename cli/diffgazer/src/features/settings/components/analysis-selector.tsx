import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { CheckboxGroup } from "../../../components/ui/checkbox";
import { Badge } from "../../../components/ui/badge";
import { buildLensOptions } from "@diffgazer/core/schemas/events";
import type { LensId } from "@diffgazer/core/schemas/review";

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
              <Badge variant={lens.badgeVariant}>{lens.badgeLabel}</Badge>
              <Text>{lens.label}</Text>
            </Box>
          }
          description={lens.description}
        />
      ))}
    </CheckboxGroup>
  );
}
