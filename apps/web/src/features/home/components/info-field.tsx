import type { ReactNode } from "react";
import { cn } from "@diffgazer/ui/lib/utils";
import { Button } from "@diffgazer/ui/components/button";

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
      <Button
        variant="ghost"
        className={cn("w-full text-left h-auto whitespace-normal p-0 justify-start hover:bg-transparent hover:opacity-80 transition-opacity", className)}
        onClick={onClick}
        aria-label={ariaLabel ?? `${label} settings`}
      >
        {content}
      </Button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
