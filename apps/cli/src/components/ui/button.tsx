import type { ReactElement, ReactNode } from "react";
import { Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "success"
  | "ghost"
  | "outline"
  | "link";

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  bracket?: boolean;
  disabled?: boolean;
  focused?: boolean;
}

export function Button({
  children,
  variant = "primary",
  bracket = true,
  disabled = false,
  focused = false,
}: ButtonProps): ReactElement {
  const { colors } = useTheme();

  const getVariantStyles = (): { color: string; bold: boolean; dimColor?: boolean } => {
    if (disabled) {
      return { color: colors.ui.textMuted, bold: false, dimColor: true };
    }

    switch (variant) {
      case "primary":
        return { color: colors.ui.accent, bold: true };
      case "secondary":
        return { color: colors.ui.text, bold: false };
      case "destructive":
        return { color: colors.ui.error, bold: true };
      case "success":
        return { color: colors.ui.success, bold: true };
      case "ghost":
        return { color: colors.ui.text, bold: false };
      case "outline":
        return { color: colors.ui.border, bold: false };
      case "link":
        return { color: colors.ui.info, bold: false };
      default:
        return { color: colors.ui.text, bold: false };
    }
  };

  const styles = getVariantStyles();
  const content = bracket ? `[ ${children} ]` : children;

  return (
    <Text
      color={styles.color}
      bold={styles.bold}
      dimColor={styles.dimColor}
      inverse={focused && !disabled}
    >
      {content}
    </Text>
  );
}
