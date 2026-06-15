import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for logo. */
export interface LogoProps extends ComponentProps<"pre"> {
  /** Display text, also used as the accessible name when asciiText is provided. */
  text: string;
  /** Precomputed ASCII art. When set, renders inside <pre role="img" aria-label={text}>. */
  asciiText?: string;
}

/**
 * Renders static text or caller-provided ASCII art without loading figlet from the default
 * component export.
 */
export function Logo({ ref, text, asciiText, className, ...props }: LogoProps) {
  return (
    <pre
      ref={ref}
      data-slot="logo"
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
  );
}
