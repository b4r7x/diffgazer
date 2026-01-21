import type { ReactElement } from "react";
import { Text } from "ink";

interface SelectionIndicatorProps {
  isSelected: boolean;
}

export function SelectionIndicator({ isSelected }: SelectionIndicatorProps): ReactElement {
  if (isSelected) {
    return <Text color="green">{">"} </Text>;
  }
  return <Text>{"  "}</Text>;
}
