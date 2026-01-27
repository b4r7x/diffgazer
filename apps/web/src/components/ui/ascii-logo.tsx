import { cn } from "@/lib/utils";
import { useFiglet } from "@/hooks/use-figlet";

interface AsciiLogoProps {
  text?: string;
  scale?: number;
  className?: string;
}

export function AsciiLogo({ text = "STARGAZER", scale = 1, className }: AsciiLogoProps): React.ReactElement {
  const { text: asciiText, isLoading } = useFiglet(text);
  const isReady = !isLoading && asciiText;

  return (
    <pre
      className={cn(
        "font-mono whitespace-pre select-none",
        isReady ? "leading-none" : "opacity-50",
        className,
      )}
      style={scale !== 1 ? { zoom: scale } : undefined}
      aria-label={text.toUpperCase()}
    >
      {isReady ? asciiText : text}
    </pre>
  );
}
