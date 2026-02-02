import React from "react";
import { useFiglet } from "@stargazer/hooks";

interface LogoProps {
  text?: string;
  className?: string;
}

export function Logo({ text = "Stargazer", className }: LogoProps): React.ReactElement {
  const { text: asciiText, isLoading } = useFiglet(text);

  return (
    <pre
      className={className}
      style={{
        fontFamily: "monospace",
        whiteSpace: "pre",
        lineHeight: 1,
        margin: 0,
      }}
      aria-label={text.toUpperCase()}
    >
      {isLoading ? text : asciiText}
    </pre>
  );
}
