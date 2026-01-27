import { useState, useEffect } from "react";
import figlet from "figlet";

// @ts-expect-error - figlet fonts don't have type declarations
import bigFont from "figlet/importable-fonts/Big";

// Font loaded once at module level (synchronous, safe)
figlet.parseFont("Big", bigFont);

interface UseFigletResult {
  text: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useFiglet(inputText: string): UseFigletResult {
  const [result, setResult] = useState<UseFigletResult>(() => ({
    text: null,
    isLoading: true,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;

    figlet.text(inputText.toUpperCase(), { font: "Big" }, (err, data) => {
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
  }, [inputText]);

  return result;
}
