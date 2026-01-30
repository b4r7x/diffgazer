import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

interface DialogContextValue {
  isOpen: boolean;
  onClose: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog compound components must be used within Dialog");
  }
  return context;
}

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
}

export function Dialog({
  isOpen,
  onClose,
  children,
  width = "100%",
}: DialogProps): ReactElement | null {
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
    <DialogContext.Provider value={{ isOpen, onClose }}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.ui.borderFocused}
        width={width}
        paddingX={1}
        paddingY={1}
      >
        {children}
      </Box>
    </DialogContext.Provider>
  );
}

interface DialogHeaderProps {
  children: ReactNode;
}

export function DialogHeader({ children }: DialogHeaderProps): ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {children}
    </Box>
  );
}

interface DialogTitleProps {
  children: ReactNode;
}

export function DialogTitle({ children }: DialogTitleProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box>
      <Text bold color={colors.ui.accent}>
        {children}
      </Text>
    </Box>
  );
}

interface DialogDescriptionProps {
  children: ReactNode;
}

export function DialogDescription({
  children,
}: DialogDescriptionProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box marginTop={1}>
      <Text color={colors.ui.textMuted}>{children}</Text>
    </Box>
  );
}

interface DialogBodyProps {
  children: ReactNode;
  maxHeight?: number;
}

export function DialogBody({
  children,
  maxHeight,
}: DialogBodyProps): ReactElement {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      overflowY={maxHeight ? "hidden" : undefined}
    >
      {children}
    </Box>
  );
}

interface DialogFooterProps {
  children: ReactNode;
}

export function DialogFooter({ children }: DialogFooterProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box marginTop={1} paddingTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor={colors.ui.border}>
      {children}
    </Box>
  );
}

interface DialogCloseProps {
  label?: string;
}

export function DialogClose({ label = "Close" }: DialogCloseProps): ReactElement {
  const { isOpen, onClose } = useDialogContext();
  const { colors } = useTheme();

  useInput(
    (input) => {
      if (input === "c" || input === "C") {
        onClose();
      }
    },
    { isActive: isOpen }
  );

  return (
    <Text color={colors.ui.textMuted}>
      [C] {label}
    </Text>
  );
}
