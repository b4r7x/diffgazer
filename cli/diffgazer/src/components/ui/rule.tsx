import { Box } from "ink";
import { SURFACE_BORDER } from "../../theme/chrome";
import { useTheme } from "../../theme/provider";

/**
 * Full-width hairline divider. It fills its container instead of guessing a
 * character count, so dividers always line up with the surface they sit in.
 */
export function Rule() {
  const { tokens } = useTheme();

  return (
    <Box
      width="100%"
      flexShrink={0}
      borderStyle={SURFACE_BORDER}
      borderColor={tokens.border}
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    />
  );
}
