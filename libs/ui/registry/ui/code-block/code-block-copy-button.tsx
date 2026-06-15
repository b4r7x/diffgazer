"use client";

import type { ComponentProps, ReactNode } from "react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

/** Props for code block copy button. */
export interface CodeBlockCopyButtonProps
  extends Omit<ComponentProps<"button">, "children" | "onCopy"> {
  /** Text copied to the clipboard on click. */
  source: string;
  /** Accessible label for the button (overrideable for localization). */
  copyLabel?: string;
  /** Status message announced via aria-live after a successful copy. */
  copiedMessage?: string;
  /** Header and Content subparts. */
  children?: ((state: "idle" | "copied") => ReactNode) | ReactNode;
  /** Called after a successful clipboard write. */
  onCopy?: (source: string) => void;
  /** Called when the clipboard write fails or the API is unavailable. */
  onCopyError?: (error: unknown) => void;
}

function ClipboardIcon({ state }: { state: "idle" | "copied" }) {
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
  className,
  children,
  onClick,
  onCopy,
  onCopyError,
  ref,
  ...props
}: CodeBlockCopyButtonProps) {
  const { copied, copy } = useCopyToClipboard({ onCopy, onError: onCopyError });
  const state = copied ? "copied" : "idle";

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!navigator.clipboard) {
      onCopyError?.(new Error("Clipboard API unavailable"));
      return;
    }
    await copy(source);
  };

  const renderedChildren =
    typeof children === "function"
      ? children(state)
      : (children ?? <ClipboardIcon state={state} />);

  return (
    <>
      <button
        ref={ref}
        type="button"
        data-slot="code-block-copy-button"
        data-state={state}
        aria-label={copyLabel}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {renderedChildren}
      </button>
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? copiedMessage : ""}
      </span>
    </>
  );
}
