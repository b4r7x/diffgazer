import { useEffect, useRef, useState } from "react";

const RESET_DELAY_MS = 2000;

type CopyStatus = "idle" | "copied" | "failed";

interface CopyButtonProps {
  text: string;
  label: string;
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(resetTimer.current);
  }, []);

  const scheduleReset = () => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), RESET_DELAY_MS);
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(
      () => {
        setStatus("copied");
        scheduleReset();
      },
      () => {
        setStatus("failed");
        scheduleReset();
      },
    );
  };

  const buttonLabel = status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : label;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={buttonLabel}
        className="rounded-sm border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}
      </button>
      {status === "failed" ? (
        <span role="alert" className="text-xs text-destructive">
          Copy failed
        </span>
      ) : null}
    </div>
  );
}
