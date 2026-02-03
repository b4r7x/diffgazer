import { cn } from "@/lib/utils";
import { useFiglet } from "@stargazer/hooks";

interface AsciiLogoProps {
  text?: string;
  scale?: number;
  className?: string;
}

export function AsciiLogo({ text = "STARGAZER", scale = 1, className }: AsciiLogoProps): JSX.Element {
  const asciiText = useFiglet(text);
  const isReady = Boolean(asciiText);

  return (
    <pre
      className={cn(
        "font-mono whitespace-pre select-none",
        isReady ? "leading-none" : "opacity-50",
        className
      )}
      style={scale !== 1 ? { zoom: scale } : undefined}
      aria-label={text.toUpperCase()}
    >
      {isReady ? asciiText : text}
    </pre>
  );
}
