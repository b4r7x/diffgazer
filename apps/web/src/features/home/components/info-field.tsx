import type { ReactNode } from "react";
import { cn } from "@diffgazer/core/cn";

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
  muted: "text-tui-muted",
};

export function InfoField({
  label,
  color = "muted",
  children,
  className,
  onClick,
  ariaLabel,
}: InfoFieldProps) {
  const content = (
    <>
      <div className={cn("text-xs uppercase mb-1 font-bold", labelColors[color])}>{label}</div>
      <div className="text-tui-fg opacity-90">{children}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn("w-full text-left cursor-pointer hover:opacity-80 transition-opacity", className)}
        onClick={onClick}
        aria-label={ariaLabel ?? `${label} settings`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
