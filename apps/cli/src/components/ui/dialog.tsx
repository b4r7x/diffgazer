import type { ReactNode } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useTheme } from "../../theme/theme-context.js";

// --- Types ---

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export interface DialogBodyProps {
  children: ReactNode;
}

export interface DialogFooterProps {
  children: ReactNode;
}

// --- Components ---

function DialogContent({ children }: DialogContentProps) {
  const { tokens } = useTheme();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={tokens.border}
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
      marginBottom={1}
      borderStyle="single"
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
      borderStyle="single"
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={tokens.border}
    >
      {children}
    </Box>
  );
}

function DialogRoot({
  open = false,
  onOpenChange,
  children,
}: DialogProps) {
  const { stdout } = useStdout();

  useInput(
    (_input, key) => {
      if (key.escape) {
        onOpenChange?.(false);
      }
    },
    { isActive: open },
  );

  if (!open) return null;

  const width = stdout.columns ?? 80;
  const height = stdout.rows ?? 24;

  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      width={width}
      height={height}
    >
      {children}
    </Box>
  );
}

// --- Compound export ---

export const Dialog = Object.assign(DialogRoot, {
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Body: DialogBody,
  Footer: DialogFooter,
});
