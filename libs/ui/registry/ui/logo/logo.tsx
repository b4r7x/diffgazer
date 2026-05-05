"use client";

import type { HTMLAttributes, Ref } from "react"
import { cn } from "@/lib/utils"
import { getFigletText, type FigletFont } from "./get-figlet-text"

export interface LogoProps extends HTMLAttributes<HTMLPreElement> {
  text: string
  font?: FigletFont
  ref?: Ref<HTMLPreElement>
}

export function Logo({
  ref,
  text,
  font = "Big",
  className,
  ...props
}: LogoProps) {
  const asciiText = getFigletText(text, font)

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
