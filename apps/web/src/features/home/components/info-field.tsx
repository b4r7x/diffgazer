import { Button } from "@diffgazer/ui/components/button";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode } from "react";

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
  blue: "text-info-text",
  violet: "text-accent",
  green: "text-success-text",
  yellow: "text-warning-text",
  red: "text-error-text",
  muted: "text-muted-foreground",
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
      <div className="text-foreground opacity-90">{children}</div>
    </>
  );

  if (onClick) {
    return (
      <Button
        variant="ghost"
        className={cn(
          "w-full text-left h-auto whitespace-normal p-0 justify-start hover:bg-transparent hover:opacity-80 transition-opacity",
          className,
        )}
        onClick={onClick}
        aria-label={ariaLabel ?? `${label} settings`}
      >
        {content}
      </Button>
    );
  }

  return <div className={className}>{content}</div>;
}
