import type { ReactElement, ReactNode } from "react";
import { Box } from "ink";

export interface ScrollAreaProps {
  children: ReactNode;
  height?: number;
  width?: number | string;
}

export function ScrollArea({
  children,
  height,
  width,
}: ScrollAreaProps): ReactElement {
  return (
    <Box
      flexDirection="column"
      height={height}
      width={width}
      overflow="hidden"
    >
      {children}
    </Box>
  );
}
