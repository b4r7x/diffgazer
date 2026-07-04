import { useCopyToClipboard } from "@diffgazer/ui/hooks/copy-to-clipboard";

interface CopyButtonProps {
  text: string;
  label: string;
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const { status, copy } = useCopyToClipboard({
    write: (value) => {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error("Clipboard API unavailable");
      }
      return navigator.clipboard.writeText(value);
    },
  });

  const handleCopy = () => {
    void copy(text);
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
