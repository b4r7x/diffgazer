import type { ReactElement } from "react";
import { Text } from "ink";
import { classifyDiffLine } from "@repo/core/diff";

interface DiffLineProps {
  line: string;
}

export function DiffLine({ line }: DiffLineProps): ReactElement {
  const lineType = classifyDiffLine(line);

  switch (lineType) {
    case "addition":
      return <Text color="green">{line}</Text>;
    case "deletion":
      return <Text color="red">{line}</Text>;
    case "hunk-header":
      return <Text color="cyan">{line}</Text>;
    case "file-header":
      return <Text bold>{line}</Text>;
    case "context":
    default:
      return <Text>{line}</Text>;
  }
}
