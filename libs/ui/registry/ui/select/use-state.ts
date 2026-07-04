"use client";

import {
  type AriaAttributes,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { matchesSearch } from "@/lib/search";
import type { SelectContextValue, SelectOptionMetadata } from "./select-context";

type SelectValue = string | null | string[];

interface UseSelectStateBaseOptions {
  /** Controlled open state. Pair with onOpenChange. */
  open?: boolean;
  openControlled?: boolean;
  /** Called when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Initial open state for uncontrolled usage. Useful with variant="card" for a settings-panel
   * layout that renders its list immediately.
   */
  defaultOpen?: boolean;
  /** Controlled highlighted item id. Pair with onHighlightChange. */
  highlighted?: string | null;
  highlightedControlled?: boolean;
  /** Called when the highlighted item changes via keyboard or search. */
  onHighlightChange?: (value: string | null) => void;
  /** Disable the trigger and prevent open. */
  disabled?: boolean;
  searchable?: boolean;
  /**
   * Visual treatment. "card" renders the inline settings-panel layout (combine with
   * defaultOpen).
   */
  variant?: "default" | "card";
  ariaInvalid?: AriaAttributes["aria-invalid"];
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
  triggerIdProp?: string;
  /** Mark the select as required for native form validation. */
  required?: boolean;
  seedOptions: ReadonlyMap<string, SelectOptionMetadata>;
}

/** Options for use select state single. */
interface UseSelectStateSingleOptions extends UseSelectStateBaseOptions {
  /** Enable multi-select. value/onChange become string[]. */
  multiple?: false;
  /** Controlled selected value. string[] when multiple, string in single mode. */
  value?: string;
  valueControlled?: boolean;
  /** Called when the selection changes. */
  onChange?: (value: string) => void;
  /** Initial selected value for uncontrolled usage. */
  defaultValue?: string;
}

/** Options for use select state multiple. */
interface UseSelectStateMultipleOptions extends UseSelectStateBaseOptions {
  /** Enable multi-select. value/onChange become string[]. */
  multiple: true;
  /** Controlled selected value. string[] when multiple, string in single mode. */
  value?: string[];
  valueControlled?: boolean;
  /** Called when the selection changes. */
  onChange?: (value: string[]) => void;
  /** Initial selected value for uncontrolled usage. */
  defaultValue?: string[];
}

/** Options for use select state. */
export type UseSelectStateOptions = UseSelectStateSingleOptions | UseSelectStateMultipleOptions;

export interface UseSelectStateReturn {
  contextValue: SelectContextValue;
  /** Ref for the wrapper element. */
  wrapperRef: RefObject<HTMLDivElement | null>;
}

function getDefaultSelectValue(
  multiple: boolean,
  defaultValue: SelectValue | undefined,
): SelectValue {
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
    seedOptions,
  } = options;
  const [registeredOptions, setRegisteredOptions] = useState<
    ReadonlyMap<string, SelectOptionMetadata>
  >(() => new Map());
  const registerOption = useCallback((itemValue: string, metadata: SelectOptionMetadata) => {
    setRegisteredOptions((current) => {
      const existing = current.get(itemValue);
      if (
        existing &&
        existing.label === metadata.label &&
        existing.disabled === metadata.disabled
      ) {
        return current;
      }
      const next = new Map(current);
      next.set(itemValue, metadata);
      return next;
    });
  }, []);
  const unregisterOption = useCallback((itemValue: string) => {
    setRegisteredOptions((current) => {
      if (!current.has(itemValue)) return current;
      const next = new Map(current);
      next.delete(itemValue);
      return next;
    });
  }, []);
  // Mounted items (registration) are authoritative; the static seed only fills
  // labels for direct-child items while the dropdown is closed and unmounted.
  const optionMetadata = useMemo<ReadonlyMap<string, SelectOptionMetadata>>(() => {
    if (registeredOptions.size === 0) return seedOptions;
    const merged = new Map(seedOptions);
    for (const [value, metadata] of registeredOptions) merged.set(value, metadata);
    return merged;
  }, [registeredOptions, seedOptions]);
  const resetValue = getDefaultSelectValue(multiple, defaultValue);
  const onSingleChange = options.multiple ? undefined : options.onChange;
  const onMultipleChange = options.multiple ? options.onChange : undefined;
  const valueChangeHandler = (nextValue: SelectValue) => {
    if (multiple) {
      if (Array.isArray(nextValue)) onMultipleChange?.(nextValue);
      return;
    }
    if (typeof nextValue === "string") onSingleChange?.(nextValue);
  };
  const isOpenControlled = openControlled ?? controlledOpen !== undefined;
  const isValueControlled = valueControlled ?? controlledValue !== undefined;
  const isHighlightedControlled = highlightedControlled ?? controlledHighlighted !== undefined;

  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: isOpenControlled ? (controlledOpen ?? false) : controlledOpen,
    controlled: isOpenControlled,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const [value, setValue] = useControllableState<SelectValue>({
    value: isValueControlled ? (controlledValue ?? resetValue) : controlledValue,
    controlled: isValueControlled,
    defaultValue: resetValue,
    onChange: valueChangeHandler,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const [highlighted, setHighlighted] = useControllableState<string | null>({
    value: isHighlightedControlled ? (controlledHighlighted ?? null) : controlledHighlighted,
    controlled: isHighlightedControlled,
    defaultValue: null,
    onChange: onHighlightChange,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Stable ref required: dep of the contextValue memo and of selectItem below.
  const closeSelect = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setHighlighted(null);
  }, [setIsOpen, setHighlighted]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (disabled && open) return;
      if (open) {
        setIsOpen(true);
        return;
      }
      closeSelect();
    },
    [closeSelect, disabled, setIsOpen],
  );

  useEffect(() => {
    if (disabled && isOpen) closeSelect();
  }, [closeSelect, disabled, isOpen]);

  useOutsideClick(wrapperRef, () => handleOpenChange(false), isOpen, [contentRef]);

  // Stable ref required: dep of the contextValue memo below.
  const onSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      const highlightedOption = highlighted === null ? undefined : optionMetadata.get(highlighted);
      if (
        highlightedOption &&
        !highlightedOption.disabled &&
        matchesSearch(highlightedOption.label, query)
      ) {
        return;
      }

      for (const [itemValue, option] of optionMetadata) {
        if (!option.disabled && matchesSearch(option.label, query)) {
          setHighlighted(itemValue);
          return;
        }
      }

      setHighlighted(null);
    },
    [highlighted, optionMetadata, setHighlighted],
  );

  // Stable ref required: dep of the contextValue memo below.
  const selectItem = useCallback(
    (itemValue: string) => {
      const option = optionMetadata.get(itemValue);
      if (!option && process.env.NODE_ENV !== "production") {
        console.warn(
          `Select: ignoring activation of value "${itemValue}" — no SelectItem with this value is registered.`,
        );
      }
      if (disabled || !option || option.disabled || !matchesSearch(option.label, searchQuery))
        return;
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
    },
    [disabled, multiple, optionMetadata, searchQuery, setValue, handleOpenChange],
  );

  // Reset clears both the value AND the post-submit invalid presentation so
  // aria-invalid does not keep announcing after the form resets, matching native
  // :user-invalid semantics (form reset clears the user-interacted flag).
  const resetValueAndValidity = useCallback(
    (next: SelectValue) => {
      setNativeInvalid(false);
      setValue(next);
    },
    [setValue],
  );
  useFormReset(wrapperRef, resetValue, resetValueAndValidity, !isValueControlled);

  const hasRequiredValue = Array.isArray(value) ? value.length > 0 : value !== null && value !== "";
  const resolvedAriaInvalid = nativeInvalid && required && !hasRequiredValue ? true : ariaInvalid;

  // Stable ref required: dep of the contextValue memo below.
  const onNativeInvalid = useCallback(() => {
    setNativeInvalid(true);
    (searchInputRef.current ?? triggerRef.current)?.focus();
  }, []);

  const contextValue: SelectContextValue = useMemo(
    () => ({
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
      registerOption,
      unregisterOption,
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
    }),
    [
      isOpen,
      disabled,
      searchable,
      handleOpenChange,
      value,
      multiple,
      searchQuery,
      onSearchChange,
      highlighted,
      setHighlighted,
      selectItem,
      registerOption,
      unregisterOption,
      optionMetadata,
      variant,
      listboxId,
      triggerIdProp,
      resolvedAriaInvalid,
      ariaDescribedBy,
      ariaLabelledBy,
      required,
      onNativeInvalid,
    ],
  );

  return { contextValue, wrapperRef };
}
