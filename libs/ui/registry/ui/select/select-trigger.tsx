"use client";

import { cva } from "class-variance-authority";
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { mergeIds, resolveAriaInvalid } from "@/lib/aria";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useSelectContext } from "./select-context";
import { isActiveOptionVisible, toOptionId } from "./selection";
import { useSelectTypeahead } from "./use-typeahead";
import { getVisibleEnabledOptions } from "./visible-options";

const selectTriggerVariants = cva(
  "flex items-center justify-between w-full px-3 py-2 text-sm font-mono cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default: "border border-border bg-background text-foreground hover:bg-secondary",
        card: "bg-foreground text-accent-foreground border-b border-foreground font-bold text-xs uppercase tracking-wider",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** Props for select trigger. */
export interface SelectTriggerProps
  extends Omit<ComponentPropsWithRef<"button">, "children" | "type" | "disabled" | "id"> {
  /** Trigger label. Use SelectValue or SelectTags for selection display. */
  children: ReactNode;
  /** Custom trigger handle. Pass null to hide the default chevron. */
  handle?: ReactNode | null;
}

/** Button that opens/closes the dropdown. */
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
  const {
    open,
    disabled,
    searchable,
    onOpenChange,
    triggerRef,
    variant,
    triggerId,
    listboxId,
    ariaInvalid,
    ariaDescribedBy,
    ariaLabelledBy,
    required,
    options,
    highlighted,
    searchQuery,
    setHighlighted,
  } = useSelectContext("SelectTrigger");
  const composedRef = useComposedRefs(triggerRef, ref);
  const handleTypeahead = useSelectTypeahead({ options, searchQuery, highlighted, setHighlighted });
  const resolvedAriaInvalid = resolveAriaInvalid(ariaInvalid ?? triggerAriaInvalid);
  const activeDescendant =
    open && !searchable && isActiveOptionVisible(options, highlighted, searchQuery, matchesSearch)
      ? toOptionId(listboxId, highlighted)
      : undefined;
  const composedDescribedBy = mergeIds(ariaDescribedByProp, ariaDescribedBy);
  const composedLabelledBy = mergeIds(ariaLabelledByProp, ariaLabelledBy);

  // APG closed-combobox keys: only while closed (the open listbox owns nav) and
  // not searchable (its search input is the combobox).
  const highlightFirstOrLast = (edge: "first" | "last") => {
    const visible = getVisibleEnabledOptions(options, searchQuery);
    const target = edge === "first" ? visible[0] : visible.at(-1);
    if (target !== undefined) setHighlighted(target);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onOpenChange(!open);
        return;
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!open) onOpenChange(true);
        return;
    }

    if (open || searchable) return;

    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      onOpenChange(true);
      highlightFirstOrLast(e.key === "Home" ? "first" : "last");
      return;
    }

    if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      onOpenChange(true);
      handleTypeahead(e.key);
    }
  };

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "combobox" (Biome cannot resolve the ternary); aria-activedescendant is applied in that same branch and is valid for the combobox role.
    <button
      {...props}
      ref={composedRef}
      id={triggerId}
      type="button"
      role={searchable ? undefined : "combobox"}
      data-slot="select-trigger"
      data-state={open ? "open" : "closed"}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : composedLabelledBy}
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
      className={cn(selectTriggerVariants({ variant }), className)}
    >
      {children}
      {handle !== null &&
        (handle ?? (
          <Chevron direction="down" size="sm" className="text-muted-foreground shrink-0" />
        ))}
    </button>
  );
}
