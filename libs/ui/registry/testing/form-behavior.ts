import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { expect } from "vitest";

const SUBMIT_LABEL_PATTERN = /submit|save|create|confirm|continue/i;

function resolveDescribedByText(field: HTMLElement): string | null {
  const describedBy = field.getAttribute("aria-describedby");
  if (!describedBy) {
    return null;
  }
  const ownerDocument = field.ownerDocument ?? document;
  const parts: string[] = [];
  for (const id of describedBy.trim().split(/\s+/)) {
    const target = ownerDocument.getElementById(id);
    if (target?.textContent) {
      parts.push(target.textContent.trim());
    }
  }
  return parts.length === 0 ? null : parts.join(" ");
}

function matchesMessage(actual: string | null, expected: string | RegExp): boolean {
  if (actual === null) {
    return false;
  }
  return typeof expected === "string" ? actual.includes(expected) : expected.test(actual);
}

/**
 * Assert the field is in invalid state with the matching message visible via aria-describedby chain.
 * Reads aria-invalid, then resolves any aria-describedby ID -> element -> textContent.
 */
export function expectFieldInvalid(field: HTMLElement, expectedMessage?: string | RegExp): void {
  expect(field, "field should report aria-invalid=\"true\"").toHaveAttribute("aria-invalid", "true");

  if (expectedMessage === undefined) {
    return;
  }

  const describedByText = resolveDescribedByText(field);
  if (matchesMessage(describedByText, expectedMessage)) {
    return;
  }

  const siblingError = findSiblingErrorText(field);
  if (matchesMessage(siblingError, expectedMessage)) {
    return;
  }

  expect(
    describedByText ?? siblingError ?? "",
    `field should expose error message ${String(expectedMessage)} via aria-describedby`,
  ).toMatch(expectedMessage);
}

function findSiblingErrorText(field: HTMLElement): string | null {
  const parent = field.parentElement;
  if (!parent) {
    return null;
  }
  const candidates = parent.querySelectorAll('[role="alert"], [data-slot="field-error"], [aria-live]');
  for (const candidate of candidates) {
    if (candidate.textContent?.trim()) {
      return candidate.textContent.trim();
    }
  }
  return null;
}

/**
 * Assert the field's aria-describedby points to (or includes) the given description id.
 */
export function expectFieldDescribedBy(field: HTMLElement, descriptionId: string): void {
  const describedBy = field.getAttribute("aria-describedby") ?? "";
  const ids = describedBy.trim().split(/\s+/).filter(Boolean);
  expect(ids, `field aria-describedby should include "${descriptionId}"`).toContain(descriptionId);
}

const FILLABLE_ROLES = ["textbox", "searchbox", "spinbutton", "combobox"] as const;

/**
 * Locate a form control by accessible name (label or aria-label) and type into it.
 * Clears existing content first.
 */
export async function fillField(user: UserEvent, name: string | RegExp, value: string): Promise<void> {
  let control: HTMLElement | null = null;
  for (const role of FILLABLE_ROLES) {
    control = screen.queryByRole(role, { name });
    if (control) {
      break;
    }
  }
  if (!control) {
    throw new Error(
      `fillField: no textbox/searchbox/spinbutton/combobox with name ${String(name)} found.`,
    );
  }
  await user.clear(control);
  if (value.length > 0) {
    await user.type(control, value);
  }
}

/**
 * Submit the form by clicking the submit button (default: getByRole("button", { name: /submit|save|create|confirm|continue/i }))
 * or the explicitly-passed button.
 */
export async function submitForm(user: UserEvent, submitButton?: HTMLElement): Promise<void> {
  if (submitButton) {
    await user.click(submitButton);
    return;
  }

  const direct = screen.queryByRole("button", { name: SUBMIT_LABEL_PATTERN });
  if (direct) {
    await user.click(direct);
    return;
  }

  const buttons = screen.getAllByRole("button");
  const fallback = buttons.find((button) => SUBMIT_LABEL_PATTERN.test(button.textContent ?? ""));
  if (!fallback) {
    throw new Error(
      `submitForm: no submit-like button found. Pass an explicit button element. Tried pattern ${String(SUBMIT_LABEL_PATTERN)}.`,
    );
  }
  await user.click(fallback);
}
