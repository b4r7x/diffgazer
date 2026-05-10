"use client";

import type { AriaAttributes, ComponentPropsWithRef, KeyboardEvent, ReactNode } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useSelectContext } from "./select-context";
import { matchesSearch } from "@/lib/search";
import { isActiveOptionVisible, toOptionId } from "./select-utils";

export interface SelectTriggerProps extends Omit<ComponentPropsWithRef<"button">, "children" | "type" | "disabled"> {
  children: ReactNode;
  /** Custom handle element. Defaults to an animated Chevron. Pass `null` to hide. */
  handle?: ReactNode | null;
  invalid?: boolean;
}

function resolveAriaInvalid(
  invalid: boolean | undefined,
  ariaInvalid: AriaAttributes["aria-invalid"] | undefined,
) {
  if (invalid) return true;
  if (ariaInvalid === true || ariaInvalid === "true" || ariaInvalid === "grammar" || ariaInvalid === "spelling") {
    return ariaInvalid;
  }
  if (ariaInvalid === false || ariaInvalid === "false") return ariaInvalid;
  return undefined;
}

export function SelectTrigger({
  children,
  className,
  handle,
  invalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-errormessage": ariaErrorMessage,
  ref,
  onClick,
  onKeyDown,
  ...props
}: SelectTriggerProps) {
  const { open, disabled, searchable, onOpenChange, triggerRef, variant, triggerId, listboxId, ariaInvalid, required, options, highlighted, searchQuery } = useSelectContext("SelectTrigger");
  const resolvedAriaInvalid = resolveAriaInvalid(invalid, ariaInvalid);
  const activeDescendant = open && !searchable && isActiveOptionVisible(options, highlighted, searchQuery, matchesSearch)
    ? toOptionId(listboxId, highlighted)
    : undefined;

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
      role="combobox"
      disabled={disabled}
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : "Select")}
      aria-labelledby={ariaLabel || !ariaLabelledBy ? undefined : ariaLabelledBy}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={activeDescendant}
      aria-required={required}
      aria-invalid={resolvedAriaInvalid}
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
