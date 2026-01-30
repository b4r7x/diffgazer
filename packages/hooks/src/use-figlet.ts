import { useState, useEffect } from "react";
import figlet from "figlet";

// @ts-expect-error - figlet fonts don't have type declarations
import bigFont from "figlet/importable-fonts/Big";
// @ts-expect-error - figlet fonts don't have type declarations
import smallFont from "figlet/importable-fonts/Small";

// Fonts loaded once at module level (synchronous, safe)
figlet.parseFont("Big", bigFont);
figlet.parseFont("Small", smallFont);

export type FigletFont = "Big" | "Small";

interface UseFigletResult {
  text: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useFiglet(inputText: string, font: FigletFont = "Big"): UseFigletResult {
  const [result, setResult] = useState<UseFigletResult>(() => ({
    text: null,
    isLoading: true,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;

    figlet.text(inputText.toUpperCase(), { font }, (err, data) => {
      if (cancelled) return;

      setResult({
        text: err ? null : (data ?? null),
        isLoading: false,
        error: err
          ? err instanceof Error
            ? err
            : new Error(String(err))
          : null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [inputText, font]);

  return result;
}
