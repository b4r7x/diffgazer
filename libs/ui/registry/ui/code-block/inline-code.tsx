import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function InlineCode({ className, ...props }: ComponentProps<"code">) {
  return (
    <code
      className={cn("bg-secondary text-foreground px-1.5 py-0.5 text-xs font-mono rounded-sm", className)}
      {...props}
    />
  )
}
