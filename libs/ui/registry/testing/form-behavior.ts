import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { expect } from "vitest";

const SUBMIT_LABEL_PATTERN = /submit|save|create|confirm|continue/i;

function resolveDescribedByText(field: HTMLElement): string | null {
  const describedBy = field.getAttribute("aria-describedby");
  if (!describedBy) {
    return null;
  }
  const ownerDocument = field.ownerDocument;
  const parts: string[] = [];
  for (const id of describedBy.trim().split(/\s+/)) {
    const target = ownerDocument.getElementById(id);
    if (target?.textContent) {
      parts.push(target.textContent.trim());
    }
  }
  return parts.length === 0 ? null : parts.join(" ");
}

/**
 * Assert the field is in invalid state with the matching message visible via aria-describedby chain.
 * Reads aria-invalid, then resolves any aria-describedby ID -> element -> textContent.
 */
export function expectFieldInvalid(field: HTMLElement, expectedMessage?: string | RegExp): void {
  expect(field, 'field should report aria-invalid="true"').toHaveAttribute("aria-invalid", "true");

  if (expectedMessage === undefined) {
    return;
  }

  expect(
    resolveDescribedByText(field) ?? "",
    `field should expose error message ${String(expectedMessage)} via aria-describedby`,
  ).toMatch(expectedMessage);
}

/**
 * Assert that a native form reset clears the post-submit invalid presentation.
 * Triggers native validation (form.reportValidity), asserts the control reports
 * aria-invalid, resets the form, then waits for aria-invalid to be cleared —
 * matching native :user-invalid semantics where reset clears the interacted flag.
 */
export async function expectResetClearsInvalid(
  form: HTMLFormElement,
  control: HTMLElement,
): Promise<void> {
  expect(form.reportValidity(), "form should report invalid before reset").toBe(false);
  // Explicit timeout: the default 1000ms flakes for this family under parallel test load.
  await waitFor(
    () =>
      expect(
        control,
        'control should report aria-invalid="true" after failed validation',
      ).toHaveAttribute("aria-invalid", "true"),
    { timeout: 5000 },
  );

  form.reset();

  await waitFor(
    () =>
      expect(control, "form reset should clear aria-invalid").not.toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    { timeout: 5000 },
  );
}

/**
 * Assert the field's aria-describedby points to (or includes) the given description id.
 */
export function expectFieldDescribedBy(field: HTMLElement, descriptionId: string): void {
  const describedBy = field.getAttribute("aria-describedby") ?? "";
  const ids = describedBy.trim().split(/\s+/).filter(Boolean);
  expect(ids, `field aria-describedby should include "${descriptionId}"`).toContain(descriptionId);
}

/**
 * Locate a textbox by accessible name (label or aria-label) and type into it.
 * Clears existing content first.
 */
export async function fillField(
  user: UserEvent,
  name: string | RegExp,
  value: string,
): Promise<void> {
  const control = screen.getByRole("textbox", { name });
  await user.clear(control);
  if (value.length > 0) {
    await user.type(control, value);
  }
}

/**
 * Submit the form by clicking the button whose accessible name matches
 * /submit|save|create|confirm|continue/i.
 */
export async function submitForm(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: SUBMIT_LABEL_PATTERN }));
}
