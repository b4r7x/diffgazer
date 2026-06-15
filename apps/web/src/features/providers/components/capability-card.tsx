import { cn } from "@diffgazer/ui/lib/utils";

export interface CapabilityCardProps {
  label: string;
  value: string;
  className?: string;
}

export function CapabilityCard({ label, value, className }: CapabilityCardProps) {
  return (
    <div className={cn("p-3 border border-border bg-secondary/20", className)}>
      <div className="text-2xs text-muted-foreground mb-1 italic">{label}</div>
      <div className="text-xs text-foreground">{value}</div>
    </div>
  );
}
