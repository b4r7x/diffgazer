"use client";

import { type SelectOptionMetadata, useSelectContext } from "./select-context";

function getSubmittedValue(
  value: string | string[] | null,
  options: ReadonlyMap<string, SelectOptionMetadata>,
): string | string[] | null {
  if (Array.isArray(value)) {
    return value.filter((itemValue) => !options.get(itemValue)?.disabled);
  }
  if (value !== null && options.get(value)?.disabled) return null;
  return value;
}

/** Props for the hidden native form controls mirrored by Select. */
interface SelectFormMirrorProps {
  /** Name for the hidden form input that participates in native form submission. */
  name?: string;
  /** Mark the select as required for native form validation. */
  required?: boolean;
  /** Disable the hidden native controls. */
  disabled?: boolean;
}

/** Hidden native select/checkbox controls for form submission and constraint validation. */
export function SelectFormMirror({ name, required, disabled = false }: SelectFormMirrorProps) {
  const { value, options, onNativeInvalid } = useSelectContext("SelectFormMirror");

  if (!name && !required) {
    return null;
  }

  const submittedValue = getSubmittedValue(value, options);
  const logicalMultipleValues = Array.isArray(value) ? value : [];
  const logicalSingleValue = Array.isArray(value) ? null : value;
  const selectedSingleValueIsDisabled = logicalSingleValue !== null && submittedValue === null;

  if (Array.isArray(submittedValue)) {
    return (
      <>
        <select
          name={name}
          data-slot="select-form-mirror"
          multiple
          value={submittedValue}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden={true}
          className="sr-only"
          // Value is driven by the custom select; the no-op keeps this
          // hidden form mirror controlled without React's warning.
          onChange={() => {}}
          onInvalid={(event) => {
            event.preventDefault();
            onNativeInvalid();
          }}
        >
          {logicalMultipleValues.map((v) => (
            <option key={v} value={v} disabled={options.get(v)?.disabled}>
              {v}
            </option>
          ))}
        </select>
        {required && (
          <input
            type="checkbox"
            data-slot="select-required-validation"
            required
            checked={submittedValue.length > 0}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden={true}
            className="sr-only"
            onChange={() => {}}
            onInvalid={(event) => {
              event.preventDefault();
              onNativeInvalid();
            }}
          />
        )}
      </>
    );
  }

  return (
    <select
      name={name}
      data-slot="select-form-mirror"
      value={submittedValue ?? ""}
      required={required}
      disabled={disabled || selectedSingleValueIsDisabled}
      tabIndex={-1}
      aria-hidden={true}
      className="sr-only"
      // Value is driven by the custom select; the no-op keeps this
      // hidden form mirror controlled without React's warning.
      onChange={() => {}}
      onInvalid={(event) => {
        event.preventDefault();
        onNativeInvalid();
      }}
    >
      <option value="" />
      {logicalSingleValue !== null && (
        <option value={logicalSingleValue} disabled={options.get(logicalSingleValue)?.disabled}>
          {logicalSingleValue}
        </option>
      )}
    </select>
  );
}
