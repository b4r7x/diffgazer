import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";

interface DialogContextValue {
  isOpen: boolean;
  onClose: () => void;
  fullscreen: boolean;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog compound components must be used within Dialog");
  }
  return context;
}

export { useDialogContext };

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
  /** Render as fullscreen overlay */
  fullscreen?: boolean;
  /** Max width when fullscreen (default: 80) */
  maxWidth?: number;
  /** Max height when fullscreen (default: 24) */
  maxHeight?: number;
}

export function Dialog({
  isOpen,
  onClose,
  children,
  width = "100%",
  fullscreen = false,
  maxWidth = 80,
  maxHeight = 24,
}: DialogProps): ReactElement | null {
  const { colors } = useTheme();
  const { columns, rows } = useTerminalDimensions();

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

  const dialogContent = (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.ui.borderFocused}
      width={fullscreen ? Math.min(maxWidth, columns - 4) : width}
      height={fullscreen ? Math.min(maxHeight, rows - 4) : undefined}
      paddingX={1}
      paddingY={1}
    >
      {children}
    </Box>
  );

  // Fullscreen mode: overlay that fills terminal
  if (fullscreen) {
    return (
      <DialogContext.Provider value={{ isOpen, onClose, fullscreen }}>
        <Box
          position="absolute"
          width={columns}
          height={rows}
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
        >
          {dialogContent}
        </Box>
      </DialogContext.Provider>
    );
  }

  // Inline mode (original behavior)
  return (
    <DialogContext.Provider value={{ isOpen, onClose, fullscreen }}>
      {dialogContent}
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

interface DialogActionsProps {
  children: ReactNode;
  /** Gap between actions */
  gap?: number;
}

export function DialogActions({ children, gap = 2 }: DialogActionsProps): ReactElement {
  return (
    <Box gap={gap} justifyContent="flex-end">
      {children}
    </Box>
  );
}

type DialogActionVariant = "primary" | "secondary" | "destructive";

interface DialogActionProps {
  /** Keyboard shortcut key (single character) */
  hotkey: string;
  label: string;
  onAction: () => void;
  variant?: DialogActionVariant;
  disabled?: boolean;
}

export function DialogAction({
  hotkey,
  label,
  onAction,
  variant = "secondary",
  disabled = false,
}: DialogActionProps): ReactElement {
  const { isOpen } = useDialogContext();
  const { colors } = useTheme();

  useInput(
    (input) => {
      if (disabled) return;
      if (input.toLowerCase() === hotkey.toLowerCase()) {
        onAction();
      }
    },
    { isActive: isOpen }
  );

  function getVariantColor(): string {
    if (disabled) return colors.ui.textMuted;
    switch (variant) {
      case "primary":
        return colors.ui.accent;
      case "destructive":
        return colors.ui.error;
      default:
        return colors.ui.text;
    }
  }
  const color = getVariantColor();

  return (
    <Text color={color} dimColor={disabled}>
      [{hotkey.toUpperCase()}] {label}
    </Text>
  );
}
