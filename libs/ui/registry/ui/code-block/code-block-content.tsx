"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../scroll-area/scroll-area";
import { CodeBlockLine } from "./code-block-line";

export interface CodeBlockContentProps extends ComponentProps<"div"> {
  showLineNumbers?: boolean;
}

export function CodeBlockContent({ showLineNumbers = true, className, children, ref, ...props }: CodeBlockContentProps) {
  return (
    <ScrollArea orientation="both" tabIndex={0} ref={ref} className={cn("focus-visible:outline focus-visible:outline-1 focus-visible:outline-border", className)} {...props}>
      <pre className="p-4 font-mono text-xs leading-relaxed">
        {typeof children === "string"
          ? children.split("\n").map((line, i) => (
              <CodeBlockLine key={i} number={showLineNumbers ? i + 1 : undefined} content={line} />
            ))
          : children}
      </pre>
    </ScrollArea>
  );
}
