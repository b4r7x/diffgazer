import { Box, Text } from "ink";
import { ReviewDisplay } from "../../features/review/index.js";
import type { ReviewState } from "../../features/review/index.js";

export function ReviewView({ state, staged }: { state: ReviewState; staged: boolean }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <ReviewDisplay state={state} staged={staged} />
      <Box marginTop={1}>
        <Text dimColor>
          [s] Toggle {staged ? "unstaged" : "staged"} [r] Refresh [b]
          Back [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
