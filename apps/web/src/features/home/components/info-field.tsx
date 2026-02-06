import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/utils/cn";

export type InfoFieldColor = "blue" | "violet" | "green" | "yellow" | "red" | "muted";

export interface InfoFieldProps {
  label: string;
  color?: InfoFieldColor;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

const labelColors: Record<InfoFieldColor, string> = {
  blue: "text-tui-blue",
  violet: "text-tui-violet",
  green: "text-tui-green",
  yellow: "text-tui-yellow",
  red: "text-tui-red",
  muted: "text-gray-400",
};

export function InfoField({
  label,
  color = "muted",
  children,
  className,
  onClick,
  ariaLabel,
}: InfoFieldProps) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (onClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cn(className, onClick && "cursor-pointer hover:opacity-80 transition-opacity")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? (ariaLabel ?? `${label} settings`) : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
    >
      <div className={cn("text-xs uppercase mb-1 font-bold", labelColors[color])}>{label}</div>
      <div className="text-tui-fg opacity-90">{children}</div>
    </div>
  );
}
