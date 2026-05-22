"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

export interface CodeBlockCopyButtonProps
  extends Omit<ComponentProps<"button">, "children" | "onCopy"> {
  /** Source text to copy to the clipboard. */
  source: string;
  /** Accessible label for the button. Defaults to "Copy code to clipboard". */
  copyLabel?: string;
  /** Status message announced via aria-live when the copy succeeds. */
  copiedMessage?: string;
  /** Optional copy renderer override. Defaults to a clipboard icon. */
  children?: ((state: "idle" | "copied") => ReactNode) | ReactNode;
  /** Called after a successful clipboard write. */
  onCopy?: (source: string) => void;
  /** Called when clipboard write fails. */
  onCopyError?: (error: unknown) => void;
}

const COPIED_TIMEOUT_MS = 2000;

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
  const [state, setState] = useState<"idle" | "copied">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending reset timer if the button unmounts before the 2s elapses.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!navigator.clipboard) {
      onCopyError?.(new Error("Clipboard API unavailable"));
      return;
    }
    try {
      await navigator.clipboard.writeText(source);
      setState("copied");
      onCopy?.(source);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setState("idle"), COPIED_TIMEOUT_MS);
    } catch (error) {
      onCopyError?.(error);
    }
  };

  const renderedChildren =
    typeof children === "function" ? children(state) : children ?? <ClipboardIcon state={state} />;

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
