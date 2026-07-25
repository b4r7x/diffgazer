import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { selectionFill } from "../../theme/chrome";
import { useTheme } from "../../theme/provider";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "destructive" | "success" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  isActive?: boolean;
  onPress?: () => void;
  children: string;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  isActive = false,
  onPress,
  children,
}: ButtonProps) {
  const { tokens } = useTheme();

  const variantColor: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: tokens.accent,
    secondary: tokens.muted,
    destructive: tokens.error,
    success: tokens.success,
    ghost: tokens.fg,
  };

  // The variant colours the resting label only. Focus always fills with the
  // selection hue, otherwise a focused secondary button fills muted and reads
  // as the disabled one in the row.
  const color = disabled ? tokens.muted : variantColor[variant];
  const interactive = isActive && !disabled && !loading;

  useInput(
    (_input, key) => {
      if (key.return && onPress) {
        onPress();
      }
    },
    { isActive: interactive },
  );

  return (
    <Box paddingX={1}>
      <Text
        color={interactive ? tokens.bg : color}
        backgroundColor={interactive ? selectionFill(tokens) : undefined}
        bold={interactive}
      >
        {loading ? (
          <>
            <Spinner type="dots" />
            <Text> </Text>
          </>
        ) : null}
        {"[ "}
        {children}
        {" ]"}
      </Text>
    </Box>
  );
}
