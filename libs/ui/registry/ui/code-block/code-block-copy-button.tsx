"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { hasAccessibleTextContent } from "@/lib/accessible-text";

/** Props for code block copy button. */
export interface CodeBlockCopyButtonProps
  extends Omit<ComponentProps<"button">, "children" | "onCopy"> {
  /** Text copied to the clipboard on click. */
  source: string;
  /** Accessible label for the button (overrideable for localization). */
  copyLabel?: string;
  /** Status message announced via aria-live after a successful copy. */
  copiedMessage?: string;
  /** Status message announced via aria-live after a failed copy. */
  copyFailedMessage?: string;
  /** Optional button content or a render function that receives the copy state. */
  children?: ((state: "idle" | "copied" | "failed") => ReactNode) | ReactNode;
  /** Called after a successful clipboard write. */
  onCopy?: (source: string) => void;
  /** Called when the clipboard write fails or the API is unavailable. */
  onCopyError?: (error: unknown) => void;
}

function ClipboardIcon({ state }: { state: "idle" | "copied" | "failed" }) {
  if (state === "copied") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <path d="M3 8.5l3 3 7-7" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <rect x="5" y="2.5" width="6" height="2" />
      <rect x="3.5" y="4.5" width="9" height="9" />
    </svg>
  );
}

/** Optional copy-to-clipboard button. */
export function CodeBlockCopyButton({
  source,
  copyLabel = "Copy code to clipboard",
  copiedMessage = "Copied",
  copyFailedMessage = "Copy failed",
  className,
  children,
  onClick,
  onCopy,
  onCopyError,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ref,
  ...props
}: CodeBlockCopyButtonProps) {
  const { status, copy } = useCopyToClipboard({ onCopy, onError: onCopyError });
  const state = status;

  let liveMessage = "";
  if (state === "copied") liveMessage = copiedMessage;
  else if (state === "failed") liveMessage = copyFailedMessage;

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    await copy(source);
  };

  const renderedChildren =
    typeof children === "function"
      ? children(state)
      : (children ?? <ClipboardIcon state={state} />);
  const fallbackLabel =
    ariaLabel || ariaLabelledBy || hasAccessibleTextContent(renderedChildren)
      ? undefined
      : copyLabel;

  return (
    <>
      <button
        ref={ref}
        type="button"
        data-slot="code-block-copy-button"
        data-state={state}
        aria-label={ariaLabel || fallbackLabel}
        aria-labelledby={ariaLabelledBy}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {renderedChildren}
      </button>
      <span aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </>
  );
}
