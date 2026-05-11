"use client";

import { useState, useRef, useId, useCallback, useMemo, type AriaAttributes, type RefObject } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { useOutsideClick } from "@/hooks/use-outside-click";
import type { SelectContextValue, SelectOptionMetadata } from "./select-context";
import { matchesSearch } from "@/lib/search";

type SelectValue = string | null | string[];

interface UseSelectStateBaseOptions {
  open?: boolean;
  openControlled?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  highlighted?: string | null;
  highlightedControlled?: boolean;
  onHighlightChange?: (value: string | null) => void;
  disabled?: boolean;
  searchable?: boolean;
  variant?: "default" | "card";
  ariaInvalid?: AriaAttributes["aria-invalid"];
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
  triggerIdProp?: string;
  required?: boolean;
  options: ReadonlyMap<string, SelectOptionMetadata>;
}

interface UseSelectStateSingleOptions extends UseSelectStateBaseOptions {
  multiple?: false;
  value?: string;
  valueControlled?: boolean;
  onChange?: (value: string) => void;
  defaultValue?: string;
}

interface UseSelectStateMultipleOptions extends UseSelectStateBaseOptions {
  multiple: true;
  value?: string[];
  valueControlled?: boolean;
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
}

export type UseSelectStateOptions =
  | UseSelectStateSingleOptions
  | UseSelectStateMultipleOptions;

export interface UseSelectStateReturn {
  contextValue: SelectContextValue;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

function getDefaultSelectValue(multiple: boolean, defaultValue: SelectValue | undefined): SelectValue {
  return defaultValue ?? (multiple ? [] : null);
}

export function useSelectState(options: UseSelectStateOptions): UseSelectStateReturn {
  const {
    open: controlledOpen,
    openControlled,
    onOpenChange,
    defaultOpen = false,
    value: controlledValue,
    valueControlled,
    defaultValue,
    highlighted: controlledHighlighted,
    highlightedControlled,
    onHighlightChange,
    multiple = false,
    disabled = false,
    searchable = false,
    variant = "default",
    ariaInvalid,
    ariaDescribedBy,
    ariaLabelledBy,
    triggerIdProp,
    required,
    options: optionMetadata,
  } = options;
  const resetValue = useMemo(
    () => getDefaultSelectValue(multiple, defaultValue),
    [defaultValue, multiple],
  );
  const onSingleChange = options.multiple ? undefined : options.onChange;
  const onMultipleChange = options.multiple ? options.onChange : undefined;
  const valueChangeHandler = useCallback((nextValue: SelectValue) => {
    if (multiple) {
      if (Array.isArray(nextValue)) onMultipleChange?.(nextValue);
      return;
    }
    if (typeof nextValue === "string") onSingleChange?.(nextValue);
  }, [multiple, onMultipleChange, onSingleChange]);
  const isOpenControlled = openControlled ?? controlledOpen !== undefined;
  const isValueControlled = valueControlled ?? controlledValue !== undefined;
  const isHighlightedControlled = highlightedControlled ?? controlledHighlighted !== undefined;

  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: isOpenControlled ? controlledOpen ?? false : controlledOpen,
    controlled: isOpenControlled,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const [value, setValue] = useControllableState<SelectValue>({
    value: isValueControlled ? controlledValue ?? resetValue : controlledValue,
    controlled: isValueControlled,
    defaultValue: resetValue,
    onChange: valueChangeHandler,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const [highlighted, setHighlighted] = useControllableState<string | null>({
    value: isHighlightedControlled ? controlledHighlighted ?? null : controlledHighlighted,
    controlled: isHighlightedControlled,
    defaultValue: null,
    onChange: onHighlightChange,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const handleOpenChange = useCallback((open: boolean) => {
    if (disabled) return;
    setIsOpen(open);
    if (!open) {
      setSearchQuery("");
      setHighlighted(null);
    }
  }, [disabled, setIsOpen, setHighlighted]);

  const outsideClickExcludeRefs = useMemo(() => [contentRef], [contentRef]);
  useOutsideClick(wrapperRef, () => handleOpenChange(false), isOpen, outsideClickExcludeRefs);

  const onSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    const highlightedOption = highlighted === null ? undefined : optionMetadata.get(highlighted);
    if (highlightedOption && !highlightedOption.disabled && matchesSearch(highlightedOption.label, query)) {
      return;
    }

    for (const [itemValue, option] of optionMetadata) {
      if (!option.disabled && matchesSearch(option.label, query)) {
        setHighlighted(itemValue);
        return;
      }
    }

    setHighlighted(null);
  }, [highlighted, optionMetadata, setHighlighted]);

  const selectItem = useCallback((itemValue: string) => {
    const option = optionMetadata.get(itemValue);
    if (disabled || !option || option.disabled || !matchesSearch(option.label, searchQuery)) return;
    setNativeInvalid(false);
    if (multiple) {
      setValue((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        return current.includes(itemValue)
          ? current.filter((v) => v !== itemValue)
          : [...current, itemValue];
      });
    } else {
      setValue(itemValue);
      handleOpenChange(false);
      triggerRef.current?.focus();
    }
  }, [disabled, multiple, optionMetadata, searchQuery, setValue, handleOpenChange]);

  useFormReset(wrapperRef, resetValue, setValue, !isValueControlled);

  const hasRequiredValue = Array.isArray(value) ? value.length > 0 : value !== null && value !== "";
  const resolvedAriaInvalid = nativeInvalid && required && !hasRequiredValue ? true : ariaInvalid;

  const onNativeInvalid = useCallback(() => {
    setNativeInvalid(true);
    (searchInputRef.current ?? triggerRef.current)?.focus();
  }, []);

  const contextValue: SelectContextValue = useMemo(() => ({
    open: isOpen,
    disabled,
    searchable,
    onOpenChange: handleOpenChange,
    value,
    multiple,
    searchQuery,
    onSearchChange,
    highlighted,
    setHighlighted,
    selectItem,
    options: optionMetadata,
    triggerRef,
    contentRef,
    searchInputRef,
    variant,
    listboxId,
    triggerId: triggerIdProp ?? `${listboxId}-trigger`,
    ariaInvalid: resolvedAriaInvalid,
    ariaDescribedBy,
    ariaLabelledBy,
    required: required || undefined,
    onNativeInvalid,
  }), [isOpen, disabled, searchable, handleOpenChange, value, multiple, searchQuery, onSearchChange, highlighted, setHighlighted, selectItem, optionMetadata, variant, listboxId, triggerIdProp, resolvedAriaInvalid, ariaDescribedBy, ariaLabelledBy, required, onNativeInvalid]);

  return { contextValue, wrapperRef };
}
