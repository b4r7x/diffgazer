"use client";

import { useState, useRef, useId, useCallback, useMemo, type RefObject } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useOutsideClick } from "@/hooks/use-outside-click";
import type { SelectContextValue, SelectOptionMetadata } from "./select-context";
import { matchesSearch } from "@/lib/search";

export interface UseSelectStateOptions {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  value?: string | string[];
  onChange?: ((value: string) => void) | ((value: string[]) => void);
  defaultValue?: string | string[];
  highlighted?: string | null;
  onHighlight?: (value: string | null) => void;
  multiple?: boolean;
  disabled?: boolean;
  variant?: "default" | "card";
  ariaInvalid?: boolean;
  required?: boolean;
}

export interface UseSelectStateReturn {
  contextValue: SelectContextValue;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

export function useSelectState({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  value: controlledValue,
  onChange,
  defaultValue,
  highlighted: controlledHighlighted,
  onHighlight,
  multiple = false,
  disabled = false,
  variant = "default",
  ariaInvalid,
}: UseSelectStateOptions): UseSelectStateReturn {
  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const [value, setValue] = useControllableState<string | string[]>({
    value: controlledValue,
    defaultValue: defaultValue ?? (multiple ? [] : ""),
    onChange: onChange as ((value: string | string[]) => void) | undefined,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearch, setHasSearch] = useState(false);
  const [highlighted, setHighlighted] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlight,
  });

  const labelsRef = useRef<Map<string, SelectOptionMetadata>>(new Map());
  const triggerRef = useRef<HTMLButtonElement>(null);
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

  useOutsideClick(wrapperRef, () => handleOpenChange(false), isOpen);

  const onSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (highlighted) {
      const option = labelsRef.current.get(highlighted);
      if (option && (!matchesSearch(option.label, query) || option.disabled)) {
        setHighlighted(null);
      }
    }
  }, [highlighted, setHighlighted]);

  const registerOption = useCallback((itemValue: string, metadata: SelectOptionMetadata) => {
    labelsRef.current.set(itemValue, metadata);
    return () => { labelsRef.current.delete(itemValue); };
  }, []);

  const isOptionDisabled = useCallback((itemValue: string) => {
    return labelsRef.current.get(itemValue)?.disabled ?? false;
  }, []);

  const selectItem = useCallback((itemValue: string) => {
    if (disabled || isOptionDisabled(itemValue)) return;
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
  }, [disabled, isOptionDisabled, multiple, setValue, handleOpenChange]);

  const contextValue: SelectContextValue = useMemo(() => ({
    open: isOpen,
    disabled,
    onOpenChange: handleOpenChange,
    value,
    multiple,
    searchQuery,
    onSearchChange,
    highlighted,
    onHighlight: setHighlighted,
    selectItem,
    labelsRef,
    registerOption,
    isOptionDisabled,
    triggerRef,
    searchInputRef,
    hasSearch,
    setHasSearch,
    variant,
    listboxId,
    triggerId: `${listboxId}-trigger`,
    ariaInvalid: ariaInvalid || undefined,
  }), [isOpen, disabled, handleOpenChange, value, multiple, searchQuery, onSearchChange, highlighted, setHighlighted, selectItem, registerOption, isOptionDisabled, hasSearch, variant, listboxId, ariaInvalid]);

  return { contextValue, wrapperRef };
}
