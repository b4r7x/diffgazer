import { useState, type ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { parseFeedbackCommand, type FeedbackCommand } from "@repo/schemas/feedback";
import { useTheme } from "../../../hooks/use-theme.js";

interface FeedbackInputProps {
  isVisible: boolean;
  onCommand: (cmd: FeedbackCommand) => void;
  onCancel: () => void;
}

const COMMAND_HINT = "Commands: focus <topic>, ignore <pattern>, ask <question>, refine <id>, stop";

export function FeedbackInput({
  isVisible,
  onCommand,
  onCancel,
}: FeedbackInputProps): ReactElement | null {
  const { colors } = useTheme();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useInput(
    (input, key) => {
      if (!isVisible) return;

      if (key.escape) {
        setValue("");
        setError(null);
        onCancel();
        return;
      }

      if (key.return) {
        if (value.trim() === "") {
          setValue("");
          setError(null);
          onCancel();
          return;
        }

        const command = parseFeedbackCommand(value);
        if (command) {
          setValue("");
          setError(null);
          onCommand(command);
        } else {
          setError(`Unknown command: "${value}"`);
        }
        return;
      }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        setError(null);
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setValue((prev) => prev + input);
        setError(null);
      }
    },
    { isActive: isVisible }
  );

  if (!isVisible) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={error ? colors.ui.error : colors.ui.border}
      paddingX={1}
    >
      <Box>
        <Text color={colors.ui.accent}>{"> "}</Text>
        <Text>{value}</Text>
        <Text color={colors.ui.textMuted}>{"_"}</Text>
      </Box>
      <Box>
        <Text color={error ? colors.ui.error : colors.ui.textMuted}>{error ?? COMMAND_HINT}</Text>
      </Box>
    </Box>
  );
}
