import type { ReactElement } from "react";
import { Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

export function StatusDisplay(): ReactElement {
  const { tokens } = useTheme();
  return <Text color={tokens.muted}>Esc or ctrl+c to exit</Text>;
}
