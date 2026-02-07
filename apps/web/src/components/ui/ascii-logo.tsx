import { cn } from "@/utils/cn";
import { getFigletText } from "@stargazer/hooks";

interface AsciiLogoProps {
  text?: string;
  className?: string;
}

export function AsciiLogo({ text = "STARGAZER", className }: AsciiLogoProps) {
  const asciiText = getFigletText(text);
  const isReady = Boolean(asciiText);

  return (
    <pre
      className={cn(
        "font-mono whitespace-pre select-none",
        isReady ? "leading-none" : "opacity-50",
        className
      )}
      aria-label={text.toUpperCase()}
    >
      {isReady ? asciiText : text}
    </pre>
  );
}
