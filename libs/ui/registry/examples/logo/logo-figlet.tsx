"use client";
// @hidden-imports-ok — demo imports optional figlet helper from logo-figlet registry item

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { type FigletFont, getFigletText } from "@/components/ui/logo/figlet";

type FigletSlotState =
  | { status: "pending" }
  | { status: "ready"; text: string }
  | { status: "error" };

function useFigletAscii(text: string, font: FigletFont) {
  const [state, setState] = useState<FigletSlotState>({ status: "pending" });
  const [attempt, setAttempt] = useState(0);

  // attempt is the intentional retry trigger; omitting it would freeze retries.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry counter must re-run the effect
  useEffect(() => {
    let active = true;
    setState({ status: "pending" });

    getFigletText(text, font)
      .then((ascii) => {
        if (active) setState({ status: "ready", text: ascii });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });

    return () => {
      active = false;
    };
  }, [text, font, attempt]);

  return { state, retry: () => setAttempt((value) => value + 1) };
}

function FigletLogo({
  text,
  font,
  className,
}: {
  text: string;
  font: FigletFont;
  className?: string;
}) {
  const { state, retry } = useFigletAscii(text, font);

  return (
    <div className="space-y-1">
      <Logo
        text={text}
        asciiText={state.status === "ready" ? state.text : undefined}
        className={className}
      />
      {state.status === "error" ? (
        <button type="button" className="text-2xs text-muted-foreground underline" onClick={retry}>
          Retry ASCII render
        </button>
      ) : null}
    </div>
  );
}

export default function LogoFiglet() {
  return (
    <div className="space-y-4">
      <FigletLogo text="DG" font="Big" className="text-foreground text-2xs" />
      <FigletLogo text="diffgazer" font="Small" className="text-muted-foreground text-2xs" />
    </div>
  );
}
