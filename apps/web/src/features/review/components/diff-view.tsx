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
          key={i}
          className={cn(
            line.startsWith("--- ") || line.startsWith("+++ ")
              ? "text-tui-muted"
              : line.startsWith("@@")
                ? "text-tui-blue"
                : line.startsWith("-")
                  ? "text-tui-red"
                  : line.startsWith("+")
                    ? "text-tui-green"
                    : undefined
          )}
        >
          {line}
        </div>
      ))}
    </pre>
  );
}
