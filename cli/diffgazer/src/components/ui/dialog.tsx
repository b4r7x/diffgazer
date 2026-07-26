import { Box, Text, useInput } from "ink";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";
import { KeyboardContext } from "../../hooks/keyboard-context";
import { SURFACE_BORDER, selectionHue } from "../../theme/chrome";
import { useTheme } from "../../theme/provider";
import { useContentZone } from "../layout/global";

/**
 * A dialog is a card lifted over the screen, not a screen replacement: it keeps
 * gutters at every width so the terminal background reads as the matte around
 * it, and it never grows past a comfortable reading measure.
 */
export function getDialogWidth(columns: number): number {
  const preferred = Math.min(Math.max(columns - 16, 52), 72);
  return Math.max(Math.min(preferred, columns - 4), 1);
}

const DialogWidthContext = createContext<number | null>(null);

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onEscapeKeyDown?: () => boolean;
  children: ReactNode;
}

export interface DialogContentProps {
  children: ReactNode;
}

export interface DialogHeaderProps {
  children: ReactNode;
}

export interface DialogTitleProps {
  children: string;
}

export interface DialogSubtitleProps {
  children: string;
}

export interface DialogBodyProps {
  children: ReactNode;
}

export interface DialogFooterProps {
  children: ReactNode;
}

function DialogContent({ children }: DialogContentProps) {
  const { tokens } = useTheme();
  const width = useContext(DialogWidthContext);

  // An open modal owns focus by definition, so the card carries the focus hue —
  // one blue rectangle on screen, the same rule the panes follow.
  return (
    <Box
      flexDirection="column"
      width={width ?? undefined}
      borderStyle={SURFACE_BORDER}
      borderColor={selectionHue(tokens)}
      paddingX={2}
      paddingY={1}
    >
      {children}
    </Box>
  );
}

function DialogHeader({ children }: DialogHeaderProps) {
  const { tokens } = useTheme();

  return (
    <Box
      flexDirection="column"
      borderStyle={SURFACE_BORDER}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      borderColor={tokens.border}
    >
      {children}
    </Box>
  );
}

function DialogTitle({ children }: DialogTitleProps) {
  const { tokens } = useTheme();

  return (
    <Text bold color={tokens.fg}>
      {children}
    </Text>
  );
}

function DialogSubtitle({ children }: DialogSubtitleProps) {
  const { tokens } = useTheme();

  return <Text color={tokens.muted}>{children}</Text>;
}

function DialogBody({ children }: DialogBodyProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {children}
    </Box>
  );
}

function DialogFooter({ children }: DialogFooterProps) {
  const { tokens } = useTheme();

  return (
    <Box
      marginTop={1}
      borderStyle={SURFACE_BORDER}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={tokens.border}
    >
      {children}
    </Box>
  );
}

function DialogRoot({ open = false, onOpenChange, onEscapeKeyDown, children }: DialogProps) {
  const { columns, contentRows } = useContentZone();
  const keyboard = useContext(KeyboardContext);

  useEffect(() => {
    if (!open) return;
    keyboard?.setModalActive(true);
    return () => keyboard?.setModalActive(false);
  }, [keyboard, open]);

  useInput(
    (_input, key) => {
      if (key.escape && !onEscapeKeyDown?.()) {
        onOpenChange?.(false);
      }
    },
    { isActive: open },
  );

  if (!open) return null;

  return (
    <DialogWidthContext value={getDialogWidth(columns)}>
      <Box
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        width={columns}
        height={contentRows}
        overflow="hidden"
      >
        {children}
      </Box>
    </DialogWidthContext>
  );
}

export const Dialog = Object.assign(DialogRoot, {
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Subtitle: DialogSubtitle,
  Body: DialogBody,
  Footer: DialogFooter,
});
