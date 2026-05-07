import type { HTMLAttributes, Ref } from "react"
import { cn } from "@/lib/utils"

export interface LogoProps extends HTMLAttributes<HTMLPreElement> {
  text: string
  asciiText?: string
  ref?: Ref<HTMLPreElement>
}

export function Logo({
  ref,
  text,
  asciiText,
  className,
  ...props
}: LogoProps) {
  return (
    <pre
      ref={ref}
      {...(asciiText ? { role: "img", "aria-label": text } : undefined)}
      className={cn(
        asciiText
          ? "font-mono whitespace-pre leading-none select-none"
          : "text-lg font-bold tracking-widest",
        className,
      )}
      {...props}
    >
      {asciiText ?? text}
    </pre>
  )
}
