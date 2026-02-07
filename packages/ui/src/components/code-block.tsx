import { cn } from "../lib/cn";

export interface CodeBlockLine {
  number: number;
  content: string;
  type?: "highlight" | "added" | "removed";
}

export interface CodeBlockProps {
  lines: CodeBlockLine[];
  className?: string;
}

export function CodeBlock({ lines, className }: CodeBlockProps) {
  return (
    <pre
      className={cn(
        "bg-tui-bg border border-tui-border p-2 font-mono text-xs text-tui-muted overflow-x-auto",
        className
      )}
    >
      {lines.map((line) => (
        <div key={line.number} className="flex">
          <span className="w-6 text-muted-foreground border-r border-tui-border mr-2 text-right pr-1 select-none">
            {line.number}
          </span>
          <code
            className={cn(
              line.type === "highlight" && "text-tui-red",
              line.type === "added" && "text-tui-green",
              line.type === "removed" && "text-tui-red"
            )}
          >
            {line.content}
          </code>
        </div>
      ))}
    </pre>
  );
}
