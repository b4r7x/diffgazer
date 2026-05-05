"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SelectContext } from "./select-context";
import { useSelectState } from "./use-select-state";

interface SelectBaseProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  highlighted?: string | null;
  onHighlight?: (value: string | null) => void;
  disabled?: boolean;
  variant?: "default" | "card";
  /** Sets the width of the Select container. "full" fills the parent. */
  width?: "sm" | "md" | "lg" | "full";
  /** Name attribute for the hidden form input */
  name?: string;
  "aria-invalid"?: boolean;
  children: ReactNode;
  className?: string;
}

interface SelectSingleProps extends SelectBaseProps {
  multiple?: false;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
}

interface SelectMultipleProps extends SelectBaseProps {
  multiple: true;
  value?: string[];
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
}

export type SelectProps = SelectSingleProps | SelectMultipleProps;

const widthClasses = {
  sm: "w-48",
  md: "w-64",
  lg: "w-80",
  full: "w-full",
} satisfies Record<NonNullable<SelectBaseProps["width"]>, string>;

export function Select(props: SelectProps) {
  const {
    open,
    onOpenChange,
    defaultOpen,
    value,
    onChange,
    defaultValue,
    highlighted,
    onHighlight,
    multiple,
    disabled = false,
    variant = "default",
    width,
    name,
    "aria-invalid": ariaInvalid,
    children,
    className,
  } = props;

  const { contextValue, wrapperRef } = useSelectState({
    open,
    onOpenChange,
    defaultOpen,
    value,
    onChange,
    defaultValue,
    highlighted,
    onHighlight,
    multiple,
    disabled,
    variant,
    ariaInvalid,
  });

  return (
    <SelectContext value={contextValue}>
      <div
        ref={wrapperRef}
        className={cn(
          "relative",
          width && widthClasses[width],
          variant === "card" && "border border-foreground bg-background shadow-[8px_8px_0px_0px_color-mix(in_srgb,var(--border)_50%,transparent)]",
          className
        )}
      >
        {children}
        {name && (
          Array.isArray(contextValue.value)
            ? contextValue.value.map((v) => (
                <input key={v} type="hidden" name={name} value={v} />
              ))
            : <input type="hidden" name={name} value={contextValue.value} />
        )}
      </div>
    </SelectContext>
  );
}
