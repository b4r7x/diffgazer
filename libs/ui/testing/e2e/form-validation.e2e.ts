import { expect, type Locator, type Page, test } from "@playwright/test";

interface ValidationCase {
  name: string;
  formId: string;
  role: "checkbox" | "radio" | "switch";
  controlName: string;
  expectedEntries: Array<[string, string]>;
}

const cases: ValidationCase[] = [
  {
    name: "Checkbox",
    formId: "checkbox-form",
    role: "checkbox",
    controlName: "Accept terms",
    expectedEntries: [["terms", "accepted"]],
  },
  {
    name: "Switch",
    formId: "switch-form",
    role: "switch",
    controlName: "Enable alerts",
    expectedEntries: [["alerts", "enabled"]],
  },
  {
    name: "Radio",
    formId: "radio-form",
    role: "radio",
    controlName: "Choose standalone",
    expectedEntries: [["standalone", "chosen"]],
  },
  {
    name: "CheckboxGroup",
    formId: "checkbox-group-form",
    role: "checkbox",
    controlName: "Apple",
    expectedEntries: [["fruits", "apple"]],
  },
  {
    name: "named RadioGroup",
    formId: "named-radio-group-form",
    role: "radio",
    controlName: "Red",
    expectedEntries: [["color", "red"]],
  },
  {
    name: "unnamed RadioGroup",
    formId: "unnamed-radio-group-form",
    role: "radio",
    controlName: "Standard",
    expectedEntries: [],
  },
];

async function formEntries(form: Locator): Promise<Array<[string, string]>> {
  return form.evaluate((element) =>
    Array.from(new FormData(element as HTMLFormElement).entries()).map(([key, value]) => [
      key,
      String(value),
    ]),
  );
}

async function opensFixture(page: Page): Promise<void> {
  await page.goto("/testing/fixtures/form-validation.html");
}

for (const validationCase of cases) {
  test(`${validationCase.name} reports validity and focuses its visible owner`, async ({
    page,
  }) => {
    await opensFixture(page);
    const form = page.locator(`#${validationCase.formId}`);
    const control = form.getByRole(validationCase.role, { name: validationCase.controlName });

    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(
      false,
    );
    expect(await formEntries(form)).toEqual([]);

    expect(await form.evaluate((element) => (element as HTMLFormElement).reportValidity())).toBe(
      false,
    );
    await expect(control).toBeFocused();

    await control.click();

    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(
      true,
    );
    expect(await formEntries(form)).toEqual(validationCase.expectedEntries);
  });
}
