export type Variant = "success" | "warning" | "error" | "info" | "neutral";
export type Size = "sm" | "md" | "lg";

export interface Shortcut {
  key: string;
  label: string;
  disabled?: boolean;
}
