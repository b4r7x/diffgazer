import { useState, useEffect } from "react";
import figlet from "figlet";

// @ts-expect-error - figlet fonts don't have type declarations
import bigFont from "figlet/importable-fonts/Big";
// @ts-expect-error - figlet fonts don't have type declarations
import smallFont from "figlet/importable-fonts/Small";

figlet.parseFont("Big", bigFont);
figlet.parseFont("Small", smallFont);

export type FigletFont = "Big" | "Small";

export interface FigletResult {
  text: string | null;
  isLoading: boolean;
}

export function useFiglet(inputText: string, font: FigletFont = "Big"): FigletResult {
  const [result, setResult] = useState<FigletResult>({ text: null, isLoading: true });

  useEffect(() => {
    let cancelled = false;

    figlet.text(inputText.toUpperCase(), { font }, (err, data) => {
      if (cancelled) return;
      setResult({ text: err ? null : (data ?? null), isLoading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [inputText, font]);

  return result;
}
