import { cn } from "@/lib/utils";
import type { CodeLine } from "@stargazer/schemas/ui";

export type { CodeLine };

export interface CodeSnippetProps {
  lines: CodeLine[];
  className?: string;
}

export function CodeSnippet({ lines, className }: CodeSnippetProps) {
  return (
    <pre className={cn("bg-black border border-tui-border p-2 font-mono text-xs text-gray-400 overflow-x-auto", className)}>
      {lines.map((line) => (
        <div key={line.number} className="flex">
          <span className="w-6 text-gray-600 border-r border-gray-700 mr-2 text-right pr-1 select-none">
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
