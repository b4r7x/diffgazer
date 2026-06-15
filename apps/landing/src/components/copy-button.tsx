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
    if (!navigator.clipboard || !window.isSecureContext) {
      setStatus("failed");
      scheduleReset();
      return;
    }
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

  let buttonLabel = label;
  if (status === "copied") {
    buttonLabel = "Copied";
  } else if (status === "failed") {
    buttonLabel = "Copy failed";
  }

  const buttonText = status === "copied" ? "Copied" : "Copy";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={buttonLabel}
        className="rounded-sm border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {status === "failed" ? "Copy failed" : buttonText}
      </button>
      {status === "failed" ? (
        <span role="alert" className="text-xs text-error-text">
          Copy failed
        </span>
      ) : null}
    </div>
  );
}
