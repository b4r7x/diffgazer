import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

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
        // <pre> does not wrap, so both branches need the same overflow guard: a long
        // wordmark or a wide ASCII block must clip inside the component instead of
        // widening its container and scrolling the page sideways.
        "max-w-full overflow-hidden",
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
