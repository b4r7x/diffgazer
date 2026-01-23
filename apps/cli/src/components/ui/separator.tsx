import type { ReactElement } from "react";
import { Text } from "ink";

interface SeparatorProps {
  width?: number;
}

export function Separator({ width = 40 }: SeparatorProps): ReactElement {
  return <Text dimColor>{"─".repeat(width)}</Text>;
}
