"use client";

import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useSelectContext } from "./select-context";

export interface SelectTriggerProps extends Omit<ComponentPropsWithRef<"button">, "children" | "type" | "disabled"> {
  children: ReactNode;
  /** Custom handle element. Defaults to an animated Chevron. Pass `null` to hide. */
  handle?: ReactNode | null;
  invalid?: boolean;
}

export function SelectTrigger({
  children,
  className,
  handle,
  invalid,
  "aria-errormessage": ariaErrorMessage,
  ref,
  onClick,
  onKeyDown,
  ...props
}: SelectTriggerProps) {
  const { open, disabled, onOpenChange, triggerRef, variant, triggerId, listboxId, ariaInvalid } = useSelectContext("SelectTrigger");

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onOpenChange(!open);
        break;
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!open) onOpenChange(true);
        break;
    }
  };

  return (
    <button
      {...props}
      ref={composeRefs(triggerRef, ref)}
      id={triggerId}
      type="button"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-invalid={invalid || ariaInvalid || undefined}
      aria-errormessage={ariaErrorMessage}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onOpenChange(!open);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center justify-between w-full px-3 py-2 text-sm font-mono cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        variant === "card"
          ? "bg-foreground text-accent-foreground border-b border-foreground font-bold text-xs uppercase tracking-wider"
          : "border border-border bg-background text-foreground hover:bg-secondary",
        className
      )}
    >
      {children}
      {handle !== null && (
        handle ?? <Chevron direction="down" open={open} size="sm" className="text-muted-foreground shrink-0" />
      )}
    </button>
  );
}
