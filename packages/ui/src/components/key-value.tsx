import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export type KeyValueVariant = "default" | "warning" | "info" | "success" | "error";
export type KeyValueLayout = "horizontal" | "vertical";

export interface KeyValueProps extends HTMLAttributes<HTMLDListElement> {
  children: ReactNode;
}

export interface KeyValueItemProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  variant?: KeyValueVariant;
  layout?: KeyValueLayout;
  bordered?: boolean;
}

const valueVariants: Record<KeyValueVariant, string> = {
  default: "font-bold text-tui-fg",
  warning: "font-bold text-tui-yellow",
  info: "font-mono text-tui-blue",
  success: "font-bold text-tui-green",
  error: "font-bold text-tui-red",
};

function KeyValueRoot({ children, className, ...props }: KeyValueProps) {
  return (
    <dl className={cn("", className)} {...props}>
      {children}
    </dl>
  );
}

function KeyValueItem({
  label,
  value,
  variant = "default",
  layout = "horizontal",
  bordered = false,
  className,
  ...props
}: KeyValueItemProps) {
  return (
    <div
      className={cn(
        layout === "horizontal" ? "flex justify-between items-center" : "flex flex-col gap-1",
        bordered && "py-4 border-b border-tui-border",
        className
      )}
      {...props}
    >
      <dt className={cn("text-tui-muted", bordered ? "text-xs" : "text-sm")}>{label}</dt>
      <dd className={cn(valueVariants[variant], bordered && "text-xs")}>{value}</dd>
    </div>
  );
}

export const KeyValue = Object.assign(KeyValueRoot, { Item: KeyValueItem });
