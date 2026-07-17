"use client";

import { useRef } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";

export default function FormResetInputExample() {
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultValue = "Initial value";
  const [value, setValue, , resetValue] = useControllableState({ defaultValue });

  const invalidatePendingReset = useFormReset(inputRef, defaultValue, resetValue);

  return (
    <form className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        Display name
        <input
          ref={inputRef}
          className="border border-border bg-background px-3 py-2 text-sm text-foreground"
          value={value}
          onChange={(event) => {
            invalidatePendingReset();
            setValue(event.currentTarget.value);
          }}
        />
      </label>
      <button
        type="reset"
        className="w-fit border border-border bg-muted px-3 py-1.5 font-mono text-sm text-foreground transition-colors hover:bg-background"
      >
        Reset
      </button>
    </form>
  );
}
