import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number | string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  width = "100%",
}: ModalProps): ReactElement | null {
  const { colors } = useTheme();

  useInput(
    (input, key) => {
      if (key.escape) {
        onClose();
      }
    },
    { isActive: isOpen }
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.ui.borderFocused}
      width={width}
      paddingX={1}
      paddingY={1}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold color={colors.ui.accent}>
            {title}
          </Text>
          <Box flexGrow={1} />
          <Text dimColor>[Esc] Close</Text>
        </Box>
      )}
      {children}
    </Box>
  );
}
