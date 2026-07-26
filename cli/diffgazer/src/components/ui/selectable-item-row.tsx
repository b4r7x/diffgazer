import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { selectionHue } from "../../theme/chrome";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";

export interface SelectableItemRowProps {
  /** Rendered verbatim ahead of the label, e.g. `[x]` for checkboxes, `( * )` for radios. */
  indicator: string;
  label: ReactNode;
  description?: ReactNode;
  disabled: boolean;
  highlighted: boolean;
  /** Columns that align the description under the label, past the indicator. */
  descriptionIndent: number;
}

interface RowEmphasis {
  color: string | undefined;
  bold: boolean;
}

function getRowEmphasis(
  tokens: CliColorTokens,
  { disabled, highlighted }: Pick<SelectableItemRowProps, "disabled" | "highlighted">,
): RowEmphasis {
  if (disabled) return { color: tokens.muted, bold: false };
  if (highlighted) return { color: selectionHue(tokens), bold: true };
  return { color: undefined, bold: false };
}

/**
 * The indicator/label/description row shared by CheckboxGroup.Item and
 * RadioGroup.Item. A non-string label or description is rendered as given, so
 * call sites can pass their own composed nodes.
 */
export function SelectableItemRow({
  indicator,
  label,
  description,
  disabled,
  highlighted,
  descriptionIndent,
}: SelectableItemRowProps) {
  const { tokens } = useTheme();
  const emphasis = getRowEmphasis(tokens, { disabled, highlighted });

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={emphasis.color} bold={emphasis.bold}>
          {indicator}
        </Text>
        {typeof label === "string" ? (
          <Text color={emphasis.color} bold={emphasis.bold}>
            {label}
          </Text>
        ) : (
          label
        )}
      </Box>
      {description != null && (
        <Box>
          <Text>{" ".repeat(descriptionIndent)}</Text>
          {typeof description === "string" ? (
            <Text color={tokens.muted}>{description}</Text>
          ) : (
            description
          )}
        </Box>
      )}
    </Box>
  );
}
