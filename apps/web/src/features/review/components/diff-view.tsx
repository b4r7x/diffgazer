import { cn } from "@/utils/cn";

export interface DiffViewProps {
  patch: string;
  className?: string;
}

export function DiffView({ patch, className }: DiffViewProps) {
  return (
    <pre className={cn("bg-black border border-tui-border p-2 font-mono text-xs overflow-x-auto", className)}>
      {patch.split("\n").map((line, i) => (
        <div
          key={`${line.startsWith("-") ? "del" : line.startsWith("+") ? "add" : "ctx"}-${i}`}
          className={cn(
            line.startsWith("-") && "text-tui-red",
            line.startsWith("+") && "text-tui-green"
          )}
        >
          {line}
        </div>
      ))}
    </pre>
  );
}
