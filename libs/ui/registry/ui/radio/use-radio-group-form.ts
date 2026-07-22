"use client";

import { type RefObject, useCallback, useRef, useState } from "react";
import { useFormReset } from "@/hooks/use-form-reset";

export interface UseRadioGroupFormOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  value: string | undefined;
  defaultValue: string | undefined;
  enabledValues: string[];
  required: boolean | undefined;
  isValueControlled: boolean;
  validSelectedValue: string | null;
  resetValue: (value: string | undefined) => void;
  setValue: (next: string) => void;
}

/** Native form reset, required validity, and validation mirror for RadioGroup. */
export function useRadioGroupForm({
  containerRef,
  value,
  defaultValue,
  enabledValues,
  required,
  isValueControlled,
  validSelectedValue,
  resetValue,
  setValue,
}: UseRadioGroupFormOptions) {
  const validationInputRef = useRef<HTMLInputElement>(null);
  const [requiredInvalid, setRequiredInvalid] = useState(false);
  const effectiveRequired = !!required && enabledValues.length > 0;

  const controlledFormReset = isValueControlled
    ? {
        syncResetBaseline: () => {
          for (const input of containerRef.current?.querySelectorAll<HTMLInputElement>(
            'input[data-slot="radio-form-mirror"]',
          ) ?? []) {
            const item = input.nextElementSibling;
            if (!item?.hasAttribute("data-diffgazer-radio-group-item")) continue;
            if (item.closest('[data-slot="radio-group"]') !== containerRef.current) continue;
            input.defaultChecked = input.value === value;
          }
          const validation = validationInputRef.current;
          if (validation) validation.defaultChecked = validSelectedValue !== null;
        },
        onReset: () => setRequiredInvalid(false),
      }
    : undefined;

  const invalidatePendingReset = useFormReset(
    containerRef,
    defaultValue,
    (nextValue) => {
      setRequiredInvalid(false);
      resetValue(nextValue);
    },
    !isValueControlled,
    controlledFormReset,
  );

  const handleValueChange = useCallback(
    (next: string) => {
      invalidatePendingReset();
      setRequiredInvalid(false);
      setValue(next);
    },
    [invalidatePendingReset, setValue],
  );

  const handleRequiredInvalid = useCallback(() => {
    setRequiredInvalid(true);
  }, []);

  return {
    effectiveRequired,
    requiredInvalid,
    validationInputRef,
    invalidatePendingReset,
    handleValueChange,
    handleRequiredInvalid,
    setRequiredInvalid,
  };
}
