"use client";

import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from "react";
import { resolveAriaInvalid } from "@/lib/aria-utils";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useSelectContext } from "./select-context";
import { matchesSearch } from "@/lib/search";
import { isActiveOptionVisible, toOptionId } from "./select-utils";

export interface SelectTriggerProps extends Omit<ComponentPropsWithRef<"button">, "children" | "type" | "disabled" | "id"> {
  children: ReactNode;
  handle?: ReactNode | null;
}

export function SelectTrigger({
  children,
  className,
  handle,
  "aria-label": ariaLabel,
  "aria-invalid": triggerAriaInvalid,
  "aria-labelledby": ariaLabelledByProp,
  "aria-describedby": ariaDescribedByProp,
  "aria-errormessage": ariaErrorMessage,
  ref,
  onClick,
  onKeyDown,
  ...props
}: SelectTriggerProps) {
  const { open, disabled, searchable, onOpenChange, triggerRef, variant, triggerId, listboxId, ariaInvalid, ariaDescribedBy, ariaLabelledBy, required, options, highlighted, searchQuery } = useSelectContext("SelectTrigger");
  const resolvedAriaInvalid = resolveAriaInvalid(ariaInvalid ?? triggerAriaInvalid);
  const activeDescendant = open && !searchable && isActiveOptionVisible(options, highlighted, searchQuery, matchesSearch)
    ? toOptionId(listboxId, highlighted)
    : undefined;
  const composedDescribedBy = [ariaDescribedByProp, ariaDescribedBy].filter(Boolean).join(" ") || undefined;
  const composedLabelledBy = ariaLabelledByProp ?? ariaLabelledBy;

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
      role={searchable ? undefined : "combobox"}
      disabled={disabled}
      aria-label={ariaLabel ?? (composedLabelledBy ? undefined : "Select")}
      aria-labelledby={ariaLabel || !composedLabelledBy ? undefined : composedLabelledBy}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open && !searchable ? listboxId : undefined}
      aria-activedescendant={searchable ? undefined : activeDescendant}
      aria-required={required}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={composedDescribedBy}
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
        handle ?? <Chevron direction="down" size="sm" className="text-muted-foreground shrink-0" />
      )}
    </button>
  );
}
