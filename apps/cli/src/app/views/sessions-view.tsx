import type { ComponentProps } from "react";
import { Box } from "ink";
import { SessionsScreen } from "../screens/sessions-screen.js";

export function SessionsView(props: ComponentProps<typeof SessionsScreen>) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <SessionsScreen {...props} />
    </Box>
  );
}
