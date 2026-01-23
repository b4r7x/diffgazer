import type { ComponentProps } from "react";
import { Box } from "ink";
import { ReviewHistoryScreen } from "../screens/review-history-screen.js";

export function ReviewHistoryView(props: ComponentProps<typeof ReviewHistoryScreen>) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <ReviewHistoryScreen {...props} />
    </Box>
  );
}
